import * as XLSX from "xlsx";
import { analyzePrReport, type PrImportResult } from "../pr/pr-import";

export type ParsedTable = { headers: string[]; rows: Array<Record<string, string>>; format: string };

export type Mismatch = {
  key: string;
  field: string;
  existing: string;
  incoming: string;
  preferred: string;
  action: "keep_existing" | "apply_incoming" | "exception";
};

export type ReconcilePlanRow = {
  action: "create" | "update" | "skip";
  key: string;
  recordId?: string;
  payload: Record<string, string | number | null>;
  mismatches: Mismatch[];
};

export type AnalyzePlan = {
  headers: string[];
  preview: Array<Record<string, string>>;
  rowCount: number;
  errors: Array<{ line?: number; message: string }>;
  plan: ReconcilePlanRow[];
  createCount: number;
  updateCount: number;
  skipCount: number;
  mismatchCount: number;
  fieldPriority: Record<string, string>;
  moduleKey: string;
};

const OPERATIONAL_FIELDS = new Set([
  "notes",
  "handler",
  "buyer",
  "priority",
  "importNo",
  "piNo",
  "paymentTerms",
  "quality",
  "closedBy",
  "location",
]);

export function parseTabularPayload(input: {
  text?: string;
  base64?: string;
  fileName?: string;
  formatHint?: string;
}): ParsedTable {
  const name = (input.fileName || "").toLowerCase();
  const hint = (input.formatHint || "").toLowerCase();
  const isXlsx =
    hint === "xlsx" ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    Boolean(input.base64 && (hint === "xlsx" || name.includes(".xls")));

  if (isXlsx && input.base64) {
    const buf = Buffer.from(input.base64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    // SAP backlog workbooks use Summary + Report — prefer Report / data sheets.
    const preferred =
      wb.SheetNames.find((n) => /^report$/i.test(n)) ||
      wb.SheetNames.find((n) => /may\s*-?\s*2026/i.test(n)) ||
      wb.SheetNames.find((n) => !/summary|sheet\d+/i.test(n)) ||
      wb.SheetNames[0];
    const sheet = wb.Sheets[preferred];
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    // May smart sheet: row0 = owners, row1 = headers
    const look = matrix.slice(0, 5) as string[][];
    const headerIdx = look.findIndex((r) =>
      r.some((c) => /^(pr number|purch\.?req\.?|po no\.?|purchasing document)$/i.test(String(c ?? "").trim())),
    );
    const sliced = headerIdx > 0 ? matrix.slice(headerIdx) : matrix;
    return matrixToTable(sliced as string[][], "xlsx");
  }

  const text = (input.text || (input.base64 ? Buffer.from(input.base64, "base64").toString("utf8") : "")).replace(
    /^\uFEFF/,
    "",
  );
  if (!text.trim()) return { headers: [], rows: [], format: "text" };
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim());
  const delim =
    hint === "tsv" || name.endsWith(".tsv") || (lines[0] || "").includes("\t")
      ? "\t"
      : ",";
  const matrix = lines.map((line) => splitDelimited(line, delim));
  return matrixToTable(matrix, delim === "\t" ? "tsv" : "csv");
}

function splitDelimited(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t");
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function matrixToTable(matrix: string[][], format: string): ParsedTable {
  if (!matrix.length) return { headers: [], rows: [], format };
  const headerIndex = matrix.findIndex((r) => r.some((c) => String(c ?? "").trim()));
  if (headerIndex < 0) return { headers: [], rows: [], format };
  const headers = matrix[headerIndex].map((h) => String(h ?? "").trim());
  const rows = matrix
    .slice(headerIndex + 1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, String(cells[i] ?? "").trim()])));
  return { headers, rows, format };
}

export function tableToTsv(table: ParsedTable): string {
  const escape = (v: string) => v.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  return [table.headers.map(escape).join("\t"), ...table.rows.map((r) => table.headers.map((h) => escape(r[h] || "")).join("\t"))].join(
    "\n",
  );
}

