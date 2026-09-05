// e2e/playwright.config.ts
// 配置：真实启动「后端(3110, 独立临时库) + 前端 vite(5173)」，单 worker 串行

import path from "path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: "http://localhost:5173",
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  globalSetup: "./global-setup.ts",

  webServer: [
    {
      // 后端：独立测试库，每次运行前自动重建种子数据
      command: "node server-runner.cjs",
      cwd: path.join(__dirname),
      url: "http://localhost:3110/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 40_000,
    },
    {
      // 前端：vite dev server（需在 client 目录下运行）
      command: "node node_modules/vite/bin/vite.js --port 5173 --strictPort",
      cwd: path.join(__dirname, "..", "client"),
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 40_000,
      env: {
        ...process.env,
        DEBATE_API_TARGET: "http://localhost:3110",
      },
    },
  ],
});
