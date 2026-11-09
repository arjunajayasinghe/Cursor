"use client";

import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ModuleUiDef } from "@/lib/modules";
import { FieldGrid } from "@/components/field-grid";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

type Row = Record<string, unknown> & { id: string; recordId: string; status: string };

export function ModuleListPage({ def }: { def: ModuleUiDef }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.moduleList(def.apiPath, q, status);
      setRows(data as Row[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [def.apiPath, q, status]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  function openCreate() {
    setCreating(true);
    setSelected({
      id: "",
      recordId: "",
      status: String(def.createDefaults.status || "Draft"),
      ...def.createDefaults,
    } as Row);
  }

  async function save() {
    if (!selected) return;
    try {
      if (!selected.id) {
        await api.moduleCreate(def.apiPath, selected);
        setToast(`${def.noun} created`);
      } else {
        await api.moduleUpdate(def.apiPath, selected.id, selected);
        setToast(`${def.noun} updated`);
      }
      setSelected(null);
      setCreating(false);
      await load();
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            {def.eyebrow}
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">{def.title}</h1>
          <p className="mt-2 max-w-3xl text-[13px] text-sub">{def.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-[5px] border border-[#dae6f2] bg-[#edf3fa] px-2 py-1 text-[11px] font-semibold text-[#365470]">
            {def.owner}
          </span>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New {def.noun}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input
              className="min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] bg-white py-2 pl-8 pr-3 text-sm"
              placeholder={`Search ${def.title.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="min-h-[35px] rounded-[5px] border border-[#cdd8e4] bg-white px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-muted">
            {rows.length} record{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {def.cols.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3.5 py-2.5 font-bold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#e8eef5] hover:bg-[#fafcff]">
                  {def.cols.map((c, i) => (
                    <td key={c.key} className="whitespace-nowrap px-3.5 py-2.5">
                      {c.key === "status" ? (
                        <StatusBadge status={r.status} />
                      ) : i === 0 ? (
                        <button
                          className="font-bold text-[#075bb3] hover:underline"
                          onClick={() => {
                            setCreating(false);
                            setSelected(r);
                          }}
                        >
                          {String(r[c.key] ?? "—")}
                        </button>
                      ) : (
                        String(r[c.key] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error ? (
            <p className="p-8 text-center text-sub">No {def.title.toLowerCase()} records found.</p>
          ) : null}
        </div>
      </section>

      <Drawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setCreating(false);
          }
        }}
        eyebrow={def.title}
        title={
          selected?.recordId ||
          (creating ? `New ${def.noun}` : selected?.id ? String(selected.id) : def.title)
        }
        subtitle={String(selected?.supplier || selected?.material || selected?.vessel || def.subtitle)}
        wide
        footer={
          <>
            <Button
              onClick={() => {
                setSelected(null);
                setCreating(false);
              }}
            >
              Close
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
              Open demo access — permissions deferred. Source tags mark SAP (S), web (W), calculated (A),
              external (E) and master (M) fields.
            </div>
            {creating || !selected.id ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {def.createFields.map((key) => {
                  const field = def.fields.find((f) => f.key === key);
                  return (
                    <label key={key} className="text-xs font-semibold text-[#465d74]">
                      {field?.label || key}
                      {field?.type === "textarea" ? (
                        <textarea
                          className="mt-1 min-h-[70px] w-full rounded-[5px] border border-[#cdd8e4] px-2 font-normal text-ink"
                          value={String(selected[key] ?? "")}
                          onChange={(e) => setSelected({ ...selected, [key]: e.target.value })}
                        />
                      ) : field?.type === "select" && field.options ? (
                        <select
                          className="mt-1 min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] px-2 font-normal text-ink"
                          value={String(selected[key] ?? "")}
                          onChange={(e) => setSelected({ ...selected, [key]: e.target.value })}
                        >
                          {field.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="mt-1 min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] px-2 font-normal text-ink"
                          type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                          value={String(selected[key] ?? "")}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              [key]: field?.type === "number" ? Number(e.target.value) : e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <>
                <FieldGrid fields={def.fields} values={selected} />
                {def.key === "eval" && selected.decisions ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[#334c66]">Review decisions</h3>
                    <div className="space-y-2">
                      {Object.entries(selected.decisions as Record<string, { decision?: string; date?: string; note?: string }>).map(
                        ([role, d]) => (
                          <div
                            key={role}
                            className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-xs"
                          >
                            <div>
                              <strong>{role}</strong>
                              <div className="text-sub">{d.note || "—"}</div>
                            </div>
                            <div className="text-right">
                              <StatusBadge status={d.decision || "Pending"} />
                              <div className="mt-1 text-[11px] text-muted">{d.date || ""}</div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Drawer>

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 max-w-[90vw] rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
