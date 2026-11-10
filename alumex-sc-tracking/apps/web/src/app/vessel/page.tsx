"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, MapPin } from "lucide-react";
import { api, type VesselTrackingDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FieldGrid } from "@/components/field-grid";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { VesselMap } from "@/components/vessel-map";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { MODULE_UI } from "@/lib/modules";

export default function VesselPage() {
  const { canEdit, canView } = useAuth();
  const editable = canEdit("vessel");
  const def = MODULE_UI.vessel;
  const [rows, setRows] = useState<VesselTrackingDetail[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<VesselTrackingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canView("vessel")) {
      setError("No access to vessel tracking");
      setRows([]);
      return;
    }
    try {
      setError(null);
      const data = await api.vesselTrackingList();
      setRows(data as VesselTrackingDetail[]);
    } catch (e) {
      // Fallback to module list if dedicated endpoint warm-up lags
      try {
        const fallback = await api.moduleList("vessel", q);
        setRows(fallback as unknown as VesselTrackingDetail[]);
      } catch (err) {
        setError((err as Error).message || (e as Error).message);
      }
    }
  }, [canView, q]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.recordId, r.vessel, r.imo, r.mmsi, r.voyage, r.status, r.position]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const markers = useMemo(
    () =>
      filtered
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id || r.recordId,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          label: r.vessel || r.recordId,
          status: r.status,
        })),
    [filtered],
  );

  async function openDetail(row: VesselTrackingDetail) {
    try {
      const full = await api.vesselTrackingGet(row.id || row.recordId);
      setSelected(full);
    } catch {
      setSelected(row);
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
          <p className="mt-2 max-w-3xl text-[13px] text-sub">
            Provider-neutral AIS adapter matched by IMO/MMSI. Supplier ETAs stay untouched; API ETAs and position
            history land in vessel_tracking_events. Map shows last-known position (Leaflet + OSM).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api.vesselTrackingPollAll();
                  setToast(`Polled ${result.polled} · updated ${result.updated}`);
                  await load();
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> {busy ? "Polling…" : "Poll provider"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <section className="mb-4 rounded-panel border border-line bg-white p-3 shadow-panel">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#334c66]">
          <MapPin className="h-4 w-4 text-[#075bb3]" /> Fleet map · last-known positions
        </div>
        <VesselMap markers={markers} height={300} />
      </section>

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input
              className="min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] pl-8 pr-2 text-sm"
              placeholder="Search vessel, IMO, MMSI…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="text-[11px] text-muted">{filtered.length} tracks</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">ID</th>
                <th className="px-3.5 py-2.5 font-bold">Vessel</th>
                <th className="px-3.5 py-2.5 font-bold">IMO / MMSI</th>
                <th className="px-3.5 py-2.5 font-bold">Position</th>
                <th className="px-3.5 py-2.5 font-bold">Supplier ETA</th>
                <th className="px-3.5 py-2.5 font-bold">API ETA</th>
                <th className="px-3.5 py-2.5 font-bold">Provider</th>
                <th className="px-3.5 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id || r.recordId}
                  className="cursor-pointer border-t border-[#e8eef5] hover:bg-[#f7fbff]"
                  onClick={() => void openDetail(r)}
                >
                  <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{r.recordId}</td>
                  <td className="px-3.5 py-2.5">{r.vessel}</td>
                  <td className="px-3.5 py-2.5">
                    {r.imo || "—"}
                    <div className="text-[11px] text-muted">{r.mmsi || ""}</div>
                  </td>
                  <td className="px-3.5 py-2.5">{r.position || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    {r.etaRevised || r.eta
                      ? String(r.etaRevised || r.eta).slice(0, 10)
                      : "—"}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {r.apiEta ? String(r.apiEta).slice(0, 10) : "—"}
                    {r.etaVarianceDays != null ? (
                      <div className="text-[11px] text-muted">Δ {r.etaVarianceDays}d</div>
                    ) : null}
                  </td>
                  <td className="px-3.5 py-2.5">{r.trackingProvider || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-8 text-center text-sub">No vessel tracks.</p> : null}
        </div>
      </section>

      <Drawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        eyebrow={def.title}
        title={selected?.vessel || selected?.recordId || "Vessel"}
        subtitle={`${selected?.imo || "IMO?"} · ${selected?.mmsi || "MMSI?"} · supplier ETA preserved`}
        wide
        footer={
          <>
            <Button onClick={() => setSelected(null)}>Close</Button>
            {editable && selected ? (
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    const updated = await api.vesselTrackingPollOne(selected.id || selected.recordId);
                    setSelected(updated);
                    setToast(`Updated from ${updated.trackingProvider || "provider"}`);
                    await load();
                  } catch (e) {
                    setToast((e as Error).message);
                  }
                }}
              >
                Refresh position
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
              Supplier ETA fields (<code>eta</code> / <code>etaRevised</code>) are never overwritten by{" "}
              <code>apiEta</code>. Match key: IMO/MMSI.
            </div>
            {selected.latitude != null && selected.longitude != null ? (
              <VesselMap
                markers={[
                  {
                    id: selected.recordId,
                    lat: Number(selected.latitude),
                    lng: Number(selected.longitude),
                    label: selected.vessel || selected.recordId,
                    status: selected.status,
                  },
                ]}
                focus={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }}
                height={240}
              />
            ) : null}
            <FieldGrid
              fields={[
                ...def.fields,
                { key: "mmsi", label: "MMSI", source: "E" as const },
                { key: "apiEta", label: "API ETA", source: "E" as const, type: "date" as const },
                { key: "latitude", label: "Latitude", source: "E" as const },
                { key: "longitude", label: "Longitude", source: "E" as const },
                { key: "speedKnots", label: "Speed (kn)", source: "E" as const },
                { key: "courseDeg", label: "Course (°)", source: "E" as const },
                { key: "trackingProvider", label: "Tracking provider", source: "E" as const },
                { key: "lastAisAt", label: "Last AIS update", source: "E" as const },
                { key: "etaVarianceDays", label: "ETA variance (days)", source: "A" as const },
              ]}
              values={selected as unknown as Record<string, unknown>}
            />
            {selected.events?.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#334c66]">Tracking events</h3>
                <div className="max-h-48 space-y-1 overflow-auto rounded-md border border-line p-2 text-[11px]">
                  {selected.events.map((ev) => (
                    <div key={ev.id} className="flex justify-between gap-2 border-b border-[#eef2f7] py-1 last:border-0">
                      <span>
                        {ev.provider} · {ev.latitude?.toFixed?.(3)}, {ev.longitude?.toFixed?.(3)}
                      </span>
                      <span className="text-muted">{String(ev.aisTimestamp || ev.createdAt).replace("T", " ").slice(0, 19)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <AttachmentsPanel moduleKey="vessel" category="vessel" recordId={selected.recordId} />
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
