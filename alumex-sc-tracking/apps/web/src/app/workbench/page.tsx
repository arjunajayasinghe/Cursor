"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  api,
  type WorkbenchDashboard,
  type WorkbenchPoDetail,
  type WorkbenchPoHeader,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "dashboard", label: "Follow-up" },
  { key: "shipping", label: "Shipping" },
  { key: "vessel", label: "Vessel" },
  { key: "clearance", label: "Clearance" },
  { key: "delivery", label: "Delivery" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const MODES = ["Sea", "Air", "Courier", "FCL", "LCL"];

export default function WorkbenchPage() {
  const { canView, canEdit, role } = useAuth();
  const editable = canEdit("ship");
  const [q, setQ] = useState("");
  const [headers, setHeaders] = useState<WorkbenchPoHeader[]>([]);
  const [dash, setDash] = useState<WorkbenchDashboard | null>(null);
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkbenchPoDetail | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [splitQty, setSplitQty] = useState("10");
  const [splitMode, setSplitMode] = useState("Air");
  const [busy, setBusy] = useState(false);

  const refreshList = useCallback(async () => {
    if (!canView("ship") && !canView("po")) {
      setError(`${role} has no access to import workbench`);
      return;
    }
    const [list, d] = await Promise.all([api.workbenchPos(q), api.workbenchDashboard()]);
    setHeaders(list);
    setDash(d);
    if (!selectedPo && list[0]) setSelectedPo(list[0].poNo);
  }, [canView, q, role, selectedPo]);

  const refreshDetail = useCallback(async (poNo: string) => {
    const d = await api.workbenchPo(poNo);
    setDetail(d);
    if (!selectedLine || !d.lines.some((l) => l.line === selectedLine)) {
      setSelectedLine(d.lines[0]?.line || null);
    }
  }, [selectedLine]);

  useEffect(() => {
    refreshList().catch((e) => setError((e as Error).message));
  }, [refreshList]);

  useEffect(() => {
    if (!selectedPo) return;
    refreshDetail(selectedPo).catch((e) => setError((e as Error).message));
  }, [selectedPo, refreshDetail]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const line = useMemo(
    () => detail?.lines.find((l) => l.line === selectedLine) || detail?.lines[0] || null,
    [detail, selectedLine],
  );

  const shipments = useMemo(() => {
    if (!detail) return [];
    const map = new Map<string, WorkbenchPoDetail["lines"][0]["allocations"][0]["shipment"] & { allocations: WorkbenchPoDetail["lines"][0]["allocations"] }>();
    for (const l of detail.lines) {
      for (const a of l.allocations) {
        const cur = map.get(a.shipmentId);
        if (!cur) {
          map.set(a.shipmentId, { ...a.shipment, allocations: [a] });
        } else {
          cur.allocations.push(a);
        }
      }
    }
    return Array.from(map.values());
  }, [detail]);

  async function runSplit() {
    if (!selectedPo || !line) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.workbenchSplit(selectedPo, {
        line: line.line,
        quantity: Number(splitQty),
        mode: splitMode,
        coverPoNo: detail?.header.coverPoNo || undefined,
        notes: `Urgent ${splitMode} split from workbench`,
      });
      setToast(`Split → ${saved.shipment.recordId} · pending ${saved.pendingAfter}`);
      await refreshDetail(selectedPo);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runShortShip(allocationId: string, allocated: number) {
    if (!selectedPo) return;
    const shipped = Math.max(0, allocated - 1);
    setBusy(true);
    try {
      await api.workbenchShortShip(allocationId, {
        shippedQty: shipped,
        notes: "Marked short-ship from workbench",
      });
      setToast(`Short-ship recorded (shipped ${shipped})`);
      await refreshDetail(selectedPo);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canView("ship") && !canView("po")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        Import workbench is restricted.
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
          Import · critical follow-up
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.85px]">PO import workbench</h1>
        <p className="mt-2 max-w-3xl text-[13px] text-sub">
          One place for shipping, vessel, clearance and delivery — PO header spine, line-wise qty,
          split to Air/Sea, short-ship and cover PO roll-up.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-panel border border-line bg-white shadow-panel">
          <div className="border-b border-[#e7edf4] p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                className="min-h-[34px] w-full rounded-[5px] border border-[#cdd8e4] pl-8 pr-2 text-xs"
                placeholder="Search PO / cover / supplier"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
          <div className="max-h-[70vh] divide-y divide-[#e8eef5] overflow-auto">
            {headers.map((h) => (
              <button
                key={h.poNo}
                type="button"
                className={cn(
                  "block w-full px-3 py-2.5 text-left text-xs hover:bg-[#f7fbff]",
                  selectedPo === h.poNo && "bg-[#eef6ff]",
                )}
                onClick={() => setSelectedPo(h.poNo)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#075bb3]">{h.poNo}</span>
                  <StatusBadge status={h.status} />
                </div>
                {h.coverPoNo ? (
                  <div className="mt-0.5 text-[10px] font-semibold text-[#396384]">Cover {h.coverPoNo}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-sub">{h.supplier || "—"}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {h.flags.map((f) => (
                    <span key={f} className="rounded-[3px] bg-[#fff4df] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#9a5c12]">
                      {f}
                    </span>
                  ))}
                  {h.modes.map((m) => (
                    <span key={m} className="rounded-[3px] bg-[#edf5ff] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#075bb3]">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  Pending {h.pendingQty} · Ships {h.shipmentCount} · Lines {h.lineCount}
                </div>
              </button>
            ))}
            {!headers.length ? <p className="p-4 text-center text-xs text-sub">No POs</p> : null}
          </div>
        </section>

        <div className="space-y-4">
          {detail ? (
            <>
              <section className="rounded-panel border border-line bg-white p-4 shadow-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#396384]">PO header</div>
                    <h2 className="text-[20px] font-semibold">{detail.header.poNo}</h2>
                    {detail.header.coverPoNo ? (
                      <div className="mt-1 text-[12px] font-semibold text-[#396384]">
                        Cover PO · {detail.header.coverPoNo}
                      </div>
                    ) : null}
                    <p className="mt-1 text-[12px] text-sub">
                      {detail.header.supplier} · {detail.header.importNo || "no import no"} ·{" "}
                      {detail.header.currency} · {detail.header.incoterm}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      ["Order", detail.dashboard.orderQty],
                      ["Allocated", detail.dashboard.allocatedQty],
                      ["Pending", detail.dashboard.pendingQty],
                      ["Short", detail.dashboard.shortQty],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-[72px] rounded-md border border-line px-2 py-1.5">
                        <div className="text-[10px] uppercase text-muted">{label}</div>
                        <strong className="text-sm">{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-md border border-line">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-[#f6f8fb] text-[#52657b]">
                      <tr>
                        {["Line", "Material", "Order", "Allocated", "Shipped", "Short", "Pending", "Status"].map((h) => (
                          <th key={h} className="px-2.5 py-2 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l) => (
                        <tr
                          key={l.id}
                          className={cn(
                            "cursor-pointer border-t border-[#e8eef5] hover:bg-[#fafcff]",
                            selectedLine === l.line && "bg-[#eef6ff]",
                          )}
                          onClick={() => setSelectedLine(l.line)}
                        >
                          <td className="px-2.5 py-2 font-bold text-[#075bb3]">{l.line}</td>
                          <td className="px-2.5 py-2">
                            <div>{l.material || "—"}</div>
                            <div className="text-[10px] text-muted">{l.materialCode}</div>
                          </td>
                          <td className="px-2.5 py-2 tabular-nums">
                            {l.quantity} {l.uom}
                          </td>
                          <td className="px-2.5 py-2 tabular-nums">{l.allocatedQty}</td>
                          <td className="px-2.5 py-2 tabular-nums">{l.shippedQty}</td>
                          <td className="px-2.5 py-2 tabular-nums text-[#9a5c12]">{l.shortQty || "—"}</td>
                          <td className="px-2.5 py-2 tabular-nums font-semibold">{l.pendingQty}</td>
                          <td className="px-2.5 py-2">
                            <StatusBadge status={l.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {editable && line && line.pendingQty > 0 ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3">
                    <div className="text-[11px] font-semibold text-[#244c74]">
                      Split line {line.line} (pending {line.pendingQty} {line.uom})
                    </div>
                    <label className="text-[11px] font-semibold text-[#465d74]">
                      Qty
                      <input
                        className="ml-1 min-h-[32px] w-20 rounded-[5px] border border-[#cdd8e4] px-2"
                        value={splitQty}
                        onChange={(e) => setSplitQty(e.target.value)}
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-[#465d74]">
                      Mode
                      <select
                        className="ml-1 min-h-[32px] rounded-[5px] border border-[#cdd8e4] px-2"
                        value={splitMode}
                        onChange={(e) => setSplitMode(e.target.value)}
                      >
                        {MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button variant="primary" disabled={busy} onClick={runSplit}>
                      Split to shipment
                    </Button>
                  </div>
                ) : null}
              </section>

              <div className="flex flex-wrap gap-1 border-b border-[#e7edf4]">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={cn(
                      "rounded-t-[6px] px-3 py-2 text-[12px] font-semibold",
                      tab === t.key
                        ? "border border-b-white border-[#cdd8e4] bg-white text-[#075bb3]"
                        : "text-sub hover:text-ink",
                    )}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <section className="rounded-panel border border-line bg-white p-4 shadow-panel">
                {tab === "dashboard" ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Follow-up on this PO</h3>
                    {detail.dashboard.attention.length ? (
                      <ul className="space-y-1.5 text-[12px]">
                        {detail.dashboard.attention.map((a, i) => (
                          <li key={`${a.type}-${a.line}-${i}`} className="rounded-md border border-[#f0d4a8] bg-[#fff8eb] px-3 py-2 text-[#7a4e12]">
                            {a.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-sub">No open chase items on this PO.</p>
                    )}
                    {dash ? (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          ["POs", dash.poCount],
                          ["Pending", dash.withPending],
                          ["Split / multi", dash.withSplit],
                          ["Short-ship", dash.withShortShip],
                          ["Shipments", dash.openShipments],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-md border border-line px-2 py-2 text-center">
                            <div className="text-[10px] uppercase text-muted">{label}</div>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab !== "dashboard" ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold capitalize">{tab} · shipments on PO</h3>
                      <div className="flex gap-2 text-[11px]">
                        {tab === "shipping" ? <Link className="text-[#075bb3] underline" href="/shipping">Open shipping register</Link> : null}
                        {tab === "vessel" ? <Link className="text-[#075bb3] underline" href="/vessel">Open vessel map</Link> : null}
                        {tab === "clearance" ? <Link className="text-[#075bb3] underline" href="/customs">Open customs</Link> : null}
                        {tab === "delivery" ? <Link className="text-[#075bb3] underline" href="/delivery">Open delivery</Link> : null}
                      </div>
                    </div>
                    {!shipments.length ? (
                      <p className="text-[12px] text-sub">No shipments yet — use Split to shipment on a line with pending qty.</p>
                    ) : (
                      shipments.map((s) => (
                        <div key={s.id} className="rounded-md border border-line p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-semibold">{s.recordId}</div>
                              <div className="text-[11px] text-sub">
                                {s.mode || "—"} · {s.bl || "no BL/AWB"} · {s.vessel || "no vessel"} · fwd {s.forwarder || "—"}
                              </div>
                            </div>
                            <StatusBadge status={s.status} />
                          </div>
                          <div className="mt-2 text-[11px] text-muted">
                            ETD {s.etd ? String(s.etd).slice(0, 10) : "—"} · ETA {s.eta ? String(s.eta).slice(0, 10) : "—"}
                          </div>
                          <div className="mt-2 space-y-1">
                            {s.allocations.map((a) => (
                              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#eaf0f5] px-2 py-1.5 text-[11px]">
                                <span>
                                  Line {a.quantity} · mode {a.mode || s.mode} · <StatusBadge status={a.status} />
                                  {a.shortQty ? <span className="ml-2 text-[#9a5c12]">short {a.shortQty}</span> : null}
                                </span>
                                {editable && a.status === "allocated" ? (
                                  <Button size="sm" disabled={busy} onClick={() => runShortShip(a.id, a.quantity)}>
                                    Mark short-ship
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          {tab === "vessel" && s.vesselTracking ? (
                            <div className="mt-2 text-[11px]">Vessel track {s.vesselTracking.recordId} · {s.vesselTracking.status}</div>
                          ) : null}
                          {tab === "clearance" && s.customs ? (
                            <div className="mt-2 text-[11px]">Customs {s.customs.recordId} · {s.customs.status}</div>
                          ) : null}
                          {tab === "delivery" && s.delivery ? (
                            <div className="mt-2 text-[11px]">Delivery {s.delivery.recordId} · {s.delivery.status}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <p className="text-sub">Select a PO.</p>
          )}
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-5 z-50 rounded-md bg-[#183954] px-4 py-2.5 text-sm text-white">{toast}</div>
      ) : null}
    </div>
  );
}
