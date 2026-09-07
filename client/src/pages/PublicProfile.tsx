// client/src/pages/PublicProfile.tsx
// 公开个人主页（C4）：无需登录即可查看任意辩手的战绩与辩论足迹

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Loading from "../components/common/Loading";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import type { MyActivities } from "../types";
import {
  CATEGORY_LABELS,
  SIDE_LABELS,
  STATUS_LABELS,
  rankChipClass,
  rankIcon,
} from "../types";

function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, logout } = useAuth();
  const [data, setData] = useState<MyActivities | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    api
      .publicProfile(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const p = data?.profile;

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <Loading text="资料加载中…" />
        ) : error || !data || !p ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3" aria-hidden>
              👻
            </div>
            {error || "该用户不存在或已被封禁"}
            <div className="mt-4">
              <Link to="/debates" className="text-orange-400 text-sm">
                ← 返回大厅
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 头部资料卡 */}
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 mb-5">
              <div className="flex items-center gap-4 flex-wrap">
                <span
                  aria-hidden
                  className="text-5xl w-16 h-16 flex items-center justify-center rounded-2xl bg-gray-900 border border-gray-600"
                >
                  {p.avatar}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold">{p.username}</h1>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded border ${rankChipClass(p.rank)}`}
                    >
                      {rankIcon(p.rank)} {p.rank}
                    </span>
                    {p.role === "admin" || p.role === "super_admin" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                        🛡️ 管理员
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    注册于 {new Date((p.created_at || 0) * 1000).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* 战绩统计 */}
              <div className="grid grid-cols-4 gap-2 mt-5 text-center">
                {[
                  ["积分", String(p.points)],
                  ["胜 / 负", `${p.wins} / ${p.losses}`],
                  ["发言", String(data.speechTotal)],
                  ["最佳辩手票", String(data.bestDebaterVotes)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-gray-900/70 border border-gray-700 py-2.5"
                  >
                    <div className="text-lg font-bold text-orange-300">{value}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {user?.id === p.id && (
                <p className="text-xs text-gray-500 mt-3">
                  这是你的公开主页——{" "}
                  <Link to="/profile" className="text-orange-400 hover:underline">
                    编辑个人资料
                  </Link>
                </p>
              )}
            </div>

            {/* 辩论足迹 */}
            <h2 className="font-bold text-gray-200 mb-3">🗂️ 辩论足迹</h2>
            {data.joined.length === 0 ? (
              <div className="text-center text-gray-500 py-10 text-sm">
                还没有参加过辩论
              </div>
            ) : (
              <ul className="space-y-2">
                {data.joined.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/debate/${j.id}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-3.5 py-2.5 hover:border-orange-500/50 transition"
                    >
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          j.side === "A"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-blue-500/15 text-blue-300"
                        }`}
                      >
                        {SIDE_LABELS[j.side]} {j.order_index}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm">
                        {j.title}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {CATEGORY_LABELS[j.category]}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {STATUS_LABELS[j.status]}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {j.speech_count} 言
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default PublicProfile;
