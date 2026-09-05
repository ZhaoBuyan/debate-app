// server/src/middleware/sensitive.ts

import { Request, Response, NextFunction } from "express";
import sensitiveService from "../services/sensitive.service.js";

// 需要做敏感词过滤的请求体字段
const TEXT_FIELDS = [
  "title",
  "description",
  "content",
  "reason",
  "sideA",
  "sideB",
  "username",
  "note",
];

/**
 * 敏感词过滤中间件：对请求体中的文本字段执行实时过滤（SRS AD-07）
 * 命中敏感词的内容会被替换为同长度的 *（例如“暴力” → “**”）
 */
export const sensitiveFilter = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body: any = req.body;
    if (body && typeof body === "object") {
      for (const field of TEXT_FIELDS) {
        if (typeof body[field] === "string") {
          body[field] = await sensitiveService.filterText(body[field]);
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
