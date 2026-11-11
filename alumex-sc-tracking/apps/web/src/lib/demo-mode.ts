/**
 * Local-only demo role switching.
 * Hard-disabled in production builds even if NEXT_PUBLIC_DEMO_ROLE_SWITCHING was set at build time.
 */
export const DEMO_ROLE_SWITCHING =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_ROLE_SWITCHING === "true";

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
