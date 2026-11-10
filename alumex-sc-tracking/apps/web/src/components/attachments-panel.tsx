"use client";

import { useCallback, useEffect, useState } from "react";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { api, type DocumentAsset } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function AttachmentsPanel({
  moduleKey,
  category,
  recordId,
}: {
  moduleKey: string;
  category?: string;
  recordId: string;
}) {
  const { canEdit } = useAuth();
  const editable = canEdit(moduleKey);
  const [rows, setRows] = useState<DocumentAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!recordId) return;
    try {
      setError(null);
      setRows(await api.documentsList(moduleKey, recordId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [moduleKey, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!recordId) return null;

  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-[#e7edf4] px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#334c66]">
          <Paperclip className="h-4 w-4" /> Attachments
        </div>
        {editable ? (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-[#365470] hover:border-[#075bb3] hover:text-[#075bb3]">
            <Upload className="h-3.5 w-3.5" />
            {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                try {
                  await api.documentUpload({
                    file,
                    moduleKey,
                    category: category || moduleKey,
                    recordId,
                  });
                  await load();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? <div className="px-3 py-2 text-xs text-red-ink">{error}</div> : null}
      <div className="divide-y divide-[#e8eef5]">
        {rows.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="truncate font-semibold text-[#075bb3]">{doc.fileName}</div>
              <div className="text-[11px] text-muted">
                {(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.storageBackend} · {doc.uploadedBy || "—"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                onClick={async () => {
                  const blob = await api.documentDownloadBlob(doc.id);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = doc.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              {editable ? (
                <Button
                  onClick={async () => {
                    await api.documentDelete(doc.id);
                    await load();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <p className="px-3 py-4 text-center text-[12px] text-sub">No documents attached.</p>
        ) : null}
      </div>
    </div>
  );
}
