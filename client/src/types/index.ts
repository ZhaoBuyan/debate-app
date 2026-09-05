// client/src/types/index.ts
// 与后端数据结构保持一致的类型定义

export type UserRole = "user" | "admin" | "super_admin";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar: string;
  points: number;
  rank: string;
  wins: number;
  losses: number;
  is_banned?: number;
  banned_reason?: string | null;
  banned_until?: number | null;
  warning_count?: number;
  created_at?: number;
}

export interface MyActivities {
  profile: User;
  joined: {
    id: string;
    title: string;
    status: DebateStatus;
    debate_type: DebateType;
    category: DebateCategory;
    start_time: number;
    end_time: number | null;
    side: "A" | "B";
    order_index: number;
    joined_at: number;
    speech_count: number;
  }[];
  bestDebaterVotes: number;
  speechTotal: number;
}

export interface SpeechHighlight {
  id: number;
  user_id: string;
  username: string;
  avatar: string;
  side: "A" | "B";
  content: string;
  round: number;
  created_at: number;
  emotions: { fire: number; agree: number; clap: number; total: number };
  impactRateA: number | null;
  hasSnapshot: boolean;
}

// ---------- 重辩链 / 检索（知识库） ----------

export interface ChainResult {
  winnerSide: "A" | "B" | null;
  bestDebaterId: string | null;
  sideA: number;
  sideB: number;
  supportRateA: number;
  supportTotal: number;
}

export interface ChainItem {
  id: string;
  title: string;
  description: string | null;
  category: DebateCategory;
  status: DebateStatus;
  debate_type: DebateType;
  start_time: number;
  end_time: number | null;
  creator_name: string | null;
  debater_count: number;
  speech_count: number;
  emotion_count: number;
  settled: number;
  cool_down_minutes: number;
  result: ChainResult | null;
}

export interface DebateChain {
  rootId: string;
  items: ChainItem[];
}

export interface RelatedDebate {
  id: string;
  title: string;
  category: DebateCategory;
  status: DebateStatus;
  debate_type: DebateType;
  created_at: number;
  cool_down_minutes: number;
  creator_name: string | null;
  debater_count: number;
  speech_count: number;
}

export interface SearchPayload {
  debates: {
    id: string;
    title: string;
    description: string | null;
    category: DebateCategory;
    status: DebateStatus;
    debate_type: DebateType;
    creator_name: string | null;
    created_at: number;
    debater_count: number;
    speech_count: number;
  }[];
  speeches: {
    id: number;
    debate_id: string;
    debate_title: string;
    username: string;
    avatar: string;
    side: "A" | "B";
    content: string;
    summary: string | null;
    round: number;
    created_at: number;
    snippet: string;
  }[];
}

export type DebateStatus =
  | "pending"
  | "waiting"
  | "ongoing"
  | "finished"
  | "rejected";

export type DebateCategory =
  | "general"
  | "tech"
  | "society"
  | "edu"
  | "philosophy"
  | "culture";

export type DebateType = "classic" | "quick1v1";

export const DEBATE_TYPE_LABELS: Record<DebateType, string> = {
  classic: "标准 8 人制",
  quick1v1: "⚡ 快速 1v1",
};

export interface Debate {
  id: string;
  title: string;
  description: string | null;
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
  curated?: number;
  curated_at?: number | null;
  hot?: number;
  emotion_count?: number;
  support_count?: number;
  parent_id: string | null;
  repeat_count: number;
  created_at: number;
  creator_name?: string;
  debater_count?: number;
  side_a_count?: number;
  side_b_count?: number;
  speech_count?: number;
}

