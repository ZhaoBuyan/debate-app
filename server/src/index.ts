// server/src/index.ts

import { App } from "./app.js";
import { logger } from "./utils/logger.js";

console.log("🚀 启动入口已加载");

const app = new App();

async function bootstrap() {
  try {
    await app.initialize();
    app.start();
  } catch (error) {
    logger.error("❌ 应用启动失败:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  logger.info("收到 SIGINT 信号，正在关闭...");
  app.shutdown();
});

process.on("SIGTERM", () => {
  logger.info("收到 SIGTERM 信号，正在关闭...");
  app.shutdown();
});

bootstrap();
