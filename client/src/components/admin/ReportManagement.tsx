// client/src/components/admin/ReportManagement.tsx
// 管理员：举报处理（AD-06：查看/处理/标记）

import React, { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import type { Report } from "../../types";
import Button from "../common/Button";

const STATUS_LABEL: Record<string, string> = {
  pending: "待处理",
  reviewing: "处理中",
  resolved: "已处理",
  rejected: "已驳回",
};

const TARGET_LABEL: Record<string, string> = {
  speech: "发言",
  message: "消息",
  user: "用户",
};

function ReportManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      setReports(await api.adminReports(status));
      setError("");
    } catch (e) {
      setError(errMsg(e, "加载举报失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [load, statusFilter]);

  const handle = async (id: number, action: "resolve" | "reject" | "delete_content") => {
    const note = action === "reject" || action === "delete_content"
      ? window.prompt(action === "delete_content" ? "删除原因备注：" : "驳回理由（可选）：") || undefined
      : undefined;
    setBusyId(id);
    try {
      await api.adminHandleReport(id, action, note);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(errMsg(e, "操作失败"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {(["pending", "all", "resolved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs transition ${
              statusFilter === s ? "bg-orange-500" : "bg-gray-700 text-gray-300"
            }`}
          >
            {s === "pending" ? "待处理" : s === "all" ? "全部" : s === "resolved" ? "已处理" : "已驳回"}
          </button>
        ))}
      </div>
      {error && <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">加载中...</div>
      ) : reports.length === 0 ? (
        <div className="text-gray-500 py-10 text-center">暂无举报</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span className="text-yellow-400 font-medium">#{r.id}</span>
                <span>举报人：{r.reporter_name}</span>
                <span>对象：{r.target_name}</span>
                <span>类型：{TARGET_LABEL[r.target_type]}</span>
                {r.debate_title && <span>辩题：{r.debate_title}</span>}
                <span className="ml-auto">
                  {STATUS_LABEL[r.status]} · {new Date(r.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              <p className="text-sm text-gray-200 mt-2">
                📝 原因：{r.reason}
              </p>
              {(r.speech_content || r.message_content) && (
                <blockquote className="mt-2 text-xs text-gray-400 bg-gray-900/60 border-l-2 border-gray-600 rounded-r-lg px-3 py-2">
                  内容：「{(r.speech_content || r.message_content)?.slice(0, 120)}」
                </blockquote>
              )}
              {r.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === r.id}
                    onClick={() => handle(r.id, "delete_content")}
                    title="删除违规内容并标记处理"
                  >
                    🗑️ 删除内容
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    disabled={busyId === r.id}
                    onClick={() => handle(r.id, "resolve")}
                  >
                    标记处理
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === r.id}
                    onClick={() => handle(r.id, "reject")}
                  >
                    驳回举报
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportManagement;
