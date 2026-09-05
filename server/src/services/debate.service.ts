// server/src/services/debate.service.ts

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database/index.js";
import {
  Debate,
  DebateDetail,
  CreateDebateInput,
  DebaterWithUser,
  DebateType,
  DebateReport,
} from "../types/index.js";
import { SpeechWithUser } from "../types/speech.js";
import { MessageWithUser, VoteStats, SupportStats } from "../types/index.js";
import supportService from "./support.service.js";
import voteService from "./vote.service.js";
import chatService from "./chat.service.js";
import aiService from "./ai.service.js";

const MAX_DEBATERS: Record<DebateType, number> = {
  classic: 8,
  quick1v1: 2,
};
const MAX_PER_SIDE: Record<DebateType, number> = {
  classic: 4,
  quick1v1: 1,
};

/** 段位门槛（U-07：青铜→白银→黄金→铂金→钻石→王者） */
const RANK_THRESHOLDS: { rank: string; minPoints: number }[] = [
  { rank: "王者", minPoints: 800 },
  { rank: "钻石", minPoints: 500 },
  { rank: "铂金", minPoints: 300 },
  { rank: "黄金", minPoints: 150 },
  { rank: "白银", minPoints: 50 },
  { rank: "青铜", minPoints: 0 },
];

/** 根据积分计算段位 */
export const rankOfPoints = (points: number): string =>
  RANK_THRESHOLDS.find((t) => points >= t.minPoints)?.rank || "青铜";

export interface DebateRoomData {
  debate: DebateDetail;
  debaters: DebaterWithUser[];
  speeches: SpeechWithUser[];
  messages: MessageWithUser[];
  votes: VoteStats;
  support: SupportStats;
  supportHistory: any[];
  emotions: Record<string, number>;
  turn: { round: number; index: number; speaker: DebaterWithUser | null };
}

