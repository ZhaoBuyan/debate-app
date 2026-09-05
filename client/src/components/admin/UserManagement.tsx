// client/src/components/admin/UserManagement.tsx
// 管理员：用户管理（AD-02 封禁 / AD-03 解封 / AD-04 警告）

import React, { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import type { AdminUser } from "../../types";
import Button from "../common/Button";

const ROLE_LABEL: Record<string, string> = {
  user: "用户",
  admin: "管理员",
  super_admin: "超级管理员",
};

function UserManagement() {
  const [list, setList] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [modal, setModal] = useState<AdminUser | null>(null);
  const [banMode, setBanMode] = useState<"temp" | "forever">("forever");
  const [reason, setReason] = useState("");

  const load = useCallback(async (keyword?: string) => {
    setLoading(true);
    try {
      const data = await api.adminUsers({ search: keyword || undefined });
      setList(data.list);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(errMsg(e, "加载用户失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (fn: () => Promise<any>, id: string, successMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      setModal(null);
      setReason("");
      await load(search || undefined);
    } catch (e) {
      setError(errMsg(e, "操作失败"));
    } finally {
      setBusyId("");
    }
  };

  const ban = (u: AdminUser) => {
    doAction(
      () =>
        api.adminBan(
          u.id,
          banMode === "temp" ? 7 * 24 * 60 * 60 * 1000 : null,
          reason || undefined,
        ),
      u.id,
      "已封禁",
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="搜索用户名…"
          className="flex-1 bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
        />
        <Button size="sm" onClick={() => load(search)}>搜索</Button>
      </div>
      {error && <div className="text-red-300 text-sm bg-red-500/10 rounded-lg px-3 py-2 mb-3">{error}</div>}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">加载中...</div>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-2">共 {total} 位用户</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-700">
                  <th className="py-2 pr-2">用户</th>
                  <th className="py-2 pr-2">角色</th>
                  <th className="py-2 pr-2">段位/积分</th>
                  <th className="py-2 pr-2">战绩</th>
                  <th className="py-2 pr-2">警告</th>
                  <th className="py-2 pr-2">状态</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-b border-gray-800">
                    <td className="py-2.5 pr-2">
                      <span aria-hidden>{u.avatar}</span> {u.username}
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-gray-400">{ROLE_LABEL[u.role]}</td>
                    <td className="py-2.5 pr-2 text-xs text-orange-300">{u.rank} / {u.points}分</td>
                    <td className="py-2.5 pr-2 text-xs">{u.wins}胜 {u.losses}负</td>
                    <td className="py-2.5 pr-2 text-xs">
                      {u.warning_count >= 3 ? (
                        <span className="text-red-400 font-bold">{u.warning_count} ⚠️</span>
                      ) : (
                        u.warning_count
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      {u.is_banned ? (
                        <span className="text-red-400" title={u.banned_reason || ""}>
                          🚫 已封禁
                          {u.banned_until ? `（至${new Date(u.banned_until).toLocaleDateString()}）` : "（永久）"}
                        </span>
                      ) : (
                        <span className="text-green-400">正常</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-1.5">
                        {!u.is_banned ? (
                          <>
                            <button
                              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
                              onClick={() => {
                                setModal(u);
                                setBanMode("temp");
                                setReason("");
                              }}
                            >
                              封禁
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded bg-yellow-600/60 hover:bg-yellow-600"
                              onClick={() =>
                                window.confirm(`确认警告用户 ${u.username}？满3次自动封禁`) &&
                                doAction(() => api.adminWarn(u.id, "违反社区规范"), u.id, "已警告")
                              }
                            >
                              警告
                            </button>
                          </>
                        ) : (
                          <button
                            className="text-xs px-2 py-1 rounded bg-green-700/60 hover:bg-green-600"
                            onClick={() => doAction(() => api.adminUnban(u.id), u.id, "已解封")}
                          >
                            解封
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 封禁弹窗 */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-gray-800 rounded-2xl border border-gray-600 p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="封禁用户"
          >
            <h3 className="font-bold mb-4">
              🚫 封禁用户 {modal.username}
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    ["temp", "临时封禁（7天）"],
                    ["forever", "永久封禁"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setBanMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm transition ${
                      banMode === mode
                        ? "bg-red-600 text-white"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="封禁原因（可选）"
                className="w-full bg-gray-700 rounded-lg border border-gray-600 px-3 py-2 text-sm focus:outline-none focus:border-red-400"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setModal(null)}>
                  取消
                </Button>
                <Button variant="danger" size="sm" disabled={busyId === modal.id} onClick={() => ban(modal)}>
                  确认封禁
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
