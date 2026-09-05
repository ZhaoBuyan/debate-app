// client/src/components/debate/SpeakerPanel.tsx
// 辩手面板：头像 + 姓名 + 实时 AI 提炼观点（A-02 一句话观点）

import React from "react";
import type { Debater } from "../../types";
import { rankChipClass, rankIcon } from "../../types";

interface Props {
  debater: Debater;
  /** 最新发言的 AI 提炼观点 */
  latestSummary?: string | null;
  isCurrentSpeaker?: boolean;
  /** 我是否投了此人为最佳辩手 */
  isVoted?: boolean;
  /** 是否显示投票按钮 */
  showVote?: boolean;
  onVoteBest?: (userId: string) => void;
  /** 高亮发言方（当前轮到该方时整组闪烁） */
  highlightSide?: boolean;
}

function SpeakerPanel({
  debater,
  latestSummary,
  isCurrentSpeaker,
  isVoted,
  showVote,
  onVoteBest,
}: Props) {
  return (
    <div
      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
        isCurrentSpeaker
          ? "border-orange-400 bg-orange-500/10 shadow-lg shadow-orange-500/10"
          : "border-gray-700 bg-gray-800/60"
      }`}
    >
      <div className="relative shrink-0">
        <span
          className="w-10 h-10 flex items-center justify-center text-xl rounded-full bg-gray-700"
          aria-hidden
        >
          {debater.avatar || "😊"}
        </span>
        {isCurrentSpeaker && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-gray-900 animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{debater.username}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${rankChipClass(debater.rank)}`}
            aria-label={`段位：${debater.rank}`}
          >
            {rankIcon(debater.rank)} {debater.rank}
          </span>
          {debater.order_index <= 4 && (
            <span className="text-[10px] text-gray-500">#{debater.order_index}</span>
          )}
        </div>
        <p
          className="text-xs text-green-300/90 truncate mt-0.5"
          title={latestSummary || ""}
          aria-label={`AI观点：${latestSummary || "暂无"}`}
        >
          {latestSummary ? `🤖 ${latestSummary}` : "·"}
        </p>
      </div>
      {showVote && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVoteBest?.(debater.user_id);
          }}
          className={`shrink-0 text-[11px] px-2 py-1 rounded-full transition ${
            isVoted
              ? "bg-orange-500 text-white"
              : "bg-gray-700 hover:bg-orange-600 text-gray-200"
          }`}
          title="投为最佳辩手"
        >
          {isVoted ? "⭐ 已投" : "⭐ 最佳"}
        </button>
      )}
    </div>
  );
}

export default SpeakerPanel;
