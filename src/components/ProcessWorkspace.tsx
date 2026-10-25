"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProcessTree, type ProcessNodeDTO } from "./ProcessTree";

type ValueStream = { id: string; code: string; name: string };
type Company = { id: string; name: string; slug: string };
type Assignment = {
  id: string;
  companyId: string;
  masterNodeId: string;
  masterNode: { code: string; name: string };
  company: { name: string };
};

type Props = {
  mode: "master" | "company";
  nodes: ProcessNodeDTO[];
  valueStreams: ValueStream[];
  companies?: Company[];
  assignments?: Assignment[];
  canEdit: boolean;
  canAdmin: boolean;
  canUpload: boolean;
  canAssign: boolean;
  canExport: boolean;
  areaScopeNodeIds: string[] | null;
  companyName?: string | null;
  companyId?: string | null;
};

export function ProcessWorkspace(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignCompanyId, setAssignCompanyId] = useState(props.companies?.[0]?.id ?? "");
  const [uploadBusy, setUploadBusy] = useState(false);

  const selected = props.nodes.find((n) => n.id === selectedId) ?? null;

  const editableIds = useMemo(() => {
    if (!props.areaScopeNodeIds) return null;
    // Expand scope to descendants client-side
    const byParent = new Map<string, string[]>();
    for (const n of props.nodes) {
      if (!n.parentId) continue;
      const list = byParent.get(n.parentId) ?? [];
      list.push(n.id);
      byParent.set(n.parentId, list);
    }
    const set = new Set<string>();
    const stack = [...props.areaScopeNodeIds];
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      for (const c of byParent.get(id) ?? []) stack.push(c);
    }
    return set;
  }, [props.areaScopeNodeIds, props.nodes]);

  const canEditSelected =
    !!selected &&
    props.canEdit &&
    (!editableIds || editableIds.has(selected.id));

  async function saveSelected(patch: Partial<ProcessNodeDTO>) {
    if (!selected) return;
    setError(null);
    setMessage(null);
    const res = await fetch("/api/processes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved");
    startTransition(() => router.refresh());
  }

  async function assignSelected() {
    if (!selected || !assignCompanyId) return;
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: assignCompanyId, masterNodeId: selected.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Assign failed");
      return;
    }
    setMessage(`Assigned ${selected.code} (+ subtree) — ${data.copied ?? 0} nodes`);
    startTransition(() => router.refresh());
  }

  async function onUpload(file: File) {
    setUploadBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/processes/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setMessage(`Upload complete: ${data.created} created, ${data.updated} updated`);
      startTransition(() => router.refresh());
    } finally {
      setUploadBusy(false);
    }
  }

  const vsName = (id: string | null) =>
    props.valueStreams.find((v) => v.id === id)?.name ?? "—";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <section className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-xl text-[var(--fg)]">
              {props.mode === "master"
                ? "Aetria Solution — Master library"
                : props.companyName ?? "Company processes"}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {props.mode === "master"
                ? "Full APQC-style taxonomy. Upload at AS level, then push branches to companies."
                : "Assigned processes only. Area editors can edit scoped branches."}
            </p>
          </div>
          <input
            type="search"
            placeholder="Search code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] sm:w-56"
          />
          {props.canExport && props.companyId && (
            <a
              href={`/api/export?companyId=${props.companyId}`}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              Export Excel (stub)
            </a>
          )}
        </header>

        {(message || error) && (
          <div
            className={`border-b px-4 py-2 text-sm ${
              error
                ? "border-red-100 bg-red-50 text-[var(--danger)]"
                : "border-amber-100 bg-[var(--warn-soft)] text-[var(--warn)]"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          <ProcessTree
            nodes={props.nodes}
            selectedId={selectedId}
            onSelect={(n) => {
              setSelectedId(n.id);
              setMessage(null);
              setError(null);
            }}
            editableIds={editableIds}
            search={search}
          />
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-96">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Details</h2>
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a process in the tree.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Code</div>
                <div className="font-mono text-sm">{selected.code}</div>
              </div>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Name</span>
                <input
                  key={selected.id + "-name"}
                  defaultValue={selected.name}
                  disabled={!canEditSelected || pending}
                  className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 disabled:bg-black/[0.03]"
                  onBlur={(e) => {
                    if (e.target.value !== selected.name) void saveSelected({ name: e.target.value });
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Description
                </span>
                <textarea
                  key={selected.id + "-desc"}
                  defaultValue={selected.description}
                  disabled={!canEditSelected || pending}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5 disabled:bg-black/[0.03]"
                  onBlur={(e) => {
                    if (e.target.value !== selected.description)
                      void saveSelected({ description: e.target.value });
                  }}
                />
              </label>
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Value stream
                </div>
                {canEditSelected && props.canAdmin ? (
                  <select
                    key={selected.id + "-vs"}
                    defaultValue={selected.valueStreamId ?? ""}
                    className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5"
                    onChange={(e) =>
                      void saveSelected({
                        valueStreamId: e.target.value || null,
                      } as Partial<ProcessNodeDTO>)
                    }
                  >
                    <option value="">Unassigned</option>
                    {props.valueStreams.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm">{vsName(selected.valueStreamId)}</div>
                )}
              </div>
              {props.canAdmin && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.isHidden}
                    disabled={pending}
                    onChange={(e) => void saveSelected({ isHidden: e.target.checked })}
                  />
                  Hidden in company map
                </label>
              )}
              {!canEditSelected && props.canEdit && (
                <p className="text-xs text-[var(--warn)]">
                  Outside your area scope — view only.
                </p>
              )}
            </div>
          )}
        </div>

        {props.canUpload && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">
              Bulk upload (AS)
            </h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              CSV or Excel. Columns: <code>code</code>, <code>name</code>, optional{" "}
              <code>description</code>, <code>parentCode</code>, <code>valueStream</code>.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              disabled={uploadBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
              className="block w-full text-sm"
            />
          </div>
        )}

        {props.canAssign && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">
              Assign / push to company
            </h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Copies the selected master node and its subtree into the company workspace.
            </p>
            <select
              value={assignCompanyId}
              onChange={(e) => setAssignCompanyId(e.target.value)}
              className="mb-2 w-full rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
            >
              {(props.companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selected || !assignCompanyId || pending}
              onClick={() => void assignSelected()}
              className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-40"
            >
              Push selected branch
            </button>
            {!!props.assignments?.length && (
              <div className="mt-3 max-h-40 overflow-auto border-t border-[var(--border)] pt-2">
                <div className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">
                  Recent assignments
                </div>
                <ul className="space-y-1 text-xs text-[var(--muted)]">
                  {props.assignments.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      {a.masterNode.code} → {a.company.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {props.canExport && (
          <div className="rounded-xl border border-dashed border-[var(--warn)] bg-[var(--warn-soft)] p-4 text-sm text-[var(--warn)]">
            <strong>Export is a stub.</strong> Value-stream-grouped Excel uses placeholder
            columns until the client template is provided. See README.
          </div>
        )}
      </aside>
    </div>
  );
}
