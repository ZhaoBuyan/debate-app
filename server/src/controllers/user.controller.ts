// server/src/controllers/user.controller.ts

import { Request, Response } from "express";
import authService from "../services/auth.service.js";

/**
 * GET /api/users/:id 公开个人主页数据（C4：无需登录可查看）
 */
export async function userProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const profile = await authService.getProfile(id);
    if (!profile) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }
    if (profile.is_banned === 1) {
      return res.status(403).json({ success: false, error: "该用户已被封禁" });
    }
    const data = await authService.getMyActivities(id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
