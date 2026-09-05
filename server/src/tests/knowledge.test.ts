// server/src/tests/knowledge.test.ts
// 知识沉淀回归测试：重辩链聚合（chain）与全文检索（search）

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import authService from "../services/auth.service.js";
import adminService from "../services/admin.service.js";
import debateService from "../services/debate.service.js";
import speechService from "../services/speech.service.js";
import voteService from "../services/vote.service.js";
import { searchAll } from "../services/search.service.js";
import { cleanupTestDb, registerUsers } from "./helpers.js";

describe("知识沉淀（重辩链 / 全文检索）", () => {
  let admin: any;
  let users!: Awaited<ReturnType<typeof registerUsers>>;
  let creator!: any;
  let debaterB!: any;
  let voterC!: any;
  let voterD!: any;
  let rootId!: string;
  let childId!: string;

  before(async () => {
    admin = (await authService.register("admin_k", "secret123")).user;
    users = await registerUsers(authService, [
      "k_creator",
      "k_debater",
      "k_voter1",
      "k_voter2",
    ]);
    [creator, debaterB, voterC, voterD] = users;

    // 搭建两代辩论：首场 A 胜并带特定关键词发言 → 重辩 → 第二场平票
    const first = await debateService.createDebate(
      {
        title: "公共知识库：远程办公是否应当成为常态？",
        description: "围绕远程办公展开的首次交锋",
        category: "society",
        type: "quick1v1",
      },
      creator.id,
    );
    rootId = first.id;
    await adminService.approveDebate(admin.id, rootId);
    await debateService.joinDebate(rootId, debaterB.id, "B"); // 自动开始
    await speechService.createSpeech({
      debateId: rootId,
      userId: debaterB.id,
      content: "远程办公显著提升了通勤效率与时间灵活性，这是有调研数据支撑的。",
    });
    // 阵营投票 2:1 → A 胜
    await voteService.voteSide({ debateId: rootId, voterId: voterC.id, side: "A" });
    await voteService.voteSide({ debateId: rootId, voterId: voterD.id, side: "A" });
    await voteService.voteSide({ debateId: rootId, voterId: debaterB.id, side: "B" });
    await voteService.voteBest({ debateId: rootId, voterId: voterC.id, targetUserId: creator.id });
    await adminService.forceEndDebate(admin.id, rootId, "第一场结束");

    // 重辩（第二场 pending → 审核 → 结束，平票 1:1）
    const second = await debateService.restartDebate(rootId, voterC.id);
    childId = second.id;
    await adminService.approveDebate(admin.id, childId);
    // 第二场：voterC 为重辩申请者 → 审核后自动成为 A1；debaterB 加入反方
    await debateService.joinDebate(childId, debaterB.id, "B"); // 自动开始
    await voteService.voteSide({ debateId: childId, voterId: voterC.id, side: "A" });
    await voteService.voteSide({ debateId: childId, voterId: debaterB.id, side: "B" });
    await adminService.forceEndDebate(admin.id, childId, "第二场结束");
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("重辩链：从后代出发可聚合整条链（2 场，含各自胜负评估）", async () => {
    const chain = await debateService.getDebateChain(childId);
    assert.equal(chain.items.length, 2, "链上应有 2 场");
    assert.equal(chain.rootId, rootId);
    assert.equal(chain.items[0].id, rootId);
    assert.equal(chain.items[1].id, childId);
    // 首场：A 胜 2:1，且有最佳辩手
    const r0 = chain.items[0].result!;
    assert.equal(r0.winnerSide, "A");
    assert.equal(r0.sideA, 2);
    assert.equal(r0.sideB, 1);
    assert.equal(r0.bestDebaterId, creator.id);
    assert.equal(chain.items[0].settled, 1);
    // 第二场：平票 1:1 → 平局（winnerSide null）
    const r1 = chain.items[1].result!;
    assert.equal(r1.winnerSide, null);
    assert.equal(r1.sideA, 1);
    assert.equal(r1.sideB, 1);
  });

  it("重辩链：从任意一场均可上溯（root 视角返回同一链）", async () => {
    const chain = await debateService.getDebateChain(rootId);
    assert.equal(chain.items.length, 2);
    assert.equal(chain.rootId, rootId);
  });

  it("检索：辩题标题命中（含描述字段）", async () => {
    const r = await searchAll("远程办公");
    const hit = r.debates.find((d: any) => d.id === rootId);
    assert.ok(hit, "应命中首场辩题");
    assert.ok(r.debates.length >= 1);
    // 无相关关键词
    const empty = await searchAll("完全不存在的关键词xyz");
    assert.equal(empty.debates.length, 0);
    assert.equal(empty.speeches.length, 0);
  });

  it("检索：发言内容命中并带上下文片段", async () => {
    const r = await searchAll("通勤效率");
    const hit = r.speeches.find((s: any) => s.debate_id === rootId);
    assert.ok(hit, "应命中发言");
    assert.equal(hit.debate_title, "公共知识库：远程办公是否应当成为常态？");
    assert.ok(hit.snippet.includes("通勤效率"), "片段应包含关键词");
    assert.ok(hit.snippet.includes("…") || hit.content.length <= 52, "长文应有省略号片段");
  });

  it("检索：重辩后代场次同样可被检索（知识库按内容而非单场）", async () => {
    // 第二场标题与首场相同，说明内容跨场次可检索
    const r = await searchAll("远程办公");
    assert.ok(r.debates.some((d: any) => d.id === childId));
  });

  it("胜负评估复用：evaluateDebateResult 与结算一致（平局场次）", async () => {
    const r = await debateService.evaluateDebateResult(childId);
    assert.equal(r.winnerSide, null);
    assert.equal(r.bestDebaterId, null);
  });

  it("内容运营：编辑精选 toggle + 榜单结构（热度兜底排序）", async () => {
    // 取消设置前 board 不应含精选
    let board = await debateService.getCuratedBoard();
    assert.ok(!board.featured.some((f: any) => f.id === rootId));
    // 热度排序：root（1发言2辩手 hot=8）> child（0发言2辩手 hot=6）
    assert.ok(board.topFinished.length >= 2);
    assert.equal(board.topFinished[0].id, rootId);
    assert.ok(board.topFinished[0].hot > board.topFinished[1].hot);

    // 设为精选 → 进入 featured；且不再出现在 topFinished
    await adminService.toggleCurate(admin.id, rootId, true);
    board = await debateService.getCuratedBoard();
    assert.equal(board.featured[0].id, rootId);
    assert.ok(!board.topFinished.some((f: any) => f.id === rootId));
    // 取消精选 → 移出 featured
    await adminService.toggleCurate(admin.id, rootId, false);
    board = await debateService.getCuratedBoard();
    assert.ok(!board.featured.some((f: any) => f.id === rootId));
  });

  it("相关辩题：同分类优先、排除自身与重辩链场次", async () => {
    // 另外建两场等待中的辩题：一场同分类 society、一场 tech
    const same = await debateService.createDebate(
      { title: "相关推荐：弹性工作制是否应该全面推广？", category: "society" },
      creator.id,
    );
    const other = await debateService.createDebate(
      { title: "相关推荐：人工智能是否应当全面监管？", category: "tech" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, same.id);
    await adminService.approveDebate(admin.id, other.id);

    const rel = await debateService.getRelatedDebates(rootId, 4);
    const ids = rel.map((r: any) => r.id);
    assert.ok(!ids.includes(rootId), "不应推荐自身");
    assert.ok(!ids.includes(childId), "不应推荐同重辩链的场次（标题相同）");
    assert.ok(ids.includes(same.id), "应推荐同分类辩题");
    assert.equal(rel[0].id, same.id, "同分类应排在首位");
    assert.equal(rel[0].category, "society");
  });
});
