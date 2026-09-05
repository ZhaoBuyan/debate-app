// server/src/database/seed.ts

import { Database } from "sqlite";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "./index.js";

/**
 * 种子数据
 */
export async function seedDatabase() {
  const db = await getDb();

  // 检查是否已有用户数据
  const userCount = await db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM users",
  );
  if (userCount && userCount.count > 0) {
    console.log("✅ 数据库已有数据，跳过种子填充");
    return;
  }

  console.log("🌱 开始填充种子数据...");

  // ---------- 1. 创建用户 ----------
  const passwordHash = await bcrypt.hash("123456", 10);

  const adminId = uuidv4();
  const testUserId = uuidv4();
  const user1Id = uuidv4();
  const user2Id = uuidv4();
  const user3Id = uuidv4();
  const user4Id = uuidv4();
  const user5Id = uuidv4();
  const user6Id = uuidv4();

  await db.run(
    `
    INSERT INTO users (id, username, password_hash, role, avatar, points, rank, wins, losses)
    VALUES 
      (?, 'admin', ?, 'super_admin', '👑', 100, '王者', 20, 2),
      (?, 'testuser', ?, 'user', '😊', 50, '黄金', 10, 5),
      (?, '张三', ?, 'user', '😎', 30, '白银', 6, 4),
      (?, '李四', ?, 'user', '🤔', 25, '白银', 5, 5),
      (?, '王五', ?, 'user', '🧐', 40, '黄金', 8, 3),
      (?, '赵六', ?, 'user', '🤓', 15, '青铜', 2, 8),
      (?, '孙七', ?, 'user', '😏', 20, '青铜', 3, 7)
  `,
    [
      adminId,
      passwordHash,
      testUserId,
      passwordHash,
      user1Id,
      passwordHash,
      user2Id,
      passwordHash,
      user3Id,
      passwordHash,
      user4Id,
      passwordHash,
      user5Id,
      passwordHash,
    ],
  );

  console.log(`✅ 创建了 ${7} 个用户`);

  // ---------- 2. 创建示例辩题 ----------
  const debate1Id = uuidv4();
  const debate2Id = uuidv4();
  const debate3Id = uuidv4();
  const now = Date.now();

  await db.run(
    `
    INSERT INTO debates (id, title, description, category, creator_id, host_id, side_a_name, side_b_name, status, start_time, created_at)
    VALUES 
      (?, '人工智能是否应该拥有道德判断能力？', '随着AI技术快速发展，是否应该赋予AI道德判断能力？这涉及伦理、法律和社会等多个层面。', 'tech', ?, ?, '正方：应该拥有', '反方：不应该拥有', 'ongoing', ?, ?),
      (?, '网络实名制利大于弊还是弊大于利？', '网络实名制能否有效治理网络乱象？还是侵犯了用户的隐私权？', 'society', ?, ?, '正方：利大于弊', '反方：弊大于利', 'waiting', ?, ?),
      (?, '高中是否应该实行选课走班制？', '选课走班制能否真正促进学生个性化发展？还是加剧了教育资源不均衡？', 'edu', ?, ?, '正方：应该实行', '反方：不应该实行', 'finished', ?, ?)
  `,
    [
      debate1Id,
      adminId,
      adminId,
      now + 30 * 60 * 1000,
      now,
      debate2Id,
      testUserId,
      testUserId,
      now + 90 * 60 * 1000,
      now,
      debate3Id,
      adminId,
      adminId,
      now - 60 * 60 * 1000,
      now - 120 * 60 * 1000,
    ],
  );

  console.log(`✅ 创建了 ${3} 个示例辩题`);

  // ---------- 3. 添加辩手 ----------
  await db.run(
    `
    INSERT INTO debaters (debate_id, user_id, side, order_index)
    VALUES 
      -- 辩题1：正方
      (?, ?, 'A', 1),
      (?, ?, 'A', 2),
      (?, ?, 'A', 3),
      -- 辩题1：反方
      (?, ?, 'B', 1),
      (?, ?, 'B', 2),
      (?, ?, 'B', 3),
      -- 辩题2：正方
      (?, ?, 'A', 1),
      (?, ?, 'A', 2),
      -- 辩题2：反方
      (?, ?, 'B', 1),
      (?, ?, 'B', 2),
      -- 辩题3：正方
      (?, ?, 'A', 1),
      (?, ?, 'A', 2),
      -- 辩题3：反方
      (?, ?, 'B', 1),
      (?, ?, 'B', 2)
  `,
    [
      debate1Id,
      adminId,
      debate1Id,
      user1Id,
      debate1Id,
      user3Id,
      debate1Id,
      testUserId,
      debate1Id,
      user2Id,
      debate1Id,
      user4Id,
      debate2Id,
      adminId,
      debate2Id,
      user3Id,
      debate2Id,
      testUserId,
      debate2Id,
      user5Id,
      debate3Id,
      adminId,
      debate3Id,
      user1Id,
      debate3Id,
      testUserId,
      debate3Id,
      user2Id,
    ],
  );

  console.log(`✅ 添加了 ${14} 位辩手`);

  // ---------- 4. 添加示例发言 ----------
  await db.run(
    `
    INSERT INTO speeches (debate_id, user_id, content, round, order_index, created_at)
    VALUES 
      (?, ?, '我认为AI应该有道德判断能力，因为这能确保AI在复杂场景下做出符合人类价值观的决策。', 1, 1, ?),
      (?, ?, 'AI只是工具，赋予它道德判断能力会模糊责任边界，人类应当承担所有道德责任。', 1, 2, ?),
      (?, ?, 'AI的道德判断可以避免人类偏见，提高决策的公正性和一致性。', 2, 1, ?),
      (?, ?, '但AI的"道德"只是程序模拟，无法真正理解道德背后的情感和同理心。', 2, 2, ?),
      (?, ?, '我们应该用法律和监管来约束AI，而不是让AI自己去"思考"道德。', 3, 1, ?)
  `,
    [
      debate1Id,
      adminId,
      now + 5 * 60 * 1000,
      debate1Id,
      testUserId,
      now + 7 * 60 * 1000,
      debate1Id,
      user1Id,
      now + 10 * 60 * 1000,
      debate1Id,
      user2Id,
      now + 12 * 60 * 1000,
      debate1Id,
      adminId,
      now + 15 * 60 * 1000,
    ],
  );

  console.log(`✅ 添加了 ${5} 条示例发言`);

  // ---------- 5. 添加支持率 ----------
  await db.run(
    `
    INSERT INTO support_rates (debate_id, user_id, side)
    VALUES 
      (?, ?, 'A'),
      (?, ?, 'A'),
      (?, ?, 'B'),
      (?, ?, 'B'),
      (?, ?, 'A')
  `,
    [
      debate1Id,
      adminId,
      debate1Id,
      user1Id,
      debate1Id,
      user2Id,
      debate1Id,
      user4Id,
      debate1Id,
      user5Id,
    ],
  );

  console.log(`✅ 添加了 ${5} 条支持率记录`);

  // ---------- 6. 添加敏感词示例 ----------
  await db.run(`
    INSERT INTO sensitive_words (word, severity)
    VALUES 
      ('色情', 'high'),
      ('暴力', 'high'),
      ('毒品', 'high'),
      ('赌博', 'high'),
      ('诈骗', 'high'),
      ('人身攻击', 'moderate'),
      ('侮辱', 'moderate'),
      ('歧视', 'moderate')
  `);

  console.log(`✅ 添加了 ${8} 个敏感词`);

  // ---------- 7. 添加一条公告 ----------
  await db.run(
    `
    INSERT INTO announcements (title, content, priority, start_at, is_active)
    VALUES (?, ?, ?, ?, ?)
  `,
    [
      "🎉 辩论平台正式上线！",
      "欢迎来到辩论平台！你可以创建辩题、参与辩论、实时投票，体验思想碰撞的乐趣。",
      2,
      now,
      1,
    ],
  );

  console.log(`✅ 添加了 1 条公告`);

  console.log("🎉 种子数据填充完成！");
  console.log("📋 测试账号:");
  console.log("   admin / 123456 (超级管理员)");
  console.log("   testuser / 123456 (普通用户)");
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}
