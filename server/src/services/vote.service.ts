// server/src/services/vote.service.ts

import { getDb } from "../database/index.js";
import {
  VoteBestInput,
  VoteSideInput,
  VoteStats,
} from "../types/index.js";

export class VoteService {
  /**
   * 最佳辩手投票（一人一票，重复投票则改票，SRS V-01/V-04）
   */
  async voteBest(input: VoteBestInput): Promise<void> {
    const { debateId, voterId, targetUserId } = input;
    const db = await getDb();

    // 目标必须是本场辩手
    const target = await db.get(
      "SELECT id FROM debaters WHERE debate_id = ? AND user_id = ?",
      [debateId, targetUserId],
    );
    if (!target) throw new Error("投票目标不是本场辩手");

    // 不能投给自己
    if (voterId === targetUserId) throw new Error("不能给自己投票");

    await db.run(
      `INSERT INTO votes_best (debate_id, voter_id, target_user_id)
       VALUES (?, ?, ?)
       ON CONFLICT(debate_id, voter_id)
       DO UPDATE SET target_user_id = excluded.target_user_id`,
      [debateId, voterId, targetUserId],
    );
  }

  /**
   * 阵营胜负投票（一人一票，可改票，SRS V-02/V-04）
   */
  async voteSide(input: VoteSideInput): Promise<void> {
    const { debateId, voterId, side } = input;
    const db = await getDb();
    await db.run(
      `INSERT INTO votes_side (debate_id, voter_id, side)
       VALUES (?, ?, ?)
       ON CONFLICT(debate_id, voter_id) DO UPDATE SET side = excluded.side`,
      [debateId, voterId, side],
    );
  }

  /** 获取投票统计 */
  async getStats(debateId: string): Promise<VoteStats> {
    const db = await getDb();

    const best = await db.all<{
      target_user_id: string;
      username: string;
      count: number;
    }[]>(
      `SELECT v.target_user_id, u.username, COUNT(*) as count
       FROM votes_best v
       JOIN users u ON u.id = v.target_user_id
       WHERE v.debate_id = ?
       GROUP BY v.target_user_id
       ORDER BY count DESC`,
      [debateId],
    );

    const side = await db.all<{ side: "A" | "B"; count: number }[]>(
      `SELECT side, COUNT(*) as count
       FROM votes_side
       WHERE debate_id = ?
       GROUP BY side`,
      [debateId],
    );

    const totalBest = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM votes_best WHERE debate_id = ?",
      [debateId],
    );
    const totalSide = await db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM votes_side WHERE debate_id = ?",
      [debateId],
    );

    return {
      best,
      side,
      total_best_votes: totalBest?.cnt || 0,
      total_side_votes: totalSide?.cnt || 0,
    };
  }

  /** 查询用户当前投票状态 */
  async hasVoted(debateId: string, voterId: string) {
    const db = await getDb();
    const best = await db.get<{ target_user_id: string }>(
      "SELECT target_user_id FROM votes_best WHERE debate_id = ? AND voter_id = ?",
      [debateId, voterId],
    );
    const side = await db.get<{ side: "A" | "B" }>(
      "SELECT side FROM votes_side WHERE debate_id = ? AND voter_id = ?",
      [debateId, voterId],
    );
    return {
      bestTarget: best?.target_user_id || null,
      side: side?.side || null,
    };
  }
}

export default new VoteService();