const PO_MAP: Record<string, string> = {
  "Purchasing Document": "poNo",
  "PO Number": "poNo",
  "PO No.": "poNo",
  "PO No:": "poNo",
  poNo: "poNo",
  Item: "line",
  Line: "line",
  "PO Line No.": "line",
  "Document Date": "date",
  "PO Date": "date",
  Vendor: "supplierCode",
  "Vendor Name": "supplier",
  Supplier: "supplier",
  "Supplier/Supplying Plant": "supplier",
  Code: "supplierCode",
  Material: "materialCode",
  "Short Text": "material",
  Quantity: "quantity",
  "Order Quantity": "quantity",
  Un: "uom",
  UOM: "uom",
  "Order Unit": "uom",
  Currency: "currency",
  "PO Line Currency": "currency",
  "Net Price": "unitPrice",
  "Unit Price": "unitPrice",
  Incoterms: "incoterm",
  "Delivery Term": "incoterm",
  PR: "prId",
  "PR No.": "prId",
  "PR number": "prId",
  "Purch.Req.": "prId",
  Plant: "plant",
  Notes: "notes",
  PI: "piNo",
  "IMPORT NUMBER": "importNo",
  "Import No.": "importNo",
  "Payment Term": "paymentTerms",
};

const GRN_MAP: Record<string, string> = {
  "Material Document": "grnNo",
  grnNo: "grnNo",
  "Material Doc. Year": "year",
  Year: "year",
  Item: "item",
  "Movement Type": "movement",
  "Posting Date": "posted",
  Plant: "plant",
  Quantity: "received",
  Un: "uom",
  UOM: "uom",
  PO: "poId",
  "Purchasing Document": "poId",
  PR: "prId",
  Notes: "notes",
  Location: "location",
};

function normHeader(h: string) {
  return h.trim().replace(/ +/g, " ").toLowerCase();
}

function mapRows(table: ParsedTable, map: Record<string, string>) {
  const headerLookup = new Map(table.headers.map((h) => [normHeader(h), h]));
  const positions = Object.entries(map)
    .map(([src, dest]) => {
      const actual = headerLookup.get(normHeader(src));
      return actual ? ([actual, dest] as const) : null;
    })
    .filter(Boolean) as Array<readonly [string, string]>;
  return table.rows.map((row, idx) => {
    const payload: Record<string, string> = {};
    for (const [src, dest] of positions) payload[dest] = row[src] ?? "";
    return { line: idx + 2, payload };
  });
}

function normalizeCompare(value: string): string {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return v;
}

function decideField(
  field: string,
  existing: string | null | undefined,
  incoming: string | null | undefined,
  priority: Record<string, string>,
): Mismatch | null {
  const a = String(existing ?? "").trim();
  const b = String(incoming ?? "").trim();
  if (!b || a === b || normalizeCompare(a) === normalizeCompare(b)) return null;
  const preferred = (priority[field] || (OPERATIONAL_FIELDS.has(field) ? "W" : "S")).toUpperCase();
  if (preferred === "W" || OPERATIONAL_FIELDS.has(field)) {
    return { key: "", field, existing: a, incoming: b, preferred, action: a ? "keep_existing" : "apply_incoming" };
  }
  if (preferred === "S" || preferred === "E" || preferred === "A" || preferred === "M") {
    return {
      key: "",
      field,
      existing: a,
      incoming: b,
      preferred,
      action: a && a !== b ? "exception" : "apply_incoming",
    };
  }
  return { key: "", field, existing: a, incoming: b, preferred, action: "keep_existing" };
}

