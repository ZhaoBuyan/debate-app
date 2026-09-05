// server/src/tests/integration.test.ts
// HTTP 层集成回归：真实启动 App（独立临时库 + 随机端口）
// 覆盖：安全头 / 健康检查 / 鉴权矩阵(401/403) / 创建-审核-精选全链路 / 注册校验

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "net";
import { App } from "../app.js";
import { cleanupTestDb } from "./helpers.js";

const BASE = "http://127.0.0.1";
let port = 0;
let app: App;

async function req(method: string, path: string, token?: string, body?: any) {
  const res = await fetch(`${BASE}:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, data: (await res.json()) as any };
}

describe("HTTP 集成（真实服务）", () => {
  before(async () => {
    app = new App();
    await app.initialize();
    // 手动监听随机端口（App.start 会占用固定端口，这里避免冲突）
    const httpServer = (app as any).httpServer;
    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });
    port = (httpServer.address() as AddressInfo).port;
  });

  after(async () => {
    try {
      clearInterval((app as any).autoStartTimer);
    } catch { /* ignore */ }
    try {
      await (app as any).io?.close();
    } catch { /* ignore */ }
    const httpServer = (app as any).httpServer;
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await cleanupTestDb();
  });

  it("健康检查：200 + API 安全头（不缓存）", async () => {
    const r = await req("GET", "/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.data.status, "ok");
    assert.match(r.headers.get("cache-control") || "", /no-store/);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  it("种子数据：列表可见 3 场辩论（公开接口）", async () => {
    const r = await req("GET", "/api/debates");
    assert.equal(r.status, 200);
    assert.ok(r.data.data.length >= 3);
  });

  it("鉴权矩阵：未登录访问受保护接口 401", async () => {
    assert.equal((await req("POST", "/api/debates", undefined, { title: "无权创建的长标题内容", category: "general" })).status, 401);
    assert.equal((await req("GET", "/api/admin/users")).status, 401);
  });

  it("鉴权矩阵：登录成功 200 / 错误密码 401", async () => {
    const ok = await req("POST", "/api/auth/login", undefined, { username: "admin", password: "123456" });
    assert.equal(ok.status, 200);
    assert.ok(ok.data.data.token);
    const bad = await req("POST", "/api/auth/login", undefined, { username: "admin", password: "wrong" });
    assert.equal(bad.status, 401);
  });

  it("鉴权矩阵：普通用户访问管理接口 403（HTTP 层）", async () => {
    const login = await req("POST", "/api/auth/login", undefined, { username: "testuser", password: "123456" });
    const r = await req("GET", "/api/admin/users", login.data.data.token);
    assert.equal(r.status, 403);
  });

  it("全链路：创建辩题 → 管理员审核 → 设精选 → 榜单可见 → 取消", async () => {
    const adminLogin = await req("POST", "/api/auth/login", undefined, { username: "admin", password: "123456" });
    const token = adminLogin.data.data.token;
    const userLogin = await req("POST", "/api/auth/login", undefined, { username: "testuser", password: "123456" });
    const userToken = userLogin.data.data.token;

    const created = await req("POST", "/api/debates", userToken, {
      title: "集成测试：城市是否应该全面禁放烟花爆竹？",
      category: "society",
      type: "quick1v1",
    });
    assert.equal(created.status, 200);
    const id = created.data.data.id;

    const pending = await req("GET", `/api/debates/${id}`);
    assert.equal(pending.data.data.status, "pending");

    const approved = await req("PUT", `/api/admin/debates/${id}/approve`, token, { coolDownMinutes: 0 });
    assert.equal(approved.status, 200);
    const detail = await req("GET", `/api/debates/${id}`);
    assert.equal(detail.data.data.status, "waiting");
    assert.equal(detail.data.data.debate_type, "quick1v1");

    // 精选 + 榜单可见
    const curate = await req("PUT", `/api/admin/debates/${id}/curate`, token, { curated: true });
    assert.equal(curate.status, 200);
    const board = await req("GET", "/api/debates/curated-board");
    assert.ok(board.data.data.featured.some((f: any) => f.id === id));
    // 取消精选
    await req("PUT", `/api/admin/debates/${id}/curate`, token, { curated: false });
    const board2 = await req("GET", "/api/debates/curated-board");
    assert.ok(!board2.data.data.featured.some((f: any) => f.id === id));
  });

  it("注册校验：非法用户名经 HTTP 返回 400 + 中文错误信息", async () => {
    const r = await req("POST", "/api/auth/register", undefined, { username: "包含 空格", password: "secret123" });
    assert.equal(r.status, 400);
    assert.match(r.data.error || "", /仅支持中文、字母、数字与下划线/);
  });

  it("重辩申请需认证：匿名 401（REST 层对象保护）", async () => {
    const r = await req("POST", "/api/debates/not-exist/restart");
    assert.equal(r.status, 401);
  });
});
