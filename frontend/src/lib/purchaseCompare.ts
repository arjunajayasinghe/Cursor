import type { Lot, PurchasedInvoiceLot, PurchasedInvoiceSummary } from "../api/client";

export type CompareMark = "match" | "priceDiff" | "otherBuyer" | "pdfOnly" | "salesOnly";

export type SideValues = {
  buyerCode: string;
  buyerName: string;
  sellingMark: string;
  grade: string;
  invoiceNumber: string;
  bags: number | null;
  netWeightKg: number | null;
  price: number | null;
  proceeds: number | null;
};

export type ComparedLot = {
  key: string;
  broker: string;
  lotNumber: number;
  mark: CompareMark;
  pdf: SideValues | null;
  sales: SideValues | null;
  notes: string;
};

/**
 * Known Venture Tea buyer codes by broker (same company, different code each broker).
 * LC PDFs print `VT | VENTURE TEA (PVT) LTD`; LC/EB sales books often store the name only.
 * Do not confuse with lookalikes: AS VT01, BC VTC/VTE, CT VT (other buyers).
 */
export const ventureSalesBuyerCodes: Record<string, string[]> = {
  AS: ["VL01"],
  BC: ["VEN"],
  CT: ["VEN"],
  EB: ["VEN"],
  FW: ["VE1"],
  JK: ["VE04"],
  LC: ["VT"],
  MB: ["V06"],
};

/** Fallback display names when sales files only store the short code. */
export const knownSalesBuyerNames: Record<string, string> = {
  VL01: "Venture Tea Pvt. Ltd.",
  VEN: "VENTURE TEA (PVT) LTD",
  VE1: "VENTURE TEA PVT LTD",
  VE04: "VENTURE TEA",
  VT: "VENTURE TEA (PVT) LTD",
  V06: "VENTURE TEA (PVT) LTD",
};

export function formatBuyer(side: Pick<SideValues, "buyerCode" | "buyerName"> | null | undefined) {
  if (!side) return "";
  const code = (side.buyerCode || "").trim();
  const name = (side.buyerName || "").trim();
  if (code && name) return `${code} · ${name}`;
  return code || name;
}

export function buyerSearchText(side: SideValues | null | undefined) {
  if (!side) return "";
  return `${side.buyerCode} ${side.buyerName}`.trim().toLowerCase();
}

export function isVentureSalesBuyer(broker: string, buyerCode: string | null | undefined) {
  const code = (buyerCode || "").trim();
  if (!code) return false;
  const upper = code.toUpperCase();
  if (upper.includes("VENTURE")) return true;
  const known = ventureSalesBuyerCodes[broker] ?? [];
  return known.some((item) => upper === item || upper.startsWith(item));
}

export function matchesInvoiceBuyer(
  broker: string,
  salesBuyer: string | null | undefined,
  invoiceBuyerCode: string | null | undefined,
) {
  const sales = (salesBuyer || "").trim().toUpperCase();
  const invoice = (invoiceBuyerCode || "").trim().toUpperCase();
  if (!sales) return false;
  if (invoice && (sales === invoice || sales.startsWith(invoice) || invoice.startsWith(sales))) return true;
  return isVentureSalesBuyer(broker, sales);
}

function nearlyEqual(a: number, b: number, tolerance = 0.51) {
  return Math.abs(a - b) <= tolerance;
}

function normText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function normInvoiceNo(value: string | null | undefined) {
  return normText(value).replace(/^0+/, "");
}

function looksLikeBuyerName(value: string) {
  const raw = value.trim();
  if (!raw) return false;
  if (/\s/.test(raw) || raw.includes("(") || raw.includes("LTD") || raw.includes("LIMITED")) return true;
  return raw.length > 8;
}

function buildBuyerNameLookup(invoices: PurchasedInvoiceSummary[]) {
  const map = new Map<string, string>(Object.entries(knownSalesBuyerNames));
  for (const invoice of invoices) {
    const code = (invoice.buyerCode || "").trim().toUpperCase();
    const name = (invoice.buyerName || "").trim();
    if (code && name) map.set(code, name);
    for (const known of ventureSalesBuyerCodes[String(invoice.broker)] ?? []) {
      if (name) map.set(known.toUpperCase(), name);
    }
  }
  return map;
}

