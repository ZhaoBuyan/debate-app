// client/src/hooks/useDebateRoom.ts
// 辩论房间核心 Hook：管理与辩论室的 WebSocket 全量状态

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, type DebateSocket } from "../socket";
import type { ChatMessage, Debater, MyState, RoomData, Speech } from "../types";

export interface Toast {
  id: number;
  kind: "error" | "info" | "success";
  text: string;
}

const EMOTION_KEYS = ["fire", "agree", "clap"] as const;

export function useDebateRoom(debateId: string | undefined, userId: string | undefined) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [my, setMy] = useState<MyState | null>(null);
  const [emotions, setEmotions] = useState<Record<"fire" | "agree" | "clap", number>>({
    fire: 0,
    agree: 0,
    clap: 0,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ended, setEnded] = useState(false);

  const socketRef = useRef<DebateSocket | null>(null);
  const debateIdRef = useRef(debateId);
  const userIdRef = useRef(userId);
  const toastId = useRef(0);

  debateIdRef.current = debateId;
  userIdRef.current = userId;

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-4), { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const showError = useCallback(
    (text: string) => pushToast("error", text),
    [pushToast],
  );

  // 连接 + 事件订阅
  useEffect(() => {
    if (!debateId || !userId) return;
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit("join_room", { debateId, userId });
    };
    const onDisconnect = () => setConnected(false);
    const onError = (message: string) => showError(message);

    const onRoomState = (data: RoomData) => {
      setRoom(data);
      setEmotions({
        fire: data.emotions?.fire || 0,
        agree: data.emotions?.agree || 0,
        clap: data.emotions?.clap || 0,
      });
      setEnded(data.debate?.status === "finished");
    };
    const onMyState = (data: MyState) => setMy(data);
    const onNewSpeech = (speech: Speech) => {
      setRoom((prev) =>
        prev ? { ...prev, speeches: [...prev.speeches, speech] } : prev,
      );
    };
    const onSpeechSummary = ({ speechId, summary }: { speechId: number; summary: string }) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              speeches: prev.speeches.map((s) =>
                s.id === speechId ? { ...s, summary } : s,
              ),
            }
          : prev,
      );
    };
    const onNewMessage = (message: ChatMessage) => {
      setRoom((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
    };
    const onVoteUpdated = ({ type, stats }: { type: "best" | "side"; stats: any[] }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          votes: {
            ...prev.votes,
            [type === "best" ? "best" : "side"]: stats,
            total_best_votes:
              type === "best"
                ? stats.reduce((a: number, b: any) => a + (b.count || 0), 0)
                : prev.votes.total_best_votes,
            total_side_votes:
              type === "side"
                ? stats.reduce((a: number, b: any) => a + (b.count || 0), 0)
                : prev.votes.total_side_votes,
          },
        };
      });
    };
    const onSupportUpdated = (stats: RoomData["support"]) => {
      setRoom((prev) => (prev ? { ...prev, support: stats } : prev));
    };
    const onEmotionUpdated = ({ type, count }: { type: string; count: number }) => {
      setEmotions((prev) => {
        if (!EMOTION_KEYS.includes(type as any)) return prev;
        return { ...prev, [type]: count };
      });
    };
    const onRoundChanged = ({ round, speakerId }: { round: number; speakerId: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const speaker = prev.debaters.find((d) => d.user_id === speakerId) || null;
        return { ...prev, turn: { ...prev.turn, round, speaker } };
      });
    };
    const onDebateStarted = () => {
      pushToast("success", "🎉 辩论开始了！");
      socket.emit("join_room", { debateId, userId });
    };
    const onDebateEnded = () => {
      setEnded(true);
      pushToast("info", "🏁 辩论已结束");
      socket.emit("join_room", { debateId, userId }); // 刷新终态
    };
    const onUserMuted = ({ userId: mutedId, duration }: { userId: string; duration: number }) => {
      if (mutedId === userId) {
        pushToast("error", `你已被禁言 ${Math.round(duration / 1000)} 秒`);
        setMy((prev) => (prev ? { ...prev, mutedUntil: Date.now() + duration } : prev));
      }
    };
    const onUserUnmuted = ({ userId: mutedId }: { userId: string }) => {
      if (mutedId === userId) {
        pushToast("info", "禁言已解除");
        setMy((prev) => (prev ? { ...prev, mutedUntil: null } : prev));
      }
    };
    const onMessageRecalled = ({ messageId }: { messageId: number }) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((m) => m.id !== messageId),
            }
          : prev,
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    socket.on("room_state", onRoomState);
    socket.on("my_state", onMyState);
    socket.on("new_speech", onNewSpeech);
    socket.on("speech_summary", onSpeechSummary);
    socket.on("new_message", onNewMessage);
    socket.on("vote_updated", onVoteUpdated);
    socket.on("support_updated", onSupportUpdated);
    socket.on("emotion_updated", onEmotionUpdated);
    socket.on("round_changed", onRoundChanged);
    socket.on("debate_started", onDebateStarted);
    socket.on("debate_ended", onDebateEnded);
    socket.on("debate_force_ended", onDebateEnded);
    socket.on("user_muted", onUserMuted);
    socket.on("user_unmuted", onUserUnmuted);
    socket.on("message_recalled", onMessageRecalled);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error", onError);
      socket.off("room_state", onRoomState);
      socket.off("my_state", onMyState);
      socket.off("new_speech", onNewSpeech);
      socket.off("speech_summary", onSpeechSummary);
      socket.off("new_message", onNewMessage);
      socket.off("vote_updated", onVoteUpdated);
      socket.off("support_updated", onSupportUpdated);
      socket.off("emotion_updated", onEmotionUpdated);
      socket.off("round_changed", onRoundChanged);
      socket.off("debate_started", onDebateStarted);
      socket.off("debate_ended", onDebateEnded);
      socket.off("debate_force_ended", onDebateEnded);
      socket.off("user_muted", onUserMuted);
      socket.off("user_unmuted", onUserUnmuted);
      socket.off("message_recalled", onMessageRecalled);
      socket.emit("leave_room", { debateId, userId });
    };
  }, [debateId, userId, pushToast, showError]);

  // ---------- 操作封装 ----------
  const sendSpeech = useCallback(
    (content: string, inputType: "text" | "voice" | "sign" = "text") => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("speech", { debateId: id, userId: uid, content, inputType });
      return true;
    },
    [],
  );

  const sendChat = useCallback(
    (content: string) => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("send_message", { debateId: id, userId: uid, content });
      return true;
    },
    [],
  );

  const sendSupport = useCallback(
    (side: "A" | "B") => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("support", { debateId: id, userId: uid, side });
      return true;
    },
    [],
  );

  const sendVoteBest = useCallback(
    (targetUserId: string) => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("vote_best", { debateId: id, voterId: uid, targetUserId });
      return true;
    },
    [],
  );

  const sendVoteSide = useCallback(
    (side: "A" | "B") => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("vote_side", { debateId: id, voterId: uid, side });
      return true;
    },
    [],
  );

  const sendEmotion = useCallback(
    (type: "fire" | "agree" | "clap", speechId?: number) => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      const uid = userIdRef.current;
      if (!s || !id || !uid) return false;
      s.emit("emotion", { debateId: id, userId: uid, type, speechId });
      return true;
    },
    [],
  );

  const sendReport = useCallback(
    (payload: {
      speechId?: number;
      messageId?: number;
      targetUserId: string;
      targetType: "speech" | "message" | "user";
      reason: string;
    }) => {
      const s = socketRef.current;
      const id = debateIdRef.current;
      if (!s || !id) return false;
      s.emit("report", { debateId: id, ...payload });
      return true;
    },
    [],
  );

  /** 重新拉取房间状态（room_state + my_state） */
  const refresh = useCallback(() => {
    const s = socketRef.current;
    const id = debateIdRef.current;
    const uid = userIdRef.current;
    if (s && id && uid) {
      s.emit("join_room", { debateId: id, userId: uid });
    }
  }, []);

  return {
    connected,
    room,
    my,
    emotions,
    toasts,
    ended,
    showError,
    pushToast,
    sendSpeech,
    sendChat,
    sendSupport,
    sendVoteBest,
    sendVoteSide,
    sendEmotion,
    sendReport,
    refresh,
  };
}

export default useDebateRoom;

export type { Debater };
