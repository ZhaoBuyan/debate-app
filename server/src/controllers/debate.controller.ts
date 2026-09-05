// server/src/controllers/debate.controller.ts

import { Request, Response } from "express";
import debateService from "../services/debate.service.js";
import speechService from "../services/speech.service.js";
import supportService from "../services/support.service.js";
import voteService from "../services/vote.service.js";
import { buildArgumentTree } from "../services/argument.service.js";
import { getDebateHighlights } from "../services/highlight.service.js";
import { searchAll } from "../services/search.service.js";
import { isCategory, isSide } from "../utils/validation.js";

/** GET /api/debates 辩题列表（支持 status/category 筛选） */
export async function list(req: Request, res: Response) {
  try {
    const { status, category } = req.query;
    const debates = await debateService.getDebates(
      status as string | undefined,
      category as string | undefined,
    );
    res.json({ success: true, data: debates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/recommended 每日推荐辩题（D-08） */
export async function recommended(req: Request, res: Response) {
  try {
    const debate = await debateService.getRecommended();
    res.json({ success: true, data: debate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/search?q= 全文检索（KN-01） */
export async function search(req: Request, res: Response) {
  try {
    const q = String(req.query.q || "");
    const data = await searchAll(q);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id 辩题详情 */
export async function detail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const debate = await debateService.getDebateById(id);
    if (!debate) {
      return res.status(404).json({ success: false, error: "辩题不存在" });
    }
    res.json({ success: true, data: debate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/debates 创建辩题（D-01） */
export async function create(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const { title, description, category, sideA, sideB, type } = req.body;
    if (category && !isCategory(category)) {
      return res.status(400).json({ success: false, error: "分类不合法" });
    }
    const result = await debateService.createDebate(
      { title, description, category, sideA, sideB, type },
      userId,
    );
    res.json({ success: true, data: { id: result.id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/debates/:id/join 加入辩论（D-06） */
export async function join(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const { id } = req.params;
    const { side } = req.body;
    if (!isSide(side)) {
      return res.status(400).json({ success: false, error: "请选择阵营 A 或 B" });
    }
    const result = await debateService.joinDebate(id, userId, side);
    res.json({ success: true, started: result.started });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/debates/:id/speech 发表发言（B-03） */
export async function speech(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const { id } = req.params;
    const { content, inputType } = req.body;
    const result = await speechService.createSpeech({
      debateId: id,
      userId,
      content,
      inputType,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/support 获取支持率统计（S-01） */
export async function getSupport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const stats = await supportService.getStats(id);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** POST /api/debates/:id/support 投票支持（S-01，每场每人一票可改边） */
export async function postSupport(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const { id } = req.params;
    const { side } = req.body;
    if (!isSide(side)) {
      return res.status(400).json({ success: false, error: "阵营不合法" });
    }
    const stats = await supportService.setSupport({
      debateId: id,
      userId,
      side,
    });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/votes 获取投票统计（V-03） */
export async function getVotes(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const stats = await voteService.getStats(id);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/argument-map 辩论树（A-04 论点→论据→反驳→再反驳） */
export async function argumentMap(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tree = await buildArgumentTree(id);
    res.json({ success: true, data: tree });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/report 赛后 AI 报告（A-03，懒生成） */
export async function report(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await debateService.getOrCreateReport(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/highlights 精彩时刻 + 发言影响力（I-03/S-05 简化版） */
export async function highlights(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await getDebateHighlights(id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/chain 重辩链聚合（知识库） */
export async function chain(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await debateService.getDebateChain(id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** GET /api/debates/:id/related 相关辩题推荐（侧栏） */
export async function related(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await debateService.getRelatedDebates(id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}

/** POST /api/debates/:id/restart 申请重辩（D-09） */
export async function restart(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未认证" });
    }
    const { id } = req.params;
    const result = await debateService.restartDebate(id, userId);
    res.json({ success: true, data: { id: result.id } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
}
