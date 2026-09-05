// server/src/middleware/auth.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../utils/config.js";
import { getDb } from "../database/index.js";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "未认证" });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, error: "未认证" });
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, error: "Token 无效" });
    }

    const db = await getDb();
    const user = await db.get(
      `SELECT id, username, role, is_banned FROM users WHERE id = ?`,
      [decoded.userId],
    );

    if (!user) {
      return res.status(401).json({ success: false, error: "用户不存在" });
    }

    if (user.is_banned) {
      // 临时封禁到期自动解封
      const bannedUser = await db.get<{ banned_until: number | null }>(
        "SELECT banned_until FROM users WHERE id = ?",
        [decoded.userId],
      );
      if (bannedUser?.banned_until && bannedUser.banned_until <= Date.now()) {
        await db.run(
          `UPDATE users SET is_banned = 0, banned_reason = NULL, banned_until = NULL, banned_at = NULL
           WHERE id = ?`,
          [decoded.userId],
        );
      } else {
        return res.status(403).json({ success: false, error: "账号已被封禁" });
      }
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Token 无效" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Token 已过期" });
    }
    console.error("认证中间件错误:", error);
    return res.status(500).json({ success: false, error: "服务器内部错误" });
  }
};
