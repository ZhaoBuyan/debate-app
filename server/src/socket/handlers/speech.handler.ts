// server/src/socket/handlers/speech.handler.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../../types/socket.js";
import { RoomManager, roomName } from "../room.manager.js";
import rateLimiter, { RATE_RULES } from "../rate.limit.js";
import speechService from "../../services/speech.service.js";
import supportService from "../../services/support.service.js";
import debateService from "../../services/debate.service.js";
import debaterService from "../../services/debater.service.js";
import type { HandlerContext } from "./chat.handler.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 辩论发言（B-01/B-02/B-03 + A-01 AI论点提炼）
 */
export function registerSpeechHandlers(ctx: HandlerContext) {
  const { socket, io, rooms } = ctx;

  socket.on("speech", async (data) => {
    try {
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) {
        return socket.emit("error", "请先加入辩论房间");
      }
      const user = socket.data.user;
      if (!user) return socket.emit("error", "请先登录后再参与互动");

      // 0. 防刷屏：发言限流
      const rule = RATE_RULES.speech;
      if (!rateLimiter.tryAcquire(`${user.id}:speech`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "发言过于频繁，请稍后再试");
      }

      // 1. 必须是辩手
      const side = await debaterService.getSide(debateId, user.id);
      if (!side) {
        return socket.emit("error", "你不是该辩论的辩手，无法发言");
      }

      // 2. 检查禁言（AD-10）
      const remain = rooms.mutedRemainMs(debateId, user.id);
      if (remain) {
        return socket.emit(
          "error",
          `你已被管理员禁言，剩余 ${Math.ceil(remain / 1000)} 秒`,
        );
      }

      // 3. 保存发言（含 AI 提炼摘要与敏感词过滤）
      const beforePhase = await debateService.getPhase(debateId);
      const speech = await speechService.createSpeech({
        debateId,
        userId: user.id,
        content: data.content,
        inputType: data.inputType || "text",
      });

      // 4. 广播新发言 + AI 论点摘要（A-01/A-02）
      io.to(roomName(debateId)).emit("new_speech", speech);
      if (speech.summary) {
        io.to(roomName(debateId)).emit("speech_summary", {
          speechId: speech.id,
          summary: speech.summary,
        });
      }

      // 5. 发言结束 → 支持率快照（S-06）
      const snapshot = await supportService.snapshot(debateId, "speech_end", String(speech.id));
      io.to(roomName(debateId)).emit("support_snapshot", snapshot);

      // 6. 推进轮次：广播下一位发言者（B-01：A1→B1→A2→B2→…）
      const roomData = await debateService.getRoomData(debateId);
      io.to(roomName(debateId)).emit("round_changed", {
        round: roomData.turn.round,
        speakerId: roomData.turn.speaker?.user_id || "",
      });

      // 7. 全员发言过一轮 → 自动进入自由辩论（B-05），广播阶段变化
      if (beforePhase !== roomData.phase) {
        io.to(roomName(debateId)).emit("debate_phase", {
          phase: roomData.phase,
        });
      }
    } catch (err: any) {
      socket.emit("error", err.message || "发言失败");
    }
  });
}

export type { IoServer, IoClient };
