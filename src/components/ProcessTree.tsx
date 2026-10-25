"use client";

import { useMemo, useState } from "react";

export type ProcessNodeDTO = {
  id: string;
  code: string;
  name: string;
  description: string;
  level: number;
  parentId: string | null;
  valueStreamId: string | null;
  isHidden: boolean;
  masterNodeId: string | null;
};

type TreeNode = ProcessNodeDTO & { children: TreeNode[] };

function buildTree(nodes: ProcessNodeDTO[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.id, { ...n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    list.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q.trim()) return nodes;
  const needle = q.trim().toLowerCase();
  const walk = (list: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const n of list) {
      const kids = walk(n.children);
      const match =
        n.code.toLowerCase().includes(needle) ||
        n.name.toLowerCase().includes(needle) ||
        n.description.toLowerCase().includes(needle);
      if (match || kids.length) out.push({ ...n, children: kids });
    }
    return out;
  };
  return walk(nodes);
}

type Props = {
  nodes: ProcessNodeDTO[];
  selectedId: string | null;
  onSelect: (node: ProcessNodeDTO) => void;
  editableIds?: Set<string> | null;
  search: string;
};

export function ProcessTree({ nodes, selectedId, onSelect, editableIds, search }: Props) {
  const tree = useMemo(() => filterTree(buildTree(nodes), search), [nodes, search]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const render = (list: TreeNode[], depth = 0) =>
    list.map((n) => {
      const hasKids = n.children.length > 0;
      const isCollapsed = collapsed[n.id];
      const selected = selectedId === n.id;
      const inScope = !editableIds || editableIds.has(n.id);
      return (
        <li key={n.id} className="select-none">
          <div
            className={`group flex items-start gap-1 rounded-md px-2 py-1.5 ${
              selected ? "bg-[var(--accent-soft)]" : "hover:bg-black/[0.03]"
            } ${n.isHidden ? "opacity-50" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            <button
              type="button"
              aria-label={hasKids ? (isCollapsed ? "Expand" : "Collapse") : "Leaf"}
              className={`mt-0.5 h-5 w-5 shrink-0 rounded text-xs text-[var(--muted)] ${
                hasKids ? "hover:bg-black/5" : "invisible"
              }`}
              onClick={() => hasKids && toggle(n.id)}
            >
              {hasKids ? (isCollapsed ? "▸" : "▾") : "·"}
            </button>
            <button
              type="button"
              onClick={() => onSelect(n)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-xs text-[var(--muted)]">{n.code}</span>
                <span className="text-sm font-medium text-[var(--fg)]">{n.name}</span>
                {n.isHidden && (
                  <span className="rounded bg-black/5 px-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    hidden
                  </span>
                )}
                {editableIds && inScope && (
                  <span className="rounded bg-[var(--accent-soft)] px-1.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
                    editable
                  </span>
                )}
              </div>
            </button>
          </div>
          {hasKids && !isCollapsed && <ul>{render(n.children, depth + 1)}</ul>}
        </li>
      );
    });

  if (!tree.length) {
    return (
      <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
        No processes match your search.
      </p>
    );
  }

  return <ul className="py-1">{render(tree)}</ul>;
}
