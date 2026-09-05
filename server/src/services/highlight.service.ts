// server/src/services/highlight.service.ts
// 精彩时刻与发言影响力（SRS I-03 情绪热力图简化版 / S-05 影响力指标简化版）

import { getDb } from "../database/index.js";

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
  /** 发言后支持率变化（相对上一条发言后快照的 ΔrateA，无快照时为 null） */
  impactRateA: number | null;
  /** 该条发言是否触发过 speech_end 快照（早于快照功能的历史发言为 false） */
  hasSnapshot: boolean;
}

/**
 * 计算每一条发言：收到的情绪计数 + 发言后的支持率变化量
 */
export async function getDebateHighlights(debateId: string): Promise<SpeechHighlight[]> {
  const db = await getDb();

  const speeches = await db.all<any[]>(
    `SELECT s.id, s.user_id, u.username, u.avatar, d.side, s.content, s.round, s.created_at
     FROM speeches s
     JOIN users u ON u.id = s.user_id
     JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
     WHERE s.debate_id = ?
     ORDER BY s.created_at ASC, s.id ASC`,
    [debateId],
  );
  if (speeches.length === 0) return [];

  // 情绪计数：按发言聚合
  const emoRows = await db.all<{ speech_id: number; emotion_type: string; cnt: number }[]>(
    `SELECT speech_id, emotion_type, COUNT(*) cnt
     FROM emotions
     WHERE debate_id = ? AND speech_id IS NOT NULL
     GROUP BY speech_id, emotion_type`,
    [debateId],
  );
  const emoMap = new Map<number, { fire: number; agree: number; clap: number }>();
  for (const r of emoRows) {
    const m = emoMap.get(r.speech_id) || { fire: 0, agree: 0, clap: 0 };
    if (r.emotion_type === "fire" || r.emotion_type === "agree" || r.emotion_type === "clap") {
      m[r.emotion_type] = (m[r.emotion_type] || 0) + r.cnt;
    }
    emoMap.set(r.speech_id, m);
  }

  // 发言后支持率快照（speech_end），用于计算影响力
  const snaps = await db.all<{ trigger_id: string; side_a_count: number; side_b_count: number }[]>(
    `SELECT trigger_id, side_a_count, side_b_count
     FROM support_snapshots
     WHERE debate_id = ? AND snapshot_type = 'speech_end' AND trigger_id IS NOT NULL
     ORDER BY timestamp ASC, id ASC`,
    [debateId],
  );

  const highlights: SpeechHighlight[] = [];
  let prevRateA: number | null = null;
  for (const sp of speeches) {
    const emo = emoMap.get(sp.id) || { fire: 0, agree: 0, clap: 0 };
    const snap = snaps.find((s) => s.trigger_id === String(sp.id));
    let impactRateA: number | null = null;
    if (snap) {
      const total = snap.side_a_count + snap.side_b_count;
      const rateA = total === 0 ? 0 : Math.round((snap.side_a_count / total) * 1000) / 10;
      impactRateA = prevRateA === null ? 0 : Math.round((rateA - prevRateA) * 10) / 10;
      prevRateA = rateA;
    }
    highlights.push({
      id: sp.id,
      user_id: sp.user_id,
      username: sp.username,
      avatar: sp.avatar,
      side: sp.side,
      content: sp.content,
      round: sp.round,
      created_at: sp.created_at,
      emotions: { ...emo, total: (emo.fire || 0) + (emo.agree || 0) + (emo.clap || 0) },
      impactRateA,
      hasSnapshot: !!snap,
    });
  }
  return highlights;
}
