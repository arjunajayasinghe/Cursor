"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type ReportPayload } from "@/lib/api";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPES: Array<{ id: string; label: string }> = [
  { id: "pipeline", label: "Procurement pipeline" },
  { id: "attention", label: "Action and delay report" },
  { id: "cost", label: "Landed cost report" },
  { id: "closure", label: "Receipt and closure report" },
];

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const safe = raw.replace(/^[\s]*[=+\-@]/, (m) => `'${m}`);
  return `"${safe.replaceAll('"', '""')}"`;
}

export default function ReportsPage() {
  const [type, setType] = useState("pipeline");
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    api
      .reports(type)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [type]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (type !== "pipeline") return data.rows;
    if (filter === "all") return data.rows;
    if (filter === "closed") return data.rows.filter((r) => String(r.status).toLowerCase() === "closed");
    return data.rows.filter((r) => String(r.status).toLowerCase() !== "closed");
  }, [data, filter, type]);

  function exportCsv() {
    if (!data) return;
    const keys =
      type === "pipeline"
        ? ["reference", "material", "supplier", "stage", "status", "owner"]
        : type === "attention"
          ? ["reference", "material", "supplier", "stage", "status", "detail"]
          : type === "cost"
            ? ["reference", "site", "quantity", "uom", "landed", "perUnit", "status"]
            : ["reference", "grnNo", "prId", "poId", "plant", "accepted", "quality", "closed", "status"];
    const body = [
      data.headers.join(","),
      ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumex-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Insights
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Reports</h1>
          <p className="mt-2 text-[13px] text-sub">
            Pipeline, action and delay, landed cost and closure views with CSV export.
          </p>
        </div>
        <Button variant="primary" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      {data?.counts?.length ? (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {data.counts.map((c) => (
            <div key={c.key} className="rounded-panel border border-line bg-white px-3 py-2 shadow-panel">
              <div className="text-[11px] text-muted">{c.label}</div>
              <strong className="text-lg tabular-nums">{c.count}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <select
            className="min-h-[35px] rounded-[5px] border border-[#cdd8e4] bg-white px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Report type"
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {type === "pipeline" ? (
            <select
              className="min-h-[35px] rounded-[5px] border border-[#cdd8e4] bg-white px-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Case filter"
            >
              <option value="open">Open cases</option>
              <option value="closed">Closed</option>
              <option value="all">All cases</option>
            </select>
          ) : null}
          <span className="ml-auto text-[11px] text-muted">{rows.length} rows</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {(data?.headers || []).map((h) => (
                  <th key={h} className="whitespace-nowrap px-3.5 py-2.5 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const values =
                  type === "pipeline"
                    ? [r.reference, r.material, r.supplier, r.stage, r.status, r.owner]
                    : type === "attention"
                      ? [r.reference, r.material, r.supplier, r.stage, r.status, r.detail]
                      : type === "cost"
                        ? [r.reference, r.site, r.quantity, r.uom, r.landed, r.perUnit, r.status]
                        : [r.reference, r.grnNo, r.prId, r.poId, r.plant, r.accepted, r.quality, r.closed, r.status];
                return (
                  <tr key={`${String(r.reference)}-${idx}`} className="border-t border-[#e8eef5] hover:bg-[#fafcff]">
                    {values.map((v, i) => (
                      <td key={i} className="whitespace-nowrap px-3.5 py-2.5">
                        {data?.headers[i]?.toLowerCase().includes("status") ? (
                          <StatusBadge status={String(v ?? "")} />
                        ) : (
                          String(v ?? "—")
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length ? <p className="p-8 text-center text-sub">No records available for this report.</p> : null}
        </div>
      </section>
    </div>
  );
}
