// server/src/utils/validation.ts

import { DebateCategory } from "../types/debate.js";

/** 辩题分类白名单（SRS D-02） */
export const DEBATE_CATEGORIES: DebateCategory[] = [
  "general",
  "tech",
  "society",
  "edu",
  "philosophy",
  "culture",
];

export const CATEGORY_LABELS: Record<DebateCategory, string> = {
  general: "综合",
  tech: "科技",
  society: "社会",
  edu: "教育",
  philosophy: "哲学",
  culture: "文化",
};

/** 辩题状态白名单 */
export const DEBATE_STATUSES = [
  "pending",
  "waiting",
  "ongoing",
  "finished",
  "rejected",
];

/** 校验字符串非空 */
export const required = (value: unknown, message: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
};

/** 校验字符串长度区间 */
export const lengthBetween = (
  value: string,
  min: number,
  max: number,
  message: string,
): void => {
  const len = value.length;
  if (len < min || len > max) {
    throw new Error(message);
  }
};

/** 校验分类合法性 */
export const isCategory = (value: unknown): value is DebateCategory =>
  typeof value === "string" && (DEBATE_CATEGORIES as string[]).includes(value);

/** 校验阵营 */
export const isSide = (value: unknown): value is "A" | "B" =>
  value === "A" || value === "B";
