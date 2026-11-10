"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";

export function StatusTransition({
  moduleKey,
  recordId,
  onChanged,
}: {
  moduleKey: string;
  recordId: string;
  onChanged?: (status: string) => void;
}) {
  const { canEdit } = useAuth();
  const editable = canEdit(moduleKey);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;
    api
      .workflowState(moduleKey, recordId)
      .then((s) => {
        setCurrent(s.current);
        setNext(s.next);
      })
      .catch((e) => setError(e.message));
  }, [moduleKey, recordId]);

  if (!recordId) return null;

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[#334c66]">Workflow status</div>
        <StatusBadge status={current || "—"} />
      </div>
      <p className="mb-2 text-[11px] text-sub">
        Independent stage machine — payment, manufacturing and shipping may overlap.
      </p>
      {error ? <p className="mb-2 text-[11px] text-red-ink">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {editable && next.length
          ? next.map((status) => (
              <Button
                key={status}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.workflowTransition(moduleKey, recordId, status);
                    setCurrent(status);
                    const refreshed = await api.workflowState(moduleKey, recordId);
                    setNext(refreshed.next);
                    onChanged?.(status);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                → {status}
              </Button>
            ))
          : null}
        {!next.length ? <span className="text-[11px] text-muted">No further transitions</span> : null}
      </div>
    </div>
  );
}
