// server/src/types/report.ts

export type ReportStatus = "pending" | "reviewing" | "resolved" | "rejected";
export type ReportTargetType = "speech" | "message" | "user";

export interface Report {
  id: number;
  debate_id: string | null;
  speech_id: number | null;
  message_id: number | null;
  reporter_id: string;
  target_user_id: string;
  target_type: ReportTargetType;
  reason: string;
  status: ReportStatus;
  handler_id: string | null;
  handler_note: string | null;
  created_at: number;
  resolved_at: number | null;
}

export interface ReportWithDetails extends Report {
  reporter_name?: string;
  target_name?: string;
  debate_title?: string;
  speech_content?: string;
  message_content?: string;
  handler_name?: string;
}

export interface CreateReportInput {
  debateId?: string;
  speechId?: number;
  messageId?: number;
  reporterId: string;
  targetUserId: string;
  targetType: ReportTargetType;
  reason: string;
}

export interface HandleReportInput {
  action: "resolve" | "reject" | "delete_content";
  note?: string;
}
