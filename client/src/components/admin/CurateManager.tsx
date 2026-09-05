// client/src/components/admin/CurateManager.tsx
// 内容运营：编辑精选管理（已精选 ↔ 候选池，热度排序）

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../../api";
import type { Debate } from "../../types";
import { CATEGORY_LABELS, STATUS_LABELS } from "../../types";
import Button from "../common/Button";

const statusText: Record<string, string> = {
  waiting: "text-blue-300",
  ongoing: "text-red-300",
  finished: "text-gray-400",
};

function Row({ d, action, busy }: { d: Debate; action: () => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-xl border border-gray-700 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{d.title}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>{CATEGORY_LABELS[d.category]}</span>
          <span className={statusText[d.status] || ""}>{STATUS_LABELS[d.status]}</span>
          <span>⚔️ {d.debater_count ?? 0}/{(d.debate_type === "quick1v1" ? 2 : 8)}</span>
          <span>🎤 {d.speech_count ?? 0}</span>
          {(d.hot || 0) > 0 && <span className="text-orange-300">🔥 {d.hot}</span>}
          {(d.cool_down_minutes || 0) > 0 && <span>🧊 {d.cool_down_minutes}分</span>}
        </div>
      </div>
      <Link
        to={`/debate/${d.id}`}
        className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition shrink-0"
      >
        查看
      </Link>
      <Button size="sm" variant="ghost" disabled={busy} onClick={action}>
        设为精选
      </Button>
    </div>
  );
}

function CurateManager() {
  const [all, setAll] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listDebates();
      setAll(list);
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

  const toggle = async (d: Debate, curated: boolean) => {
    setBusyId(d.id);
    try {
      await api.adminSetCurated(d.id, curated);
      await load();
    } catch (e) {
      setError(errMsg(e, "操作失败"));
    } finally {
      setBusyId("");
    }
  };

  const curated = all
    .filter((d) => d.curated === 1)
    .sort((a, b) => (b.curated_at || 0) - (a.curated_at || 0));
  const candidates = all
    .filter(
      (d) =>
        d.curated !== 1 &&
        d.status !== "pending" &&
        d.status !== "rejected",
    )
    .sort((a, b) => (b.hot || 0) - (a.hot || 0))
    .slice(0, 15);

  if (loading) {
    return <div className="text-gray-400 py-10 text-center">加载中...</div>;
  }

  return (
    <div>
      {error && (
        <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* 已精选 */}
      <h3 className="font-bold text-sm text-amber-300 mb-2.5">
        🏅 当前精选（{curated.length}）— 将展示在大厅顶部运营位
      </h3>
      {curated.length === 0 ? (
        <div className="text-gray-500 text-sm py-6 text-center bg-gray-800/40 rounded-xl border border-dashed border-gray-700 mb-6">
          尚未设置精选——从下方候选池中挑选优质辩论
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {curated.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/30 rounded-xl px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  <span>{STATUS_LABELS[d.status]}</span>
                  <span>🔥 {d.hot ?? 0}</span>
                  <span>
                    精选于 {d.curated_at ? new Date(d.curated_at).toLocaleString("zh-CN") : "—"}
                  </span>
                </div>
              </div>
              <Link
                to={`/debate/${d.id}`}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition shrink-0"
              >
                查看
              </Link>
              <Button
                size="sm"
                variant="danger"
                disabled={busyId === d.id}
                onClick={() => toggle(d, false)}
              >
                取消精选
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 候选池 */}
      <h3 className="font-bold text-sm text-gray-300 mb-2.5">
        📥 候选池（按热度排序 Top 15）
        <span className="text-[11px] font-normal text-gray-500 ml-2">
          热度 = 辩手×3 + 发言×2 + 情绪 + 支持人数
        </span>
      </h3>
      {candidates.length === 0 ? (
        <div className="text-gray-500 py-6 text-center">暂无可精选的辩论</div>
      ) : (
        <div className="space-y-2 max-h-[560px] overflow-y-auto thin-scroll pr-1">
          {candidates.map((d) => (
            <Row key={d.id} d={d} busy={busyId === d.id} action={() => toggle(d, true)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default CurateManager;
