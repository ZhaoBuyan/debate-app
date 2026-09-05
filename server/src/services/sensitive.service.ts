// server/src/services/sensitive.service.ts

import { getDb } from "../database/index.js";

export interface SensitiveWord {
  id: number;
  word: string;
  severity: "low" | "moderate" | "high";
  created_at: number;
}

const CACHE_TTL = 60 * 1000; // 缓存 60 秒

export class SensitiveService {
  private cachedWords: string[] = [];
  private cacheLoadedAt = 0;

  /** 获取全部敏感词（带 60s 缓存） */
  async getWords(force = false): Promise<string[]> {
    const now = Date.now();
    if (!force && this.cachedWords.length > 0 && now - this.cacheLoadedAt < CACHE_TTL) {
      return this.cachedWords;
    }
    const db = await getDb();
    const rows = await db.all<{ word: string }[]>(
      "SELECT word FROM sensitive_words",
    );
    this.cachedWords = rows.map((r) => r.word);
    this.cacheLoadedAt = now;
    return this.cachedWords;
  }

  /** 获取敏感词完整列表（管理后台用） */
  async list(): Promise<SensitiveWord[]> {
    const db = await getDb();
    return db.all<SensitiveWord[]>(
      "SELECT * FROM sensitive_words ORDER BY severity DESC, created_at DESC",
    );
  }

  /** 添加敏感词 */
  async add(word: string, severity: string = "moderate"): Promise<SensitiveWord> {
    const trimmed = (word || "").trim();
    if (!trimmed) throw new Error("敏感词不能为空");
    if (!["low", "moderate", "high"].includes(severity)) {
      throw new Error("严重级别不合法");
    }
    const db = await getDb();
    const existing = await db.get("SELECT id FROM sensitive_words WHERE word = ?", [trimmed]);
    if (existing) throw new Error("该敏感词已存在");
    const result = await db.run(
      "INSERT INTO sensitive_words (word, severity) VALUES (?, ?)",
      [trimmed, severity],
    );
    this.cachedWords.push(trimmed);
    const row = await db.get<SensitiveWord>(
      "SELECT * FROM sensitive_words WHERE id = ?",
      [result.lastID],
    );
    return row!;
  }

  /** 删除敏感词 */
  async remove(id: number): Promise<void> {
    const db = await getDb();
    await db.run("DELETE FROM sensitive_words WHERE id = ?", [id]);
    await this.getWords(true); // 刷新缓存
  }

  /** 检查文本是否命中敏感词 */
  async contains(text: string): Promise<boolean> {
    const words = await this.getWords();
    return words.some((w) => text.includes(w));
  }

  /**
   * 过滤文本：命中敏感词替换为等长 *
   * 例如： 敏感词“暴力” → “**”
   */
  async filterText(text: string): Promise<string> {
    if (!text) return text;
    let words = await this.getWords();
    // 按长度降序，优先替换长词，避免子串覆盖
    words = [...words].sort((a, b) => b.length - a.length);
    let result = text;
    for (const w of words) {
      if (!w) continue;
      result = result.split(w).join("*".repeat(w.length));
    }
    return result;
  }
}

export default new SensitiveService();
