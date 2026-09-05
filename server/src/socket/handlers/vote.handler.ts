// server/src/socket/handlers/vote.handler.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../../types/socket.js";
import { RoomManager, roomName } from "../room.manager.js";
import rateLimiter, { RATE_RULES } from "../rate.limit.js";
import voteService from "../../services/vote.service.js";
import supportService from "../../services/support.service.js";
import debaterService from "../../services/debater.service.js";
import type { HandlerContext } from "./chat.handler.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 投票系统（V-01 最佳辩手 / V-02 阵营胜负，V-03 实时更新，V-04 一人一票）
 */
export function registerVoteHandlers(ctx: HandlerContext) {
  const { socket, io } = ctx;

  /** 最佳辩手投票 */
  socket.on("vote_best", async (data) => {
    try {
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) {
        return socket.emit("error", "请先加入辩论房间");
      }
      const user = socket.data.user;
      const rule = RATE_RULES.vote;
      if (!rateLimiter.tryAcquire(`${user.id}:vote`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "操作太快啦，请稍后再试");
      }
      await voteService.voteBest({
        debateId,
        voterId: user.id,
        targetUserId: data.targetUserId,
      });
      const stats = await voteService.getStats(debateId);
      io.to(roomName(debateId)).emit("vote_updated", {
        type: "best",
        stats: stats.best,
      });
    } catch (err: any) {
      socket.emit("error", err.message || "投票失败");
    }
  });

  /** 阵营胜负投票 */
  socket.on("vote_side", async (data) => {
    try {
      const debateId = (socket.data.debateId as string) || data.debateId;
      if (!debateId) {
        return socket.emit("error", "请先加入辩论房间");
      }
      const user = socket.data.user;
      const rule = RATE_RULES.vote;
      if (!rateLimiter.tryAcquire(`${user.id}:vote`, rule.limit, rule.windowMs)) {
        return socket.emit("error", "操作太快啦，请稍后再试");
      }
      await voteService.voteSide({
        debateId,
        voterId: user.id,
        side: data.side,
      });
      const stats = await voteService.getStats(debateId);
      io.to(roomName(debateId)).emit("vote_updated", {
        type: "side",
        stats: stats.side,
      });
    } catch (err: any) {
      socket.emit("error", err.message || "投票失败");
    }
  });

  /** 兜底：通过 REST 路径投票时前端也可查询自己的状态 */
  socket.on("query_my_state", async (data) => {
    try {
      const debateId = data.debateId;
      const user = socket.data.user;
      const side = await debaterService.getSide(debateId, user.id);
      const mySupport = await supportService.getUserSide(debateId, user.id);
      const myVotes = await voteService.hasVoted(debateId, user.id);
      socket.emit("my_state", {
        isDebater: !!side,
        side,
        mySupport,
        myBestVote: myVotes.bestTarget,
        mySideVote: myVotes.side,
        mutedUntil: null,
      });
    } catch {
      socket.emit("error", "状态查询失败");
    }
  });
}

export type { IoServer, IoClient };
