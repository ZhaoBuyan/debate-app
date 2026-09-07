// server/src/routes/topics.routes.ts

import { Router } from "express";
import { list, create, toggleVote } from "../controllers/topics.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { sensitiveFilter } from "../middleware/sensitive.js";

const router = Router();

router.get("/", list);
router.post("/", authMiddleware, sensitiveFilter, create);
router.post("/:id/vote", authMiddleware, toggleVote);

export default router;
