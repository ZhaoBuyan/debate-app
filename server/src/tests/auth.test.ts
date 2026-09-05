// server/src/tests/auth.test.ts
// 用户模块回归测试：注册校验 / 登录 / 封禁-解封 / 警告自动封禁 / 资料查询

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import authService from "../services/auth.service.js";
import adminService from "../services/admin.service.js";
import { cleanupTestDb } from "./helpers.js";

describe("用户模块（U-01~U-05）", () => {
  let admin: any;
  let bob: any;

  before(async () => {
    admin = await authService.register("admin_test", "secret123");
    bob = await authService.register("bob_test", "secret123");
  });

  after(async () => {
    await cleanupTestDb();
  });

  it("注册：用户名短于3字符被拒绝", async () => {
    await assert.rejects(
      authService.register("ab", "secret123"),
      /3-20 个字符/,
    );
  });

  it("注册：密码短于6字符被拒绝", async () => {
    await assert.rejects(
      authService.register("abcd", "12345"),
      /至少需要6个字符/,
    );
  });

  it("注册：用户名重复被拒绝", async () => {
    await assert.rejects(
      authService.register("bob_test", "secret123"),
      /用户名已存在/,
    );
  });

  it("注册：返回 JWT 与默认角色/段位", async () => {
    const r = await authService.register("carol_test", "secret123");
    assert.ok(r.token);
    assert.equal(r.user.role, "user");
    assert.equal(r.user.rank, "青铜");
    assert.equal(r.user.points, 0);
  });

  it("登录：密码错误被拒绝", async () => {
    await assert.rejects(
      authService.login("bob_test", "wrong-pass"),
      /用户名或密码错误/,
    );
  });

  it("登录：成功后返回资料与 token", async () => {
    const r = await authService.login("bob_test", "secret123");
    assert.ok(r.token);
    assert.equal(r.user.username, "bob_test");
  });

  it("getProfile：返回完整公开字段（/auth/me 数据源）", async () => {
    const p = await authService.getProfile(bob.user.id);
    assert.ok(p);
    assert.equal(p.username, "bob_test");
    assert.ok("points" in p && "rank" in p && "wins" in p && "losses" in p);
    assert.ok("created_at" in p);
  });

  it("修改密码：旧密码错误被拒，正确后可用新密码登录", async () => {
    await assert.rejects(
      authService.changePassword(bob.user.id, "wrong-old", "newpass123"),
      /当前密码不正确/,
    );
    await authService.changePassword(bob.user.id, "secret123", "newpass123");
    const r = await authService.login("bob_test", "newpass123");
    assert.ok(r.token);
    // 恢复原密码，避免影响后续用例
    await authService.changePassword(bob.user.id, "newpass123", "secret123");
  });

  it("更新头像：非法值被拒，成功后资料更新", async () => {
    await assert.rejects(authService.updateAvatar(bob.user.id, ""), /头像不合法/);
    const p = await authService.updateAvatar(bob.user.id, "🎯");
    assert.equal(p!.avatar, "🎯");
  });

  it("我的活动概览：包含资料/战绩/参与历史/获票", async () => {
    const act = await authService.getMyActivities(bob.user.id);
    assert.ok(act.profile);
    assert.ok(Array.isArray(act.joined));
    assert.ok("bestDebaterVotes" in act && "speechTotal" in act);
  });

  it("封禁：永久封禁后无法登录", async () => {
    await adminService.banUser(admin.user.id, bob.user.id, "测试永久封禁", null);
    await assert.rejects(
      authService.login("bob_test", "secret123"),
      /永久封禁/,
    );
    await adminService.unbanUser(admin.user.id, bob.user.id);
    // 解封后恢复登录
    const r = await authService.login("bob_test", "secret123");
    assert.ok(r.token);
  });

  it("封禁：临时封禁到期后登录自动解封", async () => {
    // 时长传负数 = 已到期
    await adminService.banUser(admin.user.id, bob.user.id, "测试临时封禁", -1000);
    const r = await authService.login("bob_test", "secret123");
    assert.ok(r.token);
    const p = await authService.getProfile(bob.user.id);
    assert.equal(p.is_banned, 0);
  });

  it("警告：满3次自动封禁", async () => {
    const target = await authService.register("warn_me", "secret123");
    for (let i = 0; i < 3; i++) {
      await adminService.warnUser(admin.user.id, target.user.id, `警告${i + 1}`);
    }
    const p = await authService.getProfile(target.user.id);
    assert.equal(p.warning_count, 3);
    assert.equal(p.is_banned, 1);
    assert.ok(p.banned_until > Date.now());
    await assert.rejects(
      authService.login("warn_me", "secret123"),
      /封禁/,
    );
  });

  it("管理员日志：审计记录落库（AD-09）", async () => {
    const logs = await adminService.listLogs(50);
    const actions = logs.map((l: any) => l.action_type);
    assert.ok(actions.includes("warn_user"));
    assert.ok(actions.includes("auto_ban_user"));
    assert.ok(actions.includes("unban_user"));
  });
});