export function splitSalesBuyer(
  broker: string,
  rawBuyer: string | null | undefined,
  nameByCode: Map<string, string>,
  invoice?: PurchasedInvoiceSummary,
): { buyerCode: string; buyerName: string } {
  const raw = (rawBuyer || "").trim();
  if (!raw) return { buyerCode: "", buyerName: "" };

  if (looksLikeBuyerName(raw)) {
    const code =
      (invoice?.buyerCode || "").trim().toUpperCase() ||
      (isVentureSalesBuyer(broker, raw) ? (ventureSalesBuyerCodes[broker]?.[0] ?? "") : "");
    return { buyerCode: code, buyerName: raw };
  }

  const code = raw.toUpperCase();
  const fromMap = nameByCode.get(code) || "";
  const fromInvoice =
    (invoice?.buyerCode || "").trim().toUpperCase() === code ? (invoice?.buyerName || "").trim() : "";
  return { buyerCode: code, buyerName: fromMap || fromInvoice };
}

function fromPdf(pdf: PurchasedInvoiceLot, invoice: PurchasedInvoiceSummary | undefined): SideValues {
  return {
    buyerCode: (invoice?.buyerCode || "").trim(),
    buyerName: (invoice?.buyerName || "").trim(),
    sellingMark: pdf.sellingMark || "",
    grade: pdf.grade || "",
    invoiceNumber: pdf.invoiceNumber || "",
    bags: pdf.bags || null,
    netWeightKg: pdf.netWeightKg,
    price: pdf.soldPricePerKg,
    proceeds: pdf.proceeds,
  };
}

function fromSales(
  lot: Lot,
  broker: string,
  nameByCode: Map<string, string>,
  invoice: PurchasedInvoiceSummary | undefined,
): SideValues {
  const buyer = splitSalesBuyer(broker, lot.buyerCode, nameByCode, invoice);
  return {
    buyerCode: buyer.buyerCode,
    buyerName: buyer.buyerName,
    sellingMark: lot.sellingMark || lot.gardenMark || "",
    grade: lot.grade || "",
    invoiceNumber: lot.invoiceNumber || "",
    bags: lot.bags == null ? null : Number(lot.bags),
    netWeightKg: lot.netWeightKg == null ? null : Number(lot.netWeightKg),
    price: lot.soldPricePerKg == null ? null : Number(lot.soldPricePerKg),
    proceeds: null,
  };
}

function collectDiffNotes(pdf: SideValues, sales: SideValues): string[] {
  const notes: string[] = [];
  if (sales.price != null && pdf.price != null && !nearlyEqual(pdf.price, sales.price)) {
    notes.push(`Price PDF ${pdf.price.toFixed(2)} ≠ sales ${sales.price.toFixed(2)}`);
  }
  if (
    sales.netWeightKg != null &&
    pdf.netWeightKg != null &&
    !nearlyEqual(pdf.netWeightKg, sales.netWeightKg, 0.05)
  ) {
    notes.push(`Kg PDF ${pdf.netWeightKg.toFixed(2)} ≠ sales ${sales.netWeightKg.toFixed(2)}`);
  }
  if (sales.bags != null && pdf.bags != null && sales.bags > 0 && pdf.bags > 0 && sales.bags !== pdf.bags) {
    notes.push(`Bags PDF ${pdf.bags} ≠ sales ${sales.bags}`);
  }
  if (normInvoiceNo(pdf.invoiceNumber) && normInvoiceNo(sales.invoiceNumber) && normInvoiceNo(pdf.invoiceNumber) !== normInvoiceNo(sales.invoiceNumber)) {
    notes.push(`Invoice # PDF ${pdf.invoiceNumber} ≠ sales ${sales.invoiceNumber}`);
  }
  if (normText(pdf.grade) && normText(sales.grade) && normText(pdf.grade) !== normText(sales.grade)) {
    notes.push(`Grade PDF ${pdf.grade} ≠ sales ${sales.grade}`);
  }
  const pdfMark = normText(pdf.sellingMark);
  const salesMark = normText(sales.sellingMark);
  if (pdfMark && salesMark && pdfMark !== salesMark && !pdfMark.includes(salesMark) && !salesMark.includes(pdfMark)) {
    notes.push(`Mark PDF ${pdf.sellingMark} ≠ sales ${sales.sellingMark}`);
  }
  return notes;
}

