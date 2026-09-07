// server/src/socket/io-bus.ts
// 轻量 IO 单例桥：让 REST 控制器（管理操作/阶段切换）也能向房间广播实时事件

import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

let _io: IoServer | null = null;

export function setIo(io: IoServer): void {
  _io = io;
}

export function clearIo(): void {
  _io = null;
}

export function getIo(): IoServer | null {
  return _io;
}
