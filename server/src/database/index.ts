// server/src/database/index.ts

import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  // 支持测试环境注入独立数据库文件（避免污染演示库）
  const altPath = process.env.DEBATE_DB_FILE;
  if (altPath) {
    const dir = path.dirname(path.resolve(altPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = await open({
      filename: path.resolve(altPath),
      driver: sqlite3.Database,
    });
    await db.exec("PRAGMA foreign_keys = ON;");
    await createTables(db);
    console.log(`✅ 测试数据库连接成功: ${altPath}`);
    return db;
  }

  // 确保 data 目录存在（用于存放 .db 文件）
  const dataDir = path.join(__dirname, "../../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "debate.db");

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // 启用外键约束
  await db.exec("PRAGMA foreign_keys = ON;");

  // 创建所有表
  await createTables(db);

  console.log("✅ 数据库连接成功，表结构已就绪");
  return db;
}

/** 关闭数据库连接（测试清理用） */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 * 创建所有表结构
 */
async function createTables(db: Database) {
  // ---------- 用户表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'super_admin')),
      avatar TEXT NOT NULL DEFAULT '😊',
      points INTEGER NOT NULL DEFAULT 0,
      rank TEXT NOT NULL DEFAULT '青铜',
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      banned_reason TEXT,
      banned_at INTEGER,
      banned_until INTEGER,
      warning_count INTEGER NOT NULL DEFAULT 0,
      last_login_ip TEXT,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ---------- 辩题表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('general', 'tech', 'society', 'edu', 'philosophy', 'culture')),
      creator_id TEXT NOT NULL,
      host_id TEXT,
      side_a_name TEXT NOT NULL DEFAULT '正方',
      side_b_name TEXT NOT NULL DEFAULT '反方',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'waiting', 'ongoing', 'finished', 'rejected')),
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      admin_note TEXT,
      is_recommended INTEGER NOT NULL DEFAULT 0,
      recommended_date TEXT,
      parent_id TEXT,
      repeat_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_id) REFERENCES debates(id) ON DELETE SET NULL
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_debates_created_at ON debates(created_at DESC)`,
  );

  // ---------- 辩手表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debaters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('A', 'B')),
      order_index INTEGER NOT NULL,
      joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(debate_id, user_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_debaters_debate ON debaters(debate_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_debaters_user ON debaters(user_id)`,
  );

  // ---------- 发言表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS speeches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      round INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      input_type TEXT NOT NULL DEFAULT 'text' CHECK(input_type IN ('text', 'voice', 'sign')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_speeches_debate ON speeches(debate_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_speeches_round ON speeches(debate_id, round)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_speeches_user ON speeches(user_id)`,
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_debates_creator ON debates(creator_id)`,
  );

  // ---------- 投票（最佳辩手） ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS votes_best (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(debate_id, voter_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_votes_best_debate ON votes_best(debate_id)`,
  );

  // ---------- 投票（阵营胜负） ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS votes_side (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('A', 'B')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(debate_id, voter_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_votes_side_debate ON votes_side(debate_id)`,
  );

  // ---------- 支持率记录 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('A', 'B')),
      timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(debate_id, user_id),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_support_debate ON support_rates(debate_id)`,
  );

  // ---------- 支持率快照 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('speech_end', 'round_end', 'debate_end', 'manual')),
      trigger_id TEXT,
      side_a_count INTEGER NOT NULL,
      side_b_count INTEGER NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_snapshot_debate ON support_snapshots(debate_id)`,
  );

  // ---------- 消息表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chat' CHECK(type IN ('chat', 'system', 'gesture', 'announcement')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_messages_debate ON messages(debate_id)`,
  );

  // ---------- 举报表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT,
      speech_id INTEGER,
      message_id INTEGER,
      reporter_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('speech', 'message', 'user')),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'resolved', 'rejected')),
      handler_id TEXT,
      handler_note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      resolved_at INTEGER,
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (speech_id) REFERENCES speeches(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (handler_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)`,
  );

  // ---------- 敏感词表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sensitive_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      severity TEXT NOT NULL DEFAULT 'moderate' CHECK(severity IN ('low', 'moderate', 'high')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ---------- 管理员日志表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id)`,
  );

  // ---------- 公告表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      start_at INTEGER,
      end_at INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER
    )
  `);

  // ---------- 辩题提议（众创） ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS topic_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      proposer_id TEXT NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'scheduled')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (proposer_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ---------- 情绪记录 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS emotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emotion_type TEXT NOT NULL CHECK(emotion_type IN ('fire', 'agree', 'clap')),
      speech_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (speech_id) REFERENCES speeches(id) ON DELETE CASCADE
    )
  `);
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_emotions_debate ON emotions(debate_id)`,
  );

  // ---------- 赛后 AI 报告表 ----------
  await db.exec(`
    CREATE TABLE IF NOT EXISTS debate_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debate_id TEXT UNIQUE NOT NULL,
      report TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (debate_id) REFERENCES debates(id) ON DELETE CASCADE
    )
  `);

  await migrateLegacyTables(db);

  console.log("✅ 所有表结构创建/验证完成");
}

/**
 * 轻量迁移：为历史库补充新版本新增的列（幂等）
 */
async function migrateLegacyTables(db: Database) {
  const cols = await db.all<{ name: string }[]>(
    "PRAGMA table_info(debates)",
  );
  const names = cols.map((c) => c.name);
  const addIfMissing = async (col: string, ddl: string) => {
    if (!names.includes(col)) {
      await db.exec(`ALTER TABLE debates ADD COLUMN ${ddl}`);
    }
  };
  // 辩论形式（standard 8人 / quick1v1 每方1人）
  await addIfMissing(
    "debate_type",
    "debate_type TEXT NOT NULL DEFAULT 'classic'",
  );
  // 社区公约：冷静期（分钟），加入后需等待方可发言
  await addIfMissing(
    "cool_down_minutes",
    "cool_down_minutes INTEGER NOT NULL DEFAULT 0",
  );
  // 积分结算标记（防重复结算）
  await addIfMissing(
    "settled",
    "settled INTEGER NOT NULL DEFAULT 0",
  );
  // 内容运营：编辑精选标记 + 精选时间
  await addIfMissing(
    "curated",
    "curated INTEGER NOT NULL DEFAULT 0",
  );
  await addIfMissing("curated_at", "curated_at INTEGER");
}
