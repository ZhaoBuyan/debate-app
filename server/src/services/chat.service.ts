// server/src/services/chat.service.ts

import { getDb } from "../database/index.js";
import { MessageType, MessageWithUser } from "../types/index.js";
import sensitiveService from "./sensitive.service.js";

export interface SendMessageInput {
  debateId: string;
  userId: string;
  content: string;
  type?: MessageType;
}

export class ChatService {
  /** 发送聊天消息（自动过滤敏感词） */
  async sendMessage(input: SendMessageInput): Promise<MessageWithUser> {
    const { debateId, userId, content, type = "chat" } = input;
    if (!content || content.trim().length === 0) {
      throw new Error("消息内容不能为空");
    }
    const trimmed = content.trim();
    if (trimmed.length > 500) {
      throw new Error("消息内容过长（最多500字）");
    }
    const filtered = await sensitiveService.filterText(trimmed);
    const db = await getDb();

    const result = await db.run(
      `INSERT INTO messages (debate_id, user_id, content, type)
       VALUES (?, ?, ?, ?)`,
      [debateId, userId, filtered, type],
    );

    const message = await db.get<MessageWithUser>(
      `SELECT m.*, u.username, u.avatar, u.role
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [result.lastID],
    );
    if (!message) throw new Error("消息发送失败");
    return message;
  }

  /** 获取某场辩论的最近消息 */
  async getMessages(debateId: string, limit = 100): Promise<MessageWithUser[]> {
    const db = await getDb();
    return db.all<MessageWithUser[]>(
      `SELECT m.*, u.username, u.avatar, u.role
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.debate_id = ?
       ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      [debateId, limit],
    );
  }

  /** 撤回消息（管理员，软撤回：替换内容文本） */
  async recallMessage(messageId: number, adminId: string): Promise<void> {
    const db = await getDb();
    const msg = await db.get<{ debate_id: string; user_id: string }>(
      "SELECT debate_id, user_id FROM messages WHERE id = ?",
      [messageId],
    );
    if (!msg) throw new Error("消息不存在");
    await db.run(
      `UPDATE messages
       SET content = '[该消息已被管理员撤回]', type = 'system'
       WHERE id = ?`,
      [messageId],
    );
    await db.run(
      `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
       VALUES (?, 'recall_message', 'message', ?, ?)`,
      [adminId, String(messageId), `撤回用户 ${msg.user_id} 的消息`],
    );
  }

  /** 删除（物理隐藏）某条消息 —— 供举报处理使用 */
  async hideMessage(messageId: number): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE messages SET content = '[该内容因违规已被删除]', type = 'system' WHERE id = ?`,
      [messageId],
    );
  }

  /** 获取某场辩论的情绪统计 */
  async getEmotionStats(debateId: string) {
    const db = await getDb();
    const rows = await db.all<{ emotion_type: string; count: number }[]>(
      `SELECT emotion_type, COUNT(*) as count
       FROM emotions
       WHERE debate_id = ?
       GROUP BY emotion_type`,
      [debateId],
    );
    const stats: Record<string, number> = { fire: 0, agree: 0, clap: 0 };
    for (const r of rows) {
      stats[r.emotion_type] = r.count;
    }
    return stats;
  }

  /** 记录情绪反馈（🔥精彩 / 🤔有道理 / 💥反驳漂亮） */
  async addEmotion(input: {
    debateId: string;
    userId: string;
    type: "fire" | "agree" | "clap";
    speechId?: number;
  }): Promise<void> {
    const db = await getDb();
    await db.run(
      `INSERT INTO emotions (debate_id, user_id, emotion_type, speech_id)
       VALUES (?, ?, ?, ?)`,
      [input.debateId, input.userId, input.type, input.speechId || null],
    );
  }
}

export default new ChatService();
