// e2e/server-runner.cjs
// 启动后端供 E2E 使用：独立临时库 + 随机隔离端口（3110），自动重建种子数据
// 说明：dist 由 global-setup 编译；这里 require 启动入口（入口自带 bootstrap）

const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, ".tmp", "e2e.db");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(dbFile + suffix);
  } catch {
    /* ignore */
  }
}

process.env.PORT = "3110";
process.env.NODE_ENV = "development";
process.env.DEBATE_DB_FILE = dbFile;
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-secret-key";

require(path.join(__dirname, "..", "server", "dist", "index.js"));
