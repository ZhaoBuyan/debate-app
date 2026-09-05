// server/src/services/speech.service.ts

import { getDb } from "../database/index.js";
import { CreateSpeechInput, SpeechWithUser } from "../types/index.js";
import aiService from "./ai.service.js";
import sensitiveService from "./sensitive.service.js";
import debateService from "./debate.service.js";

export class SpeechService {
  /**
   * 发表发言（B-03）
   * 保存后由 AI 提炼核心论点并回填 summary（A-01，50字以内）
   */
  async createSpeech(input: CreateSpeechInput): Promise<SpeechWithUser> {
    const { debateId, userId, content, inputType = "text" } = input;

    if (!content || content.trim().length === 0) {
      throw new Error("发言内容不能为空");
    }
    if (content.length > 2000) {
      throw new Error("发言内容过长（最多2000字）");
    }

    const filtered = await sensitiveService.filterText(content.trim());
    const db = await getDb();

    // 1. 检查辩论是否进行中
    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "ongoing") {
      throw new Error("辩论未开始或已结束，无法发言");
    }

    // 2. 检查该用户是否为辩手
    const debater = await db.get<{ side: "A" | "B" }>(
      "SELECT side FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, userId],
    );
    if (!debater) throw new Error("你不是该辩论的辩手，无法发言");

    // 2.5 社区公约·冷静期：加入辩论未满设定时间不可发言
    const remain = await debateService.cooldownRemainMs(debateId, userId);
    if (remain > 0) {
      throw new Error(
        `🧊 本场设有冷静期（社区公约），请先冷静思考，还需 ${Math.ceil(remain / 1000)} 秒后才能发言`,
      );
    }

    // 3. 计算轮次与顺序
    const totalSpeeches = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM speeches WHERE debate_id = ?",
      [debateId],
    );
    const debaterCount = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM debaters WHERE debate_id = ?",
      [debateId],
    );
    const perRound = Math.max(debaterCount?.cnt || 1, 1);
    const count = totalSpeeches?.cnt || 0;
    const round = Math.floor(count / perRound) + 1;
    const orderIndex = (count % perRound) + 1;

    // 4. AI 提炼核心论点（A-01），失败不影响主流程
    let summary: string | null = null;
    try {
      summary = await aiService.summarizeSpeech(filtered);
    } catch (err) {
      console.error("AI 论点提炼失败:", (err as Error).message);
    }

    // 5. 插入发言
    const result = await db.run(
      `INSERT INTO speeches (debate_id, user_id, content, summary, round, order_index, input_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [debateId, userId, filtered, summary, round, orderIndex, inputType],
    );

    // 6. 获取完整发言信息（含用户信息）
    const speech = await db.get<SpeechWithUser>(
      `SELECT s.*, u.username, u.avatar,
              d.side
       FROM speeches s
       JOIN users u ON s.user_id = u.id
       JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
       WHERE s.id = ?`,
      [result.lastID],
    );

    if (!speech) throw new Error("发言保存失败");
    return speech;
  }

  /**
   * 获取某辩论的所有发言（按时间顺序）
   */
  async getSpeechesByDebate(debateId: string): Promise<SpeechWithUser[]> {
    const db = await getDb();
    return db.all<SpeechWithUser[]>(
      `SELECT s.*, u.username, u.avatar,
              d.side
       FROM speeches s
       JOIN users u ON s.user_id = u.id
       JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
       WHERE s.debate_id = ?
       ORDER BY s.created_at ASC, s.id ASC`,
      [debateId],
    );
  }
}

export default new SpeechService();
