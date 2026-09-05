// client/src/components/debate/CuratedSpotlight.tsx
// 内容运营位（大厅顶部）：
// 1) 🏅 编辑精选（管理员 curated 横向大卡，横滚）
// 2) 🔴 正在辩论（live 卡，按热度）
// 3) 无精选时回退显示 🌟 今日推荐（D-08）

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import type { Debate } from "../../types";
import { CATEGORY_LABELS, DEBATE_TYPE_LABELS, STATUS_LABELS } from "../../types";

function metaChips(d: Debate) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
      <span>📂 {CATEGORY_LABELS[d.category] || d.category}</span>
      <span>👤 {d.creator_name || "匿名"}</span>
      <span>⚔️ {d.debater_count ?? 0}/{(d.debate_type === "quick1v1" ? 2 : 8)}</span>
      <span>🎤 {d.speech_count ?? 0}</span>
      {(d.hot || 0) > 0 && (
        <span className="text-orange-300/90 font-medium">🔥 {d.hot}</span>
      )}
      {d.debate_type === "quick1v1" && (
        <span className="text-purple-300/90">{DEBATE_TYPE_LABELS.quick1v1}</span>
      )}
    </div>
  );
}

function FeaturedCard({ d, big }: { d: Debate; big?: boolean }) {
  return (
    <Link
      to={`/debate/${d.id}`}
      className={`group relative shrink-0 snap-start overflow-hidden rounded-2xl border bg-gray-800/70 transition hover:border-orange-400/60 hover:shadow-xl hover:shadow-orange-500/5 ${
        big ? "w-[86%] sm:w-[420px]" : "w-[72%] sm:w-72"
      }`}
    >
      {/* 顶部状态条 */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
            d.status === "ongoing"
              ? "border-red-500/50 bg-red-500/10 text-red-300"
              : d.status === "waiting"
                ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                : "border-gray-600 bg-gray-700/40 text-gray-300"
          }`}
        >
          {STATUS_LABELS[d.status]}
        </span>
        {d.cool_down_minutes > 0 && (
          <span className="text-[10px] text-cyan-300/80">🧊 {d.cool_down_minutes} 分冷静期</span>
        )}
      </div>
      <div className="p-4 pt-2">
        <h3
          className={`font-bold text-gray-100 leading-snug group-hover:text-orange-200 transition line-clamp-2 ${
            big ? "text-lg" : "text-sm"
          }`}
        >
          {d.title}
        </h3>
        {big && d.description && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{d.description}</p>
        )}
        <div className="mt-2.5">{metaChips(d)}</div>
      </div>
    </Link>
  );
}

function CuratedSpotlight() {
  const [featured, setFeatured] = useState<Debate[]>([]);
  const [live, setLive] = useState<Debate[]>([]);
  const [daily, setDaily] = useState<Debate | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .curatedBoard()
      .then((b) => {
        if (!alive) return;
        setFeatured(b.featured);
        setLive(b.live);
      })
      .catch(() => {})
      .then(() => alive && setReady(true));
    // 无精选时的每日推荐兜底（D-08）
    api
      .getRecommended()
      .then((d) => alive && setDaily(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  return (
    <div className="mb-4 space-y-4">
      {/* 🏅 编辑精选 */}
      {featured.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="font-bold text-amber-300">🏅 编辑精选</span>
            <span className="text-xs text-gray-500">管理员推荐的优质交锋</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x thin-scroll">
            {featured.map((d) => (
              <FeaturedCard key={d.id} d={d} big />
            ))}
          </div>
        </div>
      )}

      {/* 🔴 正在辩论 */}
      {live.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="font-bold text-red-300">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1.5" />
              正在辩论
            </span>
            <span className="text-xs text-gray-500">实时围观 · 支持率与投票同步刷新</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x thin-scroll">
            {live.map((d) => (
              <FeaturedCard key={d.id} d={d} />
            ))}
          </div>
        </div>
      )}

      {/* 🌟 今日推荐（无编辑精选时的回退） */}
      {featured.length === 0 && daily && (
        <Link
          to={`/debate/${daily.id}`}
          className="block bg-gradient-to-r from-purple-900/50 via-gray-800/80 to-gray-800/60 border border-purple-500/30 rounded-2xl p-4 hover:border-purple-400/70 transition group"
        >
          <div className="text-[11px] text-purple-300 mb-1">🌟 今日推荐（D-08）</div>
          <div className="font-bold group-hover:text-purple-200 transition">{daily.title}</div>
          <div className="mt-1.5">{metaChips(daily)}</div>
        </Link>
      )}
    </div>
  );
}

export default CuratedSpotlight;
