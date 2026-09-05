// server/src/types/message.ts

export type MessageType = "chat" | "system" | "gesture" | "announcement";

export interface Message {
  id: number;
  debate_id: string;
  user_id: string;
  content: string;
  type: MessageType;
  created_at: number;
}

export interface MessageWithUser extends Message {
  username: string;
  avatar?: string;
  role?: string;
}
