// e2e/server-runner.cjs
// 启动后端供 E2E 使用：独立临时库 + 隔离端口(3110) + 每轮重建种子数据
// 自包含：先编译 server（CI 拉取的仓库无 dist），再 require 启动入口

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const serverDir = path.join(__dirname, "..", "server");
const dbFile = path.join(__dirname, ".tmp", "e2e.db");

// 1) 确保后端已编译（Windows npm 为 .cmd，须经 shell）
const build = spawnSync("npm run build", {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) {
  console.error("❌ server 构建失败，E2E 后端无法启动");
  process.exit(1);
}

// 2) 清理上次遗留的 E2E 库
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(dbFile + suffix);
  } catch {
    /* ignore */
  }
}

// 3) 环境与启动（入口自带 bootstrap）
process.env.PORT = "3110";
process.env.NODE_ENV = "development";
process.env.DEBATE_DB_FILE = dbFile;
process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-secret-key";

require(path.join(serverDir, "dist", "index.js"));
