import { SourceTag } from "@/components/ui/badge";
import { SOURCE_CODES, type FieldMismatch } from "@/lib/api";
import { cn } from "@/lib/utils";

export function FieldGrid({
  fields,
  values,
  mismatches = [],
}: {
  fields: Array<{ key: string; label: string; source: keyof typeof SOURCE_CODES }>;
  values: Record<string, unknown>;
  mismatches?: FieldMismatch[];
}) {
  const byField = new Map(mismatches.filter((m) => m.status === "open").map((m) => [m.field, m]));
  const open = mismatches.filter((m) => m.status === "open");

  return (
    <div className="space-y-3">
      {open.length ? (
        <div className="rounded-[6px] border border-[#f0d4a8] bg-[#fff8eb] px-3 py-2 text-[12px] text-[#7a4e12]">
          <div className="font-semibold">Field mismatches ({open.length})</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-[#8a6228]">
            Highlighted fields differ between SAP/sync and the web record. Preferred source wins on
            reconcile; resolve from Integrations or dismiss after review.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((f) => {
          const raw = values[f.key];
          const display = raw == null || raw === "" ? "—" : String(raw);
          const mismatch = byField.get(f.key);
          return (
            <div
              key={f.key}
              className={cn(
                "min-w-0 rounded-[5px] px-1.5 py-1",
                mismatch && "bg-[#fff4df] ring-1 ring-[#f0d4a8]",
              )}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#465d74]">
                <SourceTag code={f.source} />
                <span>{f.label}</span>
                {mismatch ? (
                  <span className="ml-auto rounded-[3px] bg-[#9a5c12] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Mismatch
                  </span>
                ) : null}
              </div>
              <div className="min-h-[30px] border-b border-[#eaf0f5] py-1 text-[13px] text-ink break-words">
                {display}
              </div>
              {mismatch ? (
                <div className="mt-1 text-[11px] leading-snug text-[#9a5c12]">
                  Incoming ({mismatch.preferredSource}):{" "}
                  <span className="font-semibold">{mismatch.incomingValue || "—"}</span>
                  {mismatch.detail ? <span className="block text-[#8a6228]">{mismatch.detail}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
