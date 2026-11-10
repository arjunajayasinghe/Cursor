"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, LayoutGrid, Ship } from "lucide-react";
import { api, type OverviewData } from "@/lib/api";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const icons = {
  grid: LayoutGrid,
  alert: AlertTriangle,
  ship: Ship,
  check: Check,
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .overview()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Master dashboard
          </div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.85px] text-ink">Overview</h1>
          <p className="mt-2 text-[13px] text-sub">
            Open cases, exceptions, transit and closure across independent procurement modules.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="primary">
            <Link href="/pr">Open requisitions</Link>
          </Button>
          <Button asChild>
            <Link href="/po">Open PO / PI</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-panel border border-red-soft bg-red-soft p-4 text-sm text-red-ink">
          API unavailable: {error}. Start the Nest API on port 4000.
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(data?.kpis || [
          { label: "Open cases", value: "—", detail: "Loading", tone: "blue", icon: "grid" },
          { label: "Exceptions", value: "—", detail: "Loading", tone: "amber", icon: "alert" },
          { label: "In transit", value: "—", detail: "Loading", tone: "blue", icon: "ship" },
          { label: "Closed files", value: "—", detail: "Loading", tone: "green", icon: "check" },
        ]).map((kpi) => {
          const Icon = icons[kpi.icon as keyof typeof icons] || LayoutGrid;
          return (
            <div key={kpi.label} className="rounded-panel border border-line bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between text-xs font-semibold text-sub">
                <span>{kpi.label}</span>
                <span
                  className={cn(
                    "rounded-md p-1.5",
                    kpi.tone === "amber" && "bg-[#fff4df] text-[#9a5c12]",
                    kpi.tone === "green" && "bg-[#e6f7ef] text-[#16714e]",
                    kpi.tone === "blue" && "bg-[#edf5ff] text-blue-primary",
                  )}
                >
                  <Icon className="h-[15px] w-[15px]" />
                </span>
              </div>
              <strong className="mt-1 block text-[29px] leading-none tracking-[-0.6px] tabular-nums">
                {kpi.value}
              </strong>
              <small className="mt-1 block text-[11px] text-muted">{kpi.detail}</small>
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.75fr_1fr]">
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between border-b border-[#e7edf4] px-4 py-3.5">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.22px]">Pipeline</h2>
              <p className="text-[11px] text-muted">Record counts by independent module</p>
            </div>
          </div>
          <div className="space-y-1 px-4 py-2">
            {(data?.pipeline || []).map((row) => (
              <Link
                key={row.key}
                href={
                  (
                    {
                      pr: "/pr",
                      quotes: "/quotations",
                      eval: "/evaluation",
                      po: "/po",
                      pay: "/payments",
                      confirm: "/confirmations",
                      ship: "/shipping",
                      vessel: "/vessel",
                      customs: "/customs",
                      delivery: "/delivery",
                      grn: "/grn",
                    } as Record<string, string>
                  )[row.key] || "/reports"
                }
                className="grid grid-cols-[128px_minmax(0,1fr)_22px] items-center gap-3 py-2 text-xs text-ink hover:text-blue"
              >
                <span className="truncate">{row.label}</span>
                <span className="h-1.5 overflow-hidden rounded-lg bg-[#edf2f8]">
                  <i className="block h-full rounded-lg bg-[#4793df]" style={{ width: `${row.pct}%` }} />
                </span>
                <b className="text-right text-[#425670]">{row.count}</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between border-b border-[#e7edf4] px-4 py-3.5">
            <div>
              <h2 className="text-[17px] font-semibold">Needs attention</h2>
              <p className="text-[11px] text-muted">Live SLA / notification engine alerts</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="rounded-[5px] border border-[#dae6f2] bg-white px-2 py-1 text-[11px] font-semibold text-[#365470] hover:border-[#075bb3] hover:text-[#075bb3]"
              >
                Rules
              </Link>
              <span className="rounded-[5px] border border-[#dae6f2] bg-[#edf3fa] px-2 py-1 text-[11px] font-semibold text-[#365470]">
                {data?.attention.length || 0}
              </span>
            </div>
          </div>
          <div className="px-3 pb-2">
            {(data?.attention || []).length === 0 ? (
              <p className="p-7 text-center text-sub">No open alerts from current SLA rules.</p>
            ) : (
              data?.attention.map((item) => (
                <Link
                  key={`${item.triggerKey || item.module}-${item.id}-${item.title}`}
                  href={
                    item.href ||
                    (
                      {
                        pr: "/pr",
                        quotes: "/quotations",
                        eval: "/evaluation",
                        po: "/po",
                        pay: "/payments",
                        confirm: "/confirmations",
                        ship: "/shipping",
                        vessel: "/vessel",
                        customs: "/customs",
                        grn: "/grn",
                      } as Record<string, string>
                    )[item.module] ||
                    "/settings"
                  }
                  className="flex min-h-[49px] items-center gap-2.5 border-b border-[#edf1f6] px-1 py-2.5 last:border-0 hover:text-blue"
                >
                  <span
                    className={cn(
                      "rounded-md p-1.5",
                      item.tone === "amber" ? "bg-[#fff4df] text-[#9a5c12]" : "bg-[#edf5ff] text-blue-primary",
                    )}
                  >
                    <AlertTriangle className="h-[15px] w-[15px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-xs">{item.title}</b>
                    <small className="mt-0.5 block text-[11px] text-sub">{item.subtitle}</small>
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {(data?.kpiDetail || []).length ? (
        <section className="mb-4 rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">KPI strip</h2>
            <p className="text-[11px] text-muted">Functional-spec §11.2 monitoring measures</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#e7edf4] sm:grid-cols-5">
            {(data?.kpiDetail || []).map((k) => (
              <div key={k.label} className="bg-white px-3 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#52657b]">{k.label}</div>
                <strong className="mt-1 block text-[22px] tabular-nums tracking-[-0.4px]">{k.value}</strong>
                <small className="text-[10px] text-muted">{k.detail}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Recent purchase requisitions</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">PR</th>
                  <th className="px-3.5 py-2.5 font-bold">Material</th>
                  <th className="px-3.5 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentPr || []).map((r) => (
                  <tr key={r.id} className="border-t border-[#e8eef5]">
                    <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">
                      {r.prNo}/{r.line}
                    </td>
                    <td className="px-3.5 py-2.5">{r.material}</td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] px-4 py-3.5">
            <h2 className="text-[17px] font-semibold">Recent PO / PI</h2>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f6f8fb] text-[#52657b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">PO</th>
                  <th className="px-3.5 py-2.5 font-bold">Supplier</th>
                  <th className="px-3.5 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentPo || []).map((r) => (
                  <tr key={r.id} className="border-t border-[#e8eef5]">
                    <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{r.poNo}</td>
                    <td className="px-3.5 py-2.5">{r.supplier}</td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
