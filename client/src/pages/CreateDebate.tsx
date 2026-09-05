import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import useAuth from "../hooks/useAuth";
import api, { errMsg } from "../api";
import type { DebateCategory, DebateType } from "../types";
import { CATEGORY_LABELS } from "../types";

function CreateDebate() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DebateCategory>("general");
  const [type, setType] = useState<DebateType>("classic");
  const [sideA, setSideA] = useState("正方");
  const [sideB, setSideB] = useState("反方");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (title.trim().length < 5) {
      return setError("辩题标题至少需要5个字符");
    }
    setLoading(true);
    try {
      const { id } = await api.createDebate({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        type,
        sideA: sideA.trim() || undefined,
        sideB: sideB.trim() || undefined,
      });
      setSuccess("✅ 创建成功！辩题已提交审核，审核通过后即可开始报名。");
      setTimeout(() => navigate(`/debate/${id}`), 1200);
    } catch (err) {
      setError(errMsg(err, "创建失败"));
    }
    setLoading(false);
  };

  const inputCls =
    "w-full p-3 bg-gray-700 rounded-lg border border-gray-600 text-white focus:outline-none focus:border-orange-400";
  const labelCls = "block text-sm text-gray-400 mb-1.5";

  return (
    <div className="min-h-screen app-bg text-white">
      <Navbar user={user} isAdmin={isAdmin} onLogout={logout} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white text-sm mb-4"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-orange-400 mb-2">➕ 创建辩题</h1>
        <p className="text-sm text-gray-500 mb-6">
          创建后需管理员审核（D-03），通过后进入报名阶段，满员自动开赛（D-07）。
        </p>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl border border-gray-700 p-6 space-y-5">
          <div>
            <label htmlFor="title" className={labelCls}>
              辩题标题 <span className="text-orange-400">*</span>
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：人工智能是否应该拥有道德判断能力？"
              className={inputCls}
              maxLength={120}
              required
            />
          </div>

          <div>
            <label htmlFor="desc" className={labelCls}>辩题描述</label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充背景、定义与讨论范围，帮助辩手理解辩题（可选）"
              className={`${inputCls} h-28 resize-none`}
              maxLength={500}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {description.length}/500
            </div>
          </div>

          <div>
            <span className={labelCls}>辩论形式</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  [
                    "classic",
                    "🎤 标准辩论",
                    "正反方各 1-4 人，最多 8 人，适合团队正式对抗",
                  ],
                  [
                    "quick1v1",
                    "⚡ 快速 1v1",
                    "每方 1 人、满 2 人即开赛，适合碎片时间快速开杠",
                  ],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  aria-pressed={type === value}
                  className={`text-left rounded-xl border p-3.5 transition ${
                    type === value
                      ? value === "quick1v1"
                        ? "border-purple-400 bg-purple-500/15"
                        : "border-orange-400 bg-orange-500/10"
                      : "border-gray-700 bg-gray-700/30 hover:border-gray-500"
                  }`}
                >
                  <div className="font-semibold text-sm">{title}</div>
                  <div className="text-[11px] text-gray-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cat" className={labelCls}>分类</label>
              <select
                id="cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as DebateCategory)}
                className={inputCls}
              >
                {(Object.keys(CATEGORY_LABELS) as DebateCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sideA" className={labelCls}>正方名称</label>
              <input
                id="sideA"
                value={sideA}
                onChange={(e) => setSideA(e.target.value)}
                className={inputCls}
                maxLength={20}
              />
            </div>
            <div>
              <label htmlFor="sideB" className={labelCls}>反方名称</label>
              <input
                id="sideB"
                value={sideB}
                onChange={(e) => setSideB(e.target.value)}
                className={inputCls}
                maxLength={20}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg py-2.5 px-3">
              {error}
            </div>
          )}
          {success && (
            <div className="text-green-300 text-sm bg-green-500/10 border border-green-500/30 rounded-lg py-2.5 px-3">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold transition disabled:opacity-50"
          >
            {loading ? "提交中..." : "提交审核"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateDebate;
