"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Company = { id: string; name: string; slug: string };

type Props = {
  isAetriaOperator: boolean;
  companies: Company[];
  activeCompanyId: string | null;
};

export function WorkspaceSwitcher({ isAetriaOperator, companies, activeCompanyId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function switchTo(companyId: string | null) {
    await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--sidebar-muted)]">
      Workspace
      <select
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-[var(--sidebar-fg)] outline-none focus:border-[var(--accent)]"
        disabled={pending}
        value={activeCompanyId ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          void switchTo(v === "" ? null : v);
        }}
      >
        {isAetriaOperator && <option value="">Aetria Solution (master)</option>}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
