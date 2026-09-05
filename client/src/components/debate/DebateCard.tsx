// client/src/components/debate/DebateCard.tsx
// 辩题卡片（列表页使用）

import React from "react";
import { Link } from "react-router-dom";
import {
  CATEGORY_LABELS,
  DEBATE_TYPE_LABELS,
  STATUS_LABELS,
  type Debate,
} from "../../types";

interface Props {
  debate: Debate;
  showPendingHint?: boolean;
}

const statusColor: Record<string, string> = {
  pending: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
  waiting: "text-blue-300 bg-blue-500/10 border-blue-500/30",
  ongoing: "text-red-300 bg-red-500/10 border-red-500/30",
  finished: "text-gray-400 bg-gray-600/10 border-gray-500/30",
  rejected: "text-gray-500 bg-gray-600/10 border-gray-600/30",
};

function DebateCard({ debate, showPendingHint }: Props) {
  return (
    <Link
      to={`/debate/${debate.id}`}
      className="block bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/5 transition group"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold group-hover:text-orange-300 transition">
          {debate.title}
        </h3>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-full border ${statusColor[debate.status] || ""}`}
        >
          {STATUS_LABELS[debate.status] || debate.status}
        </span>
      </div>
      {debate.description && (
        <p className="text-gray-400 text-sm mt-1.5 line-clamp-2">
          {debate.description}
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
        <span>📂 {CATEGORY_LABELS[debate.category] || debate.category}</span>
        {(debate.debate_type === "quick1v1" || (debate.cool_down_minutes || 0) > 0) && (
          <span className="flex gap-2">
            {debate.debate_type === "quick1v1" && (
              <span className="px-1.5 py-0.5 rounded border border-purple-500/50 bg-purple-500/10 text-purple-300">
                {DEBATE_TYPE_LABELS.quick1v1}
              </span>
            )}
            {(debate.cool_down_minutes || 0) > 0 && (
              <span
                className="px-1.5 py-0.5 rounded border border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                title="本场设有冷静期：加入后需等待才能发言（社区公约）"
              >
                🧊 {debate.cool_down_minutes} 分钟冷静期
              </span>
            )}
          </span>
        )}
        <span>👤 {debate.creator_name || "匿名"}</span>
        <span>👥 {debate.debater_count ?? 0}/8</span>
        <span>
          🔴 {(debate as any).side_a_count ?? 0} vs {(debate as any).side_b_count ?? 0} 🔵
        </span>
        {(debate.hot || 0) > 0 && (
          <span className="text-orange-300/90">🔥 {debate.hot}</span>
        )}
        {showPendingHint && (
          <span className="text-yellow-400">等待管理员审核中…</span>
        )}
      </div>
    </Link>
  );
}

export default DebateCard;
