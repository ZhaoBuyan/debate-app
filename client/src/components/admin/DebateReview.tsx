// client/src/components/admin/DebateReview.tsx
// 管理员：辩题审核（AD-01 通过/拒绝）

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../../api";
import type { Debate } from "../../types";
import { CATEGORY_LABELS } from "../../types";
import Button from "../common/Button";

function DebateReview() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [cooldown, setCooldown] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setDebates(await api.adminPendingDebates());
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

  const act = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      if (action === "approve") {
        await api.adminApproveDebate(
          id,
          note[id] || undefined,
          cooldown[id] || 0,
        );
      } else {
        await api.adminRejectDebate(id, note[id] || "不符合社区规范");
      }
      setDebates((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(errMsg(e, "操作失败"));
    } finally {
      setBusy("");
    }
  };

  if (loading) return <div className="text-gray-400 py-10 text-center">加载中...</div>;

  return (
    <div className="space-y-3">
      {error && <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
      {debates.length === 0 ? (
        <div className="text-gray-500 py-10 text-center">🎉 暂无待审核辩题</div>
      ) : (
        debates.map((d) => (
          <div key={d.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <Link to={`/debate/${d.id}`} className="font-semibold hover:text-orange-300">
                  {d.title}
                </Link>
                <div className="text-xs text-gray-500 mt-1 space-x-3">
                  <span>📂 {CATEGORY_LABELS[d.category]}</span>
                  <span>👤 {d.creator_name}</span>
                  <span>🕐 {new Date(d.created_at).toLocaleString("zh-CN")}</span>
                </div>
                {d.description && (
                  <p className="text-sm text-gray-400 mt-1.5 line-clamp-2">{d.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                value={note[d.id] || ""}
                onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
                placeholder="审核备注（可选）"
                className="flex-1 bg-gray-700 rounded-lg border border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400"
              />
              <input
                type="number"
                min={0}
                max={60}
                value={cooldown[d.id] ?? 0}
                onChange={(e) =>
                  setCooldown((c) => ({
                    ...c,
                    [d.id]: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
                  }))
                }
                placeholder="冷静期(分钟)"
                title="社区公约：设置后新加入辩手需等待该时长才能发言（0-60分钟）"
                className="w-28 bg-gray-700 rounded-lg border border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-400"
              />
              <Button
                size="sm"
                variant="success"
                disabled={busy === d.id}
                onClick={() => act(d.id, "approve")}
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={busy === d.id}
                onClick={() => act(d.id, "reject")}
              >
                拒绝
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default DebateReview;
