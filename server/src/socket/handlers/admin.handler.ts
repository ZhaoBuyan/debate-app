// server/src/socket/handlers/admin.handler.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../../types/socket.js";
import { RoomManager, roomName } from "../room.manager.js";
import adminService from "../../services/admin.service.js";
import chatService from "../../services/chat.service.js";
import type { HandlerContext } from "./chat.handler.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

const isAdmin = (user: any): boolean =>
  !!user && (user.role === "admin" || user.role === "super_admin");

/**
 * 辩论中的管理员操作（AD-10 实时禁言 / AD-11 消息撤回 / AD-12 强制结束）
 */
export function registerAdminHandlers(ctx: HandlerContext) {
  const { socket, io, rooms } = ctx;

  /** 实时禁言辩手 */
  socket.on("admin_mute", async (data) => {
    try {
      if (!isAdmin(socket.data.user)) {
        return socket.emit("error", "需要管理员权限");
      }
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) return;
      rooms.mute(debateId, data.userId, data.duration);
      io.to(roomName(debateId)).emit("user_muted", {
        userId: data.userId,
        duration: data.duration,
      });
      await adminService.logAction(
        socket.data.user.id,
        "mute_user",
        "user",
        data.userId,
        `辩论 ${debateId} 禁言 ${Math.round(data.duration / 1000)} 秒`,
      );
    } catch (err: any) {
      socket.emit("error", err.message || "禁言失败");
    }
  });

  /** 解除禁言 */
  socket.on("admin_unmute", async (data) => {
    try {
      if (!isAdmin(socket.data.user)) {
        return socket.emit("error", "需要管理员权限");
      }
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) return;
      rooms.unmute(debateId, data.userId);
      io.to(roomName(debateId)).emit("user_unmuted", { userId: data.userId });
    } catch (err: any) {
      socket.emit("error", err.message || "解除禁言失败");
    }
  });

  /** 撤回消息 */
  socket.on("admin_recall", async (data) => {
    try {
      if (!isAdmin(socket.data.user)) {
        return socket.emit("error", "需要管理员权限");
      }
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) return;
      await chatService.recallMessage(data.messageId, socket.data.user.id);
      io.to(roomName(debateId)).emit("message_recalled", {
        messageId: data.messageId,
      });
    } catch (err: any) {
      socket.emit("error", err.message || "撤回失败");
    }
  });

  /** 强制结束辩论 */
  socket.on("admin_force_end", async (data) => {
    try {
      if (!isAdmin(socket.data.user)) {
        return socket.emit("error", "需要管理员权限");
      }
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) return;
      await adminService.forceEndDebate(socket.data.user.id, debateId, "管理员强制结束");
      io.to(roomName(debateId)).emit("debate_force_ended");
      io.to(roomName(debateId)).emit("debate_ended");
      // 刷新房间完整状态，让所有客户端看到 finished 状态
      await rooms.refreshRoom(io, debateId);
    } catch (err: any) {
      socket.emit("error", err.message || "强制结束失败");
    }
  });
}

export type { IoServer, IoClient };
