"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const DEMOS = [
  { email: "operator@aetria.com", label: "Aetria operator" },
  { email: "admin@acme.com", label: "Acme admin" },
  { email: "editor@acme.com", label: "Acme area editor" },
  { email: "viewer@acme.com", label: "Acme viewer" },
  { email: "admin@beta.com", label: "Beta admin" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("operator@aetria.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/app");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
          Aetria
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--fg)]">
          Process Mapping
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Sign in to the master library or a company workspace.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            Seeded users (password: password123)
          </p>
          <ul className="space-y-1">
            {DEMOS.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  className="text-left text-sm text-[var(--accent)] hover:underline"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("password123");
                  }}
                >
                  {d.label} — {d.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
