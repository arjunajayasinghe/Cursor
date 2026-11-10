"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type MonitoringReport } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

const FILTERS = [
  "prNo",
  "poNo",
  "importNo",
  "supplier",
  "plant",
  "material",
  "department",
  "stage",
  "status",
  "vessel",
] as const;

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [overdueOnly, setOverdueOnly] = useState(false);

  async function load(next = filters, overdue = overdueOnly) {
    try {
      setError(null);
      const params: Record<string, string> = { ...next };
      if (overdue) params.overdue = "1";
      setData(await api.monitoringReport(params));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    if (!data) return;
    const body = [
      data.headers.join(","),
      ...data.rows.map((r) =>
        data.headers
          .map((h) => {
            const raw = r[h] == null ? "" : String(r[h]);
            return `"${raw.replaceAll('"', '""')}"`;
          })
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alumex-monitoring.csv";
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
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Master procurement monitoring</h1>
          <p className="mt-2 max-w-3xl text-[13px] text-sub">
            End-to-end spreadsheet-style columns across PR → GRN with filters for plant, supplier, stage, overdue
            and vessel.
          </p>
        </div>
        <Button variant="primary" onClick={exportCsv} disabled={!data?.rows.length}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <section className="mb-4 rounded-panel border border-line bg-white p-3 shadow-panel">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FILTERS.map((key) => (
            <input
              key={key}
              className="rounded-[5px] border border-[#cdd8e4] px-2 py-1.5 text-xs"
              placeholder={key}
              value={filters[key] || ""}
              onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#465d74]">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue / delayed only
          </label>
          <Button
            variant="primary"
            onClick={() => {
              void load(filters, overdueOnly);
            }}
          >
            Apply filters
          </Button>
          <span className="text-[11px] text-muted">
            {data ? `${data.counts.total} rows · ${data.counts.overdue} overdue` : "—"}
          </span>
        </div>
      </section>

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="overflow-auto">
          <table className="w-full min-w-[1400px] text-left text-[11px]">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                {(data?.headers || []).map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((r, i) => (
                <tr key={i} className="border-t border-[#e8eef5]">
                  {(data?.headers || []).map((h) => (
                    <td key={h} className="whitespace-nowrap px-2.5 py-1.5">
                      {h === "overdue" ? (
                        r[h] ? (
                          <StatusBadge status="Overdue" />
                        ) : (
                          "—"
                        )
                      ) : h.toLowerCase().includes("status") ? (
                        <StatusBadge status={String(r[h] || "—")} />
                      ) : (
                        String(r[h] ?? "—").slice(0, 32)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.rows.length ? <p className="p-8 text-center text-sub">No monitoring rows.</p> : null}
        </div>
      </section>
    </div>
  );
}
