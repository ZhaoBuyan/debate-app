// server/src/middleware/security.ts
// 安全响应头中间件（零依赖，替代 helmet 的核心能力）
// 生产环境启用严格 CSP；开发环境放宽以兼容 Vite HMR/React Refresh

import { Request, Response, NextFunction } from "express";
import { config } from "../utils/config.js";

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // 防内容嗅探 / 点击劫持 / 引荐信息泄露 / 浏览器特性滥用
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (config.nodeEnv === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  } else {
    // 开发模式：允许 Vite HMR 所需的 inline/eval 与本地连接
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
        "connect-src 'self' ws: wss: http: https:; frame-ancestors 'none'",
    );
  }

  // API 响应不做缓存（含认证信息，防浏览器缓存泄露）
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}
