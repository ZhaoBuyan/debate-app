// client/src/components/debate/RelatedDebates.tsx
// 相关辩题推荐（KN-03 基础版）：辩论室侧栏，同分类/标题词重叠打分

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import type { RelatedDebate } from "../../types";
import { CATEGORY_LABELS, DEBATE_TYPE_LABELS, STATUS_LABELS } from "../../types";

const statusDot: Record<string, string> = {
  waiting: "bg-blue-400",
  ongoing: "bg-red-400 animate-pulse",
  finished: "bg-gray-500",
};

function RelatedDebates({ debateId }: { debateId: string }) {
  const [list, setList] = useState<RelatedDebate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getRelated(debateId)
      .then((r) => {
        if (alive) setList(r);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debateId]);

  // 无推荐时不显示区块
  if (!loading && list.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/60 p-4" aria-label="相关辩题">
      <h2 className="text-sm font-bold mb-3 text-gray-300 flex items-center gap-2">
        <span aria-hidden>📚</span> 相关辩题
        <span className="text-[10px] font-normal text-gray-500">换个立场，再看同一类问题</span>
      </h2>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-700/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((d) => (
            <Link
              key={d.id}
              to={`/debate/${d.id}`}
              className="block rounded-xl border border-gray-700/80 bg-gray-800/50 hover:border-orange-400/60 hover:bg-gray-700/50 px-3 py-2.5 transition group"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusDot[d.status] || "bg-gray-600"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-100 leading-snug line-clamp-2 group-hover:text-orange-200 transition">
                    {d.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
                    <span>{CATEGORY_LABELS[d.category] || d.category}</span>
                    <span className="text-gray-600">·</span>
                    <span>{STATUS_LABELS[d.status]}</span>
                    <span className="text-gray-600">·</span>
                    <span>
                      ⚔️ {d.debater_count}/{(d.debate_type === "quick1v1" ? 2 : 8)}
                    </span>
                    {d.speech_count > 0 && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span>🎤 {d.speech_count}</span>
                      </>
                    )}
                    {d.debate_type === "quick1v1" && (
                      <span className="text-purple-300/80">
                        · {DEBATE_TYPE_LABELS.quick1v1}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-gray-600 group-hover:text-orange-400 transition" aria-hidden>
                  ›
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default RelatedDebates;
