// client/src/pages/DebateChain.tsx
// 辩题重辩链聚合页：同一辩题的历次交锋，胜负/票数/支持率并排对比（知识沉淀核心）

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Loading from "../components/common/Loading";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import {
  DEBATE_TYPE_LABELS,
  STATUS_LABELS,
  SIDE_LABELS,
  type ChainItem,
  type DebateChain as ChainData,
} from "../types";

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function ResultBadge({ item }: { item: ChainItem }) {
  if (!item.result) return null;
  const w = item.result.winnerSide;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span
        className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
          w === "A"
            ? "border-red-500/50 bg-red-500/10 text-red-300"
            : w === "B"
              ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
              : "border-gray-600 bg-gray-700/40 text-gray-400"
        }`}
      >
        {w ? `${SIDE_LABELS[w]}获胜` : "🤝 平局 / 未决胜负"}
      </span>
      <span className="text-xs text-gray-400">
        胜负票 {item.result.sideA} : {item.result.sideB}
      </span>
      {item.result.supportTotal > 0 && (
        <span className="text-xs text-gray-400">
          观众支持率 {item.result.supportRateA}% : {100 - item.result.supportRateA}%
          （{item.result.supportTotal} 人）
        </span>
      )}
      {item.settled === 1 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30">
          🏆 已结算
        </span>
      )}
    </div>
  );
}

function DebateChain() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, logout } = useAuth();
  const [chain, setChain] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getChain(id)
      .then(setChain)
      .catch((e) => setError(errMsg(e, "加载失败")))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/debates" className="text-gray-400 hover:text-white text-sm">
            ← 大厅
          </Link>
        </div>

        {loading ? (
          <Loading text="正在聚合历次交锋…" />
        ) : error || !chain ? (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-10 text-center">
            <div className="text-5xl mb-3" aria-hidden>🧬</div>
            <div className="text-red-300 mb-4">{error || "辩题不存在"}</div>
            <Link to="/debates" className="text-orange-400 underline text-sm">
              返回辩题大厅
            </Link>
          </div>
        ) : (
          <>
            {/* 头部 */}
            <div className="mt-3 mb-6">
              <div className="text-xs text-purple-300 mb-1.5">🧬 公共讨论知识库 · 重辩链聚合</div>
              <h1 className="text-2xl font-bold leading-snug">{chain.items[0]?.title}</h1>
              <p className="text-sm text-gray-500 mt-2">
                该辩题共被辩论 <b className="text-orange-300">{chain.items.length}</b> 场（含重辩）。
                以下是历次交锋的胜负与观众态度变化——点击任一场可查看完整档案。
              </p>
            </div>

            {/* 历史胜负一览 */}
            {chain.items.filter((i) => i.result).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5">
                <span className="text-gray-400">历史战绩：</span>
                <span className="text-red-300">
                  正方 {chain.items.filter((i) => i.result?.winnerSide === "A").length} 胜
                </span>
                <span className="text-blue-300">
                  反方 {chain.items.filter((i) => i.result?.winnerSide === "B").length} 胜
                </span>
                <span className="text-gray-400">
                  平局 {chain.items.filter((i) => i.result && !i.result.winnerSide).length} 场
                </span>
                <span className="text-gray-600 ml-auto">观点会进化，交锋会沉淀</span>
              </div>
            )}

            {/* 时间线 */}
            <div className="relative pl-6 space-y-5">
              <span aria-hidden className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-700" />
              {chain.items.map((item, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === chain.items.length - 1;
                return (
                  <div key={item.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-6 top-2 w-4 h-4 rounded-full border-2 ${
                        isLast
                          ? "bg-purple-500 border-purple-300"
                          : "bg-gray-800 border-gray-500"
                      }`}
                    />
                    <Link
                      to={`/debate/${item.id}`}
                      className="block bg-gray-800 rounded-2xl border border-gray-700 hover:border-purple-400/60 hover:shadow-lg transition p-4"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            isFirst
                              ? "bg-gray-700 text-gray-300"
                              : "bg-purple-500/15 text-purple-300 border border-purple-500/40"
                          }`}
                        >
                          {isFirst ? "🏁 首场交锋" : `🔁 重辩 #${idx}`}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {fmtDate(item.start_time)}
                          {item.end_time ? ` · ${fmtDate(item.end_time)} 结束` : " · 进行中/待开赛"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/70 text-gray-400">
                          {STATUS_LABELS[item.status]}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-400">
                          {DEBATE_TYPE_LABELS[item.debate_type || "classic"]}
                        </span>
                        {item.cool_down_minutes > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                            🧊 {item.cool_down_minutes} 分冷静期
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        <span>👤 {item.creator_name || "匿名"}</span>
                        <span>⚔️ {item.debater_count}/{(item.debate_type === "quick1v1" ? 2 : 8)} 辩手</span>
                        <span>🎤 {item.speech_count} 次发言</span>
                        <span>💬 {item.emotion_count} 次观众情绪</span>
                      </div>
                      <ResultBadge item={item} />
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DebateChain;
