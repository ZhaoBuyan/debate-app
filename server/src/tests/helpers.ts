// server/src/tests/helpers.ts
// 测试辅助：每个测试文件使用独立的临时数据库文件，互不干扰、不污染演示库

import fs from "fs";
import os from "os";
import path from "path";

// 必须在任何 getDb() 调用之前生效（模块顶层执行，import 顺序保证）
const file = path.join(
  os.tmpdir(),
  `debate-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`,
);
process.env.DEBATE_DB_FILE = file;

export const TEST_DB_FILE = file;

/** 测试结束后清理临时库（尽力而为，忽略句柄占用错误） */
export async function cleanupTestDb(): Promise<void> {
  const { closeDb } = await import("../database/index.js");
  try {
    await closeDb();
  } catch {
    /* ignore */
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(file + suffix);
    } catch {
      /* ignore */
    }
  }
}

/** 批量注册用户（测试夹具） */
export async function registerUsers(
  authService: any,
  names: string[],
): Promise<{ id: string; username: string; token: string }[]> {
  const users: { id: string; username: string; token: string }[] = [];
  for (const name of names) {
    const r = await authService.register(name, "secret123");
    users.push({ id: r.user.id, username: r.user.username, token: r.token });
  }
  return users;
}
