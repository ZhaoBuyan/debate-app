// server/src/types/socket.ts

import { Debate, DebateStatus, DebatePhase } from "./debate";
import { Speech, SpeechWithUser } from "./speech";
import { Message } from "./message";
import { VoteStats } from "./vote";
import { SupportStats, SupportHistoryPoint } from "./support";
import { UserSession } from "./user";

export interface ClientToServerEvents {
  join_room: (data: { debateId: string; userId: string }) => void;
  leave_room: (data: { debateId: string; userId: string }) => void;
  speech: (data: {
    debateId: string;
    userId: string;
    content: string;
    inputType?: "text" | "voice" | "sign";
  }) => void;
  send_message: (data: {
    debateId: string;
    userId: string;
    content: string;
  }) => void;
  vote_best: (data: {
    debateId: string;
    voterId: string;
    targetUserId: string;
  }) => void;
  vote_side: (data: {
    debateId: string;
    voterId: string;
    side: "A" | "B";
  }) => void;
  support: (data: {
    debateId: string;
    userId: string;
    side: "A" | "B";
  }) => void;
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
  admin_mute: (data: {
    debateId: string;
    userId: string;
    duration: number;
  }) => void;
  admin_unmute: (data: { debateId: string; userId: string }) => void;
  admin_recall: (data: { debateId: string; messageId: number }) => void;
  admin_force_end: (data: { debateId: string }) => void;
  gesture: (data: {
    debateId: string;
    userId: string;
    gesture: string;
  }) => void;
  query_my_state: (data: { debateId: string }) => void;
  webrtc_offer: (data: { roomId: string; offer: any }) => void;
  webrtc_answer: (data: { roomId: string; answer: any }) => void;
  webrtc_ice: (data: { roomId: string; candidate: any }) => void;
}

export interface ServerToClientEvents {
  room_state: (data: {
    debate: Debate;
    debaters: any[];
    speeches: SpeechWithUser[];
    messages: any[];
    votes: VoteStats;
    support: SupportStats;
    supportHistory?: SupportHistoryPoint[];
    emotions?: Record<string, number>;
    phase: DebatePhase;
    turn?: { round: number; index: number; speaker: any };
  }) => void;
  new_speech: (speech: SpeechWithUser) => void;
  speech_summary: (data: { speechId: number; summary: string }) => void;
  new_message: (message: any) => void;
  vote_updated: (data: { type: "best" | "side"; stats: any[] }) => void;
  support_updated: (stats: SupportStats) => void;
  support_snapshot: (snapshot: any) => void;
  emotion_updated: (data: { type: string; count: number }) => void;
  user_joined: (data: {
    userId: string;
    username: string;
    side?: "A" | "B";
  }) => void;
  user_left: (data: { userId: string }) => void;
  debate_started: () => void;
  debate_ended: () => void;
  round_changed: (data: { round: number; speakerId: string }) => void;
  debate_phase: (data: { phase: DebatePhase }) => void;
  user_muted: (data: { userId: string; duration: number }) => void;
  user_unmuted: (data: { userId: string }) => void;
  message_recalled: (data: { messageId: number }) => void;
  debate_force_ended: () => void;
  report_submitted: (data: { success: boolean; reportId?: number }) => void;
  my_state: (data: {
    isDebater: boolean;
    side: "A" | "B" | null;
    mySupport: "A" | "B" | null;
    myBestVote: string | null;
    mySideVote: "A" | "B" | null;
    mutedUntil: number | null;
  }) => void;
  error: (message: string) => void;
  webrtc_offer: (data: { roomId: string; offer: any }) => void;
  webrtc_answer: (data: { roomId: string; answer: any }) => void;
  webrtc_ice: (data: { roomId: string; candidate: any }) => void;
}

export interface SocketWithUser {
  id: string;
  userId?: string;
  debateId?: string;
  user?: UserSession;
}
