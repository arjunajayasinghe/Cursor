import type { VerifiedIdentity } from "../../cursor/identity";

/** Read-only default for every signed-in teammate. */
export const PUBLISHED_DEFAULT_ROLE = "Management";

/** Modules the published Management role may read (Nest matrix). Writes are denied. */
const MANAGEMENT_READ = new Set([
  "pr",
  "quotes",
  "eval",
  "po",
  "pay",
  "confirm",
  "ship",
  "vessel",
  "customs",
  "delivery",
  "grn",
  "reports",
  "automation",
  "masters",
  "integrations",
  "roles",
  "documents",
]);

/**
 * Map Cursor viewer → Nest demo role. Never trust the browser.
 * Only emails listed in ADMIN_EMAILS (comma-separated) get Administrator.
 */
export function roleFromIdentity(identity: VerifiedIdentity): string {
  if (identity.kind !== "person") return PUBLISHED_DEFAULT_ROLE;
  const email = (identity.email || "").trim().toLowerCase();
  if (!email) return PUBLISHED_DEFAULT_ROLE;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(email)) return "Administrator";
  return PUBLISHED_DEFAULT_ROLE;
}

/** Resolve Nest module key from `/api/backend/...` path segments. */
export function moduleKeyFromPath(segments: string[]): string | null {
  if (!segments.length) return null;
  const root = segments[0];
  const map: Record<string, string> = {
    pr: "pr",
    quotations: "quotes",
    quotes: "quotes",
    evaluation: "eval",
    eval: "eval",
    po: "po",
    payments: "pay",
    pay: "pay",
    confirmations: "confirm",
    confirm: "confirm",
    shipping: "ship",
    ship: "ship",
    workbench: "ship",
    "vessel-tracking": "vessel",
    vessel: "vessel",
    customs: "customs",
    delivery: "delivery",
    grn: "grn",
    reports: "reports",
    overview: "reports",
    permissions: "roles",
    automation: "automation",
    documents: "documents",
  };
  if (root === "platform") {
    const sub = segments[1] || "";
    if (sub === "masters") return "masters";
    if (sub === "integrations") return "integrations";
    if (sub === "exceptions") return "automation";
    if (sub === "monitoring" || sub === "audit" || sub === "validate") return "reports";
    if (sub === "workflow") return segments[2] || "reports";
    return "reports";
  }
  return map[root] || null;
}

/** Access level 0 none · 1 view · 2 create/edit for published role map. */
export function publishedAccessLevel(role: string, moduleKey: string): 0 | 1 | 2 {
  if (role === "Administrator") return 2;
  if (role === PUBLISHED_DEFAULT_ROLE && MANAGEMENT_READ.has(moduleKey)) return 1;
  return 0;
}

export function allowMethod(role: string, method: string, moduleKey: string | null): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") {
    if (!moduleKey) return role === "Administrator";
    return publishedAccessLevel(role, moduleKey) >= 1;
  }
  // Mutations: create/edit only
  if (!moduleKey) return false;
  return publishedAccessLevel(role, moduleKey) >= 2;
}
