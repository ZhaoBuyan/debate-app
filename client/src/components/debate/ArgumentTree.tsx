// client/src/components/debate/ArgumentTree.tsx
// 辩论树（Argument Map，SRS A-04）：论点 → 反驳 → 再反驳 的可视化链路

import React, { useCallback, useEffect, useState } from "react";
import api, { errMsg } from "../../api";
import Loading from "../common/Loading";
import type { ArgumentNode } from "../../types";
import { SIDE_LABELS } from "../../types";

const DEPTH_LABELS = ["🎯 核心论点", "🗡️ 反驳", "🛡️ 再反驳", "⚔️ 交锋延伸"];

function NodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
  collapsedSet,
  onToggleCollapse,
}: {
  node: ArgumentNode;
  depth: number;
  selectedId: number | null;
  onSelect: (n: ArgumentNode) => void;
  collapsed: boolean;
  onToggle: () => void;
  collapsedSet: Set<number>;
  onToggleCollapse: (id: number) => void;
}) {
  const hasKids = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const snippet =
    node.content.length > 46 ? node.content.slice(0, 46) + "…" : node.content;
  const label = DEPTH_LABELS[Math.min(depth, DEPTH_LABELS.length - 1)];

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasKids) onToggle();
          onSelect(node);
        }}
        className={`text-left w-full flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition group ${
          isSelected
            ? "border-orange-400 bg-orange-500/10"
            : depth === 0
              ? "border-red-500/40 bg-red-500/5 hover:border-red-400"
              : "border-gray-700 bg-gray-800/70 hover:border-gray-500"
        }`}
        aria-expanded={hasKids ? !collapsed : undefined}
      >
        <span
          className={`mt-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
            node.side === "A"
              ? "bg-red-500/20 text-red-300"
              : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {SIDE_LABELS[node.side]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500 flex-wrap">
            <span aria-hidden>{node.avatar}</span>
            <span className="text-gray-400">{node.username}</span>
            <span>· {label} · 第{node.round}轮</span>
            {hasKids && (
              <span className="text-gray-600">
                （{node.children.length} 条交锋）
              </span>
            )}
          </span>
          <span
            className={`block text-sm leading-snug mt-0.5 ${
              isSelected ? "text-orange-100" : "text-gray-200 group-hover:text-gray-100"
            }`}
          >
            {snippet}
          </span>
        </span>
        {hasKids && (
          <span className="shrink-0 text-gray-500 text-xs mt-1" aria-hidden>
            {collapsed ? "▸" : "▾"}
          </span>
        )}
      </button>

      {!collapsed &&
        node.children.map((child) => (
          <div key={child.id} className="ml-6 pl-5 mt-1.5 border-l-2 border-gray-700/60">
            <NodeRow
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsed={collapsedSet.has(child.id)}
              onToggle={() => onToggleCollapse(child.id)}
              collapsedSet={collapsedSet}
              onToggleCollapse={onToggleCollapse}
            />
          </div>
        ))}
    </div>
  );
}

function ArgumentTree({
  debateId,
  speechCount,
}: {
  debateId: string;
  speechCount: number;
}) {
  const [roots, setRoots] = useState<ArgumentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ArgumentNode | null>(null);
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());

  const toggleCollapse = (id: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const tree = await api.getArgumentMap(debateId);
      setRoots(tree);
      setSelected((prev) => prev || tree[0] || null);
    } catch (e) {
      setError(errMsg(e, "加载辩论树失败"));
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    load();
  }, [load, speechCount]);

  if (loading) return <Loading text="正在推导论证链路…" />;
  if (error)
    return (
      <div className="text-red-300 text-sm bg-red-500/10 rounded-lg p-4">{error}</div>
    );
  if (roots.length === 0) {
    return (
      <div className="text-center text-gray-500 py-14 bg-gray-800/40 rounded-xl border border-dashed border-gray-700">
        <div className="text-4xl mb-2" aria-hidden>
          🌳
        </div>
        暂无发言，无法生成辩论树
        <div className="text-xs mt-1">辩手发言后，系统将自动推导论点与反驳链路</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="text-xs text-gray-400 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>🌳 辩论树（A-04）：</span>
        {DEPTH_LABELS.map((l, i) => (
          <span key={l}>
            {i > 0 && "→ "}
            {l}
          </span>
        ))}
        <span className="text-gray-600">｜点击节点可查看全文，点击 ▾ 展开交锋</span>
      </div>
      <div className="space-y-2">
        {roots.map((n) => (
          <NodeRow
            key={n.id}
            node={n}
            depth={0}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            collapsed={collapsedSet.has(n.id)}
            onToggle={() => toggleCollapse(n.id)}
            collapsedSet={collapsedSet}
            onToggleCollapse={toggleCollapse}
          />
        ))}
      </div>
      {selected && (
        <div
          className="mt-4 rounded-xl bg-gray-900/70 border border-gray-700 p-4"
          aria-live="polite"
        >
          <div className="text-[11px] text-gray-500 mb-2 flex items-center gap-2 flex-wrap">
            <span aria-hidden>{selected.avatar}</span>
            <b className="text-gray-300">{selected.username}</b>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                selected.side === "A"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {SIDE_LABELS[selected.side]}
            </span>
            <span>第 {selected.round} 轮发言</span>
            <span className="ml-auto">
              {new Date(selected.created_at).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
            {selected.content}
          </p>
        </div>
      )}
    </div>
  );
}

export default ArgumentTree;
