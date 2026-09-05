import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import DebateReview from "../components/admin/DebateReview";
import UserManagement from "../components/admin/UserManagement";
import ReportManagement from "../components/admin/ReportManagement";
import CurateManager from "../components/admin/CurateManager";
import Button from "../components/common/Button";
import type { AdminLog, Announcement, Debate, SensitiveWord } from "../types";
import { DEBATE_TYPE_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "../types";

type TabKey =
  | "overview"
  | "review"
  | "debates"
  | "curate"
  | "users"
  | "reports"
  | "sensitive"
  | "announce"
  | "logs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "📊 总览" },
  { key: "review", label: "🕵️ 辩题审核" },
  { key: "curate", label: "🏅 内容运营" },
  { key: "debates", label: "🏛️ 辩论管理" },
  { key: "users", label: "👥 用户管理" },
  { key: "reports", label: "🚩 举报处理" },
  { key: "sensitive", label: "🚫 敏感词" },
  { key: "announce", label: "📢 公告" },
  { key: "logs", label: "📜 审计日志" },
];

function AdminPanel() {
  const { user, isAdmin, logout } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-orange-400 mb-4">🛡️ 管理后台</h1>
        <div className="flex flex-wrap gap-1.5 mb-6" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-sm transition ${
                tab === t.key
                  ? "bg-orange-500 text-white font-medium"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-5">
          {tab === "overview" && <Overview />}
          {tab === "review" && <DebateReview />}
          {tab === "curate" && <CurateManager />}
          {tab === "debates" && <DebatesManager />}
          {tab === "users" && <UserManagement />}
          {tab === "reports" && <ReportManagement />}
          {tab === "sensitive" && <SensitiveWords />}
          {tab === "announce" && <Announcements />}
          {tab === "logs" && <Logs />}
        </div>
      </div>
    </div>
  );
}

// ---------- 辩论管理（全量列表：查看/强制结束） ----------
const DEBATE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待审核" },
  { key: "waiting", label: "报名中" },
  { key: "ongoing", label: "辩论中" },
  { key: "finished", label: "已结束" },
  { key: "rejected", label: "已拒绝" },
];

const STATUS_DOT: Record<string, string> = {
  pending: "text-yellow-300",
  waiting: "text-blue-300",
  ongoing: "text-red-400",
  finished: "text-gray-400",
  rejected: "text-gray-500",
};

