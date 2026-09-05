// server/src/middleware/rateLimit.ts

import rateLimit from "express-rate-limit";
import { config } from "../utils/config.js";

/**
 * 全局限流：每个 IP 每 15 分钟最多 200 次请求（SRS 4.3 安全需求）
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "请求过于频繁，请稍后再试",
  },
});

/**
 * 登录接口专用限流（更严格，防暴力破解）
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "登录尝试过于频繁，请 15 分钟后再试",
  },
});

/**
 * 注册接口专用限流（防批量刷号）
 */
export const registerLimiter = rateLimit({
  windowMs: config.authLimit.windowMs,
  max: config.authLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "注册过于频繁，请 15 分钟后再试",
  },
});
