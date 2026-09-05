// server/src/socket/rate.limit.ts
// Socket 事件级限流：按 userId + 事件类型滑动窗口计数
// 以用户维度计数（而非连接），多开连接无法绕过

interface Bucket {
  key: string;
  hits: number[];
}

const MAX_BUCKETS = 5000;

class SocketRateLimiter {
  private buckets = new Map<string, number[]>();

  /** 尝试获取配额：true=放行，false=超限 */
  tryAcquire(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    let hits = this.buckets.get(key);
    if (!hits) {
      if (this.buckets.size >= MAX_BUCKETS) {
        this.prune(now);
        // 仍超容量则整体清空（极端情况下的自我保护）
        if (this.buckets.size >= MAX_BUCKETS) this.buckets.clear();
      }
      hits = [];
      this.buckets.set(key, hits);
    }
    // 清理窗口外的记录
    const valid: number[] = [];
    for (const t of hits) {
      if (now - t < windowMs) valid.push(t);
    }
    if (valid.length >= limit) {
      this.buckets.set(key, valid);
      return false;
    }
    valid.push(now);
    this.buckets.set(key, valid);
    return true;
  }

  /** 清理过期桶，防止内存无限增长 */
  private prune(now: number) {
    for (const [key, hits] of this.buckets) {
      const valid = hits.filter((t) => now - t < 120_000);
      if (valid.length === 0) {
        this.buckets.delete(key);
      } else if (valid.length !== hits.length) {
        this.buckets.set(key, valid);
      }
    }
  }
}

export default new SocketRateLimiter();

/** 事件类型配额（防刷屏/防滥用） */
export const RATE_RULES = {
  speech: { limit: 2, windowMs: 60_000 }, // 发言：60 秒最多 2 条
  send_message: { limit: 20, windowMs: 10_000 }, // 聊天：10 秒最多 20 条
  emotion: { limit: 15, windowMs: 10_000 }, // 情绪：10 秒最多 15 次
  support: { limit: 10, windowMs: 10_000 }, // 支持：10 秒最多 10 次
  vote: { limit: 10, windowMs: 10_000 }, // 投票：10 秒最多 10 次
  gesture: { limit: 10, windowMs: 10_000 }, // 手语消息
  report: { limit: 5, windowMs: 60_000 }, // 举报：60 秒最多 5 次
} as const;

export type RateKind = keyof typeof RATE_RULES;
