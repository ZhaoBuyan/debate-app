// server/src/utils/config.ts

import dotenv from "dotenv";
dotenv.config();

const isProd = process.env.NODE_ENV === "production";

/** CORS 允许来源：支持逗号分隔多源（如企业嵌入场景 http://a.com,http://b.com） */
function parseOrigins(raw?: string): string[] {
  if (!raw) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_JWT_SECRET = "dev-secret-key-change-in-production";
const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

// 生产环境使用默认密钥属于严重风险：启动即告警
if (isProd && jwtSecret === DEFAULT_JWT_SECRET) {
  console.error(
    "⚠️ [SECURITY] 生产环境正在使用默认 JWT 密钥！请在 .env 中设置强随机 JWT_SECRET",
  );
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  databaseUrl: process.env.DATABASE_URL || "./data/debate.db",

  // 限流配置
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 200, // 最多200次请求
  },

  // 账号级限流
  authLimit: {
    windowMs: 15 * 60 * 1000,
    max: 30, // 注册：每 IP 15 分钟最多 30 次
  },

  // AI 服务配置（后续）
  ai: {
    groqApiKey: process.env.GROQ_API_KEY || "",
    model: process.env.AI_MODEL || "llama3-70b-8192",
  },
};
