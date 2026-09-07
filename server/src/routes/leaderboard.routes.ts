// server/src/routes/leaderboard.routes.ts

import { Router } from "express";
import { leaderboard } from "../controllers/leaderboard.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/leaderboard（可选认证：带 token 且 me=1 时返回我的名次）
router.get("/", (req, res, next) => {
  if (req.query.me === "1") return authMiddleware(req, res, next);
  next();
}, leaderboard);

export default router;
