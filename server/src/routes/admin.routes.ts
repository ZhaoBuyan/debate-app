// server/src/routes/admin.routes.ts

import { Router } from "express";
import { adminOnly } from "../middleware/admin.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  listUsers,
  banUser,
  unbanUser,
  warnUser,
  listPendingDebates,
  approveDebate,
  rejectDebate,
  forceEndDebate,
  curateDebate,
  listReports,
  handleReport,
  listSensitiveWords,
  addSensitiveWord,
  deleteSensitiveWord,
  deleteSpeech,
  listLogs,
  listAnnouncements,
  createAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  stats,
} from "../controllers/admin.controller.js";
import { sensitiveFilter } from "../middleware/sensitive.js";

const router = Router();

// 管理路由整体需要认证 + 管理员权限（SRS 3.9）
router.use(authMiddleware);
router.use(adminOnly);

// 数据总览
router.get("/stats", stats);

// 用户管理（AD-02/03/04）
router.get("/users", listUsers);
router.post("/users/:id/ban", banUser);
router.post("/users/:id/unban", unbanUser);
router.post("/users/:id/warn", warnUser);

// 辩题审核（AD-01）
router.get("/debates/pending", listPendingDebates);
router.put("/debates/:id/approve", approveDebate);
router.put("/debates/:id/reject", rejectDebate);
router.post("/debates/:id/force-end", forceEndDebate);
router.put("/debates/:id/curate", curateDebate);

// 举报处理（AD-06）
router.get("/reports", listReports);
router.put("/reports/:id", handleReport);

// 敏感词管理（AD-07）
router.get("/sensitive-words", listSensitiveWords);
router.post("/sensitive-words", sensitiveFilter, addSensitiveWord);
router.delete("/sensitive-words/:id", deleteSensitiveWord);

// 内容管理（AD-05）
router.delete("/speeches/:id", deleteSpeech);

// 操作审计（AD-09）
router.get("/logs", listLogs);

// 公告管理（AD-08）
router.get("/announcements", listAnnouncements);
router.post("/announcements", sensitiveFilter, createAnnouncement);
router.put("/announcements/:id/toggle", toggleAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

export default router;
