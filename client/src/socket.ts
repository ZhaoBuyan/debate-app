// client/src/socket.ts
// Socket.IO 客户端：单例 + 事件类型定义（与后端 types/socket.ts 对齐）

import { io, Socket } from "socket.io-client";
import { tokenStore } from "./api";
import type { ChatMessage, Debater, MyState, RoomData, Speech, SupportStats, VoteStats } from "./types";

export interface ClientToServerEvents {
  join_room: (data: { debateId: string; userId: string }) => void;
  leave_room: (data: { debateId: string; userId: string }) => void;
  speech: (data: {
    debateId: string;
    userId: string;
    content: string;
    inputType?: "text" | "voice" | "sign";
  }) => void;
  send_message: (data: { debateId: string; userId: string; content: string }) => void;
  vote_best: (data: { debateId: string; voterId: string; targetUserId: string }) => void;
  vote_side: (data: { debateId: string; voterId: string; side: "A" | "B" }) => void;
  support: (data: { debateId: string; userId: string; side: "A" | "B" }) => void;
  emotion: (data: {
    debateId: string;
    userId: string;
    type: "fire" | "agree" | "clap";
    speechId?: number;
  }) => void;
  report: (data: {
    debateId?: string;
    speechId?: number;
    messageId?: number;
    targetUserId: string;
    targetType: "speech" | "message" | "user";
    reason: string;
  }) => void;
  gesture: (data: { debateId: string; userId: string; gesture: string }) => void;
}

export interface ServerToClientEvents {
  room_state: (data: RoomData) => void;
  new_speech: (speech: Speech) => void;
  speech_summary: (data: { speechId: number; summary: string }) => void;
  new_message: (message: ChatMessage) => void;
  vote_updated: (data: { type: "best" | "side"; stats: any[] }) => void;
  support_updated: (stats: SupportStats) => void;
  emotion_updated: (data: { type: string; count: number }) => void;
  user_joined: (data: { userId: string; username: string; side?: "A" | "B" }) => void;
  user_left: (data: { userId: string }) => void;
  debate_started: () => void;
  debate_ended: () => void;
  debate_force_ended: () => void;
  round_changed: (data: { round: number; speakerId: string }) => void;
  user_muted: (data: { userId: string; duration: number }) => void;
  user_unmuted: (data: { userId: string }) => void;
  message_recalled: (data: { messageId: number }) => void;
  my_state: (data: MyState) => void;
  report_submitted: (data: { success: boolean; reportId?: number }) => void;
  error: (message: string) => void;
}

export type DebateSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: DebateSocket | null = null;

/** 建立（或复用）socket 连接，token 变化时自动重建 */
export function getSocket(): DebateSocket {
  const token = tokenStore.get();
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = io({
    auth: { token },
    transports: ["websocket", "polling"],
  });
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/** 加入辩论房间（自动处理重复加入） */
export function joinRoom(socket: DebateSocket, debateId: string, userId: string) {
  socket.emit("join_room", { debateId, userId });
}

export type { Debater };
