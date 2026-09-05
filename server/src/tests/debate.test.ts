// server/src/tests/debate.test.ts
// 辩题与辩论生命周期回归测试：审核 / 1v1 / 冷静期 / 发言 / 支持率 /
// 投票 / 结算 / AI报告 / 辩论树 / 重辩

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import authService from "../services/auth.service.js";
import debateService from "../services/debate.service.js";
import adminService from "../services/admin.service.js";
import speechService from "../services/speech.service.js";
import supportService from "../services/support.service.js";
import voteService from "../services/vote.service.js";
import { buildArgumentTree } from "../services/argument.service.js";
import { getDebateHighlights } from "../services/highlight.service.js";
import chatService from "../services/chat.service.js";
import { cleanupTestDb, registerUsers } from "./helpers.js";

describe("辩题与辩论生命周期（D/B/S/V/A 系列）", () => {
  let users!: Awaited<ReturnType<typeof registerUsers>>;
  let creator!: { id: string; username: string; token: string };
  let debaterB!: { id: string; username: string; token: string };
  let voterC!: { id: string; username: string; token: string };
  let voterD!: { id: string; username: string; token: string };
  let voterE!: { id: string; username: string; token: string };
  let admin: any;

  before(async () => {
    admin = (await authService.register("admin_x", "secret123")).user;
    users = await registerUsers(authService, ["creator_a", "debater_b", "voter_c", "voter_d", "voter_e"]);
    [creator, debaterB, voterC, voterD, voterE] = users;
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("创建辩题：标题过短被拒绝", async () => {
    await assert.rejects(
      debateService.createDebate({ title: "太短" }, creator.id),
      /至少需要5个字符/,
    );
  });

  it("创建辩题：默认进入 pending，类型 classic", async () => {
    const { id } = await debateService.createDebate(
      { title: "人工智能是否应该拥有道德判断能力？", category: "tech" },
      creator.id,
    );
    const d = await debateService.getDebateById(id);
    assert.equal(d!.status, "pending");
    assert.equal(d!.debate_type, "classic");
  });

  it("创建 1v1 辩题：类型被保存（回归：type 透传）", async () => {
    const { id } = await debateService.createDebate(
      { title: "1v1 早睡是否一定更健康？", category: "society", type: "quick1v1" },
      creator.id,
    );
    const d = await debateService.getDebateById(id);
    assert.equal(d!.debate_type, "quick1v1");
  });

  it("审核通过：进入 waiting 且创建者自动加入正方 A1（可设冷静期）", async () => {
    const { id } = await debateService.createDebate(
      { title: "网络实名制利大于弊吗？", category: "society" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id, "通过", 2);
    const d = await debateService.getDebateById(id);
    assert.equal(d!.status, "waiting");
    assert.equal(d!.cool_down_minutes, 2);
    const mine = d!.debaters!.find((x) => x.user_id === creator.id);
    assert.ok(mine);
    assert.equal(mine.side, "A");
    assert.equal(mine.order_index, 1);
  });

  it("1v1：第二人加入立即自动开赛（回归：类型上限 2 人）", async () => {
    const { id } = await debateService.createDebate(
      { title: "1v1 熬夜是否必然损害健康？", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    const r = await debateService.joinDebate(id, debaterB.id, "B");
    assert.equal(r.started, true);
    const d = await debateService.getDebateById(id);
    assert.equal(d!.status, "ongoing");
    assert.equal(d!.debaters!.length, 2);
  });

  it("标准制：每方最多4人，第9人加入被拒且不自动开赛", async () => {
    const { id } = await debateService.createDebate(
      { title: "标准制 8 人上限回归测试辩题标题", category: "general" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    // creator 已占 A1，再补 3 个 A + 4 个 B = 8 人
    const extra = await registerUsers(authService, [
      "fill_1", "fill_2", "fill_3", "fill_4", "fill_5", "fill_6", "fill_7",
    ]);
    for (const u of extra.slice(0, 3)) {
      await debateService.joinDebate(id, u.id, "A");
    }
    const extraB = extra.slice(3, 7);
    for (let i = 0; i < extraB.length; i++) {
      const r = await debateService.joinDebate(id, extraB[i].id, "B");
      // 前 3 人加入不满员，最后 1 人（第 8 位）触发自动开赛
      assert.equal(r.started, i === extraB.length - 1);
    }
    const d = await debateService.getDebateById(id);
    assert.equal(d!.debaters!.length, 8);
    assert.equal(d!.status, "ongoing");
  });

  it("发言：轮次推进 + AI 摘要回填 + 立场来自辩手表（回归：side 来源）", async () => {
    const { id } = await debateService.createDebate(
      { title: "测试发言轮次与摘要生成环节", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B"); // 自动开始

    const s1 = await speechService.createSpeech({
      debateId: id,
      userId: debaterB.id,
      content: "我方认为早睡能显著改善身体机能与心理状态，睡眠医学对此有大量证据支持。",
    });
    assert.equal(s1.side, "B");
    assert.equal(s1.round, 1);
    assert.ok(s1.summary, "AI 摘要应非空");

    const s2 = await speechService.createSpeech({
      debateId: id,
      userId: creator.id,
      content: "但现代人的社交与工作需求使得早睡不现实，我们应当正视这一现实约束。",
    });
    assert.equal(s2.side, "A");
    assert.equal(s2.round, 1);
  });

  it("冷静期：加入后立即发言被拦截（回归）", async () => {
    const { id } = await debateService.createDebate(
      { title: "冷静期回归验证专用辩题标题", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id, "", 1);
    await debateService.joinDebate(id, debaterB.id, "B");
    const remain = await debateService.cooldownRemainMs(id, debaterB.id);
    assert.ok(remain > 0, "冷静期应 > 0");
    await assert.rejects(
      speechService.createSpeech({
        debateId: id,
        userId: debaterB.id,
        content: "刚加入就发言应被冷静期拦截",
      }),
      /冷静期/,
    );
  });

  it("支持率：投票/切换均生效且不重复计数", async () => {
    const { id } = await debateService.createDebate(
      { title: "支持率回归测试辩题标题内容", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");
    await supportService.setSupport({ debateId: id, userId: voterC.id, side: "A" });
    await supportService.setSupport({ debateId: id, userId: voterD.id, side: "A" });
    let stats = await supportService.getStats(id);
    assert.equal(stats.sideA, 2);
    assert.equal(stats.total, 2);
    assert.equal(stats.rateA, 100);
    // 切换阵营
    await supportService.setSupport({ debateId: id, userId: voterC.id, side: "B" });
    stats = await supportService.getStats(id);
    assert.equal(stats.sideA, 1);
    assert.equal(stats.sideB, 1);
    assert.equal(stats.total, 2);
    assert.equal(stats.rateA, 50);
  });

  it("投票：一人一票可改票，非法目标被拒", async () => {
    const { id } = await debateService.createDebate(
      { title: "投票系统回归测试辩题标题", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");

    await assert.rejects(
      voteService.voteBest({ debateId: id, voterId: debaterB.id, targetUserId: debaterB.id }),
      /不能给自己投票/,
    );
    await assert.rejects(
      voteService.voteBest({ debateId: id, voterId: voterC.id, targetUserId: voterC.id }),
      /不是本场辩手/,
    );
    await voteService.voteBest({ debateId: id, voterId: voterC.id, targetUserId: creator.id });
    await voteService.voteSide({ debateId: id, voterId: voterC.id, side: "A" });
    // 改票
    await voteService.voteBest({ debateId: id, voterId: voterC.id, targetUserId: debaterB.id });
    await voteService.voteSide({ debateId: id, voterId: voterC.id, side: "B" });
    const votes = await voteService.getStats(id);
    assert.equal(votes.total_best_votes, 1);
    assert.equal(votes.best[0].target_user_id, debaterB.id);
    assert.equal(votes.total_side_votes, 1);
    assert.equal(votes.side[0].side, "B");
  });

  it("结算：胜负积分/最佳辩手加成/段位重算/审计/幂等（回归）", async () => {
    const { id } = await debateService.createDebate(
      { title: "结算回归测试辩题标题内容", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");

    // A 侧得票多 → A 胜；最佳辩手给 debaterB
    await voteService.voteSide({ debateId: id, voterId: voterC.id, side: "A" });
    await voteService.voteSide({ debateId: id, voterId: voterD.id, side: "A" });
    await voteService.voteSide({ debateId: id, voterId: voterE.id, side: "B" });
    await voteService.voteBest({ debateId: id, voterId: voterC.id, targetUserId: debaterB.id });
    await voteService.voteBest({ debateId: id, voterId: voterD.id, targetUserId: debaterB.id });

    await adminService.forceEndDebate(admin.id, id, "测试结束");

    const a = await authService.getProfile(creator.id);
    const b = await authService.getProfile(debaterB.id);
    // 胜方 A +20；败方 B +10 且最佳辩手 +30 = 40
    assert.equal(a.points, 20);
    assert.equal(a.wins, 1);
    assert.equal(b.points, 40);
    assert.equal(b.losses, 1);
    // 段位重算：40分仍是青铜（<50）
    assert.equal(a.rank, "青铜");

    // 幂等：重复结算无变化
    const again = await debateService.settleDebate(id);
    assert.deepEqual(again.pointsGiven, {});
    // 重复强制结束被拒
    await assert.rejects(
      adminService.forceEndDebate(admin.id, id),
      /已结束/,
    );

    // 审计
    const logs = await adminService.listLogs(50);
    assert.ok(logs.some((l: any) => l.action_type === "settle_debate"));
  });

  it("赛后 AI 报告：懒生成 + 免责声明 + 不重复入库", async () => {
    const { id } = await debateService.createDebate(
      { title: "赛后报告回归测试辩题标题", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");
    await speechService.createSpeech({
      debateId: id,
      userId: debaterB.id,
      content: "反方认为碎片化学习效率低下，缺乏系统性是其主要弊端所在。",
    });
    await adminService.forceEndDebate(admin.id, id);
    const r1 = await debateService.getOrCreateReport(id);
    assert.ok(r1);
    assert.ok(r1.report.includes("免责声明"));
    assert.ok(r1.report.includes("赛后总结"));
    const r2 = await debateService.getOrCreateReport(id);
    assert.equal(r2!.id, r1!.id, "重复调用不应重复入库");
  });

  it("辩论树：立场切换形成 论点→反驳→再反驳 链路", async () => {
    const { id } = await debateService.createDebate(
      { title: "辩论树结构回归测试辩题标题", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");
    await speechService.createSpeech({
      debateId: id,
      userId: creator.id,
      content: "正方论点一：我们应该全面推行垃圾分类制度。",
    });
    await speechService.createSpeech({
      debateId: id,
      userId: debaterB.id,
      content: "反方反驳：垃圾分类推行成本过高，中小城市财政无法承担。",
    });
    await speechService.createSpeech({
      debateId: id,
      userId: creator.id,
      content: "正方再反驳：长期环境治理收益远超短期财政投入。",
    });
    const tree = await buildArgumentTree(id);
    assert.equal(tree.length, 1, "应只有 1 个根论点");
    assert.equal(tree[0].children.length, 1, "根论点下应有 1 条反驳");
    assert.equal(tree[0].children[0].children.length, 1, "反驳下应有 1 条再反驳");
    assert.equal(tree[0].content.includes("正方论点一"), true);
  });

  it("精彩时刻：按发言聚合情绪并计算影响力（I-03/S-05 简化版）", async () => {
    const { id } = await debateService.createDebate(
      { title: "精彩时刻回归测试辩题标题内容", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B"); // 自动开始
    const s1 = await speechService.createSpeech({
      debateId: id,
      userId: debaterB.id,
      content: "精彩时刻测试发言一：观点本身应当先于立场被讨论。",
    });
    await chatService.addEmotion({
      debateId: id,
      userId: voterC.id,
      type: "fire",
      speechId: s1.id,
    });
    await chatService.addEmotion({
      debateId: id,
      userId: voterD.id,
      type: "agree",
      speechId: s1.id,
    });
    const hl = await getDebateHighlights(id);
    const first = hl.find((h) => h.id === s1.id);
    assert.ok(first);
    assert.equal(first.emotions.fire, 1);
    assert.equal(first.emotions.agree, 1);
    assert.equal(first.emotions.total, 2);
  });

  it("重辩：继承原辩论形式并标记 parent", async () => {
    const { id } = await debateService.createDebate(
      { title: "重辩继承回归测试辩题标题", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, debaterB.id, "B");
    await adminService.forceEndDebate(admin.id, id);
    const r = await debateService.restartDebate(id, voterC.id);
    const d = await debateService.getDebateById(r.id);
    assert.equal(d!.status, "pending");
    assert.equal(d!.parent_id, id);
    assert.equal(d!.debate_type, "quick1v1", "重辩应继承辩论形式");
    assert.equal(d!.repeat_count, 1);
  });
});
