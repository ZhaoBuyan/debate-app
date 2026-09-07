// server/src/app.ts

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer, Server as HttpServer } from "http";
import dotenv from "dotenv";

// 路由
import authRoutes from "./routes/auth.routes.js";
import debateRoutes from "./routes/debate.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import topicsRoutes from "./routes/topics.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import userRoutes from "./routes/user.routes.js";

// 中间件
import { rateLimiter } from "./middleware/rateLimit.js";
import { securityHeaders } from "./middleware/security.js";

// Socket 处理
import { setupSocket, ADMIN_ROOM } from "./socket/index.js";
import { setIo, clearIo } from "./socket/io-bus.js";

// 工具
import { logger } from "./utils/logger.js";
import { config } from "./utils/config.js";

// 数据库
import { getDb } from "./database/index.js";
import { seedDatabase } from "./database/seed.js";

// 服务
import debateService from "./services/debate.service.js";
import adminService from "./services/admin.service.js";
import roomManager from "./socket/room.manager.js";
import { Server as SocketServer } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "./types/socket.js";

dotenv.config();

export class App {
  private app: Express;
  private httpServer: HttpServer;
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents> | null = null;
  private autoStartTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  /**
   * 配置所有中间件
   */
  private configureMiddleware(): void {
    // CORS（支持逗号分隔多源）
    this.app.use(
      cors({
        origin: config.corsOrigins,
        credentials: true,
      }),
    );

    // 安全响应头（nosniff/iframe/CSP/API 不缓存）
    this.app.use(securityHeaders);

    // JSON 解析
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // 请求日志（开发环境）
    if (config.nodeEnv === "development") {
      this.app.use((req, res, next) => {
        logger.debug(`📨 ${req.method} ${req.url}`);
        next();
      });
    }

    // 全局限流
    this.app.use(rateLimiter);

    // 健康检查（不需要认证）
    this.app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: Date.now(),
        env: config.nodeEnv,
      });
    });
  }

  /**
   * 配置所有路由
   */
  private configureRoutes(): void {
    // 公开路由
    this.app.use("/api/auth", authRoutes);
    // 辩题路由：内部区分公开/需认证接口
    this.app.use("/api/debates", debateRoutes);
    // 公告（公开：仅返回启用中的公告）
    this.app.get("/api/announcements", async (req: Request, res: Response) => {
      try {
        const data = await adminService.listAnnouncements(true);
        res.json({ success: true, data });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    // 管理路由（内部统一 admin 权限校验）
    this.app.use("/api/admin", adminRoutes);
    this.app.use("/api/topics", topicsRoutes);
    this.app.use("/api/leaderboard", leaderboardRoutes);
    this.app.use("/api/users", userRoutes);

    // 404 处理
    this.app.use("*", (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: `路由 ${req.method} ${req.originalUrl} 不存在`,
      });
    });
  }

  /**
   * 配置全局错误处理
   */
  private configureErrorHandling(): void {
    this.app.use(
      (err: any, req: Request, res: Response, next: NextFunction) => {
        logger.error("❌ 服务器错误:", {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
        });

        // SQLite 错误
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({
            success: false,
            error: "数据冲突，请检查重复项",
          });
        }

        // JWT 错误
        if (err.name === "JsonWebTokenError") {
          return res.status(401).json({
            success: false,
            error: "Token 无效",
          });
        }

        if (err.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            error: "Token 已过期，请重新登录",
          });
        }

        // 默认 500
        res.status(500).json({
          success: false,
          error:
            config.nodeEnv === "development"
              ? err.message
              : "服务器内部错误，请稍后再试",
        });
      },
    );
  }

  /**
   * 初始化数据库并启动服务器
   */
  async initialize(): Promise<void> {
    try {
      // 1. 初始化数据库
      await getDb();

      // 2. 填充种子数据（首次运行）
      await seedDatabase();

      // 3. 配置 Socket.IO
      this.io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(
        this.httpServer,
        {
          cors: {
            origin: config.corsOrigins,
            credentials: true,
          },
        },
      );
      setupSocket(this.io);
    setIo(this.io);

      // 4. 启动自动调度：到点自动开始的辩论（D-07），每 10 秒检查一次
      this.autoStartTimer = setInterval(async () => {
        try {
          const startedIds = await debateService.autoStartDue();
          for (const id of startedIds) {
            if (!this.io) continue;
            this.io
              .to(ADMIN_ROOM)
              .emit("error", "系统通知：有辩论自动开始");
            // 向辩论房间广播开始事件并刷新状态
            this.io.to(`debate:${id}`).emit("debate_started");
            await roomManager.refreshRoom(this.io, id);
            logger.info(`⏰ 辩题 ${id} 已到时间自动开始`);
          }
        } catch (error) {
          logger.error("自动开始调度失败:", error);
        }
      }, 10 * 1000);

      logger.info("✅ 所有组件初始化完成");
    } catch (error) {
      logger.error("❌ 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 启动 HTTP 服务器
   */
  start(port: number = config.port): void {
    this.httpServer.listen(port, () => {
      logger.info(`🚀 服务器运行在 http://localhost:${port}`);
      logger.info(`📡 WebSocket 已就绪`);
      logger.info(`🌍 环境: ${config.nodeEnv}`);
    });
  }

  /**
   * 获取 Express 实例（用于测试）
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * 获取 Socket.IO 实例
   */
  getIo(): SocketServer | null {
    return this.io;
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    logger.info("🛑 正在关闭服务器...");
    if (this.autoStartTimer) {
      clearInterval(this.autoStartTimer);
    }
    if (this.io) {
      await this.io.close();
    }
    clearIo();
    this.httpServer.close(() => {
      logger.info("✅ 服务器已关闭");
      process.exit(0);
    });
  }
}
