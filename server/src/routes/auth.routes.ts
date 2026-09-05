// server/src/routes/auth.routes.ts

import { Router } from "express";
import {
  register,
  login,
  me,
  exportData,
  changePassword,
  updateAvatar,
  activities,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { sensitiveFilter } from "../middleware/sensitive.js";

const router = Router();

/**
 * POST /api/auth/register  用户注册（U-01）
 */
router.post("/register", registerLimiter, sensitiveFilter, register);

/**
 * POST /api/auth/login  用户登录（U-02），专用限流防暴力破解
 */
router.post("/login", loginLimiter, login);

/**
 * GET /api/auth/me  获取当前用户信息（认证）
 */
router.get("/me", authMiddleware, me);

/**
 * GET /api/auth/export  导出我的全部数据（认证，数据可携带权）
 */
router.get("/export", authMiddleware, exportData);

/**
 * PUT /api/auth/password  修改密码（需旧密码）
 */
router.put("/password", authMiddleware, changePassword);

/**
 * PUT /api/auth/avatar  更新头像
 */
router.put("/avatar", authMiddleware, updateAvatar);

/**
 * GET /api/auth/activities  我的活动概览（个人资料页）
 */
router.get("/activities", authMiddleware, activities);

export default router;