export interface CuratedBoard {
  featured: Debate[];
  live: Debate[];
  topFinished: Debate[];
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

export interface DebateReport {
  id: number;
  debate_id: string;
  report: string;
  created_at: number;
}

export interface Debater {
  id: number;
  debate_id: string;
  user_id: string;
  side: "A" | "B";
  order_index: number;
  joined_at: number;
  username: string;
  avatar: string;
  rank: string;
}

export interface Speech {
  id: number;
  debate_id: string;
  user_id: string;
  content: string;
  summary: string | null;
  round: number;
  order_index: number;
  input_type: "text" | "voice" | "sign";
  created_at: number;
  username: string;
  side: "A" | "B";
  avatar: string;
}

export interface ChatMessage {
  id: number;
  debate_id: string;
  user_id: string;
  content: string;
  type: "chat" | "system" | "gesture" | "announcement";
  created_at: number;
  username: string;
  avatar?: string;
  role?: string;
}

export interface VoteStats {
  best: { target_user_id: string; username?: string; count: number }[];
  side: { side: "A" | "B"; count: number }[];
  total_best_votes: number;
  total_side_votes: number;
}

export interface SupportStats {
  sideA: number;
  sideB: number;
  total: number;
  rateA: number;
  rateB: number;
}

export interface MyState {
  isDebater: boolean;
  side: "A" | "B" | null;
  mySupport: "A" | "B" | null;
  myBestVote: string | null;
  mySideVote: "A" | "B" | null;
  mutedUntil: number | null;
}

export interface RoomData {
  debate: Debate & { debaters?: Debater[]; speeches?: Speech[] };
  debaters: Debater[];
  speeches: Speech[];
  messages: ChatMessage[];
  votes: VoteStats;
  support: SupportStats;
  supportHistory: { timestamp: number; rateA: number; rateB: number; sideA: number; sideB: number }[];
  emotions: Record<"fire" | "agree" | "clap", number>;
  turn: { round: number; index: number; speaker: Debater | null };
}

// ---- 管理后台 ----

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  avatar: string;
  points: number;
  rank: string;
  wins: number;
  losses: number;
  is_banned: number;
  banned_reason: string | null;
  banned_until: number | null;
  warning_count: number;
  last_login_at: number | null;
  created_at: number;
}

export interface Report {
  id: number;
  debate_id: string | null;
  speech_id: number | null;
  message_id: number | null;
  reporter_id: string;
  target_user_id: string;
  target_type: "speech" | "message" | "user";
  reason: string;
  status: "pending" | "reviewing" | "resolved" | "rejected";
  handler_note: string | null;
  created_at: number;
  reporter_name: string;
  target_name: string;
  debate_title: string | null;
  speech_content: string | null;
  message_content: string | null;
}

export interface SensitiveWord {
  id: number;
  word: string;
  severity: "low" | "moderate" | "high";
  created_at: number;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: number;
  start_at: number | null;
  end_at: number | null;
  is_active: number;
  created_at: number;
}

export interface AdminLog {
  id: number;
  admin_id: string;
  admin_name: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  created_at: number;
}

export const CATEGORY_LABELS: Record<DebateCategory, string> = {
  general: "综合",
  tech: "科技",
  society: "社会",
  edu: "教育",
  philosophy: "哲学",
  culture: "文化",
};

export const STATUS_LABELS: Record<DebateStatus, string> = {
  pending: "⏳ 待审核",
  waiting: "📢 报名中",
  ongoing: "🔥 辩论中",
  finished: "🏁 已结束",
  rejected: "❌ 已拒绝",
};

export const SIDE_LABELS: Record<"A" | "B", string> = {
  A: "正方",
  B: "反方",
};

export const SEVERITY_LABELS: Record<string, string> = {
  low: "低危",
  moderate: "中危",
  high: "高危",
};

// ---------- 段位徽章样式（U-07：青铜→白银→黄金→铂金→钻石→王者） ----------

export const RANK_ORDER = [
  "青铜",
  "白银",
  "黄金",
  "铂金",
  "钻石",
  "王者",
];

export const RANK_STYLES: Record<string, string> = {
  青铜: "bg-orange-900/60 text-orange-300 border-orange-700/60",
  白银: "bg-gray-500/20 text-gray-200 border-gray-400/50",
  黄金: "bg-yellow-500/20 text-yellow-300 border-yellow-500/60",
  铂金: "bg-cyan-500/20 text-cyan-300 border-cyan-500/60",
  钻石: "bg-blue-500/20 text-blue-300 border-blue-500/60",
  王者: "bg-purple-500/25 text-purple-300 border-purple-500/70",
};

export const RANK_ICONS: Record<string, string> = {
  青铜: "🥉",
  白银: "🥈",
  黄金: "🥇",
  铂金: "💠",
  钻石: "💎",
  王者: "👑",
};

export const rankChipClass = (rank?: string | null): string =>
  RANK_STYLES[rank || "青铜"] || RANK_STYLES["青铜"];

export const rankIcon = (rank?: string | null): string =>
  RANK_ICONS[rank || "青铜"] || "🎖️";
