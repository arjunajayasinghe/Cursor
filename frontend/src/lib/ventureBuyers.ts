/**
 * Master Venture Tea buyer map — edit here when a broker changes their code/name.
 * Same company on every broker; each broker prints a different short code on sales/PDF.
 *
 * Lookalikes that are NOT Venture (do not add them here):
 *   AS VT01 · BC VTC / VTE · CT VT
 */
export type VentureBuyerEntry = {
  broker: string;
  /** Primary code first; extras are accepted aliases for that broker. */
  codes: string[];
  /** Canonical company name for display when sales only has a short code. */
  name: string;
};

export const ventureBuyerMaster: readonly VentureBuyerEntry[] = [
  { broker: "AS", codes: ["VL01"], name: "Venture Tea Pvt. Ltd." },
  { broker: "BC", codes: ["VEN"], name: "VENTURE TEA (PVT) LTD" },
  { broker: "CT", codes: ["VEN"], name: "VENTURE TEA (PVT) LTD" },
  { broker: "EB", codes: ["VEN"], name: "VENTURE TEA (PVT) LTD" },
  { broker: "FW", codes: ["VE1"], name: "VENTURE TEA PVT LTD" },
  { broker: "JK", codes: ["VE04"], name: "VENTURE TEA" },
  { broker: "LC", codes: ["VT"], name: "VENTURE TEA (PVT) LTD" },
  { broker: "MB", codes: ["V06"], name: "VENTURE TEA (PVT) LTD" },
] as const;

/** broker → codes (primary first). */
export const ventureSalesBuyerCodes: Record<string, string[]> = Object.fromEntries(
  ventureBuyerMaster.map((entry) => [entry.broker, [...entry.codes]]),
);

/** short code → display name. */
export const knownSalesBuyerNames: Record<string, string> = Object.fromEntries(
  ventureBuyerMaster.flatMap((entry) => entry.codes.map((code) => [code, entry.name])),
);

export function ventureEntryFor(broker: string): VentureBuyerEntry | undefined {
  return ventureBuyerMaster.find((entry) => entry.broker === broker);
}

export function primaryVentureCode(broker: string): string {
  return ventureEntryFor(broker)?.codes[0] ?? "";
}

export function ventureDisplayName(broker: string): string {
  return ventureEntryFor(broker)?.name ?? "VENTURE TEA (PVT) LTD";
}

export function isVentureSalesBuyer(broker: string, buyerCode: string | null | undefined) {
  const code = (buyerCode || "").trim();
  if (!code) return false;
  const upper = code.toUpperCase();
  // LC/EB sales books often store the company name with no short code.
  if (upper.includes("VENTURE")) return true;
  const known = ventureSalesBuyerCodes[broker] ?? [];
  return known.some((item) => upper === item || upper.startsWith(item));
}

export function formatVentureChip(broker: string, code?: string | null, name?: string | null) {
  const resolvedCode = (code || "").trim() || primaryVentureCode(broker) || "—";
  const resolvedName = (name || "").trim() || ventureDisplayName(broker);
  return `${broker}: ${resolvedCode} | ${resolvedName}`;
}
