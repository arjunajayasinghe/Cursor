import { NextResponse } from "next/server";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { getEffectiveAccess } from "@/lib/auth";
import { bulkUpsertMasterProcesses, type FlatUploadRow } from "@/lib/process-tree";

export async function POST(req: Request) {
  const access = await getEffectiveAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isMasterView || !access.isAetriaOperator) {
    return NextResponse.json(
      { error: "Bulk upload is only available on the Aetria Solution master library" },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let rows: FlatUploadRow[] = [];
  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      rows = parseCsv(buf.toString("utf8"));
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      rows = await parseXlsx(buf);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .csv or .xlsx" },
        { status: 400 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 });
  }

  const result = await bulkUpsertMasterProcesses(rows);
  return NextResponse.json({ ok: true, ...result });
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function mapRow(raw: Record<string, string>): FlatUploadRow | null {
  const entries = Object.entries(raw).map(([k, v]) => [normalizeHeader(k), String(v ?? "").trim()]);
  const get = (...keys: string[]) => {
    for (const [k, v] of entries) {
      if (keys.includes(k) && v) return v;
    }
    return "";
  };

  const code = get("code", "processcode", "id");
  const name = get("name", "processname", "title");
  if (!code || !name) return null;

  return {
    code,
    name,
    description: get("description", "desc") || undefined,
    parentCode: get("parentcode", "parent") || undefined,
    valueStreamCode: get("valuestream", "valuestreamcode", "vs") || undefined,
  };
}

function parseCsv(text: string): FlatUploadRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse error");
  }
  return parsed.data.map(mapRow).filter((r): r is FlatUploadRow => !!r);
}

async function parseXlsx(buf: Buffer): Promise<FlatUploadRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings accept Buffer-like
  await workbook.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Workbook has no sheets");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? "");
  });

  const rows: FlatUploadRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      const val = cell.value;
      raw[h] =
        val && typeof val === "object" && "text" in val
          ? String((val as { text: string }).text)
          : String(val ?? "");
    });
    const mapped = mapRow(raw);
    if (mapped) rows.push(mapped);
  });
  return rows;
}