export function analyzePrAgainstExisting(
  table: ParsedTable,
  existing: Array<{ id: string; recordId: string; prNo: string; line: string; plant?: string | null; imported?: boolean; notes?: string | null; material?: string | null; quantity?: unknown }>,
  fieldPriority: Record<string, string>,
): AnalyzePlan {
  const tsv = tableToTsv(table);
  let analyzed: PrImportResult;
  try {
    analyzed = analyzePrReport(
      tsv,
      existing.map((e) => ({ id: e.id, prNo: e.prNo, line: e.line, plant: e.plant, imported: e.imported })),
    );
  } catch (e) {
    return emptyPlan("pr", fieldPriority, [{ message: (e as Error).message }]);
  }

  const byKey = new Map(existing.map((e) => [`${e.prNo}/${e.line}`, e]));
  const plan: ReconcilePlanRow[] = [];

  for (const r of analyzed.records) {
    const key = `${r.prNo}/${r.line}`;
    plan.push({
      action: "create",
      key,
      payload: r as unknown as Record<string, string | number | null>,
      mismatches: [],
    });
  }

  // Reconcile existing keys present in the file (duplicates / plant fills / field updates)
  const mapped = mapRows(table, {
    "Purch.Req.": "prNo",
    "PR number": "prNo",
    "PR Number": "prNo",
    Item: "line",
    "PR Line No.": "line",
    "Short Text": "material",
    "Item Description": "material",
    Quantity: "quantity",
    "    Quantity": "quantity",
    "Order Qty": "quantity",
    Un: "uom",
    UOM: "uom",
    Plnt: "plant",
    Plant: "plant",
    Material: "materialCode",
    "Item Code": "materialCode",
    "Material Group Desc.": "materialGroup",
    "Created by": "createdBy",
    "Requested By": "requester",
    "Req.Date": "date",
    "PR Date": "date",
    "Local/Import": "sourcing",
    "Stock/Non-Stock": "stockType",
    Notes: "notes",
  });
  for (const { payload } of mapped) {
    if (!payload.prNo || !payload.line) continue;
    const line = payload.line.padStart(5, "0");
    const key = `${payload.prNo}/${line}`;
    const cur = byKey.get(key);
    if (!cur) continue;
    if (plan.some((p) => p.key === key)) continue;
    const mismatches: Mismatch[] = [];
    const updates: Record<string, string | number | null> = {};
    for (const field of ["material", "quantity", "uom", "plant", "notes", "materialGroup", "createdBy"] as const) {
      const m = decideField(field, String((cur as any)[field] ?? ""), payload[field], fieldPriority);
      if (!m) continue;
      m.key = key;
      mismatches.push(m);
      if (m.action === "apply_incoming" || m.action === "exception") {
        // exception still applies SAP for S-priority identity/reference fields; notes never overwrite
        if (field === "notes") continue;
        updates[field] = field === "quantity" ? Number(String(payload[field]).replaceAll(",", "")) : payload[field];
      }
    }
    if (Object.keys(updates).length || mismatches.length) {
      plan.push({
        action: Object.keys(updates).length ? "update" : "skip",
        key,
        recordId: cur.recordId,
        payload: updates,
        mismatches,
      });
    } else {
      plan.push({ action: "skip", key, recordId: cur.recordId, payload: {}, mismatches: [] });
    }
  }

  return summarize("pr", fieldPriority, table, plan, analyzed.errors);
}

export function analyzePoAgainstExisting(
  table: ParsedTable,
  existing: Array<Record<string, unknown>>,
  fieldPriority: Record<string, string>,
): AnalyzePlan {
  const mapped = mapRows(table, PO_MAP);
  const byKey = new Map(existing.map((e) => [`${e.poNo}/${e.line}`, e]));
  const plan: ReconcilePlanRow[] = [];
  const errors: Array<{ line?: number; message: string }> = [];
  const seen = new Set<string>();

  if (
    !table.headers.some((h) =>
      ["purchasing document", "po number", "pono", "po no.", "po no:"].includes(normHeader(h)),
    )
  ) {
    errors.push({ message: "PO file needs Purchasing Document / PO Number / PO No. column" });
  }

  for (const { line, payload } of mapped) {
    if (!payload.poNo || !payload.line) {
      errors.push({ line, message: "PO number and item are required" });
      continue;
    }
    const item = payload.line.padStart(5, "0");
    const key = `${payload.poNo}/${item}`;
    if (seen.has(key)) {
      plan.push({ action: "skip", key, payload: {}, mismatches: [] });
      continue;
    }
    seen.add(key);
    const cur = byKey.get(key);
    const normalized: Record<string, string | number | null> = {
      ...payload,
      line: item,
      quantity: payload.quantity ? Number(String(payload.quantity).replaceAll(",", "")) : null,
      unitPrice: payload.unitPrice ? Number(String(payload.unitPrice).replaceAll(",", "")) : null,
    };
    if (!cur) {
      plan.push({ action: "create", key, payload: normalized, mismatches: [] });
      continue;
    }
    const mismatches: Mismatch[] = [];
    const updates: Record<string, string | number | null> = {};
    for (const field of Object.keys(normalized)) {
      if (["poNo", "line"].includes(field)) continue;
      const m = decideField(field, String(cur[field] ?? ""), String(normalized[field] ?? ""), fieldPriority);
      if (!m) continue;
      m.key = key;
      mismatches.push(m);
      if ((m.action === "apply_incoming" || m.action === "exception") && field !== "notes") {
        updates[field] = normalized[field];
      }
    }
    plan.push({
      action: Object.keys(updates).length ? "update" : "skip",
      key,
      recordId: String(cur.recordId),
      payload: updates,
      mismatches,
    });
  }

  return summarize("po", fieldPriority, table, plan, errors);
}

