// server/src/socket/index.ts

import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../utils/config.js";
import { getDb } from "../database/index.js";
import { ClientToServerEvents, ServerToClientEvents } from "../types/socket.js";
import roomManager, { roomName } from "./room.manager.js";
import { registerChatHandlers, HandlerContext } from "./handlers/chat.handler.js";
import { registerSpeechHandlers } from "./handlers/speech.handler.js";
import { registerSupportHandlers } from "./handlers/support.handler.js";
import { registerVoteHandlers } from "./handlers/vote.handler.js";
import { registerAdminHandlers } from "./handlers/admin.handler.js";
import { logger } from "../utils/logger.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

export const ADMIN_ROOM = "admins";

/**
 * 初始化 Socket.IO：
 * 1. 握手阶段用 JWT 认证（与 REST 同一套 token）
 * 2. 连接后注册全部房间事件处理器
 */
export const setupSocket = (io: IoServer) => {
  // ---- 握手认证 ----
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as any)?.token;
      if (!token) return next(new Error("未认证，请先登录"));

      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: string;
      };
      const db = await getDb();
      const user = await db.get(
        `SELECT id, username, role, avatar, is_banned FROM users WHERE id = ?`,
        [decoded.userId],
      );
      if (!user) return next(new Error("用户不存在"));
      if (user.is_banned) return next(new Error("账号已被封禁"));

      socket.data.user = user;
      next();
    } catch (err: any) {
      if (err?.name === "TokenExpiredError") {
        return next(new Error("登录已过期，请重新登录"));
      }
      next(new Error("Token 无效"));
    }
  });

  io.on("connection", (socket: IoClient) => {
    const user = socket.data.user;
    logger.info(`🟢 Socket 连接: ${socket.id} (${user?.username || "未知"})`);

    // 管理员加入独立频道，便于实时接收举报等通知
    if (user && (user.role === "admin" || user.role === "super_admin")) {
      socket.join(ADMIN_ROOM);
    }

    const ctx: HandlerContext = { io, socket, rooms: roomManager };

    // 注册业务事件
    registerChatHandlers(ctx);
    registerSpeechHandlers(ctx);
    registerSupportHandlers(ctx);
    registerVoteHandlers(ctx);
    registerAdminHandlers(ctx);

    // 房间加入 / 离开
    socket.on("join_room", (data) => {
      roomManager
        .join(io, socket, data.debateId)
        .catch((err) => socket.emit("error", err.message || "加入房间失败"));
    });

    socket.on("leave_room", () => {
      roomManager.leave(socket);
    });

    socket.on("disconnect", () => {
      roomManager.onDisconnect(socket);
      logger.info(`🔴 Socket 断开: ${socket.id}`);
    });
  });
};

export { roomName };
