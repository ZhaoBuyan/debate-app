// server/src/middleware/admin.ts

import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types/user.js";

/**
 * 管理员权限中间件（admin / super_admin 可用）
 */
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "未认证" });
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    return res.status(403).json({ success: false, error: "需要管理员权限" });
  }
  next();
};

/**
 * 超级管理员专用中间件（仅 super_admin）
 */
export const superAdminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "未认证" });
  }
  if (user.role !== "super_admin") {
    return res
      .status(403)
      .json({ success: false, error: "需要超级管理员权限" });
  }
  next();
};

/**
 * 判断角色是否具备管理权限
 */
export const isAdminRole = (role?: UserRole): boolean =>
  role === "admin" || role === "super_admin";
