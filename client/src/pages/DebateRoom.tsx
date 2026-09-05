import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { errMsg } from "../api";
import useAuth from "../hooks/useAuth";
import useDebateRoom, { type Toast } from "../hooks/useDebateRoom";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import Navbar from "../components/common/Navbar";
import Loading from "../components/common/Loading";
import SpeakerPanel from "../components/debate/SpeakerPanel";
import ArgumentTree from "../components/debate/ArgumentTree";
import RelatedDebates from "../components/debate/RelatedDebates";
import VoiceControl from "../components/voice/VoiceControl";
import VoiceDisplay from "../components/voice/VoiceDisplay";
import type { Debate, DebateReport, Debater, Speech, SpeechHighlight } from "../types";
import {
  CATEGORY_LABELS,
  DEBATE_TYPE_LABELS,
  rankChipClass,
  rankIcon,
  SIDE_LABELS,
  STATUS_LABELS,
} from "../types";

const SPEECH_SECONDS = 180; // 每人每次 3 分钟（B-02）
const SIDE_COLOR: Record<"A" | "B", string> = {
  A: "border-red-500/60 bg-red-500/10 text-red-300",
  B: "border-blue-500/60 bg-blue-500/10 text-blue-300",
};

// ---------- 计时条 ----------
function TurnTimer({ baseTs, active }: { baseTs: number | null; active: boolean }) {
  const [left, setLeft] = useState(SPEECH_SECONDS);
  useEffect(() => {
    if (!baseTs) return;
    const tick = () => {
      const elapsed = (Date.now() - baseTs) / 1000;
      setLeft(Math.max(0, SPEECH_SECONDS - elapsed));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [baseTs]);

  if (!active) return null;
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60);
  const danger = left <= 30;
  return (
    <span
      className={`font-mono tabular-nums px-2 py-0.5 rounded ${
        danger
          ? "bg-red-500/20 text-red-300 animate-pulse"
          : "bg-gray-700/70 text-gray-200"
      }`}
      aria-label={danger ? "最后30秒警告" : "剩余发言时间"}
    >
      ⏱ {mm}:{String(ss).padStart(2, "0")}
      {danger && " ⚠️"}
    </span>
  );
}

// ---------- 发言卡片 ----------
function SpeechItem({
  speech,
  isAdmin,
  onEmotion,
  onReport,
}: {
  speech: Speech;
  isAdmin: boolean;
  onEmotion: (type: "fire" | "agree" | "clap") => void;
  onReport: () => void;
}) {
  const time = new Date(speech.created_at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article
      className={`rounded-xl border p-4 ${SIDE_COLOR[speech.side].split(" ")[0]} ${
        speech.side === "A" ? "border-l-4 border-l-red-500" : "border-l-4 border-l-blue-500"
      } bg-gray-800/80`}
      aria-label={`${SIDE_LABELS[speech.side]} ${speech.username} 第${speech.round}轮发言`}
    >
      <header className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xl" aria-hidden>{speech.avatar}</span>
        <span className="font-semibold text-sm">{speech.username}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SIDE_COLOR[speech.side]}`}>
          {SIDE_LABELS[speech.side]}
        </span>
        <span className="text-[10px] text-gray-500">第 {speech.round} 轮</span>
        <span className="text-[10px] text-gray-500 ml-auto">{time}</span>
        {speech.input_type === "voice" && <span title="语音输入">🎙️</span>}
        {speech.input_type === "sign" && <span title="手语输入">🤟</span>}
        {isAdmin && (
          <button
            type="button"
            onClick={onReport}
            className="text-[11px] text-gray-500 hover:text-red-400"
            title="举报该发言"
          >
            举报
          </button>
        )}
      </header>
      <p className="text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
        {speech.content}
      </p>
      {speech.summary && (
        <div className="mt-2.5 flex items-start gap-1.5 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          <span aria-hidden>🤖</span>
          <span>
            <span className="text-green-400 font-medium">AI 论点提炼：</span>
            {speech.summary}
          </span>
        </div>
      )}
      <footer className="mt-2 flex items-center gap-1 text-gray-500">
        <span className="text-[11px] mr-1">观众互动：</span>
        {(
          [
            ["fire", "🔥 精彩"],
            ["agree", "🤔 有道理"],
            ["clap", "💥 反驳漂亮"],
          ] as const
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => onEmotion(type)}
            className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-700/60 hover:bg-gray-600 transition"
            aria-label={`${label}（反馈给本条发言）`}
          >
            {label}
          </button>
        ))}
      </footer>
    </article>
  );
}

// ---------- 主页面 ----------
function DebateRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, logout, refreshUser } = useAuth();

  // REST 兜底加载（首次进入、Socket 尚未就绪时展示）
  const [debateMeta, setDebateMeta] = useState<Debate | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const hook = useDebateRoom(id, user?.id);
  const { room, my, connected, ended } = hook;
  const [searchParams] = useSearchParams();
  // 搜索直达的发言定位（?focus=<speechId>）
  const focusSpeechId = searchParams.get("focus")
    ? Number(searchParams.get("focus")) || null
    : null;
  const [focusedId, setFocusedId] = useState<number | null>(null);

  // 视图切换：时间线 / 辩论树
  const [view, setView] = useState<"timeline" | "tree">("timeline");
  // 赛后 AI 报告
  const [aiReport, setAiReport] = useState<DebateReport | null>(null);
  // 精彩时刻 / 金句
  const [highlights, setHighlights] = useState<SpeechHighlight[]>([]);
  // 冷静期倒计时（每秒刷新）
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 语音输入（AC-03）——用于辩手发言输入框
  const speechRec = useSpeechRecognition();
  const [speechText, setSpeechText] = useState("");
  const [chatText, setChatText] = useState("");
  const [chatMode, setChatMode] = useState<"chat" | "sign">("chat");
  const [lastInputType, setLastInputType] = useState<"text" | "voice">("text");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getDebate(id)
      .then((d) => setDebateMeta(d))
      .catch((err) => setLoadError(errMsg(err, "辩题不存在或加载失败")))
      .finally(() => setLoading(false));
  }, [id]);

  // 语音识别结果 → 填入发言框
  useEffect(() => {
    if (speechRec.finalText) {
      setSpeechText((prev) => (prev ? prev + speechRec.finalText : speechRec.finalText));
      setLastInputType("voice");
    }
  }, [speechRec.finalText]);

  // 新消息自动滚底（仅当已在底部时；否则显示跳到底部按钮）
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const msgCount = room?.messages.length || 0;
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el && atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else if (el) {
      setShowJump(true);
    }
  }, [msgCount]);

  const debate = useMemo(() => room?.debate || debateMeta, [room, debateMeta]);
  const speeches = room?.speeches || [];

  // 搜索直达发言：滚动定位并高亮（依赖 speeches，须在其声明之后定义）
  const speechReady = speeches.length;
  useEffect(() => {
    if (!focusSpeechId) return;
    const el = document.getElementById(`speech-${focusSpeechId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedId(focusSpeechId);
    const t = setTimeout(() => setFocusedId(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSpeechId, speechReady]);

  const debaters = room?.debaters || [];
  const support = room?.support;
  const votes = room?.votes;

  // 辩论结束后拉取 AI 赛后报告（A-03）与精彩时刻（I-03/I-04）
  useEffect(() => {
    if (!id || debate?.status !== "finished") return;
    api
      .getReport(id)
      .then((r) => setAiReport(r))
      .catch(() => {});
    api
      .getHighlights(id)
      .then((h) => setHighlights(h))
      .catch(() => {});
  }, [id, debate?.status, speeches.length]);

  // 每位辩手的最新 AI 观点（A-02）
  const latestSummaryByUser = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of speeches) {
      if (s.summary) map[s.user_id] = s.summary;
    }
    return map;
  }, [speeches]);

  // 辩论结束后刷新用户资料（积分/段位结算结果）
  const endedRef = useRef(false);
  useEffect(() => {
    if (ended && !endedRef.current) {
      endedRef.current = true;
      refreshUser();
    }
    if (!ended) endedRef.current = false;
  }, [ended, refreshUser]);

  // 冷静期：本场设置 + 我加入的时间 → 剩余毫秒
  const cooldownMinutes = debate?.cool_down_minutes || 0;
  const myJoinedAt = useMemo(() => {
    if (!user) return null;
    return debaters.find((d) => d.user_id === user.id)?.joined_at ?? null;
  }, [debaters, user]);
  const cooldownRemainMs =
    myJoinedAt && cooldownMinutes > 0
      ? Math.max(0, myJoinedAt * 1000 + cooldownMinutes * 60 * 1000 - nowTs)
      : 0;

  // 最后发言时间（计时基准）
  const lastSpeechTs = speeches.length
    ? speeches[speeches.length - 1].created_at
    : debate?.start_time || Date.now();
  const isMyTurn =
    !!my?.isDebater && !!room?.turn.speaker && room.turn.speaker.user_id === user?.id;
  const mutedRemain = my?.mutedUntil ? my.mutedUntil - Date.now() : null;

  // 支持率跳动动画
  const prevRate = useRef<number | null>(null);
  const [supportFlash, setSupportFlash] = useState(false);
  useEffect(() => {
    if (!support) return;
    if (prevRate.current !== null && Math.abs(support.rateA - prevRate.current) >= 5) {
      setSupportFlash(true);
      const t = setTimeout(() => setSupportFlash(false), 1500);
      return () => clearTimeout(t);
    }
    prevRate.current = support.rateA;
  }, [support]);

  if (loadError && !debate) {
    return (
      <div className="min-h-screen app-bg text-white flex flex-col items-center justify-center gap-4">
        <div className="text-5xl" aria-hidden>🤷</div>
        <div className="text-red-300">{loadError}</div>
        <Link to="/debates" className="text-orange-400 underline">
          ← 返回辩题大厅
        </Link>
      </div>
    );
  }

  if (loading && !debate) {
    return (
      <div className="min-h-screen app-bg">
        <Loading text="辩论室加载中..." />
      </div>
    );
  }

  const status = debate!.status;
  const canJoin = status === "waiting" && my && !my.isDebater;
  const showVotePanel = status === "ongoing" || status === "finished";
  const canSpeak = status === "ongoing" && !!my?.isDebater && !mutedRemain;
  const A = debaters.filter((d) => d.side === "A");
  const B = debaters.filter((d) => d.side === "B");
  const currentSpeakerId = room?.turn.speaker?.user_id;

  const reportSpeech = (speech: Speech) => {
    const reason = window.prompt("请填写举报原因（至少2个字）：", "违规内容");
    if (reason && reason.trim().length >= 2) {
      hook.sendReport({
        speechId: speech.id,
        targetUserId: speech.user_id,
        targetType: "speech",
        reason: reason.trim(),
      });
    } else if (reason) {
      hook.showError("举报原因至少2个字");
    }
  };

  const voiceCommands: Record<string, () => void> = {    "去大厅": () => navigate("/debates"),
    "刷新": () => hook.refresh(),
    ...(isAdmin && status === "ongoing"
      ? {
          "结束辩论": () => {
            if (window.confirm("确认强制结束本场辩论？")) {
              api
                .adminForceEnd(id!)
                .then(() => {
                  hook.refresh();
                  refreshUser();
                })
                .catch((e) => hook.showError(errMsg(e)));
            }
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar
        user={user}
        isAdmin={isAdmin}
        onLogout={logout}
        onToast={(t) => hook.pushToast("info", t)}
      />

      {/* Toast 通知 */}
      <div className="fixed top-16 right-4 z-50 space-y-2 w-80">
        {hook.toasts.map((t: Toast) => (
          <div
            key={t.id}
            role="alert"
            className={`px-4 py-2.5 rounded-xl text-sm shadow-2xl border backdrop-blur ${
              t.kind === "error"
                ? "bg-red-900/90 border-red-600 text-red-100"
                : t.kind === "success"
                  ? "bg-green-900/90 border-green-600 text-green-100"
                  : "bg-gray-800/95 border-gray-600 text-gray-100"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        {/* 标题区 */}
        <header className="mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/debates" className="text-gray-400 hover:text-white text-sm">
              ← 大厅
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">{debate!.title}</h1>
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                status === "ongoing"
                  ? "border-red-500/50 bg-red-500/10 text-red-300"
                  : status === "waiting"
                    ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                    : status === "finished"
                      ? "border-gray-600 bg-gray-700/40 text-gray-300"
                      : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {STATUS_LABELS[debate!.status]}
            </span>
            {!connected && (
              <span className="text-xs text-yellow-400 animate-pulse">● 连接中...</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span>📂 {CATEGORY_LABELS[debate!.category]}</span>
            <span>👤 创建者：{debate!.creator_name || "匿名"}</span>
            <span
              className={`px-1.5 py-0.5 rounded border ${
                debate!.debate_type === "quick1v1"
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                  : "border-gray-600 bg-gray-700/40 text-gray-300"
              }`}
              title="辩论形式"
            >
              {DEBATE_TYPE_LABELS[debate!.debate_type || "classic"]}
            </span>
            {(debate!.cool_down_minutes || 0) > 0 && (
              <span
                className="px-1.5 py-0.5 rounded border border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                title="社区公约：新加入辩手需等待冷静期后才能发言"
              >
                🧊 冷静期 {debate!.cool_down_minutes} 分钟
              </span>
            )}
            {debate!.description && (
              <span className="text-gray-400">{debate!.description}</span>
            )}
            {isAdmin && status === "ongoing" && (
              <button
                onClick={() => {
                  if (window.confirm("确认强制结束本场辩论？（AD-12）")) {
                    api
                      .adminForceEnd(id!)
                      .then(() => {
                        hook.refresh();
                        refreshUser();
                      })
                      .catch((e) => hook.showError(errMsg(e)));
                  }
                }}
                className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition"
              >
                ⛔ 强制结束
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ============ 左 2/3：辩论区 ============ */}
          <main className="lg:col-span-2 space-y-4 min-w-0">
            {/* 轮次横幅 */}
            {status === "ongoing" && room?.turn && (
              <div className="rounded-xl border border-gray-700 bg-gradient-to-r from-orange-500/[0.08] via-gray-800/70 to-blue-500/[0.08] px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold">
                  第 {room.turn.round} 轮
                </span>
                <span className="text-sm">
                  🎤 当前发言：
                  {room.turn.speaker ? (
                    <b
                      className={
                        room.turn.speaker.side === "A" ? "text-red-300" : "text-blue-300"
                      }
                    >
                      {SIDE_LABELS[room.turn.speaker.side]} {room.turn.speaker.username}
                    </b>
                  ) : (
                    <span className="text-gray-400">（未开始）</span>
                  )}
                </span>
                <TurnTimer
                  baseTs={lastSpeechTs}
                  active={status === "ongoing" && !!room.turn.speaker}
                />
                {isMyTurn && (
                  <span className="text-orange-300 text-sm animate-pulse font-medium">
                    👉 轮到你了！
                  </span>
                )}
              </div>
            )}

            {/* 报名区 */}
            {canJoin && (
              <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-5">
                <h2 className="font-bold text-blue-300 mb-1">📢 报名加入辩论</h2>
                <p className="text-xs text-gray-400 mb-4">
                  {debate!.debate_type === "quick1v1"
                    ? "1v1 快速模式：每方 1 人，满 2 人立即开赛，适合碎片时间快速开杠。"
                    : "标准模式：每方最多 4 人，满 8 人自动开始（D-07）。"}
                  {(debate!.cool_down_minutes || 0) > 0 && (
                    <span className="text-cyan-300 block mt-1">
                      🧊 本场设有 {debate!.cool_down_minutes} 分钟冷静期（社区公约）：
                      加入后需冷静思考，期间不能发言。
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3">
                  {(["A", "B"] as const).map((side) => {
                    const maxSide =
                      debate!.debate_type === "quick1v1" ? 1 : 4;
                    const count = debaters.filter((d) => d.side === side).length;
                    const full = count >= maxSide;
                    const sideName =
                      side === "A" ? debate!.side_a_name : debate!.side_b_name;
                    return (
                      <button
                        key={side}
                        disabled={full}
                        onClick={() =>
                          api
                            .joinDebate(id!, side)
                            .then(() => {
                              hook.pushToast(
                                "success",
                                `已加入${SIDE_LABELS[side]}！${sideName}`,
                              );
                              hook.refresh();
                            })
                            .catch((e) => hook.showError(errMsg(e)))
                        }
                        className={`flex-1 min-w-40 px-4 py-3 rounded-xl border font-medium transition disabled:opacity-40 ${
                          side === "A"
                            ? "border-red-500/50 hover:bg-red-500/10 text-red-300"
                            : "border-blue-500/50 hover:bg-blue-500/10 text-blue-300"
                        }`}
                      >
                        <div className="text-base">
                          {SIDE_LABELS[side]}：{sideName}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {count}/{maxSide} 人 {full ? "（已满）" : "点击加入"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 观众支持横幅（进行中/已结束） */}
            {support && (status === "ongoing" || status === "finished") && (
              <div
                className={`rounded-xl border p-5 ${
                  supportFlash
                    ? "border-orange-400 animate-pulse"
                    : "border-gray-700 bg-gray-800/80"
                }`}
                aria-label={`支持率：正方 ${support.rateA}%，反方 ${support.rateB}%`}
              >
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-red-300">
                    🔴 {debate!.side_a_name} {support.rateA}%
                  </span>
                  <span className="text-gray-500 text-xs self-center">
                    {support.total} 人表态
                  </span>
                  <span className="text-blue-300">
                    {support.rateB}% {debate!.side_b_name} 🔵
                  </span>
                </div>
                <div
                  className="h-5 rounded-full overflow-hidden flex bg-gray-700"
                  role="progressbar"
                  aria-valuenow={support.rateA}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-red-500 transition-all duration-700 ease-out"
                    style={{ width: `${support.rateA}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${support.rateB}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400 self-center mr-auto">
                    你是观众？支持你认为更有说服力的一方（可改选）：
                  </span>
                  {(["A", "B"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => hook.sendSupport(side)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        my?.mySupport === side
                          ? side === "A"
                            ? "bg-red-500 text-white"
                            : "bg-blue-500 text-white"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      {side === "A" ? `支持 ${debate!.side_a_name}` : `支持 ${debate!.side_b_name}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 视图切换：时间线 / 辩论树 */}
            <div
              className="flex items-center gap-1.5"
              role="tablist"
              aria-label="记录视图"
            >
              {(
                [
                  ["timeline", "📜 发言时间线"],
                  ["tree", "🌳 辩论树（A-04）"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    view === key
                      ? "bg-orange-500 text-white font-medium"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "tree" ? (
              id && <ArgumentTree debateId={id} speechCount={speeches.length} />
            ) : (
              <section aria-label="发言记录">
              {speeches.length === 0 ? (
                <div className="text-center text-gray-500 py-14 bg-gray-800/40 rounded-xl border border-dashed border-gray-700">
                  <div className="text-4xl mb-2" aria-hidden>🎤</div>
                  {status === "ongoing"
                    ? "辩论刚开始，等待第一位辩手发言…"
                    : "暂无发言记录"}
                </div>
              ) : (
              <div className="space-y-3">
                {speeches.map((s) => (
                  <div
                    key={s.id}
                    id={`speech-${s.id}`}
                    className={`rounded-2xl transition-all ${
                      focusedId === s.id ? "ring-4 ring-orange-400/70 shadow-xl shadow-orange-500/10" : ""
                    }`}
                  >
                    <SpeechItem
                      speech={s}
                      isAdmin={!!user}
                      onEmotion={(type) => hook.sendEmotion(type, s.id)}
                      onReport={() => reportSpeech(s)}
                    />
                  </div>
                ))}
              </div>
              )}
              </section>
            )}

            {/* 辩手发言输入 */}
            {status === "ongoing" && (
              <section
                aria-label="发言输入"
                className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 sticky bottom-3 backdrop-blur"
              >
                {!my?.isDebater ? (
                  <div className="text-center text-sm text-gray-500 py-2">
                    你是观众，可在右侧实时互动 🎉
                  </div>
                ) : cooldownRemainMs > 0 ? (
                  <div className="text-center text-sm text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg py-2.5">
                    🧊 社区公约·冷静期：你加入本场辩论仅刚刚，还需{" "}
                    {Math.ceil(cooldownRemainMs / 1000)} 秒才能发言。
                    请先冷静思考、整理论点（本场冷静期 {cooldownMinutes} 分钟）
                  </div>
                ) : mutedRemain ? (
                  <div className="text-center text-sm text-red-300 py-2">
                    🔇 你已被管理员禁言，剩余 {Math.max(1, Math.ceil(mutedRemain / 1000))} 秒
                  </div>
                ) : (
                  <>
                    <VoiceDisplay
                      listening={speechRec.listening}
                      interim={speechRec.interim}
                      finalText=""
                      label="语音输入转文字（AC-03）"
                    />
                    <div className="flex items-end gap-2">
                      <textarea
                        value={speechText}
                        onChange={(e) => {
                          setSpeechText(e.target.value);
                          setLastInputType("text");
                        }}
                        placeholder={
                          isMyTurn
                            ? `请输入你的发言（限时3分钟）...`
                            : `当前轮到别人发言。轮到你时再发言（B-01 顺序制）...`
                        }
                        className="flex-1 min-h-20 bg-gray-700 rounded-xl border border-gray-600 p-3 text-sm focus:outline-none focus:border-orange-400 resize-y"
                        maxLength={2000}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            speechRec.listening ? speechRec.stop() : speechRec.start()
                          }
                          className={`px-3 py-2 rounded-xl text-sm transition ${
                            speechRec.listening
                              ? "bg-green-600 text-white animate-pulse"
                              : "bg-gray-700 hover:bg-gray-600"
                          }`}
                          title="用语音输入发言内容"
                        >
                          🎙️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!speechText.trim()) return hook.showError("发言内容不能为空");
                            hook.sendSpeech(speechText.trim(), lastInputType);
                            setSpeechText("");
                            speechRec.reset();
                          }}
                          disabled={!speechText.trim()}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-40 ${
                            isMyTurn
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                        >
                          提交发言
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2">
                      💡 发言会经过敏感词过滤，并由 AI 提炼核心论点展示（A-01）
                      {!isMyTurn && " · 不按顺序发言会被礼貌忽略"}
                    </div>
                  </>
                )}
              </section>
            )}
          </main>

          {/* ============ 右 1/3：辩手 / 投票 / 聊天 ============ */}
          <aside className="space-y-4 min-w-0">
            {/* 辩手阵容 + 最佳辩手投票 */}
            <section
              className="rounded-xl border border-gray-700 bg-gray-800/60 p-4"
              aria-label="辩手阵容"
            >
              <h2 className="text-sm font-bold mb-3 text-gray-300">
                ⚔️ 辩手阵容 {status === "ongoing" && "(点击 ⭐ 投最佳辩手 V-01)"}
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {(["A", "B"] as const).map((side) => (
                  <div key={side}>
                    <div
                      className={`text-xs font-medium mb-1.5 px-2 py-1 rounded-md inline-block ${
                        side === "A"
                          ? "text-red-300 bg-red-500/10"
                          : "text-blue-300 bg-blue-500/10"
                      }`}
                    >
                      {side === "A" ? `🔴 ${debate!.side_a_name}` : `🔵 ${debate!.side_b_name}`}
                    </div>
                    <div className="space-y-1.5">
                      {debaters.filter((d) => d.side === side).length === 0 && (
                        <div className="text-xs text-gray-600 py-2 text-center border border-dashed border-gray-700 rounded-lg">
                          虚位以待（{4}人）
                        </div>
                      )}
                      {debaters
                        .filter((d) => d.side === side)
                        .map((d: Debater) => (
                          <SpeakerPanel
                            key={d.id}
                            debater={d}
                            latestSummary={latestSummaryByUser[d.user_id]}
                            isCurrentSpeaker={d.user_id === currentSpeakerId}
                            isVoted={my?.myBestVote === d.user_id}
                            showVote={showVotePanel}
                            onVoteBest={(uid) => hook.sendVoteBest(uid)}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 最佳辩手实时票数 */}
              {votes && votes.best.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-1.5">
                    ⭐ 最佳辩手实时票数（共 {votes.total_best_votes} 票）
                  </div>
                  <div className="space-y-1">
                    {votes.best.map((b) => (
                      <div key={b.target_user_id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-300 w-24 truncate">{b.username}</span>
                        <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all duration-500"
                            style={{
                              width: `${
                                votes.total_best_votes
                                  ? (b.count / votes.total_best_votes) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-orange-300 w-6 text-right">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 胜负投票 */}
            {showVotePanel && (
              <section
                className="rounded-xl border border-gray-700 bg-gray-800/60 p-4"
                aria-label="阵营胜负投票"
              >
                <h2 className="text-sm font-bold mb-3 text-gray-300">
                  🗳️ 阵营胜负投票（V-02）
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B"] as const).map((side) => {
                    const cnt =
                      votes?.side.find((v) => v.side === side)?.count || 0;
                    const total = votes?.total_side_votes || 0;
                    const pct = total ? Math.round((cnt / total) * 100) : 0;
                    const chosen = my?.mySideVote === side;
                    return (
                      <button
                        key={side}
                        onClick={() => hook.sendVoteSide(side)}
                        className={`rounded-xl border p-3 text-center transition ${
                          chosen
                            ? side === "A"
                              ? "border-red-400 bg-red-500/20"
                              : "border-blue-400 bg-blue-500/20"
                            : side === "A"
                              ? "border-red-500/40 hover:bg-red-500/10"
                              : "border-blue-500/40 hover:bg-blue-500/10"
                        }`}
                      >
                        <div className="text-xs opacity-80">
                          {side === "A" ? debate!.side_a_name : debate!.side_b_name}
                        </div>
                        <div className="text-xl font-bold mt-1">{pct}%</div>
                        <div className="text-[11px] opacity-70">{cnt} 票</div>
                        <div className="mt-1 text-[11px]">
                          {chosen ? "✅ 已投" : "投它胜出"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 观众情绪 */}
            <section className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
              <h2 className="text-sm font-bold mb-3 text-gray-300">💬 观众情绪（I-02）</h2>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["fire", "🔥", "精彩", hook.emotions.fire],
                    ["agree", "🤔", "有道理", hook.emotions.agree],
                    ["clap", "💥", "反驳漂亮", hook.emotions.clap],
                  ] as const
                ).map(([type, emoji, label, count]) => (
                  <button
                    key={type}
                    onClick={() => hook.sendEmotion(type)}
                    className="rounded-xl bg-gray-700/60 hover:bg-gray-600 py-2.5 text-center transition"
                    aria-label={`发送${label}`}
                  >
                    <div className="text-lg" aria-hidden>{emoji}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                    <div className="text-sm font-bold text-orange-300">{count}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* 聊天室 */}
            <section
              className="rounded-xl border border-gray-700 bg-gray-800/60 flex flex-col relative"
              style={{ height: 430 }}
              aria-label="实时聊天"
            >
              <h2 className="text-sm font-bold px-4 pt-3 pb-2 text-gray-300">
                🗨️ 实时聊天（I-01）
              </h2>
              <div
                ref={chatScrollRef}
                onScroll={() => {
                  const el = chatScrollRef.current;
                  if (!el) return;
                  const near =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 90;
                  atBottomRef.current = near;
                  if (near) setShowJump(false);
                }}
                className="flex-1 overflow-y-auto px-4 space-y-2 min-h-40"
                aria-live="polite"
              >
                {(room?.messages || []).map((m) => (
                  <div key={m.id} className="text-sm leading-relaxed">
                    {m.type === "system" ? (
                      <span className="text-gray-500 italic text-xs block">{m.content}</span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500">
                          {m.type === "gesture" ? "🤟 " : ""}
                          {m.username}：
                        </span>
                        <span className="text-gray-200 break-words">{m.content}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {showJump && (
                <button
                  type="button"
                  onClick={() => {
                    const el = chatScrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                    atBottomRef.current = true;
                    setShowJump(false);
                  }}
                  className="absolute right-4 top-12 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs shadow-lg animate-bounce"
                >
                  ↓ 新消息
                </button>
              )}
              <div className="p-3 border-t border-gray-700">
                <div className="flex gap-1.5 mb-2">
                  <button
                    onClick={() => setChatMode("chat")}
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      chatMode === "chat" ? "bg-orange-500" : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    文字
                  </button>
                  <button
                    onClick={() => setChatMode("sign")}
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      chatMode === "sign" ? "bg-purple-500" : "bg-gray-700 text-gray-400"
                    }`}
                    title="听障用户可发送手语/文字消息"
                  >
                    🤟 手语模式
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        submitChat();
                      }
                    }}
                    placeholder={chatMode === "chat" ? "发一条消息..." : "以手语消息发送（AC-04 输入）..."}
                    className="flex-1 bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    aria-label="聊天输入框"
                  />
                  <button
                    onClick={submitChat}
                    className="px-4 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition"
                  >
                    发送
                  </button>
                </div>
              </div>
            </section>

            {/* 相关辩题推荐（KN-03） */}
            {id && <RelatedDebates debateId={id} />}

            {/* 语音控制 */}
            <div className="flex justify-end">
              <VoiceControl
                commands={voiceCommands}
                placeholder="语音指令：去大厅 / 刷新"
              />
            </div>
          </aside>
        </div>

        {/* 已结束：总结与重辩 */}
        {status === "finished" && (
          <section className="mt-8 rounded-xl border border-gray-700 bg-gray-800/60 p-5">
            <h2 className="font-bold text-gray-200 mb-3">📊 赛后专区</h2>

            {/* 精彩时刻：情绪热力 + 金句卡（I-03/I-04 轻量版） */}
            {status === "finished" && (
              <div className="mb-4 rounded-xl border border-orange-500/25 bg-orange-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-orange-300">🎬 精彩时刻</span>
                  <span className="text-[10px] text-gray-500">
                    观众情绪热力（🔥🤔💥）· 发言影响力（支持率 Δ）
                  </span>
                </div>
                {highlights.length === 0 ? (
                  <div className="text-xs text-gray-500">
                    暂无观众情绪数据——观战时记得给精彩发言点 🔥 哦
                  </div>
                ) : (
                  <>
                    {/* 热力时间线 */}
                    <div
                      className="flex items-end gap-1 h-14 mb-4"
                      aria-label="发言情绪热度时间线"
                    >
                      {(() => {
                        const max = Math.max(
                          1,
                          ...highlights.map((h) => h.emotions.total),
                        );
                        return highlights.map((h) => (
                          <div key={h.id} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${h.username}：情绪 ${h.emotions.total}`}>
                            <div
                              className={`w-full rounded-t ${h.emotions.total > 0 ? "bg-orange-500/80" : "bg-gray-700"}`}
                              style={{ height: `${Math.max(4, (h.emotions.total / max) * 100)}%` }}
                            />
                          </div>
                        ));
                      })()}
                    </div>
                    {/* 金句卡 Top */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {highlights
                        .filter((h) => h.emotions.total > 0)
                        .sort((a, b) => b.emotions.total - a.emotions.total)
                        .slice(0, 3)
                        .map((h, i) => (
                          <div key={h.id} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3 flex flex-col">
                            <div className="text-amber-300 text-xs mb-1.5">
                              🥇 {i === 0 ? "观众最爱" : i === 1 ? "人气第二" : "人气第三"}
                            </div>
                            <p className="text-sm text-gray-100 leading-snug line-clamp-4 flex-1">
                              “{h.content}”
                            </p>
                            <div className="flex items-center gap-2 mt-2.5 text-[11px] text-gray-500 flex-wrap">
                              <span aria-hidden>{h.avatar}</span>
                              <span className="text-gray-300">{h.username}</span>
                              <span className="text-red-300">🔥{h.emotions.fire}</span>
                              <span className="text-gray-300">🤔{h.emotions.agree}</span>
                              <span className="text-yellow-300">💥{h.emotions.clap}</span>
                              {h.impactRateA !== null && h.impactRateA !== 0 && (
                                <span className={h.impactRateA > 0 ? "text-red-400" : "text-blue-400"}>
                                  支持率 {h.impactRateA > 0 ? "▲" : "▼"}
                                  {Math.abs(h.impactRateA)}%
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(`「${h.content}」 —— ${h.username} · ${debate!.title}`)
                                  .then(() => hook.pushToast("success", "📋 金句已复制，去分享吧！"))
                                  .catch(() => hook.showError("复制失败"));
                              }}
                              className="mt-2 text-[11px] px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition"
                            >
                              📋 复制金句分享
                            </button>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI 赛后报告（A-03）：明确标注 AI 生成 + 免责声明 */}
            <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-purple-300">
                  🤖 AI 赛后报告
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/40">
                  AI 生成内容
                </span>
                {(debate as any).settled === 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40">
                    🏆 积分已结算
                  </span>
                )}
              </div>
              {aiReport ? (
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {aiReport.report}
                </p>
              ) : (
                <div className="text-xs text-gray-500 py-2">
                  {speeches.length === 0
                    ? "本场没有有效发言，暂无报告。"
                    : "报告生成中…（首次访问自动生成并保存）"}
                </div>
              )}
              <div className="text-[11px] text-gray-500 mt-2 border-t border-purple-500/20 pt-2">
                ⚠️ 免责声明：以上内容由 AI 自动生成，用于辅助复盘与检索，
                可能存在偏差，请以原始发言记录为准。
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">
                  支持率走势（快照 S-06，共 {support?.total || 0} 人表态）
                </div>
                {room && room.supportHistory.length === 0 ? (
                  <div className="text-xs text-gray-600">暂无走势数据</div>
                ) : (
                  <div className="flex items-end gap-1 h-24 bg-gray-900 rounded-lg p-2 overflow-x-auto">
                    {room?.supportHistory.map((p, i) => (
                      <div key={i} className="flex flex-col items-center justify-end h-full min-w-6">
                        <div
                          className="w-4 bg-red-500/80 rounded-t"
                          style={{ height: `${Math.max(2, p.rateA)}%` }}
                          title={`正方 ${p.rateA}%`}
                        />
                        <div className="w-4 bg-blue-500/80 rounded-t -mt-0.5" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1 flex justify-between">
                  <span className="text-red-400">正 ← 时间 → 反</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-2">快捷操作</div>
                <div className="flex flex-wrap gap-2">
                  {(debate!.parent_id || (debate!.repeat_count || 0) > 0) && (
                    <Link
                      to={`/chain/${debate!.parent_id || debate!.id}`}
                      className="px-3 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-sm transition"
                    >
                      🧬 历次交锋对比
                    </Link>
                  )}
                  <button
                    onClick={() =>
                      api
                        .restartDebate(id!)
                        .then(() => {
                          hook.pushToast(
                            "success",
                            "重辩申请已提交，待管理员审核（D-09）",
                          );
                        })
                        .catch((e) => hook.showError(errMsg(e)))
                    }
                    className="px-3 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-sm transition"
                  >
                    🔁 申请重辩
                  </button>
                  <Link
                    to="/debates"
                    className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition"
                  >
                    返回大厅
                  </Link>
                </div>
                {debate!.repeat_count > 0 && (
                  <div className="text-xs text-gray-500 mt-2">
                    本辩题已重辩 {debate!.repeat_count} 次
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* pending/rejected 提示 */}
        {(status === "pending" || status === "rejected") && (
          <div className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            {status === "pending"
              ? "⏳ 该辩题正在等待管理员审核，通过后进入报名阶段。"
              : `❌ 该辩题未通过审核${debate!.admin_note ? `：${debate!.admin_note}` : ""}`}
          </div>
        )}
      </div>
    </div>
  );

  function submitChat() {
    const text = chatText.trim();
    if (!text) return;
    if (chatMode === "sign") {
      hook.sendChat(`[手语] ${text}`); // 简单模式：以手语标记发送
    } else {
      hook.sendChat(text);
    }
    setChatText("");
  }
}

export default DebateRoom;
