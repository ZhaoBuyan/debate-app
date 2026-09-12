// e2e/tests/05-guest.spec.ts
// 游客模式：未登录可浏览公开内容，互动时引导登录

import { test, expect } from "@playwright/test";

test.describe("游客模式（只读浏览 + 登录引导）", () => {
  test("游客可浏览大厅/榜单，导航显示登录入口且无受限菜单", async ({ page }) => {
    await page.goto("/debates");
    await expect(page.getByText("📋 辩题大厅")).toBeVisible({ timeout: 20_000 });

    // 导航：登录按钮可见；创建辩题/个人资料入口隐藏（限定在导航栏内断言）
    await expect(page.getByRole("link", { name: /登录 \/ 注册/ }).first()).toBeVisible();
    const nav = page.locator("nav").first();
    await expect(nav.getByRole("link", { name: "➕ 创建辩题" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "👤 个人资料" })).toHaveCount(0);

    // 排行榜游客可看
    await page.getByRole("link", { name: "🏆 排行" }).first().click();
    await page.waitForURL("**/leaderboard");
    await expect(page.getByText("🏆 排行榜")).toBeVisible({ timeout: 15_000 });
  });

  test("游客可实时观战档案，互动按钮引导登录", async ({ page }) => {
    await page.goto("/debates");
    await page
      .getByRole("link", { name: /人工智能是否应该拥有道德判断能力/ })
      .first()
      .click();
    await page.waitForURL("**/debate/*", { timeout: 15_000 });

    // 游客横幅 + 房间实时数据已加载（支持率横幅：人数随后续用例变化，用正则）
    await expect(page.getByText(/游客模式/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\d+ 人表态/).first()).toBeVisible({ timeout: 20_000 });

    // 点击支持 → 引导登录提示（不实际投票）
    await page.getByRole("button", { name: /支持 正方/ }).click();
    await expect(page.getByText("请先登录后再参与互动")).toBeVisible({ timeout: 10_000 });

    // 发言输入区对游客不可见（非辩手）
    await expect(page.getByRole("button", { name: "提交发言" })).toHaveCount(0);
  });

  test("游客可访问公开个人主页", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByText("🏆 排行榜")).toBeVisible({ timeout: 20_000 });
    // 点击榜单第一行进入公开主页
    await page.locator("main li a").first().click();
    await page.waitForURL("**/u/*");
    await expect(page.getByText("🗂️ 辩论足迹")).toBeVisible({ timeout: 15_000 });
  });
});
