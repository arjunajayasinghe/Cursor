"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type FieldMismatch,
  type ImportBatch,
  type IntegrationItem,
  type IntegrationPreview,
  type SyncJob,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function IntegrationsPage() {
  const { canView, canEdit, role } = useAuth();
  const editable = canEdit("integrations");
  const [rows, setRows] = useState<IntegrationItem[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [openMismatches, setOpenMismatches] = useState<FieldMismatch[]>([]);
  const [selected, setSelected] = useState<string>("sap_pr_tsv");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<IntegrationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!canView("integrations")) return;
    const [list, hist, jobs, mismatches] = await Promise.all([
      api.integrationsList(),
      api.integrationBatches(selected || ""),
      api.syncJobs(),
      api.mismatches("", "", "open"),
    ]);
    setRows(list);
    setBatches(hist);
    setSyncJobs(jobs);
    setOpenMismatches(mismatches);
    if (!selected && list[0]) setSelected(list[0].key);
  }, [canView, selected]);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh, role]);

  const current = rows.find((r) => r.key === selected);

  async function runAnalyze() {
    setBusy(true);
    setError(null);
    try {
      const body =
        base64 && fileName
          ? {
              base64,
              fileName,
              formatHint: fileName.endsWith(".xlsx") || fileName.endsWith(".xls") ? "xlsx" : undefined,
              text: text || undefined,
            }
          : { text };
      const result = editable
        ? await api.integrationAnalyze(selected, body)
        : await api.integrationPreview(selected, body);
      setPreview(result);
      await refresh();
      setToast(`Preview batch ${result.batchId?.slice(0, 8) || ""} · +${result.createCount || 0}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runReconcile() {
    if (!preview?.batchId) return;
    setBusy(true);
    try {
      const saved = await api.integrationReconcile(preview.batchId);
      setToast(
        `Reconciled +${saved.createdCount} / ~${saved.updatedCount} / skip ${saved.skippedCount} / mismatch ${saved.mismatchCount}`,
      );
      setPreview(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canView("integrations")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        Integration register is restricted.
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
          Administration
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Integration register</h1>
        <p className="mt-2 max-w-3xl text-[13px] text-sub">
          Phase 2 CSV/XLSX import plus Phase 3 API sync jobs (sample runner) and Phase 4 open field
          mismatches. Field source priority (S/W/A/E/M) keeps operational notes web-owned. Import
          batches stay immutable after reconcile.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <div className="mb-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-3 py-2.5 text-sm font-semibold">Connectors</div>
          <div className="divide-y divide-[#e8eef5]">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`block w-full px-3 py-2.5 text-left text-xs hover:bg-[#f7fbff] ${
                  selected === r.key ? "bg-[#eef6ff]" : ""
                }`}
                onClick={() => {
                  setSelected(r.key);
                  setPreview(null);
                  setText("");
                  setBase64(null);
                  setFileName(null);
                }}
              >
                <div className="font-semibold">{r.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-muted">{r.channel}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-panel border border-line bg-white p-4 shadow-panel">
          {current ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[17px] font-semibold">{current.name}</h2>
                  <p className="text-[12px] text-sub">{current.description}</p>
                  {current.lastResult ? (
                    <p className="mt-1 text-[11px] text-muted">Last: {current.lastResult}</p>
                  ) : null}
                </div>
                {editable ? (
                  <Button
                    onClick={async () => {
                      const next = current.status === "stub" ? "configured" : current.status === "configured" ? "active" : "stub";
                      const saved = await api.integrationPatch(current.key, { status: next });
                      setRows((prev) => prev.map((r) => (r.key === saved.key ? saved : r)));
                      setToast(`Status → ${saved.status}`);
                    }}
                  >
                    Cycle status
                  </Button>
                ) : null}
              </div>

              <div className="mb-4 rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
                Field source priority:{" "}
                {current.fieldPriority
                  ? Object.entries(current.fieldPriority)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ")
                  : "—"}
              </div>

              <label className="mb-2 block text-xs font-semibold text-[#465d74]">
                Upload CSV / TSV / XLSX
                <input
                  className="mt-1 block w-full text-xs"
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileName(file.name);
                    if (file.name.match(/\.xlsx?$/i)) {
                      setBase64(await fileToBase64(file));
                      setText("");
                    } else {
                      setBase64(null);
                      setText(await file.text());
                    }
                  }}
                />
              </label>

              <label className="mb-2 block text-xs font-semibold text-[#465d74]">
                Or paste CSV/TSV
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-[5px] border border-[#cdd8e4] p-2 font-mono text-[11px]"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setBase64(null);
                    setFileName(null);
                  }}
                  placeholder={"Header row + data…"}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy || (!text && !base64)} onClick={runAnalyze}>
                  {busy ? "Working…" : "Validate / preview"}
                </Button>
                {editable && preview?.batchId ? (
                  <Button disabled={busy || (preview.errors && preview.errors.length > 0)} onClick={runReconcile}>
                    Reconcile batch
                  </Button>
                ) : null}
              </div>

              {preview ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      ["Rows", preview.rowCount ?? preview.preview.length],
                      ["Create", preview.createCount ?? 0],
                      ["Update", preview.updateCount ?? 0],
                      ["Skip", preview.skipCount ?? 0],
                      ["Mismatch", preview.mismatchCount ?? 0],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-md border border-line px-2 py-1.5 text-center">
                        <div className="text-[10px] uppercase text-muted">{label}</div>
                        <strong className="text-sm">{value}</strong>
                      </div>
                    ))}
                  </div>
                  {preview.errors?.length ? (
                    <ul className="list-disc pl-4 text-[11px] text-red-ink">
                      {preview.errors.slice(0, 8).map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.plan?.some((p) => p.mismatches?.length) ? (
                    <div className="rounded-md border border-[#f0e0c8] bg-[#fff8ef] p-2 text-[11px]">
                      <div className="mb-1 font-semibold">Field mismatches (priority applied)</div>
                      {preview.plan
                        .flatMap((p) => p.mismatches.map((m) => ({ ...m, key: p.key })))
                        .slice(0, 12)
                        .map((m, i) => (
                          <div key={`${m.key}-${m.field}-${i}`}>
                            {m.key} · {m.field}: “{m.existing}” → “{m.incoming}” ({m.action})
                          </div>
                        ))}
                    </div>
                  ) : null}
                  <div className="overflow-auto rounded-md border border-line">
                    <table className="w-full min-w-[480px] text-left text-[11px]">
                      <thead className="bg-[#f6f8fb]">
                        <tr>
                          {preview.headers.map((h) => (
                            <th key={h} className="px-2 py-1.5 font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row, i) => (
                          <tr key={i} className="border-t border-[#e8eef5]">
                            {preview.headers.map((h) => (
                              <td key={h} className="px-2 py-1.5">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sub">Select a connector.</p>
          )}
        </section>
      </div>

      <section className="mb-4 rounded-panel border border-line bg-white shadow-panel">
        <div className="border-b border-[#e7edf4] px-4 py-2.5 text-sm font-semibold">
          Phase 3 · scheduled API sync
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {["Job", "Connector", "Schedule", "SAP client", "Status", "Last / next", "Runs", ""].map((h) => (
                  <th key={h || "actions"} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncJobs.map((job) => (
                <tr key={job.id} className="border-t border-[#e8eef5]">
                  <td className="px-3 py-2 font-semibold">{job.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{job.integrationKey}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{job.schedule}</td>
                  <td className="px-3 py-2">{job.sapClient || "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={job.enabled ? job.status : "paused"} />
                  </td>
                  <td className="px-3 py-2 text-muted">
                    <div>{job.lastResult || job.lastError || "—"}</div>
                    <div className="text-[10px]">
                      {job.lastRunAt
                        ? `Last ${String(job.lastRunAt).replace("T", " ").slice(0, 19)}`
                        : "Never run"}
                      {job.nextRunAt
                        ? ` · next ${String(job.nextRunAt).replace("T", " ").slice(0, 19)}`
                        : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">{job.runCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {editable ? (
                        <>
                          <Button
                            disabled={busy || !job.enabled}
                            onClick={async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                const saved = await api.syncJobRun(job.id);
                                setToast(saved.lastResult || "Sync finished");
                                await refresh();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Run now
                          </Button>
                          <Button
                            onClick={async () => {
                              await api.syncJobPatch(job.id, { enabled: !job.enabled });
                              await refresh();
                            }}
                          >
                            {job.enabled ? "Pause" : "Enable"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!syncJobs.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sub">
                    No sync jobs seeded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-panel border border-line bg-white shadow-panel">
        <div className="border-b border-[#e7edf4] px-4 py-2.5 text-sm font-semibold">
          Phase 4 · open field mismatches
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {["Module", "Record", "Field", "Existing", "Incoming", "Preferred", ""].map((h) => (
                  <th key={h || "act"} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openMismatches.map((m) => (
                <tr key={m.id} className="border-t border-[#e8eef5]">
                  <td className="px-3 py-2">{m.moduleKey}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{m.recordId}</td>
                  <td className="px-3 py-2 font-semibold">{m.field}</td>
                  <td className="px-3 py-2">{m.existingValue || "—"}</td>
                  <td className="px-3 py-2 text-[#9a5c12]">{m.incomingValue || "—"}</td>
                  <td className="px-3 py-2">{m.preferredSource}</td>
                  <td className="px-3 py-2">
                    {editable ? (
                      <Button
                        onClick={async () => {
                          await api.mismatchPatch(m.id, { status: "resolved" });
                          setToast(`Resolved ${m.moduleKey}/${m.field}`);
                          await refresh();
                        }}
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!openMismatches.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sub">
                    No open mismatches — drawers stay clean until sync/import conflicts appear.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="border-b border-[#e7edf4] px-4 py-2.5 text-sm font-semibold">
          Import history (immutable)
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {["Batch", "Connector", "Status", "File", "Actor", "Rows", "+ / ~ / skip", "Mismatch", "When"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-bold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-[#e8eef5]">
                  <td className="px-3 py-2 font-mono text-[11px]">{b.id.slice(0, 10)}</td>
                  <td className="px-3 py-2">{b.integrationKey}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2">{b.fileName || b.format}</td>
                  <td className="px-3 py-2">{b.actor}</td>
                  <td className="px-3 py-2">{b.rowCount}</td>
                  <td className="px-3 py-2">
                    {b.createdCount} / {b.updatedCount} / {b.skippedCount}
                  </td>
                  <td className="px-3 py-2">{b.mismatchCount}</td>
                  <td className="px-3 py-2 text-muted">
                    {String(b.reconciledAt || b.createdAt).replace("T", " ").slice(0, 19)}
                  </td>
                </tr>
              ))}
              {!batches.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sub">
                    No import batches yet — validate a file to create a preview batch.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white">{toast}</div>
      ) : null}
    </div>
  );
}
