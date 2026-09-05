// e2e/tests/helpers.ts
// 公共工具：UI 登录（走真实表单）

import type { Page } from "@playwright/test";

export async function login(page: Page, username: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: /登\s*录/, exact: true }).click();
  // 登录成功会跳转大厅
  await page.waitForURL("**/debates", { timeout: 15_000 });
}

/** 导航到某场辩论的房间页 */
export function roomUrl(id: string): string {
  return `/debate/${id}`;
}
