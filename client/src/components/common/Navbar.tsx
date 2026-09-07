// client/src/components/common/Navbar.tsx
// 顶部导航栏（登录后所有页面共用）：桌面菜单 / 移动端汉堡 / 段位徽章 / 数据导出

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { User } from "../../types";
import { rankChipClass, rankIcon } from "../../types";
import api, { errMsg } from "../../api";
import Button from "./Button";

interface Props {
  user: User | null;
  isAdmin: boolean;
  onLogout: () => void;
  onToast?: (text: string) => void;
}

function Navbar({ user, isAdmin, onLogout, onToast }: Props) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [
    { to: "/debates", label: "🏟️ 辩题大厅" },
    { to: "/create", label: "➕ 创建辩题" },
    { to: "/leaderboard", label: "🏆 排行" },
    { to: "/topics", label: "💡 众创" },
    { to: "/profile", label: "👤 个人资料" },
    ...(isAdmin ? [{ to: "/admin", label: "🛡️ 管理后台" }] : []),
  ];

  /** 导出我的全部数据（数据可携带权） */
  const handleExport = async () => {
    if (!user) return;
    try {
      const payload = await api.exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debate-export-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onToast?.("📦 数据导出成功，已开始下载");
    } catch (e) {
      onToast?.(errMsg(e, "导出失败"));
    }
  };

  const isActive = (to: string) =>
    to === "/debates" ? location.pathname === "/debates" : location.pathname.startsWith(to);

  return (
    <nav
      className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-gray-800"
      aria-label="主导航"
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/debates" className="flex items-center gap-1.5 font-bold text-lg whitespace-nowrap">
            <span aria-hidden className="text-xl">🗣️</span>
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              辩论平台
            </span>
          </Link>
          {/* 桌面菜单 */}
          <div className="hidden md:flex items-center gap-1">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className={`px-3 py-1.5 rounded-lg text-sm transition whitespace-nowrap ${
                  isActive(it.to)
                    ? "bg-gray-800 text-orange-300"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <Link
              to="/profile"
              title="个人资料"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition"
            >
              <span aria-hidden>{user.avatar}</span>
              <span className="max-w-28 truncate">{user.username}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded border ${rankChipClass(user.rank)}`}
              >
                {rankIcon(user.rank)} {user.rank || "青铜"}
              </span>
              <span className="text-xs text-orange-300/90">{user.points} 分</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleExport}
            title="导出我的全部辩论数据（JSON）"
            aria-label="导出我的数据"
            className="px-2 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
          >
            📦
          </button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="hidden sm:block">
            退出
          </Button>
          {/* 移动端汉堡 */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={menuOpen}
            className="md:hidden px-2 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900/98 px-4 py-2 space-y-1">
          {user && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300">
              <span aria-hidden>{user.avatar}</span>
              <span className="truncate">{user.username}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${rankChipClass(user.rank)}`}>
                {rankIcon(user.rank)} {user.rank || "青铜"}
              </span>
              <span className="text-xs text-orange-300/90 ml-auto">{user.points} 分</span>
            </div>
          )}
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              onClick={() => setMenuOpen(false)}
              className={`block px-2 py-2 rounded-lg text-sm ${
                isActive(it.to) ? "bg-gray-800 text-orange-300" : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {it.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="w-full text-left px-2 py-2 rounded-lg text-sm text-red-300 hover:bg-gray-800"
          >
            退出登录
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