export function analyzeGrnAgainstExisting(
  table: ParsedTable,
  existing: Array<Record<string, unknown>>,
  fieldPriority: Record<string, string>,
): AnalyzePlan {
  const mapped = mapRows(table, GRN_MAP);
  const byKey = new Map(
    existing.map((e) => [`${e.grnNo}/${e.year}/${e.item || ""}`, e]),
  );
  const plan: ReconcilePlanRow[] = [];
  const errors: Array<{ line?: number; message: string }> = [];
  const seen = new Set<string>();

  for (const { line, payload } of mapped) {
    if (!payload.grnNo || !payload.year) {
      errors.push({ line, message: "Material document and year are required" });
      continue;
    }
    const item = (payload.item || "0001").padStart(4, "0");
    const key = `${payload.grnNo}/${payload.year}/${item}`;
    if (seen.has(key)) {
      plan.push({ action: "skip", key, payload: {}, mismatches: [] });
      continue;
    }
    seen.add(key);
    const cur = byKey.get(key);
    const normalized: Record<string, string | number | null> = {
      ...payload,
      item,
      year: Number(payload.year),
      received: payload.received ? Number(String(payload.received).replaceAll(",", "")) : null,
    };
    if (!cur) {
      plan.push({ action: "create", key, payload: normalized, mismatches: [] });
      continue;
    }
    const mismatches: Mismatch[] = [];
    const updates: Record<string, string | number | null> = {};
    for (const field of Object.keys(normalized)) {
      if (["grnNo", "year", "item"].includes(field)) continue;
      const m = decideField(field, String(cur[field] ?? ""), String(normalized[field] ?? ""), fieldPriority);
      if (!m) continue;
      m.key = key;
      mismatches.push(m);
      if ((m.action === "apply_incoming" || m.action === "exception") && field !== "notes") {
        updates[field] = normalized[field];
      }
    }
    plan.push({
      action: Object.keys(updates).length ? "update" : "skip",
      key,
      recordId: String(cur.recordId),
      payload: updates,
      mismatches,
    });
  }

  return summarize("grn", fieldPriority, table, plan, errors);
}

function emptyPlan(
  moduleKey: string,
  fieldPriority: Record<string, string>,
  errors: Array<{ line?: number; message: string }>,
): AnalyzePlan {
  return {
    headers: [],
    preview: [],
    rowCount: 0,
    errors,
    plan: [],
    createCount: 0,
    updateCount: 0,
    skipCount: 0,
    mismatchCount: 0,
    fieldPriority,
    moduleKey,
  };
}

function summarize(
  moduleKey: string,
  fieldPriority: Record<string, string>,
  table: ParsedTable,
  plan: ReconcilePlanRow[],
  errors: Array<{ line?: number; message: string }>,
): AnalyzePlan {
  return {
    headers: table.headers,
    preview: table.rows.slice(0, 25),
    rowCount: table.rows.length,
    errors,
    plan,
    createCount: plan.filter((p) => p.action === "create").length,
    updateCount: plan.filter((p) => p.action === "update").length,
    skipCount: plan.filter((p) => p.action === "skip").length,
    mismatchCount: plan.reduce((n, p) => n + p.mismatches.filter((m) => m.action === "exception").length, 0),
    fieldPriority,
    moduleKey,
  };
}

export function integrationModule(key: string): "pr" | "po" | "grn" | null {
  if (key.includes("pr")) return "pr";
  if (key.includes("po")) return "po";
  if (key.includes("grn") || key.includes("goods")) return "grn";
  return null;
}
