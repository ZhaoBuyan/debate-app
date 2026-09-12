// server/src/socket/room.manager.ts

import { Server, Socket } from "socket.io";
import { ClientToServerEvents, ServerToClientEvents } from "../types/socket.js";
import debateService from "../services/debate.service.js";
import supportService from "../services/support.service.js";
import voteService from "../services/vote.service.js";
import debaterService from "../services/debater.service.js";

export const ROOM_PREFIX = "debate:";
export const roomName = (debateId: string) => ROOM_PREFIX + debateId;

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoClient = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RoomMember {
  socketId: string;
  userId: string;
  username: string;
  avatar: string;
  role: string;
  side: "A" | "B" | null;
}

interface RoomState {
  debateId: string;
  members: Map<string, RoomMember>; // socketId -> member
  mutes: Map<string, number>; // userId -> mutedUntil(ts)
}

/**
 * 房间管理器：追踪每个辩论房间的在线成员与禁言状态
 */
export class RoomManager {
  private rooms = new Map<string, RoomState>();

  /** 获取或创建房间 */
  getRoom(debateId: string): RoomState {
    let room = this.rooms.get(debateId);
    if (!room) {
      room = { debateId, members: new Map(), mutes: new Map() };
      this.rooms.set(debateId, room);
    }
    return room;
  }

  /** 删除空房间 */
  private cleanup(debateId: string) {
    const room = this.rooms.get(debateId);
    if (room && room.members.size === 0) {
      this.rooms.delete(debateId);
    }
  }

  /** 用户加入房间（支持匿名只读：游客可实时观战，写操作另行拦截） */
  async join(io: IoServer, socket: IoClient, debateId: string) {
    const user = socket.data.user;
    const effectiveId = user?.id || `guest:${socket.id}`;
    const room = this.getRoom(debateId);
    const side = user ? await debaterService.getSide(debateId, user.id) : null;

    // 加入 socket.io 房间
    socket.join(roomName(debateId));
    socket.data.debateId = debateId;

    room.members.set(socket.id, {
      socketId: socket.id,
      userId: effectiveId,
      username: user?.username || "游客",
      avatar: user?.avatar || "👤",
      role: user?.role || "guest",
      side,
    });

    // 下发房间完整状态（room_state）
    try {
      const data = await debateService.getRoomData(debateId);
      socket.emit("room_state", data);
    } catch (err: any) {
      socket.emit("error", err.message || "加载房间失败");
    }

    // 下发当前用户个性化状态（游客全部为空）
    if (user) {
      const [mySupport, myVotes] = await Promise.all([
        supportService.getUserSide(debateId, user.id),
        voteService.hasVoted(debateId, user.id),
      ]);
      socket.emit("my_state", {
        isDebater: !!side,
        side,
        mySupport,
        myBestVote: myVotes.bestTarget,
        mySideVote: myVotes.side,
        mutedUntil: room.mutes.get(user.id) || null,
      });
    } else {
      socket.emit("my_state", {
        isDebater: false,
        side: null,
        mySupport: null,
        myBestVote: null,
        mySideVote: null,
        mutedUntil: null,
      });
    }

    // 广播新人加入（仅对辩手进行提示，避免刷屏）
    const member = room.members.get(socket.id);
    if (member && member.side) {
      socket.to(roomName(debateId)).emit("user_joined", {
        userId: member.userId,
        username: member.username,
        side: member.side,
      });
    }
  }

  /** 用户离开房间 */
  leave(socket: IoClient) {
    const debateId = socket.data.debateId;
    if (!debateId) return;
    const room = this.rooms.get(debateId);
    const member = room?.members.get(socket.id);
    room?.members.delete(socket.id);
    this.cleanup(debateId);
    if (member && member.side) {
      socket.to(roomName(debateId)).emit("user_left", { userId: member.userId });
    }
  }

  /** 连接断开统一清理 */
  onDisconnect(socket: IoClient) {
    this.leave(socket);
  }

  /** 禁言用户（内存态，房间级别，AD-10） */
  mute(debateId: string, userId: string, durationMs: number) {
    const room = this.getRoom(debateId);
    room.mutes.set(userId, Date.now() + durationMs);
  }

  unmute(debateId: string, userId: string) {
    const room = this.rooms.get(debateId);
    room?.mutes.delete(userId);
  }

  /** 查询禁言剩余毫秒数；null 表示未禁言 */
  mutedRemainMs(debateId: string, userId: string): number | null {
    const room = this.rooms.get(debateId);
    const until = room?.mutes.get(userId);
    if (!until) return null;
    if (until <= Date.now()) {
      room!.mutes.delete(userId);
      return null;
    }
    return until - Date.now();
  }

  /** 向房间广播最新完整状态（辩论开始/结束/强制刷新用） */
  async refreshRoom(io: IoServer, debateId: string) {
    const room = this.rooms.get(debateId);
    if (!room || room.members.size === 0) return;
    try {
      const data = await debateService.getRoomData(debateId);
      io.to(roomName(debateId)).emit("room_state", data);
    } catch (err) {
      io.to(roomName(debateId)).emit("error", "状态刷新失败");
    }
  }
}

export default new RoomManager();
