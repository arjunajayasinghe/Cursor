import { cn, statusTone } from "@/lib/utils";

const tones = {
  blue: "bg-blue-soft text-[#085daa]",
  amber: "bg-amber-soft text-amber-ink",
  green: "bg-green-soft text-green-ink",
  red: "bg-red-soft text-red-ink",
  gray: "bg-[#edf2f6] text-[#40566d]",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const tone = statusTone(status) as keyof typeof tones;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap",
        tones[tone] || tones.gray,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "—"}
    </span>
  );
}

export function SourceTag({ code }: { code: string }) {
  const styles: Record<string, string> = {
    S: "bg-[#e6f0fe] text-[#125a9e]",
    W: "bg-[#eef1f5] text-[#455b71]",
    A: "bg-[#e5f5ee] text-[#206a51]",
    E: "bg-[#f0eafb] text-[#634895]",
    M: "bg-[#fff3d8] text-[#84581d]",
  };
  return (
    <span
      className={cn(
        "inline-grid place-items-center min-w-5 h-[19px] px-1 rounded text-[10px] font-extrabold",
        styles[code] || styles.W,
      )}
      title={code}
    >
      {code}
    </span>
  );
}
