// server/src/services/report.service.ts

import { getDb } from "../database/index.js";
import {
  CreateReportInput,
  HandleReportInput,
  ReportWithDetails,
} from "../types/index.js";
import chatService from "./chat.service.js";

export class ReportService {
  /** 提交举报（SRS AD-06 / 6.5 report 事件） */
  async create(input: CreateReportInput): Promise<number> {
    const { targetUserId, targetType, reason, debateId, speechId, messageId } =
      input;
    if (!targetUserId) throw new Error("缺少举报对象");
    const reasonTrim = (reason || "").trim();
    if (reasonTrim.length < 2) {
      throw new Error("请填写举报原因（至少2个字符）");
    }
    if (reasonTrim.length > 200) {
      throw new Error("举报原因过长（最多200字）");
    }

    const db = await getDb();

    // 校验目标存在
    const target = await db.get("SELECT id FROM users WHERE id = ?", [
      targetUserId,
    ]);
    if (!target) throw new Error("举报对象不存在");

    if (targetType === "speech" && speechId) {
      const s = await db.get("SELECT id FROM speeches WHERE id = ?", [speechId]);
      if (!s) throw new Error("发言不存在");
    }
    if (targetType === "message" && messageId) {
      const m = await db.get("SELECT id FROM messages WHERE id = ?", [messageId]);
      if (!m) throw new Error("消息不存在");
    }

    const result = await db.run(
      `INSERT INTO reports
        (debate_id, speech_id, message_id, reporter_id, target_user_id, target_type, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        debateId || null,
        speechId || null,
        messageId || null,
        input.reporterId,
        targetUserId,
        targetType,
        reasonTrim,
      ],
    );
    return result.lastID!;
  }

  /** 举报列表（可按状态筛选） */
  async list(status?: string): Promise<ReportWithDetails[]> {
    const db = await getDb();
    let sql = `
      SELECT r.*,
        ru.username as reporter_name,
        tu.username as target_name,
        d.title as debate_title,
        s.content as speech_content,
        m.content as message_content,
        hu.username as handler_name
      FROM reports r
      JOIN users ru ON ru.id = r.reporter_id
      JOIN users tu ON tu.id = r.target_user_id
      LEFT JOIN debates d ON d.id = r.debate_id
      LEFT JOIN speeches s ON s.id = r.speech_id
      LEFT JOIN messages m ON m.id = r.message_id
      LEFT JOIN users hu ON hu.id = r.handler_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== "all") {
      sql += " AND r.status = ?";
      params.push(status);
    }
    sql += " ORDER BY r.created_at DESC, r.id DESC LIMIT 100";
    return db.all<ReportWithDetails[]>(sql, params);
  }

  /**
   * 处理举报
   * action: resolve（标记处理）| reject（驳回）| delete_content（删除违规内容并处理）
   */
  async handle(
    reportId: number,
    input: HandleReportInput,
    adminId: string,
  ): Promise<void> {
    const db = await getDb();
    const report = await db.get<ReportWithDetails>(
      "SELECT * FROM reports WHERE id = ?",
      [reportId],
    );
    if (!report) throw new Error("举报不存在");
    if (report.status === "resolved" || report.status === "rejected") {
      throw new Error("该举报已处理");
    }

    const note = input.note || null;

    if (input.action === "delete_content") {
      if (report.target_type === "speech" && report.speech_id) {
        await db.run(
          "UPDATE speeches SET content = '[该发言因违规已被删除]', summary = NULL WHERE id = ?",
          [report.speech_id],
        );
      } else if (report.target_type === "message" && report.message_id) {
        await chatService.hideMessage(report.message_id);
      }
      await db.run(
        `UPDATE reports SET status = 'resolved', handler_id = ?, handler_note = ?, resolved_at = ?
         WHERE id = ?`,
        [adminId, note || "已删除违规内容", Date.now(), reportId],
      );
    } else if (input.action === "resolve") {
      await db.run(
        `UPDATE reports SET status = 'resolved', handler_id = ?, handler_note = ?, resolved_at = ?
         WHERE id = ?`,
        [adminId, note, Date.now(), reportId],
      );
    } else {
      await db.run(
        `UPDATE reports SET status = 'rejected', handler_id = ?, handler_note = ?, resolved_at = ?
         WHERE id = ?`,
        [adminId, note || "举报不成立", Date.now(), reportId],
      );
    }

    await db.run(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
       VALUES (?, ?, 'report', ?, ?)`,
      [adminId, `report_${input.action}`, String(reportId), note || ""],
    );
  }
}

export default new ReportService();
