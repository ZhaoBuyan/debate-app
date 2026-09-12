// server/src/socket/handlers/chat.handler.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../../types/socket.js";
import { RoomManager, roomName } from "../room.manager.js";
import rateLimiter, { RATE_RULES } from "../rate.limit.js";
import chatService from "../../services/chat.service.js";
import reportService from "../../services/report.service.js";
import sensitiveService from "../../services/sensitive.service.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface HandlerContext {
  io: IoServer;
  socket: IoClient;
  rooms: RoomManager;
}

/** 获取客户端所属辩论房间（须先 join_room） */
function debateOf(ctx: HandlerContext): string | null {
  return (ctx.socket.data.debateId as string) || null;
}

/**
 * 观众互动（I-01 实时聊天 / I-02 情绪反馈 / 手势消息）
 * 以及举报（AD-06）
 */
export function registerChatHandlers(ctx: HandlerContext) {
  const { socket, io, rooms } = ctx;

  /** 发送聊天消息 */
  socket.on("send_message", async (data) => {
    try {
      const rule = RATE_RULES.send_message;
      if (!rateLimiter.tryAcquire(`${socket.data.user.id}:send_message`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "说话太快啦，请稍作停顿再继续（防刷屏）");
      }
      const debateId = debateOf(ctx);
      if (!debateId || debateId !== data.debateId) {
        return socket.emit("error", "请先加入该辩论房间");
      }
      const user = socket.data.user;
      if (!user) return socket.emit("error", "请先登录后再参与互动");
      const remain = rooms.mutedRemainMs(debateId, user.id);
      if (remain) {
        return socket.emit(
          "error",
          `你已被禁言，剩余 ${Math.ceil(remain / 1000)} 秒`,
        );
      }
      const message = await chatService.sendMessage({
        debateId,
        userId: user.id,
        content: data.content,
        type: "chat",
      });
      io.to(roomName(debateId)).emit("new_message", message);
    } catch (err: any) {
      socket.emit("error", err.message || "消息发送失败");
    }
  });

  /** 情绪反馈：🔥精彩 / 🤔有道理 / 💥反驳漂亮（I-02） */
  socket.on("emotion", async (data) => {
    try {
      const rule = RATE_RULES.emotion;
      if (!rateLimiter.tryAcquire(`${socket.data.user.id}:emotion`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "情绪输出太密集啦，缓缓再点～");
      }
      const debateId = debateOf(ctx);
      if (!debateId || debateId !== data.debateId) return;
      const user = socket.data.user;
      if (!user) return socket.emit("error", "请先登录后再参与互动");
      await chatService.addEmotion({
        debateId,
        userId: user.id,
        type: data.type,
        speechId: data.speechId,
      });
      const stats = await chatService.getEmotionStats(debateId);
      const count = stats[data.type] || 0;
      io.to(roomName(debateId)).emit("emotion_updated", {
        type: data.type,
        count,
      });
    } catch (err: any) {
      socket.emit("error", err.message || "情绪反馈失败");
    }
  });

  /** 手势消息（听障用户输入，消息类型为 gesture） */
  socket.on("gesture", async (data) => {
    try {
      const rule = RATE_RULES.gesture;
      if (!rateLimiter.tryAcquire(`${socket.data.user.id}:gesture`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "消息发送太快，请稍后再试");
      }
      const debateId = debateOf(ctx);
      if (!debateId || debateId !== data.debateId) return;
      const user = socket.data.user;
      if (!user) return socket.emit("error", "请先登录后再参与互动");
      const filtered = await sensitiveService.filterText(
        (data.gesture || "").slice(0, 200),
      );
      if (!filtered) return;
      const message = await chatService.sendMessage({
        debateId,
        userId: user.id,
        content: `[手语] ${filtered}`,
        type: "gesture",
      });
      io.to(roomName(debateId)).emit("new_message", message);
    } catch (err: any) {
      socket.emit("error", err.message || "手势消息发送失败");
    }
  });

  /** 举报（AD-06） */
  socket.on("report", async (data) => {
    try {
      const rule = RATE_RULES.report;
      if (!rateLimiter.tryAcquire(`${socket.data.user.id}:report`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "举报提交过于频繁，请稍后再试");
      }
      const user = socket.data.user;
      if (!user) return socket.emit("error", "请先登录后再参与互动");
      if (data.targetUserId === user.id) {
        return socket.emit("error", "不能举报自己");
      }
      const reportId = await reportService.create({
        debateId: data.debateId || debateOf(ctx) || undefined,
        speechId: data.speechId,
        messageId: data.messageId,
        targetUserId: data.targetUserId,
        targetType: data.targetType,
        reason: data.reason,
        reporterId: user.id,
      });
      socket.emit("report_submitted", { success: true, reportId });
    } catch (err: any) {
      socket.emit("error", err.message || "举报提交失败");
    }
  });
}
