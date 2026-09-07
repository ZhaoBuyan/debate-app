// server/src/types/topic.ts
// 辩题众创（D-10）

import { DebateCategory } from "./debate.js";

export interface TopicProposal {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  category: DebateCategory;
  created_at: number;
  username?: string;
  vote_count?: number;
  /** 当前查看者是否已投票（列表接口带 viewerId 时返回） */
  voted?: boolean;
}

export interface LeaderboardRow {
  id: string;
  username: string;
  avatar: string;
  role: string;
  points: number;
  rank: string;
  wins: number;
  losses: number;
  speech_total?: number;
  speech_30d?: number;
  win_rate?: number;
}

export interface LeaderboardPayload {
  type: "points" | "active";
  list: LeaderboardRow[];
  meRank?: number | null;
}