function DebatesManager() {
  const [list, setList] = useState<Debate[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.listDebates();
      setList(all);
      setError("");
    } catch (e) {
      setError(errMsg(e, "加载失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const forceEnd = async (d: Debate) => {
    if (!window.confirm(`确认强制结束《${d.title}》？将触发积分结算与赛后报告。`)) return;
    setBusyId(d.id);
    try {
      await api.adminForceEnd(d.id, "管理员从后台强制结束");
      await load();
    } catch (e) {
      setError(errMsg(e, "操作失败"));
    } finally {
      setBusyId("");
    }
  };

  const visible = list.filter((d) => filter === "all" || d.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {DEBATE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${
              filter === f.key ? "bg-orange-500" : "bg-gray-700 text-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 ml-auto">共 {visible.length} 场</span>
      </div>
      {error && (
        <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">{error}</div>
      )}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">加载中...</div>
      ) : visible.length === 0 ? (
        <div className="text-gray-500 py-10 text-center">暂无该状态的辩题</div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {visible.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-gray-800 rounded-xl border border-gray-700 px-4 py-3">
              <span className={`text-sm ${STATUS_DOT[d.status]}`} title={STATUS_LABELS[d.status]} aria-hidden>
                ●
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{STATUS_LABELS[d.status]}</span>
                  <span>{DEBATE_TYPE_LABELS[d.debate_type || "classic"]}</span>
                  {(d.cool_down_minutes || 0) > 0 && <span>🧊 冷静期 {d.cool_down_minutes} 分</span>}
                  <span>👥 {d.debater_count ?? 0}/{(d.debate_type === "quick1v1" ? 2 : 8)}</span>
                  <span>👤 {d.creator_name || "匿名"}</span>
                  <span>🎤 {(d as any).speech_count ?? 0}</span>
                  {d.repeat_count > 0 && <span>🔁 重辩×{d.repeat_count}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Link
                  to={`/debate/${d.id}`}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                >
                  查看
                </Link>
                {d.status === "ongoing" && (
                  <button
                    onClick={() => forceEnd(d)}
                    disabled={busyId === d.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600/70 hover:bg-red-600 transition disabled:opacity-40"
                  >
                    ⛔ 强制结束
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 总览 ----------
function Overview() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .adminStats()
      .then(setData)
      .catch((e) => setError(errMsg(e)));
  }, []);
  if (error) return <div className="text-red-300 text-sm">{error}</div>;
  if (!data) return <div className="text-gray-400 py-10 text-center">加载中...</div>;
  const statusName: Record<string, string> = {
    pending: "待审核",
    waiting: "报名中",
    ongoing: "辩论中",
    finished: "已结束",
    rejected: "已拒绝",
  };
  const cards = [
    { label: "注册用户", value: data.users, emoji: "👥" },
    { label: "累计发言", value: data.speeches, emoji: "🎤" },
    { label: "待处理举报", value: data.pendingReports, emoji: "🚩" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
            <div className="text-2xl mb-1" aria-hidden>{c.emoji}</div>
            <div className="text-3xl font-bold text-orange-400">{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
          <div className="text-2xl mb-1" aria-hidden>🗂️</div>
          <div className="text-3xl font-bold text-orange-400">
            {Object.values(data.byStatus || {}).reduce((a: number, b: any) => a + b, 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">全部辩题</div>
        </div>
      </div>
      <div className="text-sm text-gray-400 mb-2">辩题状态分布</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(data.byStatus || {}).map(([k, v]) => (
          <span key={k} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs">
            {statusName[k] || k}：<b className="text-orange-300">{v as number}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- 敏感词管理（AD-07） ----------
function SensitiveWords() {
  const [list, setList] = useState<SensitiveWord[]>([]);
  const [word, setWord] = useState("");
  const [severity, setSeverity] = useState("high");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .adminSensitiveWords()
      .then(setList)
      .catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(load, [load]);

  const add = async () => {
    if (!word.trim()) return setError("请输入敏感词");
    setError("");
    try {
      await api.adminAddSensitiveWord(word.trim(), severity);
      setWord("");
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("确认删除该敏感词？")) return;
    try {
      await api.adminDeleteSensitiveWord(id);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const sevColor: Record<string, string> = {
    high: "bg-red-500/20 text-red-300",
    moderate: "bg-yellow-500/20 text-yellow-300",
    low: "bg-green-500/20 text-green-300",
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="输入新敏感词…"
          className="flex-1 bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          aria-label="严重级别"
        >
          <option value="high">高危</option>
          <option value="moderate">中危</option>
          <option value="low">低危</option>
        </select>
        <Button size="sm" onClick={add}>添加</Button>
      </div>
      {error && <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="flex flex-wrap gap-2">
        {list.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-sm"
          >
            <span className={sevColor[w.severity] || ""} title={SEVERITY_LABELS[w.severity]}>
              ●
            </span>
            {w.word}
            <button
              onClick={() => remove(w.id)}
              className="text-gray-500 hover:text-red-400 text-xs"
              aria-label={`删除敏感词 ${w.word}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        命中敏感词的内容将被自动替换为 <b>*</b>（注册/发言/消息/辩题等全链路实时过滤）
      </p>
    </div>
  );
}

// ---------- 公告管理（AD-08） ----------
function Announcements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState(1);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .adminAnnouncements()
      .then(setList)
      .catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    if (!title.trim() || !content.trim()) return setError("标题和内容不能为空");
    setError("");
    try {
      await api.adminCreateAnnouncement({ title: title.trim(), content: content.trim(), priority });
      setTitle("");
      setContent("");
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div>
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="公告标题…"
          className="w-full bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="公告内容…"
          className="w-full bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm h-20 resize-none"
        />
        <div className="flex gap-2 items-center">
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            aria-label="优先级"
          >
            <option value={2}>高优先</option>
            <option value={1}>普通</option>
            <option value={0}>低优先</option>
          </select>
          <Button size="sm" onClick={create}>发布公告</Button>
        </div>
      </div>
      {error && <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="space-y-2">
        {list.map((a) => (
          <div key={a.id} className="flex items-start gap-3 bg-gray-800 rounded-xl border border-gray-700 p-3.5">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {a.is_active ? "🟢" : "⚪"} {a.title}
                <span className="ml-2 text-[10px] text-gray-500">
                  {new Date(a.created_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{a.content}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                api
                  .adminToggleAnnouncement(a.id, !a.is_active)
                  .then(load)
                  .catch((e) => setError(errMsg(e)))
              }
            >
              {a.is_active ? "下架" : "上架"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                window.confirm("确认删除该公告？") &&
                api.adminDeleteAnnouncement(a.id).then(load).catch((e) => setError(errMsg(e)))
              }
            >
              删除
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 审计日志（AD-09） ----------
function Logs() {
  const [list, setList] = useState<AdminLog[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .adminLogs()
      .then(setList)
      .catch((e) => setError(errMsg(e)));
  }, []);
  if (error) return <div className="text-red-300 text-sm">{error}</div>;
  return (
    <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
      {list.length === 0 && <div className="text-gray-500 text-center py-8">暂无操作记录</div>}
      {list.map((l) => (
        <div
          key={l.id}
          className="flex items-start gap-3 text-xs bg-gray-800/70 rounded-lg px-3 py-2"
        >
          <span className="text-orange-300 whitespace-nowrap">{l.admin_name || "系统"}</span>
          <span className="text-gray-300 whitespace-nowrap">{l.action_type}</span>
          <span className="text-gray-500 whitespace-nowrap">
            {l.target_type}{l.target_id ? `#${l.target_id}` : ""}
          </span>
          <span className="text-gray-500 flex-1 truncate">{l.details || ""}</span>
          <span className="text-gray-600 whitespace-nowrap">
            {new Date(l.created_at).toLocaleString("zh-CN")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default AdminPanel;
