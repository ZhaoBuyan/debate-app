// server/src/tests/moderation.test.ts
// 内容安全与治理回归测试：敏感词 / 举报处理 / 消息过滤与撤回 / 发言删除

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import authService from "../services/auth.service.js";
import adminService from "../services/admin.service.js";
import debateService from "../services/debate.service.js";
import speechService from "../services/speech.service.js";
import sensitiveService from "../services/sensitive.service.js";
import chatService from "../services/chat.service.js";
import reportService from "../services/report.service.js";
import { cleanupTestDb, registerUsers } from "./helpers.js";

describe("内容安全与治理（AD-05/06/07 + 敏感词链路）", () => {
  let admin: any;
  let users: Awaited<ReturnType<typeof registerUsers>>;
  let debateId: string;
  let reporter: any;
  let speaker: any;

  before(async () => {
    admin = (await authService.register("admin_m", "secret123")).user;
    users = await registerUsers(authService, ["mod_creator", "mod_speaker", "mod_reporter"]);
    const [creator, sp, rp] = users;
    speaker = sp;
    reporter = rp;

    // 搭建一场进行中的 1v1 辩论供内容测试使用
    const { id } = await debateService.createDebate(
      { title: "内容治理测试专用辩题标题内容", category: "general", type: "quick1v1" },
      creator.id,
    );
    await adminService.approveDebate(admin.id, id);
    await debateService.joinDebate(id, sp.id, "B"); // 自动开始
    debateId = id;
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("敏感词：添加/查重/列表/删除", async () => {
    const w = await sensitiveService.add("测试违禁词", "high");
    assert.ok(w.id);
    await assert.rejects(sensitiveService.add("测试违禁词", "low"), /已存在/);
    const list = await sensitiveService.list();
    assert.ok(list.some((x) => x.word === "测试违禁词"));
    await sensitiveService.remove(w.id);
    const list2 = await sensitiveService.list();
    assert.ok(!list2.some((x) => x.word === "测试违禁词"));
  });

  it("敏感词：filterText 按词长等长替换、contains 命中", async () => {
    await sensitiveService.add("暴力", "high");
    await sensitiveService.add("广告推销", "moderate");
    const out = await sensitiveService.filterText("拒绝暴力行为，抵制广告推销信息");
    assert.equal(out, "拒绝**行为，抵制****信息");
    assert.equal(await sensitiveService.contains("这里有暴力内容"), true);
    assert.equal(await sensitiveService.contains("这里很和平"), false);
  });

  it("聊天消息：内容自动过滤敏感词", async () => {
    const msg = await chatService.sendMessage({
      debateId,
      userId: reporter.id,
      content: "这条消息包含暴力词汇测试",
    });
    assert.equal(msg.content, "这条消息包含**词汇测试");
    assert.equal(msg.type, "chat");
  });

  it("发言内容同样经过敏感词过滤", async () => {
    const s = await speechService.createSpeech({
      debateId,
      userId: speaker.id,
      content: "我方认为暴力不是解决问题的合理方式。",
    });
    assert.ok(!s.content.includes("暴力"), "发言内容应被过滤");
    assert.equal(s.content, "我方认为**不是解决问题的合理方式。");
  });

  it("举报：提交后进入待处理列表，可标记处理/驳回", async () => {
    const messages = await chatService.getMessages(debateId);
    const targetMsg = messages.find((m: any) => m.user_id === reporter.id)!;
    const reportId = await reportService.create({
      debateId,
      messageId: targetMsg.id,
      targetUserId: reporter.id,
      targetType: "message",
      reason: "测试举报：疑似刷屏",
      reporterId: speaker.id,
    });
    assert.ok(reportId > 0);

    const pending = await reportService.list("pending");
    assert.ok(pending.some((r: any) => r.id === reportId));

    await reportService.handle(reportId, { action: "reject", note: "证据不足" }, admin.id);
    const after = await reportService.list("rejected");
    assert.ok(after.some((r: any) => r.id === reportId && r.handler_name === "admin_m"));
  });

  it("举报处理：delete_content 会删除目标内容（AD-05/06）", async () => {
    // 重新举报上一条含过滤词的发言
    const speeches = await speechService.getSpeechesByDebate(debateId);
    const target = speeches.find((s: any) => s.user_id === speaker.id)!;
    const rid = await reportService.create({
      debateId,
      speechId: target.id,
      targetUserId: speaker.id,
      targetType: "speech",
      reason: "测试举报：不当言论",
      reporterId: reporter.id,
    });
    await reportService.handle(rid, { action: "delete_content" }, admin.id);
    const after = await speechService.getSpeechesByDebate(debateId);
    const removed = after.find((s: any) => s.id === target.id)!;
    assert.ok(removed.content.includes("违规已被删除"));
    assert.equal(removed.summary, null);
  });

  it("管理员删除发言 + 撤回消息均写入审计日志", async () => {
    const speeches = await speechService.getSpeechesByDebate(debateId);
    const some = speeches[0];
    if (some && !some.content.includes("违规已被删除")) {
      await adminService.deleteSpeech(admin.id, some.id);
    }
    const msgs = await chatService.getMessages(debateId);
    const m = msgs.find((x: any) => x.type === "chat");
    if (m) {
      await chatService.recallMessage(m.id, admin.id);
      const after = await chatService.getMessages(debateId);
      const recalled = after.find((x: any) => x.id === m.id)!;
      assert.ok(recalled.content.includes("已被管理员撤回"));
    }
    const logs = await adminService.listLogs(50);
    assert.ok(logs.some((l: any) => l.action_type === "report_reject"));
    assert.ok(logs.some((l: any) => l.action_type === "report_delete_content"));
    assert.ok(logs.some((l: any) => l.action_type === "recall_message"));
  });
});
