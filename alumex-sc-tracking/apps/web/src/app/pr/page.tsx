"use client";

import { ChevronRight, Download, Plus, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  PR_FIELDS,
  PR_REPORT_COLUMNS,
  type FieldMismatch,
  type PrGroup,
  type PrImportPreview,
  type PrItem,
} from "@/lib/api";
import { FieldGrid } from "@/components/field-grid";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ExcelDeltaUpload } from "@/components/excel-delta-upload";
import { HistoryPanel } from "@/components/history-panel";
import { StatusTransition } from "@/components/status-transition";

export default function PrPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("pr");
  const [groups, setGroups] = useState<PrGroup[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reportMode, setReportMode] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<PrItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<PrImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mismatches, setMismatches] = useState<FieldMismatch[]>([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = await api.prGroups(q, status);
      // Normalize incomplete sample/backend payloads so the table never throws.
      setGroups(
        (Array.isArray(rows) ? rows : []).map((g) => ({
          ...g,
          prNo: g.prNo || "—",
          lineCount: g.lineCount ?? g.lines?.length ?? 0,
          quantity: g.quantity ?? 0,
          statuses: Array.isArray(g.statuses)
            ? g.statuses
            : Array.from(new Set((g.lines || []).map((l) => l.status).filter(Boolean) as string[])),
          lines: Array.isArray(g.lines) ? g.lines : [],
        })),
      );
    } catch (e) {
      setError((e as Error).message);
      setGroups([]);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!selected?.recordId) {
      setMismatches([]);
      return;
    }
    let cancelled = false;
    api
      .mismatches("pr", selected.recordId, "open")
      .then((rows) => {
        if (!cancelled) setMismatches(rows);
      })
      .catch(() => {
        if (!cancelled) setMismatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.recordId]);

  const statuses = useMemo(
    () => Array.from(new Set(groups.flatMap((g) => g.statuses || []))).sort(),
    [groups],
  );

  async function analyzeFile(file: File) {
    setImportBusy(true);
    setImportError(null);
    setPreview(null);
    try {
      const text = await file.text();
      setImportText(text);
      const result = await api.prAnalyzeImport(text);
      setPreview(result);
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  }

  async function commitImport() {
    if (!importText) return;
    setImportBusy(true);
    try {
      const result = await api.prCommitImport(importText);
      setToast(`Imported ${result.created} items · filled ${result.plantsFilled} plants`);
      setImportOpen(false);
      setPreview(null);
      setImportText("");
      await load();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Module 01 · Procurement
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Purchase requisitions</h1>
          <p className="mt-2 text-[13px] text-sub">
            One summary row per PR. Expand the number for line items, toggle report columns, or open an item for
            full details with source tags.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <Button onClick={() => setImportOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Import SAP PR file
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  setSelected({
                    id: "",
                    recordId: "",
                    prNo: "",
                    line: "00010",
                    quantity: 1,
                    status: "Draft",
                    priority: "Normal",
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> New line
              </Button>
            </>
          ) : (
            <span className="rounded-[5px] border border-line bg-[#f6f8fb] px-2 py-1 text-[11px] text-muted">
              View only
            </span>
          )}
        </div>
      </div>

      <ExcelDeltaUpload kind="pr" onApplied={() => void load()} />

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input
              className="min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] bg-white py-2 pl-8 pr-3 text-sm"
              placeholder="Search PR, material, plant…"
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
          <span className="ml-auto text-[11px] text-muted">{groups.length} PR groups</span>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">PR number</th>
                <th className="px-3.5 py-2.5 font-bold">Date</th>
                <th className="px-3.5 py-2.5 font-bold">Requester</th>
                <th className="px-3.5 py-2.5 font-bold">Plant</th>
                <th className="px-3.5 py-2.5 font-bold">Material</th>
                <th className="px-3.5 py-2.5 font-bold">Lines</th>
                <th className="px-3.5 py-2.5 font-bold">Priority</th>
                <th className="px-3.5 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = !!expanded[g.prNo];
                const full = !!reportMode[g.prNo];
                return (
                  <Fragment key={g.prNo}>
                    <tr className="border-t border-[#e8eef5] hover:bg-[#fafcff]">
                      <td className="px-3.5 py-2.5">
                        <button
                          className="inline-flex min-h-[30px] items-center gap-1.5 font-bold text-[#075bb3]"
                          aria-expanded={open}
                          onClick={() => setExpanded((s) => ({ ...s, [g.prNo]: !open }))}
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                          {g.prNo}
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 tabular-nums">{g.date || "—"}</td>
                      <td className="px-3.5 py-2.5">{g.requester || "—"}</td>
                      <td className="px-3.5 py-2.5">{g.plant || "—"}</td>
                      <td className="px-3.5 py-2.5">{g.material || "—"}</td>
                      <td className="px-3.5 py-2.5 tabular-nums">{g.lineCount}</td>
                      <td className="px-3.5 py-2.5">{g.priority || "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(g.statuses || []).map((s) => (
                            <StatusBadge key={s} status={s} />
                          ))}
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-[#e8eef5]">
                        <td colSpan={8} className="bg-[#f3f7fc] p-0">
                          <div className="sticky left-0 w-full p-3 pl-4 shadow-[inset_3px_0_#4391dc]">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <strong>
                                {g.lineCount} {g.lineCount === 1 ? "line item" : "line items"}
                              </strong>
                              <Button
                                size="sm"
                                aria-pressed={full}
                                className={cn(full && "border-[#a5c9ee] bg-blue-soft")}
                                onClick={() => setReportMode((s) => ({ ...s, [g.prNo]: !full }))}
                              >
                                Report columns
                              </Button>
                            </div>
                            <div className="overflow-auto rounded-md border border-line bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-[#f6f8fb] text-[#52657b]">
                                  <tr>
                                    {(full
                                      ? PR_REPORT_COLUMNS
                                      : [
                                          { key: "line", label: "Line" },
                                          { key: "materialCode", label: "Material" },
                                          { key: "material", label: "Description" },
                                          { key: "quantity", label: "Qty" },
                                          { key: "uom", label: "UoM" },
                                          { key: "need", label: "Need by" },
                                          { key: "status", label: "Status" },
                                        ]
                                    ).map((c) => (
                                      <th key={c.key} className="whitespace-nowrap px-2.5 py-2 font-bold">
                                        {c.label}
                                      </th>
                                    ))}
                                    <th className="px-2.5 py-2 font-bold">Open</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(g.lines || []).map((line) => (
                                    <tr key={line.id} className="border-t border-[#e8eef5] hover:bg-[#fafcff]">
                                      {(full
                                        ? PR_REPORT_COLUMNS
                                        : [
                                            { key: "line", label: "Line" },
                                            { key: "materialCode", label: "Material" },
                                            { key: "material", label: "Description" },
                                            { key: "quantity", label: "Qty" },
                                            { key: "uom", label: "UoM" },
                                            { key: "need", label: "Need by" },
                                            { key: "status", label: "Status" },
                                          ]
                                      ).map((c) => (
                                        <td key={c.key} className="whitespace-nowrap px-2.5 py-2">
                                          {c.key === "status" ? (
                                            <StatusBadge status={line.status} />
                                          ) : (
                                            String((line as Record<string, unknown>)[c.key] ?? "—")
                                          )}
                                        </td>
                                      ))}
                                      <td className="px-2.5 py-2">
                                        <button
                                          className="font-bold text-[#075bb3] hover:underline"
                                          onClick={() => setSelected(line)}
                                        >
                                          Details
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!groups.length && !error ? <p className="p-8 text-center text-sub">No purchase requisitions found.</p> : null}
        </div>
      </section>

      <Drawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        eyebrow="Purchase requisition line"
        title={
          selected?.prNo
            ? `${selected.prNo} / ${selected.line}`
            : selected?.id
              ? selected.recordId
              : "New PR line"
        }
        subtitle={selected?.material || "Capture SAP PR identity and operational fields"}
        wide
        footer={
          <>
            <Button onClick={() => setSelected(null)}>Close</Button>
            {editable ? (
              <Button
                variant="primary"
                onClick={async () => {
                  if (!selected) return;
                  try {
                    if (!selected.id) {
                      await api.prCreate({
                        ...selected,
                        prNo: selected.prNo || `10000${Date.now().toString().slice(-5)}`,
                        line: selected.line || "00010",
                        quantity: Number(selected.quantity || 1),
                        requester: selected.requester || "Demo requester",
                        department: selected.department || "Manufacturing",
                        plant: selected.plant || "1100 · Sapugaskanda",
                        material: selected.material || "New material",
                        uom: selected.uom || "EA",
                        buyer: selected.buyer || "A. Jayasinghe",
                      });
                      setToast("PR line created");
                    } else {
                      await api.prUpdate(selected.id, selected);
                      setToast("PR line updated");
                    }
                    setSelected(null);
                    await load();
                  } catch (e) {
                    setToast((e as Error).message);
                  }
                }}
              >
                Save
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
              Role permissions apply via X-Demo-Role. Source tags (S/W/A/E/M) mark field origin.
            </div>
            {!selected.id ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["prNo", "SAP PR number"],
                  ["line", "PR line"],
                  ["material", "Material description"],
                  ["quantity", "Quantity"],
                  ["uom", "UoM"],
                  ["plant", "Plant"],
                  ["requester", "Requester"],
                  ["buyer", "Buyer"],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-[#465d74]">
                    {label}
                    <input
                      className="mt-1 min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] px-2 font-normal text-ink"
                      value={String((selected as Record<string, unknown>)[key] ?? "")}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          [key]: key === "quantity" ? Number(e.target.value) : e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <>
                <FieldGrid
                  fields={PR_FIELDS}
                  values={selected as unknown as Record<string, unknown>}
                  mismatches={mismatches}
                />
                {selected.recordId ? (
                  <>
                    <StatusTransition
                      moduleKey="pr"
                      recordId={selected.recordId}
                      onChanged={(status) => setSelected({ ...selected, status })}
                    />
                    <AttachmentsPanel moduleKey="pr" category="pr" recordId={selected.recordId} />
                    <HistoryPanel moduleKey="pr" recordId={selected.recordId} />
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={importOpen}
        onOpenChange={setImportOpen}
        eyebrow="Purchase requisitions"
        title="Import SAP PR file"
        subtitle="Accepts tab-separated .txt / .tsv using the Report worksheet columns (pr-import stub)."
        footer={
          <>
            <Button onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!preview || !!preview.errors.length || importBusy}
              onClick={commitImport}
            >
              {preview?.records.length ? `Import ${preview.records.length} items` : "Import"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
            Required columns include Purch.Req., Item, Material, Short Text, Un, Quantity, Req.Date and the other
            SAP Report fields from the GUI handoff. Existing PR/line pairs are skipped.
          </div>
          <label className="block text-xs font-semibold text-[#465d74]">
            PR report (.txt or .tsv)
            <input
              type="file"
              accept=".txt,.tsv,text/plain,text/tab-separated-values"
              className="mt-1 block w-full text-sm font-normal"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void analyzeFile(file);
              }}
            />
          </label>
          {importBusy ? <p className="text-xs text-sub">Analyzing…</p> : null}
          {importError ? <p className="text-xs text-red-ink">{importError}</p> : null}
          {preview ? (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-md border border-line p-3">
                <div className="text-muted">New items</div>
                <strong className="text-lg">{preview.records.length}</strong>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-muted">PR groups</div>
                <strong className="text-lg">{preview.groups}</strong>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-muted">Duplicates</div>
                <strong className="text-lg">{preview.duplicates}</strong>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-muted">Errors</div>
                <strong className="text-lg">{preview.errors.length}</strong>
              </div>
              {preview.errors.length ? (
                <ul className="col-span-full space-y-1 rounded-md border border-red-soft bg-red-soft p-3 text-red-ink">
                  {preview.errors.slice(0, 8).map((err) => (
                    <li key={`${err.line}-${err.message}`}>
                      Line {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </Drawer>

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 max-w-[90vw] rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
