// server/src/services/leaderboard.service.ts
// 排行榜：段位榜（积分）与活跃榜（30 天发言数），附当前用户名次

import { getDb } from "../database/index.js";
import { LeaderboardRow } from "../types/index.js";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export class LeaderboardService {
  /**
   * 段位榜：按积分取前 20（附带发言总数/胜负/胜率）
   */
  async byPoints(): Promise<LeaderboardRow[]> {
    const db = await getDb();
    return db.all<LeaderboardRow[]>(
      `SELECT u.id, u.username, u.avatar, u.role, u.points, u.rank, u.wins, u.losses,
              (SELECT COUNT(*) FROM speeches s WHERE s.user_id = u.id) as speech_total,
              CASE WHEN (u.wins + u.losses) > 0
                   THEN ROUND(u.wins * 100.0 / (u.wins + u.losses), 1)
                   ELSE NULL END as win_rate
       FROM users u
       WHERE u.is_banned = 0
       ORDER BY u.points DESC, u.wins DESC
       LIMIT 20`,
    );
  }

  /**
   * 活跃榜：近 30 天发言数前 20
   */
  async byActivity(): Promise<LeaderboardRow[]> {
    const db = await getDb();
    const since = Date.now() - THIRTY_DAYS;
    return db.all<LeaderboardRow[]>(
      `SELECT u.id, u.username, u.avatar, u.role, u.points, u.rank, u.wins, u.losses,
              COUNT(s.id) as speech_30d
       FROM users u
       JOIN speeches s ON s.user_id = u.id AND s.created_at >= ?
       WHERE u.is_banned = 0
       GROUP BY u.id
       ORDER BY speech_30d DESC
       LIMIT 20`,
      [since],
    );
  }

  /**
   * 当前用户在段位榜的名次（第 N 名）
   */
  async myRank(userId: string): Promise<number | null> {
    const db = await getDb();
    const user = await db.get<{ points: number }>(
      "SELECT points FROM users WHERE id = ?",
      [userId],
    );
    if (!user) return null;
    const row = await db.get<{ n: number }>(
      "SELECT COUNT(*) + 1 n FROM users WHERE points > ? AND is_banned = 0",
      [user.points],
    );
    return row?.n || null;
  }
}

export default new LeaderboardService();
