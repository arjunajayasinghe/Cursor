/** Local-only demo role switching. Must stay false in published builds. */
export const DEMO_ROLE_SWITCHING = process.env.NEXT_PUBLIC_DEMO_ROLE_SWITCHING === "true";

/** Safe default for first paint and published private preview. */
export const DEFAULT_SAFE_ROLE = "Management";

/** Roles the browser may choose when DEMO_ROLE_SWITCHING is on (Administrator still needs API allow). */
export const SWITCHABLE_ROLES = [
  "Management",
  "Requester",
  "Procurement",
  "Finance",
  "Import Team",
  "Stores",
  "Technical 1",
  "Technical 2",
  "Supplier",
  "Clearing Agent",
  "Administrator",
] as const;
