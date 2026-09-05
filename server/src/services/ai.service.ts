// server/src/services/ai.service.ts

import { config } from "../utils/config.js";

/**
 * AI 辅助服务（SRS 3.7）
 * - A-01 实时论点提炼：辩手发言后提炼核心论点+论据（50字以内）
 * - A-03 赛后报告：AI 生成完整辩论报告（本地启发式，未配置 Groq Key 时可用）
 *
 * 设计：优先调用 Groq API；未配置 GROQ_API_KEY 或调用失败时，
 * 自动降级为本地抽取式摘要，保证功能始终可用。
 */
export class AIService {
  private readonly GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

  /**
   * 提炼发言核心论点（≤50字）
   */
  async summarizeSpeech(content: string): Promise<string> {
    if (!content) return "";
    const text = content.trim();

    if (config.ai.groqApiKey) {
      try {
        return await this.callGroq(
          "你是一名辩论赛速记员。请用不超过50个字提炼该发言的核心论点与论据，直接输出结果，不要任何前缀。",
          text,
        );
      } catch (err) {
        console.error("Groq 调用失败，降级为本地摘要:", (err as Error).message);
      }
    }
    return this.localExtract(text, 50);
  }

  /**
   * 赛后报告（A-03）：汇总正反双方发言并生成简评
   */
  async generateReport(
    debateTitle: string,
    speeches: { side: "A" | "B"; username: string; content: string }[],
  ): Promise<string> {
    if (config.ai.groqApiKey) {
      try {
        const transcript = speeches
          .map(
            (s) =>
              `【${s.side === "A" ? "正方" : "反方"}·${s.username}】${s.content}`,
          )
          .join("\n");
        return await this.callGroq(
          `你是辩论赛复盘教练。辩题：《${debateTitle}》\n请生成一份辩论报告，包含：双方核心论点、主要交锋点、逻辑漏洞与改进建议。500字以内，使用简洁中文分段。`,
          transcript.slice(0, 6000),
        );
      } catch (err) {
        console.error("Groq 报告生成失败:", (err as Error).message);
      }
    }
    // 本地兜底报告
    const sideA = speeches.filter((s) => s.side === "A");
    const sideB = speeches.filter((s) => s.side === "B");
    const points = (list: typeof sideA, label: string) => {
      if (list.length === 0) return `${label}暂无发言`;
      const brief = list
        .map((s) => `${s.username}：${this.localExtract(s.content, 30)}`)
        .join("；");
      return `${label}核心观点：${brief}`;
    };
    return (
      `【赛后总结】辩题《${debateTitle}》共 ${speeches.length} 次发言。\n` +
      points(sideA, "正方") +
      "。" +
      points(sideB, "反方") +
      "。\n\n⚠️ 免责声明：本报告由 AI 自动生成（辅助工具），旨在帮助复盘，可能存在偏差或不完整，请以原始发言记录为准，理性参考。"
    );
  }

  /** 调用 Groq Chat Completions */
  private async callGroq(system: string, user: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(this.GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.ai.groqApiKey}`,
        },
        body: JSON.stringify({
          model: config.ai.model,
          temperature: 0.4,
          max_tokens: 400,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user.slice(0, 4000) },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Groq API ${res.status}`);
      }
      const data = (await res.json()) as any;
      const content: string =
        data?.choices?.[0]?.message?.content || "";
      return content.trim();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 本地抽取式摘要：保留关键句并截断到 maxLen 字符
   */
  private localExtract(text: string, maxLen: number): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= maxLen) return clean;
    const sentences = clean.split(/(?<=[。！？!?；;])/);
    let result = "";
    // 优先取前两句，不够再补
    for (const s of sentences) {
      if ((result + s).length > maxLen) break;
      result += s;
    }
    result = result.trim();
    if (result.length === 0) result = clean.slice(0, maxLen);
    if (result.length < clean.length) result += "…";
    return result.slice(0, maxLen + 1);
  }
}

export default new AIService();
