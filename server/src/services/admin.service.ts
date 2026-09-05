// server/src/services/admin.service.ts

import { getDb } from "../database/index.js";
import supportService from "./support.service.js";
import debateService from "./debate.service.js";

const TEMP_BAN_MS = 7 * 24 * 60 * 60 * 1000; // 临时封禁 7 天
const AUTO_BAN_MS = 7 * 24 * 60 * 60 * 1000; // 3次警告自动封禁 7 天

export class AdminService {
  /** 记录管理员操作日志（SRS AD-09） */
  async logAction(
    adminId: string,
    actionType: string,
    targetType: string,
    targetId?: string | number,
    details?: string,
  ): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, actionType, targetType, targetId === undefined ? null : String(targetId), details || null],
    );
  }

  // ---------- 用户管理（AD-02/03/04） ----------

  /** 用户列表（支持搜索与分页） */
  async listUsers(search?: string, page = 1, pageSize = 20) {
    const db = await getDb();
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (search && search.trim()) {
      where += " AND (u.username LIKE ? OR u.id LIKE ?)";
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    const total = await db.get<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM users u ${where}`,
      params,
    );
    const offset = (page - 1) * pageSize;
    const list = await db.all(
      `SELECT u.id, u.username, u.role, u.avatar, u.points, u.rank, u.wins, u.losses,
              u.is_banned, u.banned_reason, u.banned_until, u.warning_count,
              u.last_login_at, u.created_at
       FROM users u ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );
    return { list, total: total?.cnt || 0, page, pageSize };
  }

  /** 封禁用户（durationMs 为空 = 永久封禁，SRS U-04） */
  async banUser(adminId: string, userId: string, reason?: string, durationMs?: number | null) {
    const db = await getDb();
    if (userId === adminId) throw new Error("不能封禁自己");
    const target = await db.get<{ role: string; is_banned: number }>(
      "SELECT role, is_banned FROM users WHERE id = ?",
      [userId],
    );
    if (!target) throw new Error("用户不存在");
    if (target.is_banned) throw new Error("该用户已被封禁");
    if (target.role === "super_admin") throw new Error("不能封禁超级管理员");

    const permanent = durationMs === null || durationMs === undefined;
    const bannedUntil = permanent ? null : Date.now() + durationMs;
    await db.run(
      `UPDATE users SET is_banned = 1, banned_reason = ?, banned_at = ?, banned_until = ?
       WHERE id = ?`,
      [reason || (permanent ? "永久封禁" : "临时封禁"), Date.now(), bannedUntil, userId],
    );
    await this.logAction(
      adminId,
      permanent ? "ban_user_permanent" : "ban_user_temp",
      "user",
      userId,
      reason || "",
    );
    return { permanent, bannedUntil };
  }

  /** 解封用户 */
  async unbanUser(adminId: string, userId: string) {
    const db = await getDb();
    const target = await db.get<{ is_banned: number }>(
      "SELECT is_banned FROM users WHERE id = ?",
      [userId],
    );
    if (!target) throw new Error("用户不存在");
    if (!target.is_banned) throw new Error("该用户未被封禁");
    await db.run(
      `UPDATE users SET is_banned = 0, banned_reason = NULL, banned_at = NULL, banned_until = NULL
       WHERE id = ?`,
      [userId],
    );
    await this.logAction(adminId, "unban_user", "user", userId);
  }

  /** 警告用户（满3次自动封禁 7 天，SRS U-05） */
  async warnUser(adminId: string, userId: string, reason?: string) {
    const db = await getDb();
    if (userId === adminId) throw new Error("不能警告自己");
    const target = await db.get<{ role: string; warning_count: number }>(
      "SELECT role, warning_count FROM users WHERE id = ?",
      [userId],
    );
    if (!target) throw new Error("用户不存在");
    if (target.role === "super_admin") throw new Error("不能警告超级管理员");

    const newCount = target.warning_count + 1;
    await db.run("UPDATE users SET warning_count = ? WHERE id = ?", [
      newCount,
      userId,
    ]);
    await this.logAction(
      adminId,
      "warn_user",
      "user",
      userId,
      `${reason || "警告"}（第 ${newCount} 次）`,
    );

    // 累计 3 次自动封禁
    if (newCount >= 3) {
      const until = Date.now() + AUTO_BAN_MS;
      await db.run(
        `UPDATE users SET is_banned = 1, banned_reason = '警告满3次自动封禁', banned_at = ?, banned_until = ?
         WHERE id = ?`,
        [Date.now(), until, userId],
      );
      await this.logAction(adminId, "auto_ban_user", "user", userId, "警告满3次");
      return { warningCount: newCount, autoBanned: true, bannedUntil: until };
    }
    return { warningCount: newCount, autoBanned: false };
  }

  // ---------- 辩题审核（AD-01） ----------

  /** 待审核辩题列表 */
  async listPendingDebates() {
    const db = await getDb();
    return db.all(
      `SELECT d.*, u.username as creator_name,
        (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count
       FROM debates d
       LEFT JOIN users u ON u.id = d.creator_id
       WHERE d.status = 'pending'
       ORDER BY d.created_at ASC`,
    );
  }

  /** 审核通过：pending → waiting，并设定开始时间（30分钟后） */
  async approveDebate(
    adminId: string,
    debateId: string,
    note?: string,
    coolDownMinutes = 0,
  ) {
    const db = await getDb();
    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "pending") throw new Error("该辩题不在待审核状态");

    const minutes = Math.max(
      0,
      Math.min(60, Number(coolDownMinutes) || 0),
    );
    // 创建者自动成为主持人并加入正方第1位
    const creator = await db.get<{ creator_id: string }>(
      "SELECT creator_id FROM debates WHERE id = ?",
      [debateId],
    );
    await db.run(
      `UPDATE debates SET status = 'waiting', start_time = ?, admin_note = ?, cool_down_minutes = ?
       WHERE id = ?`,
      [Date.now() + 30 * 60 * 1000, note || null, minutes, debateId],
    );
    const existing = await db.get(
      "SELECT id FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, creator!.creator_id],
    );
    if (!existing) {
      await db.run(
        `INSERT INTO debaters (debate_id, user_id, side, order_index) VALUES (?, ?, 'A', 1)`,
        [debateId, creator!.creator_id],
      );
    }
    await this.logAction(
      adminId,
      "approve_debate",
      "debate",
      debateId,
      `${note || ""}${minutes > 0 ? `；冷静期 ${minutes} 分钟` : ""}`,
    );
  }

  /** 审核拒绝 */
  async rejectDebate(adminId: string, debateId: string, note?: string) {
    const db = await getDb();
    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status !== "pending") throw new Error("该辩题不在待审核状态");
    await db.run(
      `UPDATE debates SET status = 'rejected', admin_note = ? WHERE id = ?`,
      [note || "未通过审核", debateId],
    );
    await this.logAction(adminId, "reject_debate", "debate", debateId, note || "");
  }

  /** 强制结束辩论（B-07 / AD-12）：结束 + 快照 + 结算积分段位 + 生成 AI 赛后报告 */
  async forceEndDebate(actorId: string, debateId: string, reason?: string) {
    const db = await getDb();
    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (debate.status === "finished") throw new Error("该辩论已结束");
    await db.run(
      `UPDATE debates SET status = 'finished', end_time = ? WHERE id = ?`,
      [Date.now(), debateId],
    );
    // 结束时记录支持率快照
    await supportService.snapshot(debateId, "debate_end");
    // 积分/段位结算（幂等，日志由下方统一记录）
    try {
      const result = await debateService.settleDebate(debateId);
      if (Object.keys(result.pointsGiven).length > 0) {
        await db.run(
          `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
           VALUES (?, 'settle_debate', 'debate', ?, ?)`,
          [actorId, debateId, `积分结算完成：胜方 ${result.winnerSide || "平局"}；${JSON.stringify(result.pointsGiven)}`],
        );
      }
    } catch (err) {
      console.error("辩论结算失败:", (err as Error).message);
    }
    // AI 赛后报告（异步生成，失败可经 GET 接口懒生成兜底）
    debateService
      .getOrCreateReport(debateId)
      .catch((err) => console.error("赛后报告生成失败:", err.message));

    await this.logAction(
      actorId,
      "force_end_debate",
      "debate",
      debateId,
      reason || "",
    );
  }

  // ---------- 内容管理（AD-05） ----------

  /** 删除（隐藏）违规发言 */
  async deleteSpeech(adminId: string, speechId: number) {
    const db = await getDb();
    const speech = await db.get<{ debate_id: string; user_id: string }>(
      "SELECT debate_id, user_id FROM speeches WHERE id = ?",
      [speechId],
    );
    if (!speech) throw new Error("发言不存在");
    await db.run(
      `UPDATE speeches SET content = '[该发言因违规已被删除]', summary = NULL WHERE id = ?`,
      [speechId],
    );
    await this.logAction(adminId, "delete_speech", "speech", speechId);
  }

  /** 管理员日志查询 */
  async listLogs(limit = 100) {
    const db = await getDb();
    return db.all(
      `SELECT l.*, u.username as admin_name
       FROM admin_logs l
       LEFT JOIN users u ON u.id = l.admin_id
       ORDER BY l.created_at DESC LIMIT ?`,
      [limit],
    );
  }

  // ---------- 内容运营：编辑精选 ----------

  /** 设置 / 取消编辑精选（curated） */
  async toggleCurate(adminId: string, debateId: string, curated: boolean) {
    const db = await getDb();
    const debate = await db.get<{ status: string; title: string }>(
      "SELECT status, title FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");
    if (!curated && debate.status === "pending") {
      throw new Error("待审核辩题不能精选");
    }
    if (curated && (debate.status === "pending" || debate.status === "rejected")) {
      throw new Error("待审核/已拒绝的辩题不能设为精选");
    }
    await db.run(
      `UPDATE debates SET curated = ?, curated_at = ? WHERE id = ?`,
      [curated ? 1 : 0, curated ? Date.now() : null, debateId],
    );
    await this.logAction(
      adminId,
      curated ? "curate_debate" : "uncurate_debate",
      "debate",
      debateId,
      `《${debate.title}》`,
    );
  }

  // ---------- 公告管理（AD-08） ----------
  async listAnnouncements(activeOnly = false) {
    const db = await getDb();
    if (activeOnly) {
      return db.all(
        `SELECT * FROM announcements
         WHERE is_active = 1 AND (start_at IS NULL OR start_at <= ?)
           AND (end_at IS NULL OR end_at > ?)
         ORDER BY priority DESC, created_at DESC`,
        [Date.now(), Date.now()],
      );
    }
    return db.all(`SELECT * FROM announcements ORDER BY created_at DESC`);
  }

  async createAnnouncement(
    adminId: string,
    input: { title: string; content: string; priority?: number },
  ) {
    const title = (input.title || "").trim();
    const content = (input.content || "").trim();
    if (!title || !content) throw new Error("标题和内容不能为空");
    if (title.length > 60) throw new Error("公告标题过长（最多60字）");
    if (content.length > 2000) throw new Error("公告内容过长（最多2000字）");
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO announcements (title, content, priority, is_active) VALUES (?, ?, ?, 1)`,
      [title, content, input.priority || 0],
    );
    await this.logAction(adminId, "create_announcement", "announcement", result.lastID!);
    return result.lastID!;
  }

  async toggleAnnouncement(adminId: string, id: number, isActive: boolean) {
    const db = await getDb();
    await db.run(`UPDATE announcements SET is_active = ?, updated_at = ? WHERE id = ?`, [
      isActive ? 1 : 0,
      Date.now(),
      id,
    ]);
    await this.logAction(
      adminId,
      isActive ? "enable_announcement" : "disable_announcement",
      "announcement",
      id,
    );
  }

  async deleteAnnouncement(adminId: string, id: number) {
    const db = await getDb();
    await db.run("DELETE FROM announcements WHERE id = ?", [id]);
    await this.logAction(adminId, "delete_announcement", "announcement", id);
  }
}

export default new AdminService();