export function comparePurchaseToSales(
  pdfLots: PurchasedInvoiceLot[],
  salesLots: Lot[],
  invoices: PurchasedInvoiceSummary[],
): ComparedLot[] {
  const invoiceByBroker = new Map(invoices.map((invoice) => [String(invoice.broker), invoice] as const));
  const nameByCode = buildBuyerNameLookup(invoices);

  // Any sales row for broker+lot (prefer a priced row).
  const salesAnyByKey = new Map<string, Lot>();
  for (const lot of salesLots) {
    const key = `${lot.broker}|${lot.lotNumber}`;
    const existing = salesAnyByKey.get(key);
    if (!existing || (lot.soldPricePerKg != null && existing.soldPricePerKg == null)) {
      salesAnyByKey.set(key, lot);
    }
  }

  const seen = new Set<string>();
  const rows: ComparedLot[] = [];

  for (const pdf of pdfLots) {
    const broker = String(pdf.broker);
    const key = `${broker}|${pdf.lotNumber}`;
    seen.add(key);
    const invoice = invoiceByBroker.get(broker);
    const pdfSide = fromPdf(pdf, invoice);
    const salesLot = salesAnyByKey.get(key);

    if (!salesLot) {
      rows.push({
        key: `pdf-${pdf.id}`,
        broker,
        lotNumber: pdf.lotNumber,
        mark: "pdfOnly",
        pdf: pdfSide,
        sales: null,
        notes: "On PDF invoice only — not on sales file",
      });
      continue;
    }

    const salesSide = fromSales(salesLot, broker, nameByCode, invoice);
    const salesBuyerKey = salesSide.buyerCode || salesSide.buyerName;
    const sameBuyer = matchesInvoiceBuyer(broker, salesBuyerKey, invoice?.buyerCode || invoice?.buyerName);

    if (!sameBuyer) {
      const blank = !salesBuyerKey && salesSide.price == null;
      rows.push({
        key: `both-${pdf.id}`,
        broker,
        lotNumber: pdf.lotNumber,
        mark: "otherBuyer",
        pdf: pdfSide,
        sales: salesSide,
        notes: blank
          ? `PDF ${formatBuyer(pdfSide) || "Venture"} · sales unsold/blank`
          : `PDF ${formatBuyer(pdfSide) || "Venture"} · sales ${formatBuyer(salesSide) || "—"}`,
      });
      continue;
    }

    // Lot number + Venture/same buyer on both sides → green Match.
    // Soft field diffs (mark/grade/kg/price) stay in notes only — they do not turn the row orange.
    const softNotes = collectDiffNotes(pdfSide, salesSide);
    rows.push({
      key: `both-${pdf.id}`,
      broker,
      lotNumber: pdf.lotNumber,
      mark: "match",
      pdf: pdfSide,
      sales: salesSide,
      notes: softNotes.length > 0 ? softNotes.join(" · ") : "Lot + buyer matched",
    });
  }

  // Venture purchases on sales that never appear on the PDF.
  for (const [key, salesLot] of salesAnyByKey) {
    if (seen.has(key)) continue;
    const broker = String(salesLot.broker);
    const invoice = invoiceByBroker.get(broker);
    const salesSide = fromSales(salesLot, broker, nameByCode, invoice);
    const salesBuyerKey = salesSide.buyerCode || salesSide.buyerName;
    if (!matchesInvoiceBuyer(broker, salesBuyerKey, invoice?.buyerCode || invoice?.buyerName)) continue;
    rows.push({
      key: `sales-${salesLot.id}`,
      broker,
      lotNumber: Number(salesLot.lotNumber),
      mark: "salesOnly",
      pdf: null,
      sales: salesSide,
      notes: "On sales file for this buyer — missing from PDF",
    });
  }

  return rows.sort((a, b) => a.broker.localeCompare(b.broker) || a.lotNumber - b.lotNumber);
}

export function summarizeCompare(rows: ComparedLot[]) {
  const match = rows.filter((row) => row.mark === "match").length;
  const priceDiff = rows.filter((row) => row.mark === "priceDiff").length;
  const otherBuyer = rows.filter((row) => row.mark === "otherBuyer").length;
  const pdfOnly = rows.filter((row) => row.mark === "pdfOnly").length;
  const salesOnly = rows.filter((row) => row.mark === "salesOnly").length;
  return {
    match,
    priceDiff,
    otherBuyer,
    pdfOnly,
    salesOnly,
    total: rows.length,
    issues: priceDiff + otherBuyer + pdfOnly + salesOnly,
  };
}

export const compareMarkStyle: Record<
  CompareMark,
  { label: string; chip: "success" | "warning" | "info" | "error" | "default"; rowBg: string; bar: string }
> = {
  match: { label: "Match", chip: "success", rowBg: "rgba(46, 125, 50, 0.18)", bar: "#2e7d32" },
  priceDiff: { label: "Differs", chip: "warning", rowBg: "rgba(180, 120, 20, 0.12)", bar: "#b47814" },
  otherBuyer: { label: "Other buyer", chip: "default", rowBg: "rgba(90, 70, 40, 0.10)", bar: "#6b4f2a" },
  pdfOnly: { label: "PDF only", chip: "info", rowBg: "rgba(26, 95, 122, 0.12)", bar: "#1a5f7a" },
  salesOnly: { label: "Sales only", chip: "error", rowBg: "rgba(140, 63, 42, 0.12)", bar: "#8c3f2a" },
};
