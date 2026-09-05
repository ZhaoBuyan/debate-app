// server/src/types/support.ts

export interface SupportRate {
  id: number;
  debate_id: string;
  user_id: string;
  side: "A" | "B";
  timestamp: number;
}

export interface SupportSnapshot {
  id: number;
  debate_id: string;
  snapshot_type: "speech_end" | "round_end" | "debate_end" | "manual";
  trigger_id: string | null;
  side_a_count: number;
  side_b_count: number;
  timestamp: number;
}

export interface SupportStats {
  sideA: number;
  sideB: number;
  total: number;
  rateA: number;
  rateB: number;
}

export interface SupportHistoryPoint {
  timestamp: number;
  sideA: number;
  sideB: number;
  rateA: number;
  rateB: number;
}

export interface SupportInput {
  debateId: string;
  userId: string;
  side: "A" | "B";
}
