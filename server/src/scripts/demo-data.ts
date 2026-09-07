// server/src/scripts/demo-data.ts
// 演示数据生成器：npm run demo
// - 幂等：自动清理上次生成的演示数据（“用户N / 辩题 N｜”命名空间）后重建
// - 走真实 service 路径（注册/审核/报名/发言/情绪/投票/结算/AI报告），数据与生产逻辑一致
// - 前置：数据库已由 seed 初始化（先启动一次服务器或运行过测试库之外的真实服务）

import authService from "../services/auth.service.js";
import debateService from "../services/debate.service.js";
import adminService from "../services/admin.service.js";
import speechService from "../services/speech.service.js";
import supportService from "../services/support.service.js";
import chatService from "../services/chat.service.js";
import voteService from "../services/vote.service.js";
import topicsService from "../services/topics.service.js";
import { rankOfPoints } from "../services/debate.service.js";
import { getDb } from "../database/index.js";
import { CATEGORY_LABELS } from "../utils/validation.js";

const AVATARS = ["🐼", "🦊", "🐯", "🦁", "🐸", "🐙", "🦉", "🐺", "🐨", "🐹", "🐰", "🦄"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cleanupDemo(db: Awaited<ReturnType<typeof getDb>>) {
  await db.exec(`
    DELETE FROM debates WHERE title LIKE '辩题 %';
    DELETE FROM topic_proposals WHERE title LIKE '辩题 %';
    DELETE FROM users WHERE username LIKE '用户%';
  `);
}

async function main() {
  const db = await getDb();
  console.log("🧹 清理旧演示数据…");
  await cleanupDemo(db);

  const admin = await db.get<{ id: string }>(
    "SELECT id FROM users WHERE role IN ('admin','super_admin') ORDER BY role DESC LIMIT 1",
  );
  if (!admin) throw new Error("未找到管理员（请先启动一次服务器完成种子初始化）");
  const adminId = admin.id;

  // ---------- 1. 注册演示用户（用户1..用户12） ----------
  console.log("👥 注册演示用户…");
  const users: any[] = [];
  for (let i = 1; i <= 12; i++) {
    const r = await authService.register(`用户${i}`, "123456");
    await db.run("UPDATE users SET avatar = ? WHERE id = ?", [
      AVATARS[i - 1],
      r.user.id,
    ]);
    users.push({ ...r.user, avatar: AVATARS[i - 1] });
  }
  // 用户1~8 辩手；用户9~12 观众/运营
  const [u1, u2, u3, u4, u5, u6, u7, u8] = users.slice(0, 8);
  const [aud1, aud2, aud3, aud4] = users.slice(8);

  // ---------- 2. 辩题 1：完整 8 人经典赛（展示辩论树/报告/金句/走势图/榜单结算） ----------
  console.log("🎬 生成 辩题 1（8 人经典赛，2 轮 16 条发言）…");
  const T1 = "辩题 1｜人工智能应当拥有道德判断能力吗？";
  const debate1 = await debateService.createDebate(
    {
      title: T1,
      description:
        "演示场次：当 AI 在医疗、司法与内容审核中替代人类决策，它是否应当被赋予道德判断能力？",
      category: "tech",
      sideA: "正方",
      sideB: "反方",
    },
    u1.id,
  );
  await adminService.approveDebate(adminId, debate1.id);
  for (const u of [u2, u3, u4]) {
    await debateService.joinDebate(debate1.id, u.id, "A");
  }
  for (const u of [u5, u6, u7, u8]) {
    await debateService.joinDebate(debate1.id, u.id, "B"); // 第 8 人触发自动开赛
  }

  // 发言稿：A（正方）与 B（反方）各 4 人 × 2 轮
  const sideA1 = [
    "在医疗诊断与司法量刑场景中，AI 已开始替代人类做影响重大的判断。如果它完全缺乏道德框架，一个只会追求“成功率最大化”的系统，就可能把资源从最有希望的病人身上移走——这不是技术问题，而是价值排序问题，必须由道德能力来约束。",
    "反对者担心“赋予道德”是拟人化，但道德判断并不神秘：它是一组可检验的决策原则。我们完全可以把“不伤害、公正、透明”编码为 AI 的硬性约束，就像把安全标准写进汽车一样。拒绝编码道德，等于放任算法自行其是。",
    "今天内容平台的推荐算法已经证明了：没有道德约束的优化器会造成成瘾与对立。系统不是“中立”的，它默认的优化目标就是它的价值观。既然如此，不如让这个价值观经过公开的道德设计，而不是被点击率偷偷决定。",
    "我们可以做一个最小的实验来检验立场：如果一辆自动驾驶汽车必须在行人与其乘客之间选择，它是否需要某种“伤害最小化”的原则？如果答案是肯定的，那它就是道德判断的雏形——剩下的只是把它做得更好。",
  ];
  const sideB1 = [
    "我们讨论的不是要不要安全，而是“道德”这个词的滥用。道德要求主体有能力理解善恶并为此负责；而 AI 无论参数多大，都不会感受到愧疚。把一个没有责任能力的东西说成有道德，只会让真正该负责的人——开发者与使用者——溜走。",
    "把原则“编码”进系统听起来很美，可谁来定义原则？十个人就有十种正义观。把一方价值观固化进算法，等于让一小撮工程师用代码替全社会做选择——这恰恰是反民主的，比“没有道德”危险得多。",
    "自动驾驶的那个思想实验恰好暴露了问题：所谓“伤害最小化”需要先给每个生命定价。谁来定价？依据什么？这类难题人类吵了几千年都没有答案，指望训练数据里学到一个“正确”的道德，是把争议本身外包给了统计。",
    "更务实的担忧是责任链：当 AI 做出错误判断时，我们无法惩罚一个模型，也无法让代码悔改。与其讨论给 AI 装道德，不如讨论给它装刹车——明确的禁用边界、审计日志与人工复核权，这些才是真正能落地的约束。",
  ];
  const speechSets = [
    [sideA1[0], sideB1[0]],
    [sideA1[1], sideB1[1]],
    [sideA1[2], sideB1[2]],
    [sideA1[3], sideB1[3]],
  ];
  // 回合序（interleave）：A1 B1 A2 B2 A3 B3 A4 B4 × 2 轮
  const order = [u1, u5, u2, u6, u3, u7, u4, u8];
  const supportSchedule: Record<number, { voter: any; side: "A" | "B" }> = {
    1: { voter: aud1, side: "A" }, // 第二轮 A1 后
    4: { voter: aud2, side: "B" },
    7: { voter: aud3, side: "A" },
    10: { voter: aud4, side: "B" },
  };

  let speechIndex = 0;
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < 8; i++) {
      const user = order[i];
      const isA = i % 2 === 0;
      const poolIdx = Math.floor(i / 2);
      const content = isA ? sideA1[poolIdx] : sideB1[poolIdx];
      const speech = await speechService.createSpeech({
        debateId: debate1.id,
        userId: user.id,
        content: `（第 ${round} 轮）${content}`,
      });
      speechIndex++;

      // 观感节奏：部分发言后观众表态，形成支持率曲线
      const sched = supportSchedule[speechIndex - 1];
      if (sched) {
        await supportService.setSupport({
          debateId: debate1.id,
          userId: sched.voter.id,
          side: sched.side,
        });
      }
      await supportService.snapshot(debate1.id, "speech_end", String(speech.id));

      // 精彩发言挂观众情绪（分布到靠后更强的论点）
      const emotionMap: Record<number, Array<["fire" | "agree" | "clap", any]>> = {
        8: [
          ["fire", aud1],
          ["agree", aud2],
          ["fire", aud3],
          ["clap", aud4],
        ],
        12: [
          ["agree", aud1],
          ["fire", aud2],
          ["agree", aud3],
          ["fire", aud4],
        ],
        14: [
          ["fire", aud1],
          ["clap", aud2],
          ["fire", aud3],
          ["agree", aud4],
        ],
      };
      const emos = emotionMap[speechIndex];
      if (emos) {
        for (const [type, voter] of emos) {
          await chatService.addEmotion({
            debateId: debate1.id,
            userId: voter.id,
            type,
            speechId: speech.id,
          });
        }
      }
      await sleep(5); // 保持时间戳有间隔（曲线/排序展示更自然）
    }
  }

  // 观众投票（A 3:1 胜）+ 最佳辩手（A2 高票）
  await voteService.voteSide({ debateId: debate1.id, voterId: aud1.id, side: "A" });
  await voteService.voteSide({ debateId: debate1.id, voterId: aud2.id, side: "A" });
  await voteService.voteSide({ debateId: debate1.id, voterId: aud3.id, side: "A" });
  await voteService.voteSide({ debateId: debate1.id, voterId: aud4.id, side: "B" });
  await voteService.voteBest({ debateId: debate1.id, voterId: aud1.id, targetUserId: u2.id });
  await voteService.voteBest({ debateId: debate1.id, voterId: aud3.id, targetUserId: u2.id });
  await voteService.voteBest({ debateId: debate1.id, voterId: aud4.id, targetUserId: u2.id });
  await voteService.voteBest({ debateId: debate1.id, voterId: aud2.id, targetUserId: u6.id });
  await adminService.forceEndDebate(adminId, debate1.id, "演示场次 1 结束");

  // 设为编辑精选（首页运营位）
  await adminService.toggleCurate(adminId, debate1.id, true);

  // ---------- 3. 辩题 2：独立 1v1（平局）+ 辩题 2 的重辩（展示重辩链对比） ----------
  console.log("🔁 生成 辩题 2（1v1 平局）及其重辩（胜场）…");
  const T2 = "辩题 2｜生成式 AI 内容是否应当强制标注？";
  const debate2 = await debateService.createDebate(
    {
      title: T2,
      description: "演示场次：1v1 快速赛，平局收场——可对比其重辩的战绩。",
      category: "tech",
      type: "quick1v1",
    },
    aud1.id,
  );
  await adminService.approveDebate(adminId, debate2.id);
  await debateService.joinDebate(debate2.id, aud2.id, "B"); // 自动开赛
  const b2Speeches = [
    [aud1.id, "正方：当 AI 生成的图文以假乱真时，消费者没有能力分辨来源——强制标注是信息透明的基本权利，就像食品必须标注成分一样。"],
    [aud2.id, "反方：一刀切的标注既难落地（合成与编辑的边界模糊），又给创作者添负担；应区分高风险场景（新闻/选举）做精准治理。"],
    [aud1.id, "正方：精准治理的幻觉正是今天的困境——平台靠自律，结果深度伪造泛滥。标注成本远低于信任崩塌的成本。"],
    [aud2.id, "反方：标注若流于形式，反而制造虚假安全感；真正该做的是提升公众媒介素养与检测工具，而不是贴一张谁都看不懂的标签。"],
  ] as const;
  for (const [uid, content] of b2Speeches) {
    const sp = await speechService.createSpeech({ debateId: debate2.id, userId: uid, content });
    await supportService.snapshot(debate2.id, "speech_end", String(sp.id));
  }
  await chatService.addEmotion({ debateId: debate2.id, userId: aud3.id, type: "fire", speechId: (await speechService.getSpeechesByDebate(debate2.id))[0].id });
  await voteService.voteSide({ debateId: debate2.id, voterId: aud3.id, side: "A" });
  await voteService.voteSide({ debateId: debate2.id, voterId: aud4.id, side: "B" }); // 1:1 平局
  await adminService.forceEndDebate(adminId, debate2.id, "演示场次：1v1 平局");

  // 辩题 2 的重辩（quick1v1 继承）：第二场 A 胜 → 重辩链展示两种结果
  const restart = await debateService.restartDebate(debate2.id, aud3.id);
  await adminService.approveDebate(adminId, restart.id);
  await debateService.joinDebate(restart.id, aud4.id, "B"); // 自动开赛
  const r1 = await speechService.createSpeech({
    debateId: restart.id,
    userId: aud3.id,
    content: "重辩正方：上场的反方把问题甩给素养与工具，可当伪造已经骗过老人与选民，指望人人自检是不现实的——标注是成本最低的第一道防线。",
  });
  await supportService.snapshot(restart.id, "speech_end", String(r1.id));
  const r2 = await speechService.createSpeech({
    debateId: restart.id,
    userId: aud4.id,
    content: "重辩反方：防线要防得住才算数。没有执行与处罚的标注只是安慰剂——把资源投到可验证的水印与溯源技术上，比贴标签有用。",
  });
  await supportService.snapshot(restart.id, "speech_end", String(r2.id));
  await voteService.voteSide({ debateId: restart.id, voterId: aud1.id, side: "A" });
  await voteService.voteSide({ debateId: restart.id, voterId: aud2.id, side: "A" }); // 2:0 A 胜
  await adminService.forceEndDebate(adminId, restart.id, "演示场次：重辩结束");

  // ---------- 4. 辩题 3：进行中的 1v1（可继续体验发言） ----------

  // ---------- 4. 辩题 3：进行中的 1v1（可继续体验发言） ----------
  console.log("⚡ 生成 辩题 3（进行中 1v1）…");
  const debate3 = await debateService.createDebate(
    {
      title: "辩题 3｜远程办公是否应当成为企业默认选项？",
      description: "演示场次：正在直播的 1v1，可加入观战并继续互动。",
      category: "society",
      type: "quick1v1",
    },
    u1.id,
  );
  await adminService.approveDebate(adminId, debate3.id);
  await debateService.joinDebate(debate3.id, u2.id, "B");
  const s1 = await speechService.createSpeech({
    debateId: debate3.id,
    userId: u1.id,
    content: "正方开篇：远程办公把通勤时间还给生活与产出，数据上并未牺牲协作质量——企业该信任结果而非打卡机。",
  });
  await supportService.snapshot(debate3.id, "speech_end", String(s1.id));
  await chatService.addEmotion({ debateId: debate3.id, userId: aud1.id, type: "fire", speechId: s1.id });
  const s2 = await speechService.createSpeech({
    debateId: debate3.id,
    userId: u2.id,
    content: "反方开篇：创造力的火花来自走廊里的偶遇，新人成长依赖现场观察——远程的账算得清显性成本，算不清隐性损耗。",
  });
  await supportService.snapshot(debate3.id, "speech_end", String(s2.id));
  await chatService.addEmotion({ debateId: debate3.id, userId: aud2.id, type: "agree", speechId: s2.id });
  await supportService.setSupport({ debateId: debate3.id, userId: aud3.id, side: "A" });
  await supportService.setSupport({ debateId: debate3.id, userId: aud4.id, side: "B" });

  // ---------- 5. 辩题 4（报名中）+ 辩题 5（待审核） ----------
  console.log("📢 生成 辩题 4（报名中）与 辩题 5（待审核）…");
  const debate4 = await debateService.createDebate(
    {
      title: "辩题 4｜中小学是否应当全面禁止携带手机进校园？",
      description: "演示场次：报名中，满员后自动开赛。",
      category: "edu",
      sideA: "支持禁带",
      sideB: "反对禁带",
    },
    u3.id,
  );
  await adminService.approveDebate(adminId, debate4.id);
  await debateService.createDebate(
    {
      title: "辩题 5｜公共议题讨论中是否应强制要求实名制？",
      description: "演示场次：等待管理员审核（展示审核流程）。",
      category: "society",
    },
    u4.id,
  );

  // ---------- 6. 众创池（D-10） ----------
  console.log("💡 生成众创提案…");
  const proposals: any[] = [
    {
      title: "辩题 6｜城市是否应该取消机动车限行改用拥堵费？",
      description: "参考新加坡经验，把配额博弈换成价格信号。",
      category: "society",
    },
    {
      title: "辩题 7｜高校是否应该取消毕业论文强制要求？",
      description: "用项目制毕业设计替代八股式论文。",
      category: "edu",
    },
    {
      title: "辩题 8｜开源软件作者是否有权收回自己的代码？",
      description: "许可证永久性 vs 维护者权利之争。",
      category: "tech",
    },
  ];
  const proposalCreators = [aud1, aud2, aud3];
  for (let i = 0; i < proposals.length; i++) {
    const p = await topicsService.create(proposalCreators[i].id, proposals[i]);
    // 投票热度：辩手们分散投票（提案 1 最热）
    const voters = i === 0 ? [u1, u2, u3, u4, u5] : i === 1 ? [u6, u7] : [u8];
    for (const v of voters) {
      await topicsService.toggleVote(p.id, v.id);
    }
  }

  // ---------- 7. 模拟历史战绩（段位梯度，演示用） ----------
  console.log("🏆 校准段位梯度…");
  const boosts: [any, number][] = [
    [u1, 780], // → 王者附近
    [u3, 420],
    [u5, 180],
    [u8, 40],
  ];
  for (const [u, pts] of boosts) {
    await db.run("UPDATE users SET points = points + ?, wins = wins + ? WHERE id = ?", [
      pts,
      Math.floor(pts / 40),
      u.id,
    ]);
  }
  const rows = await db.all<{ id: string; points: number }[]>(
    "SELECT id, points FROM users WHERE username LIKE '用户%'",
  );
  for (const r of rows) {
    await db.run("UPDATE users SET rank = ? WHERE id = ?", [rankOfPoints(r.points), r.id]);
  }

  // ---------- 8. 公告与日志 ----------
  await adminService.createAnnouncement(adminId, {
    title: "🎉 演示场次已就绪",
    content:
      "欢迎体验：辩题 1 已完赛（含 AI 报告/辩论树/金句卡），辩题 3 正在进行，辩题 4 等待你的加入——去观战或报名吧！",
    priority: 1,
  });

  // 摘要输出
  const debate1Info = await debateService.getDebateById(debate1.id);
  const support = await supportService.getStats(debate1.id);
  const highlights = await (await import("../services/highlight.service.js")).getDebateHighlights(
    debate1.id,
  );
  const topHeat = Math.max(0, ...highlights.map((h) => h.emotions.total));
  console.log("\n✅ 演示数据生成完成！");
  console.log("------------------------------------------");
  console.log(`  辩手: ${(debate1Info?.debaters || []).length} 人 · 发言: ${debate1Info?.speeches?.length ?? 0} 条`);
  console.log(`  观众支持: A ${support.sideA} / B ${support.sideB} · 情绪峰值: 🔥x${topHeat}`);
  console.log(`  重辩链: 2 场（辩题 2 档案 → 历次交锋对比）`);
  console.log(`  编辑精选: 辩题 1 · 众创提案: ${proposals.length} 条`);
  console.log(`  用户段位: ${rows.map((r) => rankOfPoints(r.points)).join("/")}`);
  console.log("------------------------------------------");
  console.log("重置演示数据：再次运行 npm run demo 即可（自动清理后重建）");
}

main().catch((err) => {
  console.error("❌ 演示数据生成失败:", err);
  process.exit(1);
});
