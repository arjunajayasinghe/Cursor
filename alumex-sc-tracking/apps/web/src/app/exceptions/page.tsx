"use client";

import { useEffect, useState } from "react";
import { api, type ExceptionItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

export default function ExceptionsPage() {
  const { canView, canEdit, role } = useAuth();
  const editable = canEdit("automation");
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<ExceptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setRows(await api.exceptionsList(status));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!canView("automation")) return;
    void load();
  }, [status, canView, role]);

  if (!canView("automation")) {
    return (
      <div className="rounded-panel border border-red-soft bg-red-soft p-6 text-sm text-red-ink">
        Exception register requires automation access.
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">
            Monitoring
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.85px]">Exception register</h1>
          <p className="mt-2 text-[13px] text-sub">
            SLA breaches and authorized exceptions. Open items feed overview alerts.
          </p>
        </div>
        <select
          className="rounded-[5px] border border-[#cdd8e4] px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="authorized">Authorized</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </select>
      </div>

      {error ? (
        <div className="mb-4 rounded-panel border border-red-soft bg-red-soft p-3 text-sm text-red-ink">{error}</div>
      ) : null}

      <section className="rounded-panel border border-line bg-white shadow-panel">
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-[#f6f8fb] text-[#52657b]">
              <tr>
                <th className="px-3.5 py-2.5 font-bold">Title</th>
                <th className="px-3.5 py-2.5 font-bold">Module</th>
                <th className="px-3.5 py-2.5 font-bold">Record</th>
                <th className="px-3.5 py-2.5 font-bold">Owner</th>
                <th className="px-3.5 py-2.5 font-bold">Severity</th>
                <th className="px-3.5 py-2.5 font-bold">Status</th>
                {editable ? <th className="px-3.5 py-2.5 font-bold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t border-[#e8eef5]">
                  <td className="px-3.5 py-2.5">
                    <div className="font-semibold">{x.title}</div>
                    <div className="text-[11px] text-sub">{x.detail}</div>
                  </td>
                  <td className="px-3.5 py-2.5">{x.moduleKey}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-[#075bb3]">{x.recordId}</td>
                  <td className="px-3.5 py-2.5">{x.ownerRole || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    <StatusBadge status={x.severity} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <StatusBadge status={x.status} />
                  </td>
                  {editable ? (
                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {["under_review", "authorized", "closed"].map((st) => (
                          <Button
                            key={st}
                            onClick={async () => {
                              await api.exceptionPatch(x.id, { status: st });
                              await load();
                            }}
                          >
                            {st}
                          </Button>
                        ))}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="p-8 text-center text-sub">No exceptions in this filter.</p> : null}
        </div>
      </section>
    </div>
  );
}
