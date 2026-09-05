// e2e/tests/01-auth.spec.ts
// 认证旅程：登录 / 导航 / 移动端汉堡菜单

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("认证与导航", () => {
  test("admin 登录成功并进入大厅，导航显示用户名与段位", async ({ page }) => {
    await login(page, "admin");
    await expect(page.getByText("📋 辩题大厅")).toBeVisible();
    const profileLink = page.getByTitle("个人资料");
    await expect(profileLink).toContainText("admin");
    await expect(profileLink).toContainText("王者"); // seed：admin 段位
  });

  test("错误密码登录被拦截并提示", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("用户名").fill("admin");
    await page.getByLabel("密码", { exact: true }).fill("wrong-pass");
    await page.getByRole("button", { name: /登\s*录/, exact: true }).click();
    await expect(page.getByText("用户名或密码错误")).toBeVisible();
    // 仍停留在登录页
    expect(page.url()).toContain("/login");
  });

  test("未登录访问受保护页面会重定向到登录页", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL("**/login", { timeout: 10_000 });
  });

  test("移动端视口：汉堡菜单可展开并进入个人资料", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await login(page, "testuser");
    await page.getByRole("button", { name: "打开菜单" }).click();
    await page.getByRole("link", { name: "👤 个人资料" }).click();
    await page.waitForURL("**/profile");
    await expect(page.getByText("我的辩论记录")).toBeVisible();
    await context.close();
  });
});
