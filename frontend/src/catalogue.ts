export const centres = ["Colombo", "Mombasa", "Kochi", "Jakarta", "Kolkata"] as const;

export const brokers = [
  { code: "AS", name: "Asia Siyaka" },
  { code: "BC", name: "Bartleet" },
  { code: "CT", name: "Ceylon Tea Brokers" },
  { code: "EB", name: "Eastern Brokers" },
  { code: "FW", name: "Forbes & Walker" },
  { code: "JK", name: "John Keells" },
  { code: "LC", name: "Lanka Commodity Brokers" },
  { code: "MB", name: "Mercantile Brokers" },
] as const;

export type BrokerCode = (typeof brokers)[number]["code"];

export const grades = ["BOP", "BOPF", "OP", "OPA", "FBOP", "Pekoe", "Fannings", "Dust", "Dust1"] as const;

export const requiredColumns = [
  "lotNumber",
  "gardenMark",
  "invoiceNumber",
  "grade",
  "bags",
  "netWeightKg",
  "valuationPerKg",
] as const;

const currencyByCentre: Record<(typeof centres)[number], string> = {
  Colombo: "LKR",
  Mombasa: "KES",
  Kochi: "INR",
  Jakarta: "IDR",
  Kolkata: "INR",
};

export function currencyFor(centre: string) {
  return currencyByCentre[centre as (typeof centres)[number]] ?? "";
}

export function formatSaleDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

export function formatQuantity(value: number | string | null | undefined, digits: number) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(parsed);
}

export function brokerName(code: string) {
  return brokers.find((broker) => broker.code === code)?.name ?? code;
}

export function isAllowedCatalogueFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".dat");
}

export async function csvHeaderError(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) return null;
  const text = await file.slice(0, 4096).text();
  const line = text.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, "") ?? "";
  const columns = line.split(",").map((column) => column.trim().toLowerCase());
  const missing = requiredColumns.filter((column) => !columns.includes(column.toLowerCase()));
  if (missing.length === 0) return null;
  return `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`;
}
