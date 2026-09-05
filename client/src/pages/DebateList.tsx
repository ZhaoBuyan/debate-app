import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api";
import DebateCard from "../components/debate/DebateCard";
import CuratedSpotlight from "../components/debate/CuratedSpotlight";
import Loading from "../components/common/Loading";
import Navbar from "../components/common/Navbar";
import VoiceControl from "../components/voice/VoiceControl";
import useAuth from "../hooks/useAuth";
import type { Announcement, Debate, DebateCategory, SearchPayload } from "../types";
import { CATEGORY_LABELS, SIDE_LABELS } from "../types";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "waiting", label: "报名中" },
  { value: "ongoing", label: "辩论中" },
  { value: "finished", label: "已结束" },
  { value: "pending", label: "我的待审核" },
];

function DebateList() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [category, setCategory] = useState(() => searchParams.get("category") || "all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState("");

  // 筛选条件同步到 URL（可分享 / 返回保持）
  useEffect(() => {
    setSearchParams({ status, category }, { replace: true });
  }, [status, category, setSearchParams]);

  // ---------- 全文检索（KN-01） ----------
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload | null>(null);
  const [searching, setSearching] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults(null);
      setPanelOpen(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setResults(r);
          setPanelOpen(true);
        })
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const highlight = (text: string, keyword: string) => {
    const q = keyword.trim();
    if (!q) return text;
    const parts: React.ReactNode[] = [];
    let rest = text;
    let i = 0;
    while (rest.length > 0 && i < 20) {
      const idx = rest.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) {
        parts.push(rest);
        break;
      }
      if (idx > 0) parts.push(rest.slice(0, idx));
      parts.push(
        <mark key={i} className="bg-yellow-500/40 text-yellow-100 rounded px-0.5">
          {rest.slice(idx, idx + q.length)}
        </mark>,
      );
      rest = rest.slice(idx + q.length);
      i++;
    }
    return parts;
  };

  const fetchDebates = useCallback(async () => {
    try {
      const list = await api.listDebates({ status, category });
      // “待审核”只显示自己创建的（否则普通用户看不到刚创建的辩题状态）
      const visible =
        status === "pending"
          ? list.filter((d) => d.status === "pending" && d.creator_id === user?.id)
          : list;
      setDebates(visible);
      setError("");
    } catch (err) {
      setError(errMsg(err, "加载辩题失败"));
    }
  }, [status, category, user?.id]);

  useEffect(() => {
    fetchDebates().finally(() => setLoading(false));
  }, [fetchDebates]);

  useEffect(() => {
    api
      .listAnnouncements()
      .then((a) => setAnnouncements(a))
      .catch(() => {});
  }, []);

  // 语音控制指令
  const voiceCommands: Record<string, () => void> = {
    "去大厅": () => navigate("/debates"),
    "创建辩题": () => navigate("/create"),
    "刷新列表": () => fetchDebates(),
  };
  if (isAdmin) {
    voiceCommands["管理后台"] = () => navigate("/admin");
  }

  const ongoing = debates.filter((d) => d.status === "ongoing");
  const waiting = debates.filter((d) => d.status === "waiting");
  const finished = debates.filter((d) => d.status === "finished");
  const sections = [
    { title: "🔥 进行中", list: ongoing, hint: "实时观战，为支持的阵营投票！" },
    { title: "📢 报名中", list: waiting, hint: "加入成为辩手，或等待开赛后观战" },
    { title: "🏁 已结束", list: finished, hint: "查看完整记录与赛后报告" },
  ];

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 公告滚动条 */}
        {announcements.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500/15 to-transparent border border-orange-500/30 rounded-xl px-4 py-2 mb-4 text-sm text-orange-200 overflow-hidden">
            {announcements.map((a) => (
              <span key={a.id} className="mr-6">
                📢 {a.title}：{a.content}
              </span>
            ))}
          </div>
        )}

        {/* 内容运营位：编辑精选 / 正在辩论 / 今日推荐兜底 */}
        <CuratedSpotlight />

        {/* 筛选栏 + 检索（KN-01） */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <h1 className="text-2xl font-bold text-orange-400 mr-auto">📋 辩题大厅</h1>
          <div className="relative w-full sm:w-72 order-last sm:order-none">
            <span
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
            >
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length >= 1) setPanelOpen(true);
              }}
              onFocus={() => query.trim() && setPanelOpen(true)}
              onBlur={() => setTimeout(() => setPanelOpen(false), 200)}
              placeholder="检索辩题 / 发言内容…"
              aria-label="全文检索"
              className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-orange-400"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                …
              </span>
            )}
            {panelOpen && results && (
              <div className="absolute right-0 top-full mt-1.5 w-full sm:w-96 z-30 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {results.debates.length === 0 && results.speeches.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      没有找到与「{query.trim()}」相关的内容
                    </div>
                  )}
                  {results.debates.length > 0 && (
                    <div className="px-3 pt-2 text-[11px] text-gray-500">
                      🏛️ 辩题（{results.debates.length}）
                    </div>
                  )}
                  {results.debates.slice(0, 5).map((d) => (
                    <Link
                      key={d.id}
                      to={`/debate/${d.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      className="block px-4 py-2.5 hover:bg-gray-700/60 transition"
                    >
                      <div className="text-sm text-gray-100 line-clamp-1">
                        {highlight(d.title, query.trim())}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {CATEGORY_LABELS[d.category] || d.category} · {d.creator_name || "匿名"} ·
                        🎤 {d.speech_count}
                      </div>
                    </Link>
                  ))}
                  {results.speeches.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[11px] text-gray-500 border-t border-gray-700">
                      🎤 发言（{results.speeches.length}）
                    </div>
                  )}
                  {results.speeches.slice(0, 6).map((s) => (
                    <Link
                      key={s.id}
                      to={`/debate/${s.debate_id}?focus=${s.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      className="block px-4 py-2.5 hover:bg-gray-700/60 transition"
                    >
                      <div className="text-xs text-gray-300 line-clamp-1">
                        {highlight(s.snippet, query.trim())}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex gap-2">
                        <span className={s.side === "A" ? "text-red-300" : "text-blue-300"}>
                          {SIDE_LABELS[s.side]}
                        </span>
                        <span className="truncate">{s.username}</span>
                        <span className="truncate text-gray-600">「{s.debate_title}」</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select
            aria-label="按状态筛选"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            aria-label="按分类筛选"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
          >
            <option value="all">全部分类</option>
            {(Object.keys(CATEGORY_LABELS) as DebateCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <Link
            to="/create"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition"
          >
            ➕ 创建辩题
          </Link>
          <VoiceControl commands={voiceCommands} placeholder="语音指令：去大厅 / 创建辩题 / 刷新列表" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <Loading text="辩题加载中..." />
        ) : debates.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <div className="text-5xl mb-4" aria-hidden>🎯</div>
            暂无符合条件的辩题
            <div className="text-sm mt-2">去创建一个新的辩题吧！</div>
          </div>
        ) : (
          <div className="space-y-8">
            {status !== "all" && status !== "pending" ? (
              <div className="grid gap-3">
                {debates.map((d) => (
                  <DebateCard key={d.id} debate={d} showPendingHint={d.status === "pending"} />
                ))}
              </div>
            ) : (
              sections.map(
                (sec) =>
                  sec.list.length > 0 && (
                    <section key={sec.title}>
                      <div className="flex items-baseline gap-3 mb-3">
                        <h2 className="font-bold text-gray-200">{sec.title}</h2>
                        <span className="text-xs text-gray-500">{sec.hint}</span>
                      </div>
                      <div className="grid gap-3">
                        {sec.list.map((d) => (
                          <DebateCard key={d.id} debate={d} />
                        ))}
                      </div>
                    </section>
                  ),
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DebateList;
