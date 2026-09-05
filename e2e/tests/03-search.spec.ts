// e2e/tests/03-search.spec.ts
// 知识库检索：大厅搜索框命中辩题并跳转

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("检索：输入关键词出现结果面板，点击辩题结果进入档案", async ({ page }) => {
  await login(page, "testuser");

  const searchBox = page.getByRole("textbox", { name: "全文检索" });
  await searchBox.fill("AI");

  // 下拉面板出现「辩题」分组与命中行
  const panel = page.locator("text=🏛️ 辩题").first();
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole("link", { name: /人工智能是否应该拥有道德判断能力/ }).first(),
  ).toBeVisible();

  // 点击辩题结果 → 进入该辩论档案页
  await page
    .getByRole("link", { name: /人工智能是否应该拥有道德判断能力/ })
    .first()
    .click();
  await page.waitForURL("**/debate/*", { timeout: 15_000 });
  await expect(page.locator("h1")).toContainText("人工智能", { timeout: 20_000 });
});
