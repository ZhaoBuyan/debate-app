// server/src/controllers/leaderboard.controller.ts

import { Request, Response } from "express";
import leaderboardService from "../services/leaderboard.service.js";

/**
 * GET /api/leaderboard?type=points|active[&me=1]
 * 段位榜 / 活跃榜，登录且 me=1 时附带当前用户名次
 */
export async function leaderboard(req: Request, res: Response) {
  try {
    const type = req.query.type === "active" ? "active" : "points";
    const me = (req as any).user;
    const wantRank = req.query.me === "1" && me?.id;

    const [list, meRank] = await Promise.all([
      type === "points"
        ? leaderboardService.byPoints()
        : leaderboardService.byActivity(),
      wantRank ? leaderboardService.myRank(me.id) : Promise.resolve(null),
    ]);

    res.json({ success: true, data: { type, list, meRank } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
