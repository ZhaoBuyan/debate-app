// e2e/tests/02-room.spec.ts
// 辩论室观众互动：观战种子辩论 → 聊天 / 情绪 / 支持率
// 种子数据：AI 辩题（ongoing）中 testuser 是 B1 辩手

import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("观众互动：聊天发送 / 情绪反馈计数 / 支持率更新", async ({ page }) => {
  await login(page, "testuser");

  // 进入种子 ongoing 辩论
  await page.getByRole("link", { name: /人工智能是否应该拥有道德判断能力/ }).first().click();
  await page.waitForURL("**/debate/*", { timeout: 15_000 });
  // 房间加载完成：支持率横幅出现（种子 5 人表态）
  await expect(page.getByText("5 人表态")).toBeVisible({ timeout: 20_000 });

  // 1) 聊天：发送后消息出现在聊天区
  const chatBox = page.getByPlaceholder(/发一条消息/);
  await chatBox.fill("大家好，我是来观战的观众！");
  await chatBox.press("Enter");
  await expect(page.getByText("大家好，我是来观战的观众！")).toBeVisible({ timeout: 10_000 });

  // 2) 情绪：给第一条发言点 🔥 → 顶部观众情绪卡片计数 +1
  const fireOnSpeech = page
    .getByRole("button", { name: /反馈给本条发言/ })
    .first();
  await fireOnSpeech.click();
  const aggregate = page.getByRole("button", { name: "发送精彩" });
  await expect(aggregate.locator("div").filter({ hasText: /^1$/ }).first()).toBeVisible({
    timeout: 10_000,
  });

  // 3) 支持率：观众表态后横幅人数变化（种子 5 人 → 6 人）
  await page.getByRole("button", { name: /支持 正方/ }).click();
  await expect(page.getByText("6 人表态")).toBeVisible({ timeout: 10_000 });
});
