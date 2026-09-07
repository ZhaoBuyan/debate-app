// client/src/api.ts
// axios 封装：自动注入 JWT、统一错误处理

import axios, { AxiosError } from "axios";
import type {
  AdminLog,
  AdminUser,
  Announcement,
  ArgumentNode,
  ChainItem,
  CuratedBoard,
  Debate,
  DebateCategory,
  DebateChain,
  DebateReport,
  DebateType,
  MyActivities,
  RelatedDebate,
  Report,
  TopicProposal,
  LeaderboardPayload,
  SearchPayload,
  SensitiveWord,
  Speech,
  SpeechHighlight,
  SupportStats,
  User,
  VoteStats,
} from "./types";

const TOKEN_KEY = "token";
const USER_KEY = "user";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const userStore = {
  get: (): User | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set: (u: User) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(USER_KEY),
};

const http = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; success?: boolean }>) => {
    const status = error.response?.status;
    if (status === 401) {
      // Token 失效：清理并回到登录页
      tokenStore.clear();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** 统一解析后端 { success, error, data } 响应 */
function unwrap<T>(res: { data: { success: boolean; error?: string; data?: T } }): T {
  if (!res.data.success) {
    throw new Error(res.data.error || "请求失败");
  }
  return res.data.data as T;
}

export const api = {
  // ---------- 认证 ----------
  async register(username: string, password: string): Promise<{ user: User; token: string }> {
    const res = await http.post("/auth/register", { username, password });
    return unwrap(res as any);
  },
  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const res = await http.post("/auth/login", { username, password });
    return unwrap(res as any);
  },
  async me(): Promise<User> {
    const res = await http.get("/auth/me");
    return unwrap(res as any);
  },

  // ---------- 辩题 ----------
  async listDebates(params?: { status?: string; category?: string }): Promise<Debate[]> {
    const res = await http.get("/debates", { params });
    return unwrap(res as any);
  },
  async getDebate(id: string): Promise<Debate> {
    const res = await http.get(`/debates/${id}`);
    return unwrap(res as any);
  },
  async getRecommended(): Promise<Debate | null> {
    const res = await http.get("/debates/recommended");
    return unwrap<Debate | null>(res as any);
  },
  async createDebate(input: {
    title: string;
    description?: string;
    category: DebateCategory;
    sideA?: string;
    sideB?: string;
    type?: DebateType;
  }): Promise<{ id: string }> {
    const res = await http.post("/debates", input);
    return unwrap(res as any);
  },
  async joinDebate(id: string, side: "A" | "B"): Promise<{ started: boolean }> {
    const res = await http.post(`/debates/${id}/join`, { side });
    return unwrap(res as any);
  },
  async restartDebate(id: string): Promise<{ id: string }> {
    const res = await http.post(`/debates/${id}/restart`);
    return unwrap(res as any);
  },
  async getSupport(id: string): Promise<SupportStats> {
    const res = await http.get(`/debates/${id}/support`);
    return unwrap(res as any);
  },
  async postSupport(id: string, side: "A" | "B"): Promise<SupportStats> {
    const res = await http.post(`/debates/${id}/support`, { side });
    return unwrap(res as any);
  },
  async getVotes(id: string): Promise<VoteStats> {
    const res = await http.get(`/debates/${id}/votes`);
    return unwrap(res as any);
  },
  /** REST 兜底发言（WebSocket 优先） */
  async postSpeech(
    id: string,
    content: string,
    inputType?: "text" | "voice" | "sign",
  ): Promise<Speech> {
    const res = await http.post(`/debates/${id}/speech`, { content, inputType });
    return unwrap(res as any);
  },
  /** 辩论树（A-04） */
  async getArgumentMap(id: string): Promise<ArgumentNode[]> {
    const res = await http.get(`/debates/${id}/argument-map`);
    return unwrap(res as any);
  },
  /** 赛后 AI 报告（A-03） */
  async getReport(id: string): Promise<DebateReport | null> {
    const res = await http.get(`/debates/${id}/report`);
    return unwrap(res as any);
  },
  /** 导出我的全部数据（数据可携带权） */
  async exportMyData(): Promise<any> {
    const res = await http.get("/auth/export");
    return unwrap(res as any);
  },
  /** 修改密码 */
  async changePassword(oldPassword: string, newPassword: string) {
    const res = await http.put("/auth/password", { oldPassword, newPassword });
    return unwrap(res as any);
  },
  /** 更新头像 */
  async updateAvatar(avatar: string): Promise<User> {
    const res = await http.put("/auth/avatar", { avatar });
    return unwrap<User>(res as any);
  },
  /** 我的活动概览（个人资料页） */
  async myActivities(): Promise<MyActivities> {
    const res = await http.get("/auth/activities");
    return unwrap(res as any);
  },
  /** 精彩时刻 / 发言影响力 */
  async getHighlights(id: string): Promise<SpeechHighlight[]> {
    const res = await http.get(`/debates/${id}/highlights`);
    return unwrap(res as any);
  },
  /** 重辩链聚合（知识库） */
  async getChain(id: string): Promise<DebateChain> {
    const res = await http.get(`/debates/${id}/chain`);
    return unwrap(res as any);
  },
  /** 全文检索（KN-01） */
  async search(q: string): Promise<SearchPayload> {
    const res = await http.get("/debates/search", { params: { q } });
    return unwrap(res as any);
  },
  /** 相关辩题推荐（KN-03，辩论室侧栏） */
  async getRelated(id: string): Promise<RelatedDebate[]> {
    const res = await http.get(`/debates/${id}/related`);
    return unwrap(res as any);
  },
  /** 管理员：推进辩论阶段（B-05/B-06） */
  async adminSetPhase(id: string, phase: "free" | "summary") {
    const res = await http.put(`/admin/debates/${id}/phase`, { phase });
    return unwrap(res as any);
  },
  /** 众创列表 */
  async listTopics(): Promise<TopicProposal[]> {
    const res = await http.get("/topics");
    return unwrap(res as any);
  },
  /** 提交众创提案 */
  async createTopic(input: { title: string; description?: string; category: DebateCategory }): Promise<TopicProposal> {
    const res = await http.post("/topics", input);
    return unwrap(res as any);
  },
  /** 众创投票（toggle） */
  async voteTopic(id: number): Promise<{ voted: boolean; voteCount: number }> {
    const res = await http.post(`/topics/${id}/vote`);
    return unwrap(res as any);
  },
  /** 管理员：采纳众创提案 */
  async adminAdoptTopic(id: number) {
    const res = await http.post(`/admin/topics/${id}/adopt`);
    return unwrap(res as any);
  },
  /** 管理员：移除众创提案 */
  async adminRemoveTopic(id: number) {
    const res = await http.delete(`/admin/topics/${id}`);
    return unwrap(res as any);
  },
  /** 排行榜 */
  async leaderboard(type: "points" | "active" = "points"): Promise<LeaderboardPayload> {
    const res = await http.get("/leaderboard", { params: { type, me: "1" } });
    return unwrap(res as any);
  },
  /** 公开个人主页（C4） */
  async publicProfile(userId: string): Promise<MyActivities> {
    const res = await http.get(`/users/${userId}`);
    return unwrap(res as any);
  },
  /** 内容运营榜单（编辑精选/正在直播/人气复盘） */
  async curatedBoard(): Promise<CuratedBoard> {
    const res = await http.get("/debates/curated-board");
    return unwrap(res as any);
  },
  /** 管理员：设置/取消编辑精选 */
  async adminSetCurated(id: string, curated: boolean) {
    const res = await http.put(`/admin/debates/${id}/curate`, { curated });
    return unwrap(res as any);
  },

  // ---------- 公告 ----------
  async listAnnouncements(): Promise<Announcement[]> {
    const res = await http.get("/announcements");
    return unwrap(res as any);
  },

  // ---------- 管理 ----------
  async adminStats(): Promise<{
    users: number;
    speeches: number;
    pendingReports: number;
    byStatus: Record<string, number>;
  }> {
    const res = await http.get("/admin/stats");
    return unwrap(res as any);
  },
  async adminUsers(params?: { search?: string; page?: number }): Promise<{
    list: AdminUser[];
    total: number;
  }> {
    const res = await http.get("/admin/users", { params });
    return unwrap(res as any);
  },
  async adminBan(userId: string, durationMs?: number | null, reason?: string) {
    const res = await http.post(`/admin/users/${userId}/ban`, {
      reason,
      durationMs: durationMs === undefined ? null : durationMs,
    });
    return unwrap(res as any);
  },
  async adminUnban(userId: string) {
    const res = await http.post(`/admin/users/${userId}/unban`);
    return unwrap(res as any);
  },
  async adminWarn(userId: string, reason?: string) {
    const res = await http.post(`/admin/users/${userId}/warn`, { reason });
    return unwrap(res as any);
  },
  async adminPendingDebates(): Promise<Debate[]> {
    const res = await http.get("/admin/debates/pending");
    return unwrap(res as any);
  },
  async adminApproveDebate(id: string, note?: string, coolDownMinutes = 0) {
    const res = await http.put(`/admin/debates/${id}/approve`, {
      note,
      coolDownMinutes,
    });
    return unwrap(res as any);
  },
  async adminRejectDebate(id: string, note?: string) {
    const res = await http.put(`/admin/debates/${id}/reject`, { note });
    return unwrap(res as any);
  },
  async adminForceEnd(id: string, reason?: string) {
    const res = await http.post(`/admin/debates/${id}/force-end`, { reason });
    return unwrap(res as any);
  },
  async adminReports(status?: string): Promise<Report[]> {
    const res = await http.get("/admin/reports", { params: { status } });
    return unwrap(res as any);
  },
  async adminHandleReport(
    id: number,
    action: "resolve" | "reject" | "delete_content",
    note?: string,
  ) {
    const res = await http.put(`/admin/reports/${id}`, { action, note });
    return unwrap(res as any);
  },
  async adminSensitiveWords(): Promise<SensitiveWord[]> {
    const res = await http.get("/admin/sensitive-words");
    return unwrap(res as any);
  },
  async adminAddSensitiveWord(word: string, severity: string) {
    const res = await http.post("/admin/sensitive-words", { word, severity });
    return unwrap(res as any);
  },
  async adminDeleteSensitiveWord(id: number) {
    const res = await http.delete(`/admin/sensitive-words/${id}`);
    return unwrap(res as any);
  },
  async adminAnnouncements(): Promise<Announcement[]> {
    const res = await http.get("/admin/announcements");
    return unwrap(res as any);
  },
  async adminCreateAnnouncement(input: { title: string; content: string; priority?: number }) {
    const res = await http.post("/admin/announcements", input);
    return unwrap(res as any);
  },
  async adminToggleAnnouncement(id: number, isActive: boolean) {
    const res = await http.put(`/admin/announcements/${id}/toggle`, { isActive });
    return unwrap(res as any);
  },
  async adminDeleteAnnouncement(id: number) {
    const res = await http.delete(`/admin/announcements/${id}`);
    return unwrap(res as any);
  },
  async adminLogs(): Promise<AdminLog[]> {
    const res = await http.get("/admin/logs");
    return unwrap(res as any);
  },
};

/** 从 axios 错误中提取后端 error 文案 */
export function errMsg(err: unknown, fallback = "操作失败"): string {
  const e = err as AxiosError<{ error?: string }>;
  return e?.response?.data?.error || (err as Error)?.message || fallback;
}

export default api;
