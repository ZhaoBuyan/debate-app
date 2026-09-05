// e2e/global-setup.ts
// 全局准备：编译 server（保证 dist 最新），删除上次 E2E 遗留的测试库

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export default function globalSetup() {
  // 1. 构建后端（dist 是 webServer 启动的产物）
  const serverDir = path.join(__dirname, "..", "server");
  const build = spawnSync("npm", ["run", "build"], {
    cwd: serverDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    throw new Error("❌ server 构建失败，E2E 终止");
  }

  // 2. 清理 E2E 测试库（server-runner 每次也会自行清理，双保险）
  const tmpDir = path.join(__dirname, ".tmp");
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(path.join(tmpDir, `e2e.db${suffix}`));
    } catch {
      /* ignore */
    }
  }
}
