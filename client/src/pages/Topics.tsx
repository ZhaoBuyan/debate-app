// client/src/pages/Topics.tsx
// 辩题众创（D-10）：提案池 + 投票 + 管理员采纳

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Button from "../components/common/Button";
import Loading from "../components/common/Loading";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import type { DebateCategory, TopicProposal } from "../types";
import { CATEGORY_LABELS } from "../types";

function Topics() {
  const { user, isAdmin, logout } = useAuth();
  const [list, setList] = useState<TopicProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 提交表单
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DebateCategory>("general");

  const load = useCallback(async () => {
    try {
      setList(await api.listTopics());
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!user) return;
    try {
      await api.createTopic({ title, description: description || undefined, category });
      setTitle("");
      setDescription("");
      setCategory("general");
      await load();
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  const vote = async (id: number) => {
    try {
      await api.voteTopic(id);
      await load();
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  const adopt = async (id: number) => {
    if (!window.confirm("采纳该提案为正式辩题？将进入审核流程。")) return;
    try {
      await api.adminAdoptTopic(id);
      await load();
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("确认移除该提案？")) return;
    try {
      await api.adminRemoveTopic(id);
      await load();
    } catch (ex) {
      setErr(errMsg(ex));
    }
  };

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-orange-400 mb-1">💡 辩题众创</h1>
        <p className="text-sm text-gray-400 mb-6">
          D-10 · 提出你关心的辩题，社区投票，高票提案将被采纳为正式辩题
        </p>

        {err && (
          <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        {/* 提交提案 */}
        <form
          onSubmit={submit}
          className="rounded-2xl border border-gray-700 bg-gray-800/50 p-4 mb-6 flex flex-col gap-3"
        >
          <div className="flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="提案辩题（5-60 字）…"
              aria-label="提案辩题"
              className="flex-1 min-w-[220px] rounded-lg bg-gray-900/80 border border-gray-600 px-3 py-2 text-sm focus:border-orange-400 outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DebateCategory)}
              aria-label="分类"
              className="rounded-lg bg-gray-900/80 border border-gray-600 px-2 py-2 text-sm"
            >
              {(Object.keys(CATEGORY_LABELS) as DebateCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="补充说明（可选，≤200 字）"
            aria-label="补充说明"
            className="rounded-lg bg-gray-900/80 border border-gray-600 px-3 py-2 text-sm focus:border-orange-400 outline-none"
          />
          {user ? (
            <Button type="submit" size="sm" className="self-end" disabled={busy}>
              提交提案
            </Button>
          ) : (
            <p className="text-xs text-gray-500">
              登录后即可提交提案
            </p>
          )}
        </form>

        {/* 提案列表 */}
        {loading ? (
          <Loading text="提案加载中…" />
        ) : list.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div className="text-4xl mb-3" aria-hidden>
              🌱
            </div>
            众创池还空着——提出第一个辩题吧
          </div>
        ) : (
          <ul className="space-y-2.5">
            {list.map((t, i) => (
              <li
                key={t.id}
                className="rounded-xl border border-gray-700 bg-gray-800/50 p-3.5 flex items-start gap-3"
              >
                <span className="text-sm font-bold text-gray-500 w-7 text-right mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-400 mt-1">{t.description}</p>
                  )}
                  <div className="text-[11px] text-gray-500 mt-1.5">
                    👤 {t.username} · {new Date(t.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    onClick={() => vote(t.id)}
                    disabled={!user}
                    title={t.voted ? "取消投票" : "投票支持"}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                      t.voted
                        ? "bg-orange-500/20 border-orange-500/60 text-orange-300"
                        : "bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-500/60"
                    } disabled:opacity-40`}
                  >
                    👍 {t.vote_count ?? 0}
                  </button>
                  {isAdmin && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => adopt(t.id)}
                        className="text-[11px] px-2 py-1 rounded bg-green-700/70 hover:bg-green-600 text-white transition"
                        title="采纳为正式辩题"
                      >
                        采纳
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-[11px] px-2 py-1 rounded bg-gray-700 hover:bg-red-700/80 text-gray-300 transition"
                        title="移除提案"
                      >
                        移除
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-600 mt-6 text-center">
          采纳的提案将进入管理员审核流程（D-03）—{" "}
          <Link to="/debates" className="text-gray-400 hover:text-orange-400">
            返回大厅
          </Link>
        </p>
      </main>
    </div>
  );
}

export default Topics;
