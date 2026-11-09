import { SourceTag } from "@/components/ui/badge";
import { SOURCE_CODES } from "@/lib/api";

export function FieldGrid({
  fields,
  values,
}: {
  fields: Array<{ key: string; label: string; source: keyof typeof SOURCE_CODES }>;
  values: Record<string, unknown>;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      {fields.map((f) => {
        const raw = values[f.key];
        const display = raw == null || raw === "" ? "—" : String(raw);
        return (
          <div key={f.key} className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#465d74]">
              <SourceTag code={f.source} />
              <span>{f.label}</span>
            </div>
            <div className="min-h-[30px] border-b border-[#eaf0f5] py-1 text-[13px] text-ink break-words">
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
