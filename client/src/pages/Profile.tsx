// client/src/pages/Profile.tsx
// 个人资料页（U-08）：战绩展示 / 头像编辑 / 修改密码 / 参与历史

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Loading from "../components/common/Loading";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import { rankChipClass, rankIcon, SIDE_LABELS, STATUS_LABELS } from "../types";
import type { MyActivities } from "../types";

const AVATAR_CHOICES = [
  "😊", "😎", "🤔", "🧐", "🤓", "😏", "🦊", "🐼", "🐯", "🦁",
  "🐸", "🐙", "🦄", "🐳", "🦉", "🐺", "⚡", "🔥", "🌟", "🎯",
];

function Profile() {
  const { user, isAdmin, logout, refreshUser } = useAuth();
  const [data, setData] = useState<MyActivities | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [pickingAvatar, setPickingAvatar] = useState(false);

  // 修改密码表单
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const load = useCallback(() => {
    api
      .myActivities()
      .then((d) => {
        setData(d);
        refreshUser();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 3000);
  };

  const pickAvatar = async (emoji: string) => {
    try {
      await api.updateAvatar(emoji);
      await refreshUser();
      setPickingAvatar(false);
      flash("✅ 头像已更新");
      load();
    } catch (e) {
      flash(errMsg(e, "更新失败"));
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd.length < 6) return setPwdMsg({ ok: false, text: "新密码至少6个字符" });
    setPwdLoading(true);
    try {
      await api.changePassword(oldPwd, newPwd);
      setPwdMsg({ ok: true, text: "✅ 密码修改成功，下次登录请使用新密码" });
      setOldPwd("");
      setNewPwd("");
    } catch (err) {
      setPwdMsg({ ok: false, text: errMsg(err, "修改失败") });
    }
    setPwdLoading(false);
  };

  if (loading || !data || !user) {
    return (
      <div className="min-h-screen app-bg">
        <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
        <Loading text="资料加载中..." />
      </div>
    );
  }

  const p = data.profile;
  const inputCls =
    "w-full p-2.5 bg-gray-700 rounded-lg border border-gray-600 text-sm text-white focus:outline-none focus:border-orange-400";

  const statCards = [
    { label: "积分", value: p.points, icon: "✨" },
    { label: "段位", value: p.rank, icon: rankIcon(p.rank) },
    { label: "胜 / 负", value: `${p.wins} / ${p.losses}`, icon: "⚔️" },
    { label: "发言总数", value: data.speechTotal, icon: "🎤" },
    { label: "获最佳票", value: data.bestDebaterVotes, icon: "⭐" },
    { label: "注册时长", value: `${Math.max(1, Math.floor((Date.now() - (p.created_at || Date.now())) / 86400000))} 天`, icon: "📅" },
  ];

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {toast && (
          <div className="fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-600 text-sm shadow-2xl">
            {toast}
          </div>
        )}

        {/* 头部资料卡 */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 flex flex-col sm:flex-row items-center gap-5">
          <button
            type="button"
            onClick={() => setPickingAvatar((v) => !v)}
            title="点击更换头像"
            aria-label="更换头像"
            className="relative w-20 h-20 rounded-2xl bg-gray-700 flex items-center justify-center text-4xl hover:ring-2 hover:ring-orange-400 transition"
          >
            <span aria-hidden>{p.avatar}</span>
            <span className="absolute -bottom-1 -right-1 text-sm" aria-hidden>✏️</span>
          </button>
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-xl font-bold">{p.username}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${rankChipClass(p.rank)}`}>
                {rankIcon(p.rank)} {p.rank}
              </span>
              {p.is_banned ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  🚫 已封禁{p.banned_until ? `至 ${new Date(p.banned_until).toLocaleDateString()}` : "（永久）"}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30">
                  🟢 正常
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1.5">
              角色：{p.role === "super_admin" ? "超级管理员" : p.role === "admin" ? "管理员" : "辩手"}
              {p.warning_count > 0 && (
                <span className="ml-2 text-yellow-400">⚠️ 警告 {p.warning_count}/3</span>
              )}
            </div>
          </div>
          {/* 头像选择器 */}
          {pickingAvatar && (
            <div className="sm:ml-auto grid grid-cols-8 gap-1.5">
              {AVATAR_CHOICES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => pickAvatar(a)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition ${
                    p.avatar === a
                      ? "bg-orange-500/30 ring-1 ring-orange-400"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  aria-label={`选择头像 ${a}`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 战绩统计 */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
          {statCards.map((c) => (
            <div key={c.label} className="bg-gray-800/80 rounded-xl border border-gray-700 p-3 text-center">
              <div className="text-lg" aria-hidden>{c.icon}</div>
              <div className="text-lg font-bold text-orange-300">{c.value}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* 修改密码 */}
          <form onSubmit={submitPassword} className="bg-gray-800 rounded-2xl border border-gray-700 p-5 space-y-3">
            <h2 className="font-bold text-sm text-gray-200">🔑 修改密码</h2>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="当前密码"
              className={inputCls}
              autoComplete="current-password"
              required
            />
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="新密码（至少6个字符）"
              className={inputCls}
              autoComplete="new-password"
              required
            />
            {pwdMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg ${pwdMsg.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                {pwdMsg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {pwdLoading ? "提交中..." : "确认修改"}
            </button>
          </form>

          {/* 参与历史 */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
            <h2 className="font-bold text-sm text-gray-200 mb-3">📜 我的辩论记录（{data.joined.length}）</h2>
            {data.joined.length === 0 ? (
              <div className="text-gray-500 text-sm py-6 text-center">
                还没有参与过辩论，
                <Link to="/debates" className="text-orange-400 underline">去报名一场</Link> 吧！
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {data.joined.map((d) => (
                  <Link
                    key={d.id}
                    to={`/debate/${d.id}`}
                    className="flex items-center gap-2.5 rounded-lg bg-gray-700/40 hover:bg-gray-700 px-3 py-2 text-sm transition"
                  >
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                        d.side === "A" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"
                      }`}
                    >
                      {SIDE_LABELS[d.side]}
                    </span>
                    <span className="flex-1 min-w-0 truncate">{d.title}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">
                      {STATUS_LABELS[d.status]} · {d.speech_count} 次发言
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
