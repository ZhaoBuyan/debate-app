// server/src/services/argument.service.ts
// 辩论树（Argument Map）推导服务（SRS A-04：论点→论据→反驳→再反驳）

import { getDb } from "../database/index.js";
import { ArgumentNode } from "../types/index.js";

interface SpeechRow {
  id: number;
  debate_id: string;
  user_id: string;
  username: string;
  avatar: string;
  side: "A" | "B";
  content: string;
  round: number;
  created_at: number;
}

interface MutableNode extends ArgumentNode {
  children: MutableNode[];
}

/**
 * 由发言记录推导逻辑树：
 * 规则（启发式）——
 * 1. 首条发言成为根“论点”节点；
 * 2. 当发言方切换阵营（A→B 或 B→A）时，视为对上一节点（对方立场）的
 *    “反驳 / 再反驳”，挂为子节点；
 * 3. 同一方连续发言（新一轮提出新论点）则另起一个根节点；
 * 4. 节点内嵌子链即构成 论点 → 反驳 → 再反驳 的逻辑链路。
 */
export async function buildArgumentTree(debateId: string): Promise<ArgumentNode[]> {
  const db = await getDb();
  const speeches = await db.all<SpeechRow[]>(
    `SELECT s.*, u.username, u.avatar, d.side
     FROM speeches s
     JOIN users u ON u.id = s.user_id
     JOIN debaters d ON d.debate_id = s.debate_id AND d.user_id = s.user_id
     WHERE s.debate_id = ?
     ORDER BY s.created_at ASC, s.id ASC`,
    [debateId],
  );

  const roots: MutableNode[] = [];
  let lastNode: MutableNode | null = null;
  let lastSide: "A" | "B" | null = null;

  for (const sp of speeches) {
    const node: MutableNode = {
      id: sp.id,
      debate_id: sp.debate_id,
      user_id: sp.user_id,
      username: sp.username,
      avatar: sp.avatar,
      side: sp.side,
      content: sp.content,
      round: sp.round,
      created_at: sp.created_at,
      children: [],
    };
    if (lastNode && lastSide && sp.side !== lastSide) {
      // 立场切换：作为对上一节点的反驳/再反驳
      lastNode.children.push(node);
    } else {
      // 首条发言或同方新论点：开新根
      roots.push(node);
    }
    lastNode = node;
    lastSide = sp.side;
  }
  return roots;
}
