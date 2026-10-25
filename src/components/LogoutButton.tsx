"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md border border-white/15 px-2 py-1 text-xs text-[var(--sidebar-muted)] hover:bg-white/5 hover:text-[var(--sidebar-fg)]"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
