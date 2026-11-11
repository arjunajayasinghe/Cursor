"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MasterDataEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  ["plant", "Plants"],
  ["currency", "Currencies"],
  ["uom", "Units of measure"],
  ["incoterm", "Incoterms"],
  ["delay_reason", "Delay reasons"],
  ["supplier", "Suppliers"],
] as const;

export default function MastersPage() {
  const { canView, canEdit, role } = useAuth();
  const editable = canEdit("masters");
  const [category, setCategory] = useState<string>("plant");
  const [rows, setRows] = useState<MasterDataEntry[]>([]);
  const [draft, setDraft] = useState({ code: "", name: "", extra: "" });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!canView("masters")) return;
    api
      .mastersList(category)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [category, canView, role]);

  const title = useMemo(() => CATEGORIES.find((c) => c[0] === category)?.[1] || category, [category]);

  if (!canView("masters")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        Master data administration requires the masters permission (Administrator by default).
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
          Administration
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Master data</h1>
        <p className="mt-2 text-[13px] text-sub">
          Plants, currencies, UOM, Incoterms, delay reasons and suppliers — shared reference catalogues.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={
              category === key
                ? "rounded-[5px] border border-[#075bb3] bg-[#075bb3] px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-[5px] border border-line bg-white px-3 py-1.5 text-xs font-semibold text-[#365470]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {editable ? (
        <section className="mb-4 rounded-panel border border-line bg-white p-4 shadow-panel">
          <h2 className="mb-3 text-sm font-semibold">Add / update {title}</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              className="rounded-[5px] border border-[#cdd8e4] px-2 py-1.5 text-sm"
              placeholder="Code"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <input
              className="rounded-[5px] border border-[#cdd8e4] px-2 py-1.5 text-sm"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="rounded-[5px] border border-[#cdd8e4] px-2 py-1.5 text-sm"
              placeholder="Extra"
              value={draft.extra}
              onChange={(e) => setDraft({ ...draft, extra: e.target.value })}
            />
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await api.mastersUpsert({
                    category,
                    code: draft.code,
                    name: draft.name,
                    extra: draft.extra || undefined,
                  });
                  setDraft({ code: "", name: "", extra: "" });
                  setRows(await api.mastersList(category));
                  setToast("Saved");
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              Save
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="overflow-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">Code</th>
                <th className="px-3.5 py-2.5 font-bold">Name</th>
                <th className="px-3.5 py-2.5 font-bold">Extra</th>
                <th className="px-3.5 py-2.5 font-bold">Active</th>
                {editable ? <th className="px-3.5 py-2.5 font-bold" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#e8eef5]">
                  <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{r.code}</td>
                  <td className="px-3.5 py-2.5">{r.name}</td>
                  <td className="px-3.5 py-2.5 text-sub">{r.extra || "—"}</td>
                  <td className="px-3.5 py-2.5">{r.active ? "Yes" : "No"}</td>
                  {editable ? (
                    <td className="px-3.5 py-2.5">
                      <Button
                        onClick={async () => {
                          await api.mastersDelete(r.id);
                          setRows(await api.mastersList(category));
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
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
