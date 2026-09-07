// server/src/controllers/topics.controller.ts

import { Request, Response } from "express";
import topicsService from "../services/topics.service.js";

/** GET /api/topics 众创池列表（公开；带登录态返回已投标记） */
export async function list(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const data = await topicsService.list(user?.id, 60);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/topics 提交众创提案（D-10） */
export async function create(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: "未认证" });
    const { title, description, category } = req.body;
    const data = await topicsService.create(user.id, { title, description, category });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/topics/:id/vote 投票/取消（一人一票） */
export async function toggleVote(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: "未认证" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: "参数不合法" });
    }
    const data = await topicsService.toggleVote(id, user.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}
