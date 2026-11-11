"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api, type AuditEvent } from "@/lib/api";

export function HistoryPanel({ moduleKey, recordId }: { moduleKey: string; recordId: string }) {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [wf, setWf] = useState<Array<{ fromStatus?: string | null; toStatus: string; actor: string; createdAt: string; note?: string | null }>>([]);

  useEffect(() => {
    if (!recordId) return;
    api.auditHistory(moduleKey, recordId).then(setRows).catch(() => setRows([]));
    api.workflowHistory(moduleKey, recordId).then(setWf).catch(() => setWf([]));
  }, [moduleKey, recordId]);

  if (!recordId) return null;

  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center gap-2 border-b border-[#e7edf4] px-3 py-2.5 text-sm font-semibold text-[#334c66]">
        <History className="h-4 w-4" /> History
      </div>
      <div className="max-h-56 space-y-2 overflow-auto p-3 text-[11px]">
        {wf.map((w, i) => (
          <div key={`w-${i}`} className="rounded border border-[#eef2f7] px-2 py-1.5">
            <div className="font-semibold text-[#075bb3]">
              Workflow · {w.fromStatus || "—"} → {w.toStatus}
            </div>
            <div className="text-muted">
              {w.actor} · {String(w.createdAt).replace("T", " ").slice(0, 19)}
              {w.note ? ` · ${w.note}` : ""}
            </div>
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.id} className="rounded border border-[#eef2f7] px-2 py-1.5">
            <div className="font-semibold">
              {r.action} <span className="text-muted">({r.source || "manual"})</span>
            </div>
            <div className="text-muted">
              {r.actor} · {String(r.createdAt).replace("T", " ").slice(0, 19)}
            </div>
            {r.detail ? <div className="text-sub">{r.detail}</div> : null}
          </div>
        ))}
        {!rows.length && !wf.length ? <p className="text-center text-sub">No history yet.</p> : null}
      </div>
    </div>
  );
}
