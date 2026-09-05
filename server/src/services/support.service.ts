// server/src/services/support.service.ts

import { getDb } from "../database/index.js";
import {
  SupportInput,
  SupportSnapshot,
  SupportStats,
  SupportHistoryPoint,
} from "../types/index.js";

export class SupportService {
  /**
   * 投票支持 / 切换支持（每场辩论每人一票，可改边）
   */
  async setSupport(input: SupportInput): Promise<SupportStats> {
    const { debateId, userId, side } = input;
    const db = await getDb();

    const debate = await db.get<{ status: string }>(
      "SELECT status FROM debates WHERE id = ?",
      [debateId],
    );
    if (!debate) throw new Error("辩题不存在");

    // upsert：已投过的用户切换阵营
    await db.run(
      `INSERT INTO support_rates (debate_id, user_id, side)
       VALUES (?, ?, ?)
       ON CONFLICT(debate_id, user_id) DO UPDATE SET side = excluded.side`,
      [debateId, userId, side],
    );

    return this.getStats(debateId);
  }

  /** 获取支持率统计 */
  async getStats(debateId: string): Promise<SupportStats> {
    const db = await getDb();
    const row = await db.get<{ sideA: number; sideB: number }>(
      `SELECT
        SUM(CASE WHEN side = 'A' THEN 1 ELSE 0 END) as sideA,
        SUM(CASE WHEN side = 'B' THEN 1 ELSE 0 END) as sideB
       FROM support_rates WHERE debate_id = ?`,
      [debateId],
    );
    const sideA = row?.sideA || 0;
    const sideB = row?.sideB || 0;
    const total = sideA + sideB;
    return {
      sideA,
      sideB,
      total,
      rateA: total === 0 ? 0 : Math.round((sideA / total) * 1000) / 10,
      rateB: total === 0 ? 0 : Math.round((sideB / total) * 1000) / 10,
    };
  }

  /** 记录支持率快照（SRS S-06：发言结束/辩论结束等关键节点） */
  async snapshot(
    debateId: string,
    snapshotType: SupportSnapshot["snapshot_type"],
    triggerId?: string,
  ): Promise<SupportSnapshot> {
    const db = await getDb();
    const stats = await this.getStats(debateId);
    const result = await db.run(
      `INSERT INTO support_snapshots
        (debate_id, snapshot_type, trigger_id, side_a_count, side_b_count)
       VALUES (?, ?, ?, ?, ?)`,
      [debateId, snapshotType, triggerId || null, stats.sideA, stats.sideB],
    );
    const snapshot = await db.get<SupportSnapshot>(
      "SELECT * FROM support_snapshots WHERE id = ?",
      [result.lastID],
    );
    return snapshot!;
  }

  /** 获取支持率历史走势（用于赛后曲线图 SRS S-04） */
  async getHistory(debateId: string): Promise<SupportHistoryPoint[]> {
    const db = await getDb();
    const rows = await db.all<SupportSnapshot[]>(
      `SELECT * FROM support_snapshots
       WHERE debate_id = ?
       ORDER BY timestamp ASC LIMIT 500`,
      [debateId],
    );
    return rows.map((r) => {
      const total = r.side_a_count + r.side_b_count;
      return {
        timestamp: r.timestamp,
        sideA: r.side_a_count,
        sideB: r.side_b_count,
        rateA: total === 0 ? 0 : Math.round((r.side_a_count / total) * 1000) / 10,
        rateB: total === 0 ? 0 : Math.round((r.side_b_count / total) * 1000) / 10,
      };
    });
  }

  /** 查询某用户在某场辩论的支持阵营 */
  async getUserSide(
    debateId: string,
    userId: string,
  ): Promise<"A" | "B" | null> {
    const db = await getDb();
    const row = await db.get<{ side: "A" | "B" }>(
      "SELECT side FROM support_rates WHERE debate_id = ? AND user_id = ?",
      [debateId, userId],
    );
    return row?.side || null;
  }
}

export default new SupportService();
