/** Port of GUI handoff pr-import.js — SAP Report column mapping + validation stub. */

export const sapPrColumns: Record<string, string> = {
  PGr: "purchasingGroup",
  "Purch.Req.": "prNo",
  "Req.Date": "date",
  Chngd: "changed",
  "Release Dt": "approved",
  "PR Received Date": "reportReceived",
  "Report Date": "reportDate",
  "Delay in Days": "reportDelay",
  "Delay Category": "delayBand",
  Item: "line",
  Material: "materialCode",
  "Short Text": "material",
  Un: "uom",
  Quantity: "quantity",
  "Created by": "createdBy",
  "Local/Import": "sourcing",
  "Stock/Non-Stock": "stockType",
  "Material Group Desc.": "materialGroup",
};

export type ExistingPrItem = { id: string; prNo: string; line: string; plant?: string | null; imported?: boolean };

export type PrImportRecord = {
  prNo: string;
  line: string;
  status: string;
  imported: boolean;
  quantity: number;
  reportDelay: number | null;
  [key: string]: string | number | boolean | null;
};

export type PrImportResult = {
  records: PrImportRecord[];
  plants: Array<{ id: string; plant: string }>;
  errors: Array<{ line: number; message: string }>;
  duplicates: number;
  groups: number;
};

const sapDateKeys = ["date", "changed", "approved", "reportReceived", "reportDate"];

export function prNumberKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^0+(?=\d)/, "");
}

export function prItemKey(number: unknown, line: unknown): string {
  return `${prNumberKey(number)}/${prNumberKey(line)}`;
}

function parseSapDate(value: string): string | null {
  if (!value) return "";
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const named = /^(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})$/i.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!named && !iso) return null;
  const year = iso ? Number(iso[1]) : Number(named![3]) + (named![3].length === 2 ? 2000 : 0);
  const month = iso ? Number(iso[2]) : months.indexOf(named![2].toLowerCase()) + 1;
  const day = iso ? Number(iso[3]) : Number(named![1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

export function analyzePrReport(text: string, existing: ExistingPrItem[]): PrImportResult {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .map((line, i) => ({ line: i + 1, cells: line.split("\t") }));
  return analyzePrRows(rows, existing);
}

function analyzePrRows(
  rows: Array<{ line: number; cells: string[] }>,
  existing: ExistingPrItem[],
): PrImportResult {
  const headerIndex = rows.findIndex((row) => row.cells.some((c) => String(c ?? "").trim()));
  const normalize = (value: unknown) =>
    String(value ?? "")
      .trim()
      .replace(/ +/g, " ")
      .toLowerCase();
  const headers = (rows[headerIndex]?.cells || []).map(normalize);
  const positions = Object.entries(sapPrColumns).map(
    ([header, key]) => [header, key, headers.indexOf(normalize(header))] as const,
  );
  const missing = positions.filter(([, , i]) => i < 0).map(([h]) => h);
  if (missing.length) {
    throw new Error(`Required report columns are missing: ${missing.join(", ")}.`);
  }
  const plantColumn = headers.findIndex((h) => h === "plnt" || h === "plant");
  const allPositions =
    plantColumn >= 0 ? [...positions, ["Plnt", "plant", plantColumn] as const] : positions;

  const existingItems = new Map(existing.map((r) => [prItemKey(r.prNo, r.line), r]));
  const seen = new Set<string>();
  const records: PrImportRecord[] = [];
  const plants: Array<{ id: string; plant: string }> = [];
  const errors: Array<{ line: number; message: string }> = [];
  let duplicates = 0;

  for (const { line, cells } of rows.slice(headerIndex + 1)) {
    if (!cells.some((c) => String(c ?? "").trim())) continue;
    const error = (message: string) => errors.push({ line, message });
    if (cells.length !== headers.length) {
      error("Column count differs from the header.");
      continue;
    }
    const r: Record<string, string> = Object.fromEntries(
      allPositions.map(([, key, j]) => [key, String(cells[j] ?? "").trim()]),
    );
    if (!/^\d{1,10}$/.test(r.prNo) || !/^\d{1,5}$/.test(r.line) || !Number(r.prNo) || !Number(r.line)) {
      error("Invalid PR number or item number.");
      continue;
    }
    if (!r.material || !r.uom) {
      error("Material description and unit are required.");
      continue;
    }
    if (
      !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(r.quantity) ||
      !Number.isFinite(Number(r.quantity.replaceAll(",", ""))) ||
      Number(r.quantity.replaceAll(",", "")) <= 0
    ) {
      error("Quantity must be a positive number.");
      continue;
    }
    const quantity = Number(r.quantity.replaceAll(",", ""));
    const badDate = sapDateKeys.find((k) => parseSapDate(r[k] ?? "") === null);
    if (badDate || !r.date) {
      error(`Invalid or missing date in ${allPositions.find(([, k]) => k === (badDate || "date"))?.[0]}.`);
      continue;
    }
    const dates: Record<string, string> = {};
    sapDateKeys.forEach((k) => {
      dates[k] = parseSapDate(r[k] ?? "") || "";
    });
    if (r.reportDelay && !/^-?\d+$/.test(r.reportDelay)) {
      error("Delay in Days must be a whole number.");
      continue;
    }
    const reportDelay = r.reportDelay === "" ? null : Number(r.reportDelay);
    const key = prItemKey(r.prNo, r.line);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const current = existingItems.get(key);
    if (current) {
      if (current.imported && !current.plant && r.plant) plants.push({ id: current.id, plant: r.plant });
      else duplicates++;
      continue;
    }
    records.push({
      ...r,
      ...dates,
      quantity,
      reportDelay,
      prNo: r.prNo,
      line: r.line.padStart(5, "0"),
      status: r.approved ? "Released" : "Release unverified",
      imported: true,
    } as PrImportRecord);
  }

  return {
    records,
    plants,
    errors,
    duplicates,
    groups: new Set(records.map((r) => prNumberKey(r.prNo))).size,
  };
}
