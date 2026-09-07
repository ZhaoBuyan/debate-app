// server/src/routes/user.routes.ts

import { Router } from "express";
import { userProfile } from "../controllers/user.controller.js";

const router = Router();

// GET /api/users/:id 公开主页（无需认证）
router.get("/:id", userProfile);

export default router;
