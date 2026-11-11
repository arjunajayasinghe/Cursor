"use client";

import { useRef, useState } from "react";
import { api, type ExcelDeltaResult } from "@/lib/api";
import { Button } from "@/components/ui/button";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function ExcelDeltaUpload({
  kind,
  onApplied,
}: {
  kind: "pr" | "po";
  onApplied?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelDeltaResult | null>(null);
  const label = kind === "pr" ? "PR" : "PO";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const saved =
        kind === "pr"
          ? await api.prExcelDelta({ base64, fileName: file.name })
          : await api.poExcelDelta({ base64, fileName: file.name });
      setResult(saved);
      onApplied?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-panel border border-[#d7e7fb] bg-[#f7fbff] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-semibold text-[#244c74]">Daily {label} Excel</div>
          <p className="mt-0.5 max-w-xl text-[11px] text-sub">
            Upload the SAP {label} workbook a few times a day. Only new lines and changed SAP fields are
            written. Unchanged lines and notes stay.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onFile(file);
            }}
          />
          <Button variant="primary" disabled={busy} type="button" onClick={() => inputRef.current?.click()}>
            {busy ? "Applying delta…" : `Upload ${label} Excel`}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-[12px] text-red-ink">{error}</p> : null}
      {result ? (
        <p className="mt-2 text-[12px] text-[#244c74]">
          {result.rowCount} lines · {result.created} new · {result.updated} updated · {result.unchanged} unchanged
        </p>
      ) : null}
    </div>
  );
}
