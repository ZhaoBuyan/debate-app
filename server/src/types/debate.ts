// server/src/types/debate.ts

import { SpeechWithUser } from "./speech";

export type DebateStatus =
  | "pending"
  | "waiting"
  | "ongoing"
  | "finished"
  | "rejected";
export type DebatePhase = "formal" | "free" | "summary";
export const PHASE_LABELS: Record<DebatePhase, string> = {
  formal: "正式轮辩",
  free: "自由辩论",
  summary: "总结陈词",
};
export type DebateCategory =
  | "general"
  | "tech"
  | "society"
  | "edu"
  | "philosophy"
  | "culture";
export type DebateType = "classic" | "quick1v1";

export const DEBATE_TYPE_LABELS: Record<DebateType, string> = {
  classic: "标准辩论（每方4人）",
  quick1v1: "快速 1v1（每方1人）",
};

export interface Debate {
  id: string;
  title: string;
  description: string;
  category: DebateCategory;
  creator_id: string;
  host_id: string | null;
  side_a_name: string;
  side_b_name: string;
  status: DebateStatus;
  debate_type: DebateType;
  cool_down_minutes: number;
  start_time: number;
  end_time: number | null;
  admin_note: string | null;
  is_recommended: boolean;
  recommended_date: string | null;
  parent_id: string | null;
  repeat_count: number;
  created_at: number;
}

export interface DebateDetail extends Debate {
  creator_name?: string;
  host_name?: string;
  debater_count?: number;
  side_a_count?: number;
  side_b_count?: number;
  debaters?: DebaterWithUser[]; // 新增
  speeches?: SpeechWithUser[]; // 新增
}

export interface CreateDebateInput {
  title: string;
  description?: string;
  category?: DebateCategory;
  sideA?: string;
  sideB?: string;
  type?: DebateType;
}

export interface DebateReport {
  id: number;
  debate_id: string;
  report: string;
  created_at: number;
}

export interface ArgumentNode {
  id: number;
  debate_id: string;
  user_id: string;
  username: string;
  avatar: string;
  side: "A" | "B";
  content: string;
  round: number;
  created_at: number;
  children: ArgumentNode[];
}

export interface JoinDebateInput {
  side: "A" | "B";
}

export interface Debater {
  id: number;
  debate_id: string;
  user_id: string;
  side: "A" | "B";
  order_index: number;
  joined_at: number;
  username?: string;
}

export interface DebaterWithUser extends Debater {
  username: string;
  avatar: string;
  rank: string;
}
