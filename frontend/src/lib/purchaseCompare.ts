import type { Lot, PurchasedInvoiceLot, PurchasedInvoiceSummary } from "../api/client";

export type CompareMark = "match" | "priceDiff" | "pdfOnly" | "salesOnly";

export type ComparedLot = {
  key: string;
  broker: string;
  lotNumber: number;
  mark: CompareMark;
  sellingMark: string;
  grade: string;
  invoiceNumber: string;
  bags: number | null;
  netWeightKg: number | null;
  pdfPrice: number | null;
  salesPrice: number | null;
  proceeds: number | null;
  salesBuyer: string;
  notes: string;
};

/** Known Venture buyer codes used on post-auction sales files, by broker. */
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

export function comparePurchaseToSales(
  pdfLots: PurchasedInvoiceLot[],
  salesLots: Lot[],
  invoices: PurchasedInvoiceSummary[],
): ComparedLot[] {
  const invoiceBuyerByBroker = new Map(
    invoices.map((invoice) => [String(invoice.broker), invoice.buyerCode] as const),
  );

  const salesByKey = new Map<string, Lot>();
  for (const lot of salesLots) {
    const broker = String(lot.broker);
    const buyer = lot.buyerCode;
    if (!matchesInvoiceBuyer(broker, buyer, invoiceBuyerByBroker.get(broker))) continue;
    const key = `${broker}|${lot.lotNumber}`;
    // Prefer the row with a sold price if duplicates appear.
    const existing = salesByKey.get(key);
    if (!existing || (lot.soldPricePerKg != null && existing.soldPricePerKg == null)) {
      salesByKey.set(key, lot);
    }
  }

  const seen = new Set<string>();
  const rows: ComparedLot[] = [];

  for (const pdf of pdfLots) {
    const broker = String(pdf.broker);
    const key = `${broker}|${pdf.lotNumber}`;
    seen.add(key);
    const sales = salesByKey.get(key);
    if (!sales) {
      rows.push({
        key: `pdf-${pdf.id}`,
        broker,
        lotNumber: pdf.lotNumber,
        mark: "pdfOnly",
        sellingMark: pdf.sellingMark,
        grade: pdf.grade,
        invoiceNumber: pdf.invoiceNumber,
        bags: pdf.bags,
        netWeightKg: pdf.netWeightKg,
        pdfPrice: pdf.soldPricePerKg,
        salesPrice: null,
        proceeds: pdf.proceeds,
        salesBuyer: "",
        notes: "On PDF invoice only",
      });
      continue;
    }

    const salesPrice = sales.soldPricePerKg == null ? null : Number(sales.soldPricePerKg);
    const pdfPrice = Number(pdf.soldPricePerKg);
    const priceDiff =
      salesPrice != null && Number.isFinite(salesPrice) && !nearlyEqual(pdfPrice, salesPrice);
    const kgDiff =
      sales.netWeightKg != null &&
      Number.isFinite(Number(sales.netWeightKg)) &&
      !nearlyEqual(Number(pdf.netWeightKg), Number(sales.netWeightKg), 0.05);

    rows.push({
      key: `both-${pdf.id}`,
      broker,
      lotNumber: pdf.lotNumber,
      mark: priceDiff || kgDiff ? "priceDiff" : "match",
      sellingMark: pdf.sellingMark || sales.sellingMark || "",
      grade: pdf.grade || sales.grade || "",
      invoiceNumber: pdf.invoiceNumber || sales.invoiceNumber || "",
      bags: pdf.bags || Number(sales.bags) || null,
      netWeightKg: pdf.netWeightKg,
      pdfPrice,
      salesPrice,
      proceeds: pdf.proceeds,
      salesBuyer: String(sales.buyerCode || ""),
      notes: priceDiff
        ? `Price PDF ${pdfPrice.toFixed(2)} vs sales ${salesPrice!.toFixed(2)}`
        : kgDiff
          ? `Kg PDF ${Number(pdf.netWeightKg).toFixed(2)} vs sales ${Number(sales.netWeightKg).toFixed(2)}`
          : "Matched",
    });
  }

  for (const [key, sales] of salesByKey) {
    if (seen.has(key)) continue;
    const broker = String(sales.broker);
    rows.push({
      key: `sales-${sales.id}`,
      broker,
      lotNumber: Number(sales.lotNumber),
      mark: "salesOnly",
      sellingMark: sales.sellingMark || sales.gardenMark || "",
      grade: sales.grade || "",
      invoiceNumber: sales.invoiceNumber || "",
      bags: sales.bags == null ? null : Number(sales.bags),
      netWeightKg: sales.netWeightKg == null ? null : Number(sales.netWeightKg),
      pdfPrice: null,
      salesPrice: sales.soldPricePerKg == null ? null : Number(sales.soldPricePerKg),
      proceeds: null,
      salesBuyer: String(sales.buyerCode || ""),
      notes: "On sales file only",
    });
  }

  return rows.sort((a, b) => a.broker.localeCompare(b.broker) || a.lotNumber - b.lotNumber);
}

export function summarizeCompare(rows: ComparedLot[]) {
  const match = rows.filter((row) => row.mark === "match").length;
  const priceDiff = rows.filter((row) => row.mark === "priceDiff").length;
  const pdfOnly = rows.filter((row) => row.mark === "pdfOnly").length;
  const salesOnly = rows.filter((row) => row.mark === "salesOnly").length;
  return { match, priceDiff, pdfOnly, salesOnly, total: rows.length, issues: priceDiff + pdfOnly + salesOnly };
}

export const compareMarkStyle: Record<
  CompareMark,
  { label: string; chip: "success" | "warning" | "info" | "error"; rowBg: string; bar: string }
> = {
  match: { label: "Match", chip: "success", rowBg: "rgba(31, 77, 58, 0.06)", bar: "#1f4d3a" },
  priceDiff: { label: "Differs", chip: "warning", rowBg: "rgba(180, 120, 20, 0.12)", bar: "#b47814" },
  pdfOnly: { label: "PDF only", chip: "info", rowBg: "rgba(26, 95, 122, 0.12)", bar: "#1a5f7a" },
  salesOnly: { label: "Sales only", chip: "error", rowBg: "rgba(140, 63, 42, 0.12)", bar: "#8c3f2a" },
};
