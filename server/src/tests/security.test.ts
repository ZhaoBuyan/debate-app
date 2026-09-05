// server/src/tests/security.test.ts
// 安全纵深回归：响应头 / 输入校验（用户名/消息/举报/公告）/ 限流器窗口逻辑

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "net";
import express from "express";
import authService from "../services/auth.service.js";
import adminService from "../services/admin.service.js";
import debateService from "../services/debate.service.js";
import chatService from "../services/chat.service.js";
import reportService from "../services/report.service.js";
import sensitiveService from "../services/sensitive.service.js";
import rateLimiter from "../socket/rate.limit.js";
import { securityHeaders } from "../middleware/security.js";
import { cleanupTestDb, registerUsers } from "./helpers.js";

describe("安全纵深", () => {
  let admin: any;
  let users!: Awaited<ReturnType<typeof registerUsers>>;
  let debateId!: string;

  before(async () => {
    admin = (await authService.register("admin_sec", "secret123")).user;
    users = await registerUsers(authService, ["sec_a", "sec_b"]);
    // 供聊天长度用例使用的辩论
    const { id } = await debateService.createDebate(
      { title: "安全测试用辩题标题内容安全", category: "general", type: "quick1v1" },
      users[0].id,
    );
    await adminService.approveDebate(admin.id, id);
    debateId = id;
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("响应头：nosniff / 禁止 iframe 嵌入 / Referrer / API 不缓存", async () => {
    const app = express();
    app.use(securityHeaders);
    app.get("/", (_q, r) => r.json({ ok: 1 }));
    app.get("/api/ping", (_q, r) => r.json({ ok: 1 }));

    const srv = app.listen(0);
    const port = (srv.address() as AddressInfo).port;
    try {
      const page = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(page.headers.get("x-content-type-options"), "nosniff");
      assert.equal(page.headers.get("x-frame-options"), "DENY");
      assert.match(
        page.headers.get("referrer-policy") || "",
        /strict-origin-when-cross-origin/,
      );
      assert.ok((page.headers.get("content-security-policy") || "").includes("frame-ancestors 'none'"));

      const api = await fetch(`http://127.0.0.1:${port}/api/ping`);
      assert.match(api.headers.get("cache-control") || "", /no-store/);
      assert.match(api.headers.get("pragma") || "", /no-cache/);
    } finally {
      srv.close();
    }
  });

  it("注册：用户名含非法字符被拒绝（仅中文/字母/数字/下划线）", async () => {
    await assert.rejects(
      authService.register("bad name!", "secret123"),
      /仅支持中文、字母、数字与下划线/,
    );
    await assert.rejects(
      authService.register("名称<脚本>", "secret123"),
      /仅支持中文、字母、数字与下划线/,
    );
  });

  it("注册：用户名超长（>20）被拒绝", async () => {
    await assert.rejects(
      authService.register("a".repeat(21), "secret123"),
      /3-20 个字符/,
    );
  });

  it("注册：首尾空格自动裁剪后成功", async () => {
    const r = await authService.register("  spaced_user  ", "secret123");
    assert.equal(r.user.username, "spaced_user");
    // 裁剪后的用户名可正常登录
    const login = await authService.login("spaced_user", "secret123");
    assert.ok(login.token);
  });

  it("聊天消息：超过 500 字被拒绝（防刷屏承载）", async () => {
    await assert.rejects(
      chatService.sendMessage({
        debateId,
        userId: users[1].id,
        content: "长".repeat(501),
      }),
      /最多500字/,
    );
    const ok = await chatService.sendMessage({
      debateId,
      userId: users[1].id,
      content: "长".repeat(500),
    });
    assert.equal(ok.content.length, 500);
  });

  it("举报原因：超 200 字被拒绝，合法长度可提交", async () => {
    await assert.rejects(
      reportService.create({
        targetUserId: users[0].id,
        targetType: "user",
        reason: "长".repeat(201),
        reporterId: users[1].id,
      }),
      /最多200字/,
    );
    const id = await reportService.create({
      targetUserId: users[0].id,
      targetType: "user",
      reason: "刷屏骚扰",
      reporterId: users[1].id,
    });
    assert.ok(id > 0);
  });

  it("公告：标题/内容超限被拒绝", async () => {
    await assert.rejects(
      adminService.createAnnouncement(admin.id, {
        title: "标".repeat(61),
        content: "内容",
      }),
      /最多60字/,
    );
    await assert.rejects(
      adminService.createAnnouncement(admin.id, {
        title: "标题",
        content: "内".repeat(2001),
      }),
      /最多2000字/,
    );
  });

  it("Socket 限流器：窗口内超限拦截、窗口过后恢复", async () => {
    // 3 次 / 60ms 窗口
    assert.equal(rateLimiter.tryAcquire("u:rate-test:speech", 3, 60), true);
    assert.equal(rateLimiter.tryAcquire("u:rate-test:speech", 3, 60), true);
    assert.equal(rateLimiter.tryAcquire("u:rate-test:speech", 3, 60), true);
    assert.equal(rateLimiter.tryAcquire("u:rate-test:speech", 3, 60), false, "第4次应被拦截");
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(rateLimiter.tryAcquire("u:rate-test:speech", 3, 60), true, "窗口过后恢复");
  });

  it("敏感词兜底：文本替换不因长文出问题", async () => {
    await sensitiveService.add("违禁内容", "high");
    const text = "这是一段包含违禁内容的长文本，违禁内容出现了两次".repeat(2);
    const out = await sensitiveService.filterText(text);
    assert.ok(!out.includes("违禁内容"));
  });
});
