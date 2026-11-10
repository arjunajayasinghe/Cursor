"use client";

import { useEffect, useState } from "react";
import { api, type IntegrationItem, type IntegrationPreview } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

export default function IntegrationsPage() {
  const { canView, canEdit, role } = useAuth();
  const editable = canEdit("integrations");
  const [rows, setRows] = useState<IntegrationItem[]>([]);
  const [selected, setSelected] = useState<string>("sap_pr_tsv");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<IntegrationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!canView("integrations")) return;
    api
      .integrationsList()
      .then((list) => {
        setRows(list);
        if (list[0]) setSelected(list[0].key);
      })
      .catch((e) => setError(e.message));
  }, [canView, role]);

  const current = rows.find((r) => r.key === selected);

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
          Stubs for future SAP CSV/XLSX connectors with field source priority (S/W/A/E/M). Phase 1 supports
          validate/preview; PR commit remains on the Purchase requisitions import path.
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
                </div>
                {editable ? (
                  <Button
                    onClick={async () => {
                      const next = current.status === "stub" ? "configured" : "stub";
                      const saved = await api.integrationPatch(current.key, { status: next });
                      setRows((prev) => prev.map((r) => (r.key === saved.key ? saved : r)));
                      setToast(`Status → ${saved.status}`);
                    }}
                  >
                    Toggle stub/configured
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
                Paste CSV/TSV sample for preview
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-[5px] border border-[#cdd8e4] p-2 font-mono text-[11px]"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={"PR\tItem\tMaterial\n100002481\t00010\tDemo"}
                />
              </label>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    setPreview(await api.integrationPreview(selected, text));
                  } catch (e) {
                    setToast((e as Error).message);
                  }
                }}
              >
                Validate / preview
              </Button>

              {preview ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs text-sub">
                    {preview.rowCount ?? preview.preview.length} rows · duplicates in sample:{" "}
                    {(preview.duplicateKeys || []).length}
                    {preview.note ? ` · ${preview.note}` : ""}
                  </div>
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

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white">{toast}</div>
      ) : null}
    </div>
  );
}
