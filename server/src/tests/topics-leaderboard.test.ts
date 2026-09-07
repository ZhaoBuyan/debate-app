// server/src/tests/topics-leaderboard.test.ts
// 辩题众创（D-10）与排行榜回归

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import authService from "../services/auth.service.js";
import topicsService from "../services/topics.service.js";
import leaderboardService from "../services/leaderboard.service.js";
import debateService from "../services/debate.service.js";
import adminService from "../services/admin.service.js";
import { getDb } from "../database/index.js";
import { cleanupTestDb } from "./helpers.js";

describe("辩题众创与排行榜（D-10 / 榜单）", () => {
  let creator: any;
  let voterA: any;
  let voterB: any;
  let admin: any;

  before(async () => {
    admin = (await authService.register("admin_tp", "secret123")).user;
    creator = (await authService.register("proposer1", "secret123")).user;
    voterA = (await authService.register("voter_aa", "secret123")).user;
    voterB = (await authService.register("voter_bb", "secret123")).user;
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("提案：非法标题拒绝 / 重复提案拒绝", async () => {
    await assert.rejects(
      topicsService.create(creator.id, { title: "太短" }),
      /5-60/,
    );
    await topicsService.create(creator.id, {
      title: "应不应该允许小学生使用手机？",
      description: "测试描述",
      category: "edu",
    });
    await assert.rejects(
      topicsService.create(voterA.id, {
        title: "应不应该允许小学生使用手机？",
      }),
      /已经在众创池里/,
    );
  });

  it("投票：一人一票可取消（toggle），票数正确", async () => {
    const list = await topicsService.list();
    const id = list[0].id;
    assert.equal(list[0].vote_count, 0);

    const r1 = await topicsService.toggleVote(id, voterA.id);
    assert.equal(r1.voted, true);
    assert.equal(r1.voteCount, 1);
    await topicsService.toggleVote(id, voterB.id);
    const r3 = await topicsService.toggleVote(id, voterA.id); // 取消
    assert.equal(r3.voted, false);
    assert.equal(r3.voteCount, 1);

    // viewerId 附带已投标记
    const withViewer = await topicsService.list(voterB.id);
    assert.equal(withViewer[0].voted, true);
  });

  it("采纳：生成 pending 辩题（提交者为创建人）并从池中移除", async () => {
    const list = await topicsService.list();
    const id = list[0].id;
    const created = await topicsService.adopt(id);
    const debate = await debateService.getDebateById(created.id);
    assert.equal(debate!.status, "pending");
    assert.equal(debate!.creator_id, creator.id);
    assert.equal(debate!.title, list[0].title);
    const after = await topicsService.list();
    assert.ok(!after.some((t: any) => t.id === id), "采纳后应从众创池移除");
  });

  it("移除：不存在时拒绝；存在时删除", async () => {
    await assert.rejects(topicsService.remove(99999), /不存在或已被移除/);
    await topicsService.create(voterA.id, {
      title: "临时提案准备被删除的辩题内容标题",
    });
    const list = await topicsService.list();
    const target = list.find((t) => t.title.startsWith("临时提案"));
    await topicsService.remove(target!.id);
    const after = await topicsService.list();
    assert.ok(!after.some((t) => t.id === target!.id));
  });

  it("排行榜：段位榜按积分排序，活跃榜统计 30 天发言", async () => {
    const db = await getDb();
    // 直接构造积分差
    await db.run("UPDATE users SET points = 500 WHERE id = ?", [creator.id]);
    await db.run("UPDATE users SET points = 10 WHERE id = ?", [voterA.id]);
    await db.run("UPDATE users SET points = 0 WHERE id = ?", [voterB.id]);

    const points = await leaderboardService.byPoints();
    assert.ok(points.length >= 4);
    assert.equal(points[0].id, creator.id);
    assert.ok(points[0].points > points[1].points);

    const myRank = await leaderboardService.myRank(voterA.id);
    assert.ok(myRank! >= 2);
    const topRank = await leaderboardService.myRank(creator.id);
    assert.equal(topRank, 1);

    // 活跃榜：结构校验（30 天窗口内的发言统计）
    const active = await leaderboardService.byActivity();
    assert.ok(Array.isArray(active));
    assert.ok(active.every((r) => r.speech_30d! >= 1));
  });
});
