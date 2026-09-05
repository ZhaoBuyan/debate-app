// server/src/types/speech.ts

export type InputType = "text" | "voice" | "sign";

export interface Speech {
  id: number;
  debate_id: string;
  user_id: string;
  content: string;
  summary: string | null;
  round: number;
  order_index: number;
  input_type: InputType;
  created_at: number;
}

export interface SpeechWithUser extends Speech {
  username: string;
  side: "A" | "B";
  avatar: string;
}

export interface CreateSpeechInput {
  debateId: string;
  userId: string;
  content: string;
  inputType?: InputType;
}
