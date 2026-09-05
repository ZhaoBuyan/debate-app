// server/src/controllers/admin.controller.ts

import { Request, Response } from "express";
import adminService from "../services/admin.service.js";
import reportService from "../services/report.service.js";
import sensitiveService from "../services/sensitive.service.js";
import debateService from "../services/debate.service.js";

const adminIdOf = (req: Request): string => (req as any).user?.id || "";

/** GET /api/curated-board 内容运营榜单（编辑精选/直播中/精华复盘） */
export async function curatedBoard(req: Request, res: Response) {
  try {
    const data = await debateService.getCuratedBoard();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** PUT /api/admin/debates/:id/curate 设置/取消编辑精选 */
export async function curateDebate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { curated } = req.body;
    await adminService.toggleCurate(adminIdOf(req), id, !!curated);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 用户管理 ----------

/** GET /api/admin/users 用户列表 */
export async function listUsers(req: Request, res: Response) {
  try {
    const { search, page, pageSize } = req.query;
    const data = await adminService.listUsers(
      search as string | undefined,
      Math.max(1, parseInt(page as string) || 1),
      Math.min(100, Math.max(1, parseInt(pageSize as string) || 20)),
    );
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/users/:id/ban 封禁用户（临时/永久） */
export async function banUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason, durationMs } = req.body;
    const result = await adminService.banUser(
      adminIdOf(req),
      id,
      reason,
      durationMs === undefined ? null : Number(durationMs),
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/users/:id/unban 解封用户 */
export async function unbanUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await adminService.unbanUser(adminIdOf(req), id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/users/:id/warn 警告用户 */
export async function warnUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await adminService.warnUser(adminIdOf(req), id, reason);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 辩题审核 ----------

/** GET /api/admin/debates/pending 待审核辩题 */
export async function listPendingDebates(req: Request, res: Response) {
  try {
    const data = await adminService.listPendingDebates();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** PUT /api/admin/debates/:id/approve 审核通过（可设置冷静期分钟数） */
export async function approveDebate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { note, coolDownMinutes } = req.body;
    await adminService.approveDebate(
      adminIdOf(req),
      id,
      note,
      Number(coolDownMinutes) || 0,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** PUT /api/admin/debates/:id/reject 审核拒绝 */
export async function rejectDebate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    await adminService.rejectDebate(adminIdOf(req), id, note);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/debates/:id/force-end 强制结束辩论（AD-12） */
export async function forceEndDebate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await adminService.forceEndDebate(adminIdOf(req), id, reason);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 举报处理 ----------

/** GET /api/admin/reports 举报列表 */
export async function listReports(req: Request, res: Response) {
  try {
    const { status } = req.query;
    const data = await reportService.list(status as string | undefined);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** PUT /api/admin/reports/:id 处理举报（AD-06） */
export async function handleReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, note } = req.body;
    if (!["resolve", "reject", "delete_content"].includes(action)) {
      return res.status(400).json({ success: false, error: "处理动作不合法" });
    }
    await reportService.handle(Number(id), { action, note }, adminIdOf(req));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 敏感词管理（AD-07） ----------

/** GET /api/admin/sensitive-words 敏感词列表 */
export async function listSensitiveWords(req: Request, res: Response) {
  try {
    const data = await sensitiveService.list();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/sensitive-words 添加敏感词 */
export async function addSensitiveWord(req: Request, res: Response) {
  try {
    const { word, severity } = req.body;
    const data = await sensitiveService.add(word, severity);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** DELETE /api/admin/sensitive-words/:id 删除敏感词 */
export async function deleteSensitiveWord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await sensitiveService.remove(Number(id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 内容与日志 ----------

/** DELETE /api/admin/speeches/:id 删除违规发言 */
export async function deleteSpeech(req: Request, res: Response) {
  try {
    await adminService.deleteSpeech(adminIdOf(req), Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** GET /api/admin/logs 管理员操作日志 */
export async function listLogs(req: Request, res: Response) {
  try {
    const data = await adminService.listLogs();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ---------- 公告管理（AD-08） ----------

/** GET /api/admin/announcements 全部公告 */
export async function listAnnouncements(req: Request, res: Response) {
  try {
    const data = await adminService.listAnnouncements(false);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/admin/announcements 发布公告 */
export async function createAnnouncement(req: Request, res: Response) {
  try {
    const { title, content, priority } = req.body;
    const id = await adminService.createAnnouncement(adminIdOf(req), {
      title,
      content,
      priority,
    });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** PUT /api/admin/announcements/:id/toggle 上/下架公告 */
export async function toggleAnnouncement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    await adminService.toggleAnnouncement(
      adminIdOf(req),
      Number(id),
      !!isActive,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** DELETE /api/admin/announcements/:id 删除公告 */
export async function deleteAnnouncement(req: Request, res: Response) {
  try {
    await adminService.deleteAnnouncement(adminIdOf(req), Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

// ---------- 数据总览 ----------

/** GET /api/admin/stats 数据总览 */
export async function stats(req: Request, res: Response) {
  try {
    const db = (await import("../database/index.js")).getDb;
    const d = await db();
    const users = await d.get<{ cnt: number }>("SELECT COUNT(*) cnt FROM users");
    const debates = await d.all<{ status: string; cnt: number }[]>(
      "SELECT status, COUNT(*) cnt FROM debates GROUP BY status",
    );
    const speeches = await d.get<{ cnt: number }>(
      "SELECT COUNT(*) cnt FROM speeches",
    );
    const reports = await d.get<{ cnt: number }>(
      "SELECT COUNT(*) cnt FROM reports WHERE status = 'pending'",
    );
    const byStatus: Record<string, number> = {};
    debates.forEach((r) => (byStatus[r.status] = r.cnt));
    res.json({
      success: true,
      data: {
        users: users?.cnt || 0,
        speeches: speeches?.cnt || 0,
        pendingReports: reports?.cnt || 0,
        byStatus,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
