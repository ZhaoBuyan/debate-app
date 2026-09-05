// server/src/types/vote.ts

export interface VoteBest {
  id: number;
  debate_id: string;
  voter_id: string;
  target_user_id: string;
  created_at: number;
}

export interface VoteSide {
  id: number;
  debate_id: string;
  voter_id: string;
  side: "A" | "B";
  created_at: number;
}

export interface VoteStats {
  best: {
    target_user_id: string;
    username?: string;
    count: number;
  }[];
  side: {
    side: "A" | "B";
    count: number;
  }[];
  total_best_votes: number;
  total_side_votes: number;
}

export interface VoteBestInput {
  debateId: string;
  voterId: string;
  targetUserId: string;
}

export interface VoteSideInput {
  debateId: string;
  voterId: string;
  side: "A" | "B";
}
