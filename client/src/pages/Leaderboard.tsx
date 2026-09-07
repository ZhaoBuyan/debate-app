// client/src/pages/Leaderboard.tsx
// 排行榜（C5）：段位榜 / 活跃榜，含我的名次

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Loading from "../components/common/Loading";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import type { LeaderboardRow } from "../types";
import { rankChipClass, rankIcon } from "../types";

const MEDALS = ["🥇", "🥈", "🥉"];

function Leaderboard() {
  const { user, isAdmin, logout } = useAuth();
  const [type, setType] = useState<"points" | "active">("points");
  const [list, setList] = useState<LeaderboardRow[]>([]);
  const [meRank, setMeRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .leaderboard(type)
      .then((data) => {
        if (!alive) return;
        setList(data.list);
        setMeRank(data.meRank ?? null);
      })
      .catch((e) => alive && setErr(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [type]);

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-orange-400 mb-1">🏆 排行榜</h1>
        <p className="text-sm text-gray-400 mb-5">
          辩论不只是胜负——积分、活跃与思想的交锋都值得被看见
        </p>

        <div className="flex gap-2 mb-5" role="tablist" aria-label="榜单类型">
          {(
            [
              ["points", "👑 段位榜"],
              ["active", "⚡ 活跃榜（30 天）"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={type === key}
              onClick={() => setType(key)}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                type === key
                  ? "bg-orange-500 text-white font-medium"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {meRank && user && (
          <div className="mb-4 text-xs text-gray-300 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2">
            我的名次：<b className="text-orange-300">第 {meRank} 名</b>
          </div>
        )}

        {loading ? (
          <Loading text="榜单加载中…" />
        ) : err ? (
          <div className="text-sm text-red-300">{err}</div>
        ) : list.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            {type === "points" ? "还没有积分记录" : "近 30 天还没有人发言"}
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((row, i) => (
              <li key={row.id}>
                <Link
                  to={`/u/${row.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-3.5 py-2.5 hover:border-orange-500/50 hover:bg-gray-800 transition"
                >
                  <span className="w-9 text-center text-lg shrink-0" aria-hidden>
                    {MEDALS[i] ?? (
                      <span className="text-sm text-gray-500">{i + 1}</span>
                    )}
                  </span>
                  <span aria-hidden className="text-xl shrink-0">
                    {row.avatar}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {row.username}
                        {user?.id === row.id && (
                          <span className="text-[10px] text-orange-300 ml-1">（我）</span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${rankChipClass(row.rank)}`}
                      >
                        {rankIcon(row.rank)} {row.rank}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {type === "points"
                        ? `${row.points} 分 · 胜 ${row.wins} / 负 ${row.losses} ${
                            row.win_rate != null ? `· 胜率 ${row.win_rate}%` : ""
                          }${row.speech_total ? ` · ${row.speech_total} 次发言` : ""}`
                        : `近 30 天 ${row.speech_30d ?? 0} 次发言 · 积分 ${row.points}`}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default Leaderboard;
