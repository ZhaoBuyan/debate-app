// server/src/utils/logger.ts

import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = config.nodeEnv === "development" ? "debug" : "info";

function log(level: LogLevel, message: string, meta?: any): void {
  if (levels[level] < levels[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level.toUpperCase()}`;

  if (meta) {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`, meta);
  } else {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (message: string, meta?: any) => log("debug", message, meta),
  info: (message: string, meta?: any) => log("info", message, meta),
  warn: (message: string, meta?: any) => log("warn", message, meta),
  error: (message: string, meta?: any) => log("error", message, meta),
};
