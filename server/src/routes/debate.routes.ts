// server/src/routes/debate.routes.ts

import { Router } from "express";
import {
  list,
  recommended,
  detail,
  create,
  join,
  speech,
  restart,
  getSupport,
  postSupport,
  getVotes,
  argumentMap,
  report,
  highlights,
  chain,
  related,
  search,
} from "../controllers/debate.controller.js";
import { curatedBoard } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { sensitiveFilter } from "../middleware/sensitive.js";

const router = Router();

// ---- 公开接口（无需认证，SRS 6.2/6.3）----
router.get("/", list);
router.get("/recommended", recommended);
router.get("/search", search);
router.get("/curated-board", curatedBoard);
router.get("/:id", detail);
router.get("/:id/support", getSupport);
router.get("/:id/votes", getVotes);
router.get("/:id/argument-map", argumentMap);
router.get("/:id/report", report);
router.get("/:id/highlights", highlights);
router.get("/:id/chain", chain);
router.get("/:id/related", related);

// ---- 需认证接口 ----
router.post("/", authMiddleware, sensitiveFilter, create);
router.post("/:id/join", authMiddleware, join);
router.post("/:id/speech", authMiddleware, sensitiveFilter, speech);
router.post("/:id/support", authMiddleware, postSupport);
router.post("/:id/restart", authMiddleware, restart);

export default router;
