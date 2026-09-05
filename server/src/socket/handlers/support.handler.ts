// server/src/socket/handlers/support.handler.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../../types/socket.js";
import { RoomManager, roomName } from "../room.manager.js";
import rateLimiter, { RATE_RULES } from "../rate.limit.js";
import supportService from "../../services/support.service.js";
import type { HandlerContext } from "./chat.handler.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 实时支持率（S-01：观众投票支持 / 切换支持，结果实时广播）
 */
export function registerSupportHandlers(ctx: HandlerContext) {
  const { socket, io } = ctx;

  socket.on("support", async (data) => {
    try {
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) {
        return socket.emit("error", "请先加入辩论房间");
      }
      const user = socket.data.user;
      const rule = RATE_RULES.support;
      if (!rateLimiter.tryAcquire(`${user.id}:support`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "操作太快啦，请稍后再试");
      }
      const stats = await supportService.setSupport({
        debateId,
        userId: user.id,
        side: data.side,
      });
      io.to(roomName(debateId)).emit("support_updated", stats);
    } catch (err: any) {
      socket.emit("error", err.message || "支持失败");
    }
  });
}

export type { IoServer, IoClient };
