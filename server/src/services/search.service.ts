// server/src/services/search.service.ts
// 全文检索（KN-01）：按关键词检索辩题与发言，命中内容回带上下文片段

import { getDb } from "../database/index.js";

export interface SearchResult {
  debates: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    status: string;
    debate_type: string;
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
    /** 命中位置上下文片段（以命中词为中心截取） */
    snippet: string;
  }[];
}

/** 生成以命中词为中心的上下文片段 */
export function makeSnippet(text: string, keyword: string, radius = 26): string {
  const idx = text.indexOf(keyword);
  if (idx === -1) return text.slice(0, 2 * radius);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + keyword.length + radius);
  const lead = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  return lead + text.slice(start, end).replace(/\s+/g, " ") + tail;
}

/** 关键词检索辩题与发言 */
export async function searchAll(keyword: string): Promise<SearchResult> {
  const q = (keyword || "").trim();
  if (q.length < 1) {
    return { debates: [], speeches: [] };
  }
  const like = `%${q}%`;
  const db = await getDb();

  // 辩题：标题优先于描述
  const debates = await db.all<any[]>(
    `SELECT d.id, d.title, d.description, d.category, d.status, d.debate_type,
            u.username as creator_name, d.created_at,
            (SELECT COUNT(*) FROM debaters WHERE debate_id = d.id) as debater_count,
            (SELECT COUNT(*) FROM speeches WHERE debate_id = d.id) as speech_count
     FROM debates d
     LEFT JOIN users u ON u.id = d.creator_id
     WHERE d.title LIKE ? ESCAPE '\\' OR d.description LIKE ? ESCAPE '\\'
     ORDER BY CASE WHEN d.title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, d.created_at DESC
     LIMIT 10`,
    [like, like, like],
  );

  // 发言：命中内容并回带辩论上下文
  const speeches = await db.all<any[]>(
    `SELECT s.id, s.debate_id, d.title as debate_title, u.username, u.avatar,
            dd.side, s.content, s.summary, s.round, s.created_at
     FROM speeches s
     JOIN debates d ON d.id = s.debate_id
     JOIN users u ON u.id = s.user_id
     JOIN debaters dd ON dd.debate_id = s.debate_id AND dd.user_id = s.user_id
     WHERE s.content LIKE ? ESCAPE '\\'
     ORDER BY s.created_at DESC
     LIMIT 10`,
    [like],
  );

  return {
    debates,
    speeches: speeches.map((s) => ({
      ...s,
      snippet: makeSnippet(s.content, q),
    })),
  };
}
