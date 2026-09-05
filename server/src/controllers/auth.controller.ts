// server/src/controllers/auth.controller.ts

import { Request, Response } from "express";
import authService from "../services/auth.service.js";
import { getDb } from "../database/index.js";

/** POST /api/auth/register 用户注册（U-01） */
export async function register(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    const result = await authService.register(username, password);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "注册失败" });
  }
}

/** POST /api/auth/login 用户登录（U-02） */
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "";
    const result = await authService.login(username, password, ip);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message || "登录失败" });
  }
}

/** GET /api/auth/me 获取当前用户完整公开信息 */
export async function me(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const full = await authService.getProfile(user.id);
    res.json({ success: true, data: full || user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** PUT /api/auth/password 修改密码 */
export async function changePassword(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(user.id, oldPassword, newPassword);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** PUT /api/auth/avatar 更新头像 */
export async function updateAvatar(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { avatar } = req.body;
    const profile = await authService.updateAvatar(user.id, avatar);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** GET /api/auth/activities 我的活动概览（资料页） */
export async function activities(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const data = await authService.getMyActivities(user.id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/auth/export 导出我的全部数据（数据可携带权）
 * 返回：个人资料 + 创建的辩题 + 参与的辩论 + 发言 + 投票 + 支持 + 聊天 + 举报
 */
export async function exportData(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const db = await getDb();
    const uid = user.id;

    const profile = await db.get(
      `SELECT id, username, role, avatar, points, rank, wins, losses, warning_count,
              created_at, last_login_at
       FROM users WHERE id = ?`,
      [uid],
    );
    const createdDebates = await db.all(
      `SELECT id, title, category, status, debate_type, created_at FROM debates WHERE creator_id = ?`,
      [uid],
    );
    const joined = await db.all(
      `SELECT d.id, d.title, d.status, d.side_a_name, d.side_b_name, t.side, t.order_index, t.joined_at
       FROM debaters t JOIN debates d ON d.id = t.debate_id WHERE t.user_id = ?`,
      [uid],
    );
    const speeches = await db.all(
      `SELECT s.id, s.debate_id, s.content, s.summary, s.round, s.input_type, s.created_at
       FROM speeches s WHERE s.user_id = ? ORDER BY s.created_at`,
      [uid],
    );
    const votesBestGiven = await db.all(
      `SELECT v.debate_id, u.username AS target, v.created_at
       FROM votes_best v JOIN users u ON u.id = v.target_user_id WHERE v.voter_id = ?`,
      [uid],
    );
    const votesSideGiven = await db.all(
      `SELECT debate_id, side, created_at FROM votes_side WHERE voter_id = ?`,
      [uid],
    );
    const supports = await db.all(
      `SELECT debate_id, side, timestamp FROM support_rates WHERE user_id = ?`,
      [uid],
    );
    const messages = await db.all(
      `SELECT id, debate_id, content, type, created_at FROM messages WHERE user_id = ? ORDER BY created_at`,
      [uid],
    );
    const reports = await db.all(
      `SELECT id, debate_id, target_type, reason, status, created_at FROM reports WHERE reporter_id = ?`,
      [uid],
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      debatesCreated: createdDebates,
      debatesJoined: joined,
      speeches,
      votesBestGiven,
      votesSideGiven,
      supports,
      chatMessages: messages,
      reportsSubmitted: reports,
      disclaimer: "该文件由辩论平台导出，包含你在平台上的全部活动记录。",
    };
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="debate-export-${user.username}.json"`,
    );
    res.json({ success: true, data: payload });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
