// e2e/tests/04-flow.spec.ts
// 全链路旅程：创建 1v1 辩题 → 管理员审核 → 对手加入即开赛 → 发言 + AI 提炼
// 扮演：admin（创建/审核/正方）与 张三（反方）

import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

const TITLE = `E2E 全链路：早睡是否一定更健康？${Date.now() % 10000}`;

async function createDebate(page: Page): Promise<void> {
  await page.goto("/create");
  await page.getByLabel("辩题标题").fill(TITLE);
  // 选择 快速 1v1 形式
  await page.getByText("⚡ 快速 1v1", { exact: false }).click();
  await page.getByRole("button", { name: "提交审核" }).click();
  // 创建成功 → 进入房间页并显示待审核提示
  await page.waitForURL("**/debate/*", { timeout: 15_000 });
  await expect(page.getByText(/正在等待管理员审核/)).toBeVisible({ timeout: 15_000 });
}

async function approveInAdmin(page: Page): Promise<void> {
  await page.goto("/admin");
  await page.getByRole("tab", { name: "🕵️ 辩题审核" }).click();
  const row = page.locator(".space-y-3 > div", { hasText: TITLE }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "通过" }).click();
  await expect(row).not.toBeVisible({ timeout: 15_000 });
}

test("创建 → 审核 → 1v1 开赛 → 正方发言被 AI 提炼", async ({ browser }) => {
  // ---------- admin：创建 + 审核 ----------
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, "admin");
  await createDebate(adminPage);

  const roomUrl = adminPage.url();
  await approveInAdmin(adminPage);

  // 回到房间：应变为「报名中」，且创建者（admin）已是正方 A1（无报名按钮）
  await adminPage.goto(roomUrl);
  await expect(adminPage.getByText("📢 报名中", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(adminPage.getByText(/点击加入/)).not.toBeVisible({ timeout: 5_000 });

  // ---------- 张三：加入反方 → 满 2 人立即开赛 ----------
  const userCtx = await browser.newContext();
  const userPage = await userCtx.newPage();
  await login(userPage, "张三");
  await userPage.goto(roomUrl);
  const joinB = userPage.getByRole("button", { name: /点击加入/ }).filter({ hasText: "反方" });
  await joinB.click();
  // 加入成功 toast
  await expect(userPage.getByText(/已加入反方/)).toBeVisible({ timeout: 10_000 });

  // ---------- admin：刷新房间 → ongoing → 发言 ----------
  await adminPage.reload();
  // 轮次横幅出现（第 1 轮，当前发言为正方 admin）
  await expect(adminPage.getByText(/第 1 轮/)).toBeVisible({ timeout: 20_000 });

  const speechBox = adminPage.locator("textarea");
  const content = "我方坚持认为早睡能提升睡眠质量与白天效率，医学证据充分支持这一观点。";
  await speechBox.fill(content);
  await adminPage.getByRole("button", { name: "提交发言" }).click();

  // 发言出现在时间线，且 AI 提炼框随之生成
  await expect(adminPage.getByText(content, { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(adminPage.getByText(/AI 论点提炼/).first()).toBeVisible({ timeout: 20_000 });

  // 双方都能看到（张三侧刷新后时间线出现该发言）
  await userPage.reload();
  await expect(userPage.getByText(content, { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });

  await adminCtx.close();
  await userCtx.close();
});
