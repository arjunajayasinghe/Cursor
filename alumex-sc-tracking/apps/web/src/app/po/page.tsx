"use client";

import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, PO_FIELDS, type PoItem } from "@/lib/api";
import { FieldGrid } from "@/components/field-grid";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useAuth } from "@/lib/auth";

export default function PoPage() {
  const { canEdit } = useAuth();
  const editable = canEdit("po");
  const [rows, setRows] = useState<PoItem[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<PoItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await api.poList(q, status));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Module 04 · Procurement
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Purchase orders & PI</h1>
          <p className="mt-2 text-[13px] text-sub">
            Record the SAP PO and item separately, with supplier, commercial terms, proforma invoice and release
            details.
          </p>
        </div>
        {editable ? (
          <Button
            variant="primary"
            onClick={() =>
              setSelected({
                id: "",
                recordId: "",
                poNo: "",
                line: "00010",
                quantity: 1,
                currency: "USD",
                status: "Draft",
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> New PO line
          </Button>
        ) : (
          <span className="rounded-[5px] border border-line bg-[#f6f8fb] px-2 py-1 text-[11px] text-muted">
            View only
          </span>
        )}
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
              placeholder="Search PO, supplier, PI, import…"
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
          <span className="ml-auto text-[11px] text-muted">{rows.length} PO lines</span>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">PO</th>
                <th className="px-3.5 py-2.5 font-bold">Line</th>
                <th className="px-3.5 py-2.5 font-bold">Supplier</th>
                <th className="px-3.5 py-2.5 font-bold">Material</th>
                <th className="px-3.5 py-2.5 font-bold">Qty</th>
                <th className="px-3.5 py-2.5 font-bold">Total</th>
                <th className="px-3.5 py-2.5 font-bold">PI</th>
                <th className="px-3.5 py-2.5 font-bold">Sent</th>
                <th className="px-3.5 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#e8eef5] hover:bg-[#fafcff]">
                  <td className="px-3.5 py-2.5">
                    <button className="font-bold text-[#075bb3] hover:underline" onClick={() => setSelected(r)}>
                      {r.poNo}
                    </button>
                  </td>
                  <td className="px-3.5 py-2.5 tabular-nums">{r.line}</td>
                  <td className="px-3.5 py-2.5">{r.supplier || "—"}</td>
                  <td className="px-3.5 py-2.5">{r.material || "—"}</td>
                  <td className="px-3.5 py-2.5 tabular-nums">
                    {r.quantity ?? "—"} {r.uom || ""}
                  </td>
                  <td className="px-3.5 py-2.5 tabular-nums">
                    {r.currency || ""} {r.total ?? "—"}
                  </td>
                  <td className="px-3.5 py-2.5">{r.piNo || "—"}</td>
                  <td className="px-3.5 py-2.5 tabular-nums">{r.sent || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error ? <p className="p-8 text-center text-sub">No purchase orders found.</p> : null}
        </div>
      </section>

      <Drawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        eyebrow="Purchase order & PI"
        title={selected?.poNo ? `${selected.poNo} / ${selected.line}` : "New PO line"}
        subtitle={selected?.supplier || selected?.material || "SAP PO commercial and PI fields"}
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
                      await api.poCreate({
                        ...selected,
                        poNo: selected.poNo || `45000${Date.now().toString().slice(-5)}`,
                        line: selected.line || "00010",
                        quantity: Number(selected.quantity || 1),
                        supplier: selected.supplier || "Demo supplier",
                        material: selected.material || "Demo material",
                        currency: selected.currency || "USD",
                        unitPrice: Number(selected.unitPrice || 1),
                      });
                      setToast("PO line created");
                    } else {
                      await api.poUpdate(selected.id, selected);
                      setToast("PO line updated");
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
              Calculated fields include PO line amount and expected delivery from production + transit lead times.
            </div>
            {!selected.id ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["poNo", "SAP PO number"],
                  ["line", "PO line"],
                  ["supplier", "Supplier"],
                  ["material", "Material"],
                  ["quantity", "Quantity"],
                  ["uom", "UoM"],
                  ["currency", "Currency"],
                  ["unitPrice", "Unit price"],
                  ["piNo", "PI number"],
                  ["importNo", "Import number"],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-[#465d74]">
                    {label}
                    <input
                      className="mt-1 min-h-[35px] w-full rounded-[5px] border border-[#cdd8e4] px-2 font-normal text-ink"
                      value={String((selected as Record<string, unknown>)[key] ?? "")}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          [key]:
                            key === "quantity" || key === "unitPrice" ? Number(e.target.value) : e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <FieldGrid fields={PO_FIELDS} values={selected as unknown as Record<string, unknown>} />
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
