// server/src/services/debater.service.ts

import { getDb } from "../database/index.js";
import { DebaterWithUser } from "../types/index.js";

export class DebaterService {
  /** 获取某场辩论的全部辩手（含用户信息，按 A1..A4, B1..B4 排序） */
  async getByDebate(debateId: string): Promise<DebaterWithUser[]> {
    const db = await getDb();
    const rows = await db.all<DebaterWithUser[]>(
      `SELECT d.*, u.username, u.avatar, u.rank
       FROM debaters d
       JOIN users u ON u.id = d.user_id
       WHERE d.debate_id = ?
       ORDER BY d.side ASC, d.order_index ASC`,
      [debateId],
    );
    // 交替排序：A1 B1 A2 B2 A3 B3 A4 B4（SRS B-01）
    const sideA = rows.filter((r) => r.side === "A");
    const sideB = rows.filter((r) => r.side === "B");
    const interleaved: DebaterWithUser[] = [];
    const max = Math.max(sideA.length, sideB.length);
    for (let i = 0; i < max; i++) {
      if (sideA[i]) interleaved.push(sideA[i]);
      if (sideB[i]) interleaved.push(sideB[i]);
    }
    return interleaved;
  }

  /** 判断用户是否为某场辩论辩手 */
  async isDebater(debateId: string, userId: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.get(
      "SELECT id FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, userId],
    );
    return !!row;
  }

  /** 获取用户在某场辩论的阵营 */
  async getSide(debateId: string, userId: string): Promise<"A" | "B" | null> {
    const db = await getDb();
    const row = await db.get<{ side: "A" | "B" }>(
      "SELECT side FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, userId],
    );
    return row?.side || null;
  }

  /** 统计各方人数 */
  async countBySide(debateId: string): Promise<{ A: number; B: number }> {
    const db = await getDb();
    const row = await db.get<{ A: number; B: number }>(
      `SELECT
        SUM(CASE WHEN side = 'A' THEN 1 ELSE 0 END) as A,
        SUM(CASE WHEN side = 'B' THEN 1 ELSE 0 END) as B
       FROM debaters WHERE debate_id = ?`,
      [debateId],
    );
    return { A: row?.A || 0, B: row?.B || 0 };
  }
}

export default new DebaterService();
