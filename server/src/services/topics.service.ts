// server/src/services/topics.service.ts
// 辩题众创（D-10）：提案 + 投票 + 管理员采纳为正式辩题

import { getDb } from "../database/index.js";
import debateService from "./debate.service.js";
import { TopicProposal } from "../types/index.js";
import { isCategory } from "../utils/validation.js";

export class TopicsService {
  /**
   * 众创列表（按票数倒序；viewerId 存在时附带当前用户是否已投票）
   */
  async list(viewerId?: string, limit = 50): Promise<TopicProposal[]> {
    const db = await getDb();
    const rows = await db.all<TopicProposal[]>(
      `SELECT p.*, u.username,
              (SELECT COUNT(*) FROM topic_proposal_votes v
               WHERE v.proposal_id = p.id) as vote_count
       FROM topic_proposals p
       JOIN users u ON u.id = p.user_id
       ORDER BY vote_count DESC, p.created_at DESC
       LIMIT ?`,
      [limit],
    );
    if (viewerId && rows.length > 0) {
      const marks = rows.map(() => "?").join(",");
      const votedRows = await db.all<{ proposal_id: number }[]>(
        `SELECT proposal_id FROM topic_proposal_votes
         WHERE user_id = ? AND proposal_id IN (${marks})`,
        [viewerId, ...rows.map((r) => r.id)],
      );
      const votedSet = new Set(votedRows.map((r) => r.proposal_id));
      for (const r of rows) r.voted = votedSet.has(r.id);
    }
    return rows;
  }

  /**
   * 提交众创提案
   */
  async create(
    userId: string,
    input: { title: string; description?: string; category?: string },
  ): Promise<TopicProposal> {
    const title = (input.title || "").trim();
    if (title.length < 5 || title.length > 60) {
      throw new Error("辩题标题长度需为 5-60 字");
    }
    const description = (input.description || "").trim().slice(0, 200);
    const category = input.category || "general";
    if (!isCategory(category)) throw new Error("分类不合法");

    const db = await getDb();
    const exist = await db.get<{ id: number }>(
      "SELECT id FROM topic_proposals WHERE title = ?",
      [title],
    );
    if (exist) throw new Error("这个辩题已经在众创池里了，去给它投票吧");

    const result = await db.run(
      `INSERT INTO topic_proposals (user_id, title, description, category)
       VALUES (?, ?, ?, ?)`,
      [userId, title, description || null, category],
    );
    return (await this.getById(result.lastID!))!;
  }

  async getById(id: number): Promise<TopicProposal | null> {
    const db = await getDb();
    const row = await db.get<TopicProposal>(
      `SELECT p.*, u.username,
              (SELECT COUNT(*) FROM topic_proposal_votes v
               WHERE v.proposal_id = p.id) as vote_count
       FROM topic_proposals p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [id],
    );
    return row || null;
  }

  /**
   * 投票（toggle：已投则取消），返回最新票数与是否已投
   */
  async toggleVote(
    proposalId: number,
    userId: string,
  ): Promise<{ voted: boolean; voteCount: number }> {
    const db = await getDb();
    const proposal = await db.get<{ id: number }>(
      "SELECT id FROM topic_proposals WHERE id = ?",
      [proposalId],
    );
    if (!proposal) throw new Error("该提案不存在或已被采纳");

    const existing = await db.get<{ proposal_id: number }>(
      "SELECT proposal_id FROM topic_proposal_votes WHERE proposal_id = ? AND user_id = ?",
      [proposalId, userId],
    );
    if (existing) {
      await db.run(
        "DELETE FROM topic_proposal_votes WHERE proposal_id = ? AND user_id = ?",
        [proposalId, userId],
      );
    } else {
      await db.run(
        "INSERT INTO topic_proposal_votes (proposal_id, user_id) VALUES (?, ?)",
        [proposalId, userId],
      );
    }
    const count = await db.get<{ n: number }>(
      "SELECT COUNT(*) n FROM topic_proposal_votes WHERE proposal_id = ?",
      [proposalId],
    );
    return { voted: !existing, voteCount: count?.n || 0 };
  }

  /**
   * 管理员采纳：转为正式辩题（pending，走审核流程），并从众创池移除
   */
  async adopt(proposalId: number): Promise<{ id: string }> {
    const proposal = await this.getById(proposalId);
    if (!proposal) throw new Error("该提案不存在或已被移除");

    const created = await debateService.createDebate(
      {
        title: proposal.title,
        description: proposal.description || undefined,
        category: proposal.category,
      },
      proposal.user_id,
    );

    const db = await getDb();
    await db.run("DELETE FROM topic_proposals WHERE id = ?", [proposalId]);
    return created;
  }

  /** 管理员移除提案 */
  async remove(proposalId: number): Promise<void> {
    const db = await getDb();
    const result = await db.run("DELETE FROM topic_proposals WHERE id = ?", [
      proposalId,
    ]);
    if (result.changes === 0) throw new Error("该提案不存在或已被移除");
  }
}

export default new TopicsService();