export class DebateService {
  /**
   * 创建辩题（D-01，创建后进入 pending 等待管理员审核，D-03）
   */
  async createDebate(
    input: CreateDebateInput,
    creatorId: string,
  ): Promise<{ id: string }> {
    const {
      title,
      description,
      category = "general",
      sideA = "正方",
      sideB = "反方",
      type = "classic",
    } = input;

    if (!title || title.trim().length < 5) {
      throw new Error("辩题标题至少需要5个字符");
    }
    if (description && description.length > 500) {
      throw new Error("辩题描述过长（最多500字）");
    }
    if (type !== "classic" && type !== "quick1v1") {
      throw new Error("辩论形式不合法");
    }

    const db = await getDb();
    const id = uuidv4();
    const now = Date.now();

    await db.run(
      `INSERT INTO debates (id, title, description, category, creator_id, host_id, side_a_name, side_b_name, start_time, status, debate_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        id,
        title.trim(),
        description ? description.trim() : null,
        category,
        creatorId,
        creatorId,
        sideA,
        sideB,
        now + 30 * 60 * 1000,
        type,
        now,
      ],
    );

    return { id };
  }

  /**
   * 获取辩题列表（支持筛选，SRS D-04）
   */
  async getDebates(
    status?: string,
    category?: string,
  ): Promise<DebateDetail[]> {
    const db = await getDb();
    let sql = `
      SELECT d.*, u.username as creator_name,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id AND side = 'A') as side_a_count,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id AND side = 'B') as side_b_count
      FROM debates d
      LEFT JOIN users u ON d.creator_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== "all") {
      sql += " AND d.status = ?";
      params.push(status);
    }
    if (category && category !== "all") {
      sql += " AND d.category = ?";
      params.push(category);
    }

    sql += " ORDER BY d.created_at DESC LIMIT 100";

    const debates = await db.all<DebateDetail[]>(sql, params);
    await this.attachHot(debates);
    return debates;
  }

  /**
   * 附加热度指标（内容运营）：
   * hot = 辩手×3 + 发言×2 + 情绪×1 + 支持人数×1
   */
  private async attachHot(debates: DebateDetail[]): Promise<void> {
    if (debates.length === 0) return;
    const db = await getDb();
    const ids = debates.map((d) => d.id);
    const marks = ids.map(() => "?").join(",");
    const pick = async (table: string, col: string): Promise<Map<string, number>> => {
      const rows = await db.all<{ k: string; c: number }[]>(
        `SELECT ${col} as k, COUNT(*) c FROM ${table} WHERE ${col} IN (${marks}) GROUP BY ${col}`,
        ids,
      );
      const m = new Map<string, number>();
      rows.forEach((r) => m.set(String(r.k), r.c));
      return m;
    };
    const [speech, emotion, support] = await Promise.all([
      pick("speeches", "debate_id"),
      pick("emotions", "debate_id"),
      pick("support_rates", "debate_id"),
    ]);
    for (const d of debates) {
      const dc = (d as any).debater_count || 0;
      const sc = speech.get(d.id) || 0;
      const ec = emotion.get(d.id) || 0;
      const sup = support.get(d.id) || 0;
      (d as any).speech_count = sc;
      (d as any).emotion_count = ec;
      (d as any).support_count = sup;
      (d as any).hot = dc * 3 + sc * 2 + ec + sup;
    }
  }

  /**
   * 内容运营榜单（公开）：编辑精选 / 正在直播 / 精华复盘（高热度兜底）
   */
  async getCuratedBoard() {
    const db = await getDb();
    const rows = await db.all<any[]>(
      `SELECT d.*, u.username as creator_name,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count
       FROM debates d
       LEFT JOIN users u ON u.id = d.creator_id
       WHERE d.status IN ('waiting', 'ongoing', 'finished')
       ORDER BY d.created_at DESC LIMIT 100`,
    );
    await this.attachHot(rows);

    const featured = rows
      .filter((d: any) => d.curated === 1)
      .sort(
        (a: any, b: any) =>
          (b.curated_at || b.created_at) - (a.curated_at || a.created_at),
      )
      .slice(0, 5);
    const live = rows
      .filter((d: any) => d.status === "ongoing")
      .sort((a: any, b: any) => b.hot - a.hot)
      .slice(0, 3);
    const featuredIds = new Set(featured.map((f: any) => f.id));
    const topFinished = rows
      .filter((d: any) => d.status === "finished" && !featuredIds.has(d.id) && d.hot > 0)
      .sort((a: any, b: any) => b.hot - a.hot)
      .slice(0, 4);
    return { featured, live, topFinished };
  }

  /**
   * 获取辩题详情（含辩手、发言、支持率、投票等）
   */
  async getDebateById(id: string): Promise<DebateDetail | null> {
    const db = await getDb();
    const debate = await db.get<DebateDetail>(
      `SELECT d.*, u.username as creator_name
       FROM debates d
       LEFT JOIN users u ON d.creator_id = u.id
       WHERE d.id = ?`,
      [id],
    );
    if (!debate) return null;

    debate.debaters = await this.getDebatersOf(id);
    debate.speeches = await db.all<SpeechWithUser[]>(
      `SELECT s.*, u.username, u.avatar,
              d.side
       FROM speeches s
       JOIN users u ON s.user_id = u.id
       JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
       WHERE s.debate_id = ?
       ORDER BY s.created_at ASC, s.id ASC`,
      [id],
    );
    return debate;
  }

  /** 辩手（交替顺序 A1 B1 A2 B2 …） */
  private async getDebatersOf(debateId: string): Promise<DebaterWithUser[]> {
    const db = await getDb();
    const rows = await db.all<DebaterWithUser[]>(
      `SELECT d.*, u.username, u.avatar, u.rank
       FROM debaters d
       JOIN users u ON u.id = d.user_id
       WHERE d.debate_id = ?
       ORDER BY d.side ASC, d.order_index ASC`,
      [debateId],
    );
    const sideA = rows.filter((r) => r.side === "A");
    const sideB = rows.filter((r) => r.side === "B");
    const interleaved: DebaterWithUser[] = [];
    for (let i = 0; i < Math.max(sideA.length, sideB.length); i++) {
      if (sideA[i]) interleaved.push(sideA[i]);
      if (sideB[i]) interleaved.push(sideB[i]);
    }
    return interleaved;
  }

  /**
   * 聚合辩论房间完整状态（WebSocket room_state / REST 详情共用）
   */
  async getRoomData(debateId: string): Promise<DebateRoomData> {
    const db = await getDb();
    const debate = await this.getDebateById(debateId);
    if (!debate) throw new Error("辩题不存在");

    const debaters = debate.debaters || [];
    const speeches = debate.speeches || [];
    const messages = await chatService.getMessages(debateId);
    const votes = await voteService.getStats(debateId);
    const support = await supportService.getStats(debateId);
    const supportHistory = await supportService.getHistory(debateId);
    const emotions = await chatService.getEmotionStats(debateId);

    return {
      debate,
      debaters,
      speeches,
      messages: messages.reverse(), // 旧 → 新
      votes,
      support,
      supportHistory,
      emotions,
      turn: this.computeTurn(debaters, speeches.length),
    };
  }

  /**
   * 计算当前轮次与下一位发言者（SRS B-01: A1→B1→A2→B2→…）
   * 每轮每人发言一次；全部发完则进入下一轮
   */
  computeTurn(
    debaters: DebaterWithUser[],
    speechCount: number,
  ): DebateRoomData["turn"] {
    if (debaters.length === 0) {
      return { round: 1, index: 0, speaker: null };
    }
    const round = Math.floor(speechCount / debaters.length) + 1;
    const index = speechCount % debaters.length;
    return { round, index, speaker: debaters[index] || null };
  }

  /**
   * 加入辩论（D-06：标准每方4人共8人 / 1v1 每方1人共2人；满员自动开始 D-07）
   */
  async joinDebate(
    debateId: string,
    userId: string,
    side: "A" | "B",
  ): Promise<{ started: boolean }> {
    const db = await getDb();

    const debate = await db.get<{ status: string; title: string; debate_type: DebateType }>(
      "SELECT status, title, debate_type FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "waiting") {
      throw new Error("辩论未在报名阶段（waiting），无法加入");
    }
    const type: DebateType = debate.debate_type || "classic";
    const maxSide = MAX_PER_SIDE[type];
    const maxTotal = MAX_DEBATERS[type];

    const existing = await db.get(
      "SELECT id FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, userId],
    );
    if (existing) throw new Error("你已加入该辩论");

    const sideCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM debaters WHERE debate_id = ? AND side = ?",
      [debateId, side],
    );
    if ((sideCount?.cnt || 0) >= maxSide) {
      throw new Error(`该阵营已满（每方最多${maxSide}人）`);
    }

    const totalCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM debaters WHERE debate_id = ?",
      [debateId],
    );
    if ((totalCount?.cnt || 0) >= maxTotal) {
      throw new Error(`辩手已满（最多${maxTotal}人）`);
    }

    const orderIndex = (sideCount?.cnt || 0) + 1;
    await db.run(
      `INSERT INTO debaters (debate_id, user_id, side, order_index) VALUES (?, ?, ?, ?)`,
      [debateId, userId, side, orderIndex],
    );

    // 满员自动开始
    const newCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM debaters WHERE debate_id = ?",
      [debateId],
    );
    if ((newCount?.cnt || 0) >= maxTotal) {
      await this.startDebate(debateId);
      return { started: true };
    }
    return { started: false };
  }

  /**
   * 查询辩手冷静期剩余毫秒（社区公约：加入后需等待 cool_down_minutes 才能发言）
   * @returns 0 表示无需等待
   */
  async cooldownRemainMs(debateId: string, userId: string): Promise<number> {
    const db = await getDb();
    const row = await db.get<{ cool_down_minutes: number; joined_at: number }>(
      `SELECT d.cool_down_minutes, t.joined_at
       FROM debates d
       JOIN debaters t ON t.debate_id = d.id AND t.user_id = ?
       WHERE d.id = ?`,
      [userId, debateId],
    );
    if (!row || !row.cool_down_minutes || row.cool_down_minutes <= 0) return 0;
    const waitUntil = row.joined_at * 1000 + row.cool_down_minutes * 60 * 1000;
    return Math.max(0, waitUntil - Date.now());
  }

  /**
   * 评估辩论结果（不落库）：阵营投票胜负 + 最佳辩手最高票
   * 供结算与重辩链聚合页共用，保证判定规则单一来源
   */
  async evaluateDebateResult(debateId: string): Promise<{
    winnerSide: "A" | "B" | null;
    bestDebaterId: string | null;
    sideVotes: { side: "A" | "B"; cnt: number }[];
    bestVotes: { target_user_id: string; cnt: number }[];
  }> {
    const db = await getDb();
    // 阵营胜负：票多者胜；单边有票即胜；两边有票且相等为平局
    const sideVotes = await db.all<{ side: "A" | "B"; cnt: number }[]>(
      `SELECT side, COUNT(*) cnt FROM votes_side WHERE debate_id = ? GROUP BY side`,
      [debateId],
    );
    let winnerSide: "A" | "B" | null = null;
    if (sideVotes.length === 2 && sideVotes[0].cnt !== sideVotes[1].cnt) {
      winnerSide =
        sideVotes[0].cnt > sideVotes[1].cnt ? sideVotes[0].side : sideVotes[1].side;
    } else if (sideVotes.length === 1 && sideVotes[0].cnt > 0) {
      winnerSide = sideVotes[0].side;
    }
    // 最佳辩手：票数最高（须 >0），并列取先投者（id 最小）
    const bestVotes = await db.all<{ target_user_id: string; cnt: number }[]>(
      `SELECT target_user_id, COUNT(*) cnt FROM votes_best
       WHERE debate_id = ? GROUP BY target_user_id ORDER BY cnt DESC, MIN(id) ASC LIMIT 1`,
      [debateId],
    );
    const bestDebaterId =
      bestVotes.length > 0 && bestVotes[0].cnt > 0 ? bestVotes[0].target_user_id : null;
    return { winnerSide, bestDebaterId, sideVotes, bestVotes };
  }

  /**
   * 辩论结算（积分/段位/胜负）：幂等，仅对未结算的 finished 辩论执行
   * 规则：阵营投票胜方辩手 +20，败方 +10，平局/无人投票 +10（参与分）；
   *       最佳辩手（票数最高且>0）额外 +30
   */
  async settleDebate(
    debateId: string,
    actorId?: string,
  ): Promise<{
    winnerSide: "A" | "B" | null;
    bestDebaterId: string | null;
    pointsGiven: Record<string, number>;
  }> {
    const db = await getDb();
    const debate = await db.get<{ status: string; settled: number; title: string }>(
      "SELECT status, settled, title FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "finished") throw new Error("辩论尚未结束，无法结算");
    if (debate.settled) {
      return { winnerSide: null, bestDebaterId: null, pointsGiven: {} };
    }

    // 阵营胜负 / 最佳辩手判定（与聚合页共用同一规则）
    const { winnerSide, bestDebaterId } = await this.evaluateDebateResult(debateId);

    // 结算每位辩手
    const debaters = await db.all<{ user_id: string; side: "A" | "B" }[]>(
      "SELECT user_id, side FROM debaters WHERE debate_id = ?",
      [debateId],
    );
    const pointsGiven: Record<string, number> = {};
    for (const d of debaters) {
      let gain = 10; // 参与分
      if (winnerSide) {
        if (d.side === winnerSide) {
          gain = 20;
        }
      }
      if (d.user_id === bestDebaterId) gain += 30;

      const user = await db.get<{ points: number }>(
        "SELECT points FROM users WHERE id = ?",
        [d.user_id],
      );
      const newPoints = (user?.points || 0) + gain;
      await db.run("UPDATE users SET points = ? WHERE id = ?", [newPoints, d.user_id]);
      if (winnerSide) {
        await db.run(
          d.side === winnerSide
            ? "UPDATE users SET wins = wins + 1 WHERE id = ?"
            : "UPDATE users SET losses = losses + 1 WHERE id = ?",
          [d.user_id],
        );
      }
      // 段位随积分自动重算（U-07）
      const newRank = rankOfPoints(newPoints);
      await db.run(
        "UPDATE users SET rank = ? WHERE id = ? AND rank != ?",
        [newRank, d.user_id, newRank],
      );
      pointsGiven[d.user_id] = gain;
    }

    await db.run("UPDATE debates SET settled = 1 WHERE id = ?", [debateId]);
    if (actorId) {
      await db.run(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
         VALUES (?, 'settle_debate', 'debate', ?, ?)`,
        [actorId, debateId, `结算辩题《${debate.title}》，胜方：${winnerSide || "平局"}`],
      );
    }
    return { winnerSide, bestDebaterId, pointsGiven };
  }

  /**
   * 赛后 AI 报告（A-03）：辩论结束时生成并落库，懒生成兜底（幂等）
   */
  async getOrCreateReport(debateId: string): Promise<DebateReport | null> {
    const db = await getDb();
    const debate = await db.get<{ status: string; title: string }>(
      "SELECT status, title FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");

    const existing = await db.get<DebateReport>(
      "SELECT * FROM debate_reports WHERE debate_id = ?",
      [debateId],
    );
    if (existing) return existing;
    if (debate.status !== "finished") return null;

    const speeches = await db.all<{ side: "A" | "B"; username: string; content: string }[]>(
      `SELECT d.side AS side, u.username, s.content
       FROM speeches s
       JOIN users u ON u.id = s.user_id
       JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
       WHERE s.debate_id = ?
       ORDER BY s.created_at ASC, s.id ASC`,
      [debateId],
    );
    const reportText = await aiService.generateReport(debate.title, speeches);
    await db.run(
      "INSERT OR IGNORE INTO debate_reports (debate_id, report) VALUES (?, ?)",
      [debateId, reportText],
    );
    return (await db.get<DebateReport>(
      "SELECT * FROM debate_reports WHERE debate_id = ?",
      [debateId],
    ))!;
  }

  /** 开始辩论：waiting → ongoing */
  async startDebate(debateId: string): Promise<void> {
    const db = await getDb();
    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status === "ongoing") return;
    if (debate.status !== "waiting") {
      throw new Error(`当前状态（${debate.status}）无法开始辩论`);
    }
    await db.run(
      `UPDATE debates SET status = 'ongoing', start_time = ? WHERE id = ?`,
      [Date.now(), debateId],
    );
  }

  /**
   * 自动开始到期的辩论（D-07：30分钟后由系统启动）
   * 由启动定时器周期性调用
   */
  async autoStartDue(): Promise<string[]> {
    const db = await getDb();
    const due = await db.all<{ id: string }[]>(
      `SELECT id FROM debates
       WHERE status = 'waiting' AND start_time <= ?`,
      [Date.now()],
    );
    const started: string[] = [];
    for (const d of due) {
      await this.startDebate(d.id);
      started.push(d.id);
    }
    return started;
  }

  /**
   * 申请重辩（D-09：复制为新的待审核辩题，带 parent_id）
   */
  async restartDebate(debateId: string, userId: string): Promise<{ id: string }> {
    const db = await getDb();
    const debate = await db.get<Debate>(
      "SELECT * FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "finished") throw new Error("只有已结束的辩论才能申请重辩");

    const newId = uuidv4();
    await db.run(
      `INSERT INTO debates
        (id, title, description, category, creator_id, host_id, side_a_name, side_b_name,
         status, debate_type, start_time, parent_id, repeat_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        newId,
        debate.title,
        debate.description,
        debate.category,
        userId,
        null,
        debate.side_a_name,
        debate.side_b_name,
        debate.debate_type || "classic",
        Date.now() + 30 * 60 * 1000,
        debate.id,
        (debate.repeat_count || 0) + 1,
        Date.now(),
      ],
    );
    return { id: newId };
  }

  /**
   * 推荐辩题（D-08 每日推荐；is_recommended 标记或最新结束的）
   */
  async getRecommended() {
    const db = await getDb();
    return db.get(
      `SELECT d.*, u.username as creator_name,
        (SELECT COUNT(*) FROM speeches WHERE debate_id = d.id) as speech_count
       FROM debates d
       LEFT JOIN users u ON u.id = d.creator_id
       WHERE d.status = 'finished'
       ORDER BY (d.is_recommended = 1) DESC, d.end_time DESC
       LIMIT 1`,
    );
  }

  /**
   * 重辩链聚合（知识沉淀：同一辩题的历次交锋形成可对比的公共讨论知识库）
   * 从任意一场（root 或后代）出发，上溯到首场，再沿 parent_id 收集全部后续重辩场次。
   * 每场附：胜负评估 / 阵营票数 / 最佳票数 / 发言数 / 支持率终值 / 是否已结算
   */
  async getDebateChain(debateId: string) {
    const db = await getDb();
    const start = await db.get<{ id: string; parent_id: string | null }>(
      "SELECT id, parent_id FROM debates WHERE id = ?",
      [debateId],
    );
    if (!start) throw new Error("辩题不存在");

    // 1) 上溯至链首
    let cursor: string | null = start.id;
    const chainIds: string[] = [];
    for (let i = 0; i < 200 && cursor; i++) {
      chainIds.unshift(cursor);
      const row: { parent_id: string | null } | undefined = await db.get(
        "SELECT parent_id FROM debates WHERE id = ?",
        [cursor],
      );
      cursor = row?.parent_id || null;
    }

    // 2) 从链首沿 parent_id 收集后代（线性：一次重辩即一条 parent 子链）
    cursor = chainIds[chainIds.length - 1];
    for (let i = 0; i < 200 && cursor; i++) {
      const child: { id: string } | undefined = await db.get(
        "SELECT id FROM debates WHERE parent_id = ? ORDER BY created_at ASC, id ASC LIMIT 1",
        [cursor],
      );
      if (!child || chainIds.includes(child.id)) break;
      chainIds.push(child.id);
      cursor = child.id;
    }

    // 3) 批量取详情与计数
    const marks = chainIds.map(() => "?").join(",");
    const debates = await db.all<any[]>(
      `SELECT d.*, u.username as creator_name,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count,
        (SELECT COUNT(*) FROM speeches WHERE debate_id = d.id) as speech_count,
        (SELECT COUNT(*) FROM emotions WHERE debate_id = d.id) as emotion_count
       FROM debates d
       LEFT JOIN users u ON u.id = d.creator_id
       WHERE d.id IN (${marks})
       ORDER BY d.created_at ASC`,
      chainIds,
    );

    const items = [];
    for (const d of debates) {
      let result = null;
      if (d.status === "finished") {
        const r = await this.evaluateDebateResult(d.id);
        const support = await supportService.getStats(d.id);
        result = {
          winnerSide: r.winnerSide,
          bestDebaterId: r.bestDebaterId,
          sideA: r.sideVotes.find((v) => v.side === "A")?.cnt || 0,
          sideB: r.sideVotes.find((v) => v.side === "B")?.cnt || 0,
          supportRateA: support.rateA,
          supportTotal: support.total,
        };
      }
      items.push({
        id: d.id,
        title: d.title,
        description: d.description,
        category: d.category,
        status: d.status,
        debate_type: d.debate_type,
        start_time: d.start_time,
        end_time: d.end_time,
        creator_name: d.creator_name,
        debater_count: d.debater_count,
        speech_count: d.speech_count,
        emotion_count: d.emotion_count,
        settled: d.settled,
        cool_down_minutes: d.cool_down_minutes,
        result,
      });
    }

    return { rootId: chainIds[0], items };
  }

  /**
   * 相关辩题推荐（辩论室侧栏，KN-03 基础版）
   * 打分：同分类 +8；标题 2-gram 词重叠每个 +2；其余按时间
   * 排除：自身、pending/rejected、以及同一重辩链上的场次（避免推荐同名辩题）
   */
  async getRelatedDebates(debateId: string, limit = 4) {
    const db = await getDb();
    const cur = await db.get<{ category: string; title: string }>(
      "SELECT category, title FROM debates WHERE id = ?",
      [debateId],
    );
    if (!cur) throw new Error("辩题不存在");

    // 排除自身 + 同一重辩链（前代与后代标题相同）
    const chain = await this.getDebateChain(debateId);
    const excluded = chain.items.map((i: any) => i.id);
    const marks = excluded.map(() => "?").join(",");

    const rows = await db.all<any[]>(
      `SELECT d.id, d.title, d.category, d.status, d.debate_type, d.created_at,
              d.cool_down_minutes, u.username as creator_name,
              (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count,
              (SELECT COUNT(*) FROM speeches WHERE debate_id = d.id) as speech_count
       FROM debates d
       LEFT JOIN users u ON u.id = d.creator_id
       WHERE d.status NOT IN ('pending', 'rejected')
         AND d.id NOT IN (${marks})
       ORDER BY d.created_at DESC
       LIMIT 40`,
      excluded,
    );

    // 标题 2-gram（中文启发式）
    const grams = (s: string): Set<string> => {
      const g = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
      return g;
    };
    const curGrams = grams(cur.title);
    const overlap = (title: string) => {
      let n = 0;
      for (const g of grams(title)) if (curGrams.has(g)) n++;
      return n;
    };

    const scored = rows
      .map((r) => ({
        ...r,
        score: (r.category === cur.category ? 8 : 0) + overlap(r.title) * 2,
      }))
      .sort(
        (a, b) =>
          b.score - a.score || (b.created_at as number) - (a.created_at as number),
      )
      .slice(0, limit);
    return scored;
  }
}

export default new DebateService();
