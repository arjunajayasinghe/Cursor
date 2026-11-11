/**
 * Load real Alumex files into Nest/Postgres (delta upsert):
 *  1) Smart Sheet May-2026 = filled operational spine (PR/PO/shipment)
 *  2) SAP PR Created but PO Pending = PR backlog enrich
 *  3) SAP PO to Delivery Pending = PO backlog enrich
 *
 * Usage (from apps/api):
 *   npx tsx scripts/import-real-data.ts
 *   npx tsx scripts/import-real-data.ts --fixtures-only
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

const ROOT = path.resolve(__dirname, "../../../");
const REAL = path.join(ROOT, "samples/real");
const FIXTURES = path.join(ROOT, "apps/web/src/lib/fixtures");

const prisma = new PrismaClient();

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  // case/space tolerant
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
  for (const k of keys) {
    const actual = map.get(norm(k));
    if (actual && row[actual] != null && String(row[actual]).trim() !== "") return String(row[actual]).trim();
  }
  return "";
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function asDate(v: string): Date | null {
  if (!v) return null;
  // Excel serial
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + serial * 86400000);
    }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function padLine(v: string): string {
  const n = String(v || "").replace(/\.0$/, "");
  const digits = n.replace(/\D/g, "") || "10";
  return digits.padStart(5, "0");
}

function prNo(v: string): string {
  return String(v || "")
    .replace(/\.0$/, "")
    .replace(/,/g, "")
    .trim();
}

function sheetRows(file: string, prefer: RegExp[]): Array<Record<string, unknown>> {
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", cellDates: true });
  const name =
    wb.SheetNames.find((n) => prefer.some((re) => re.test(n))) ||
    wb.SheetNames.find((n) => !/summary|sheet\d+/i.test(n)) ||
    wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown as string[][];
  const headerIdx = matrix.findIndex((r) =>
    r.some((c) => /^(pr number|purch\.?req\.?|po no\.?|purchasing document)$/i.test(String(c ?? "").trim())),
  );
  const start = headerIdx >= 0 ? headerIdx : 0;
  const headers = matrix[start].map((h) => String(h ?? "").trim());
  return matrix
    .slice(start + 1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
}

function recordId(prefix: string, a: string, b: string) {
  const h = createHash("sha1").update(`${prefix}:${a}/${b}`).digest("hex").slice(0, 10);
  return `${prefix}-${h}`;
}

async function importMay() {
  const file = path.join(REAL, "smart-sheet-may-2026.xls");
  const rows = sheetRows(file, [/may/i]);
  let prUpsert = 0;
  let poUpsert = 0;
  let shipUpsert = 0;
  const prGroups = new Map<string, any>();
  const poList: any[] = [];

  for (const row of rows) {
    const pr = prNo(cell(row, "PR number", "PR Number"));
    const line = padLine(cell(row, "PR Line No.", "Item"));
    if (!pr) continue;
    const material = cell(row, "Item Description", "Item Name", "Short Text") || "—";
    const qty = num(cell(row, "Order Qty", "Qty")) ?? 1;
    const plant = cell(row, "Plant");
    const requester = cell(row, "Requested By");
    const uom = cell(row, "UOM") || null;
    const materialCode = cell(row, "Item Code", "Code") || null;
    const status = cell(row, "Delivery Status") || (cell(row, "PO No:", "PO No.") ? "PO raised" : "In process");
    const need = asDate(cell(row, "Expected Delivery Date", "Requested Delivery Date"));
    const date = asDate(cell(row, "PR Date"));

    const prRecordId = recordId("PR", pr, line);
    await prisma.purchaseRequisition.upsert({
      where: { recordId: prRecordId },
      create: {
        recordId: prRecordId,
        prNo: pr,
        line,
        date,
        requester: requester || null,
        plant: plant || null,
        materialCode,
        material,
        quantity: new Prisma.Decimal(qty),
        uom,
        need,
        status,
        imported: true,
        notes: cell(row, "Remarks") || null,
        sourcing: cell(row, "Stock/Non-Stock") ? null : null,
        stockType: cell(row, "Stock/Non-Stock") || null,
        buyer: cell(row, "Shipment Handling By") || null,
      },
      update: {
        requester: requester || undefined,
        plant: plant || undefined,
        materialCode: materialCode || undefined,
        material,
        quantity: new Prisma.Decimal(qty),
        uom: uom || undefined,
        need: need || undefined,
        status,
        imported: true,
      },
    });
    prUpsert++;

    const g = prGroups.get(pr) || {
      prNo: pr,
      lineCount: 0,
      requester,
      department: null,
      plant,
      date: date ? date.toISOString().slice(0, 10) : null,
      buyer: cell(row, "Shipment Handling By") || null,
      priority: "Normal",
      statuses: new Set<string>(),
      material,
      quantity: 0,
      lines: [] as any[],
    };
    g.lineCount += 1;
    g.quantity += qty;
    g.statuses.add(status);
    g.lines.push({
      id: prRecordId,
      recordId: prRecordId,
      prNo: pr,
      line,
      date: date ? date.toISOString().slice(0, 10) : null,
      requester,
      plant,
      materialCode,
      material,
      quantity: qty,
      uom,
      need: need ? need.toISOString().slice(0, 10) : null,
      buyer: cell(row, "Shipment Handling By") || null,
      priority: "Normal",
      status,
    });
    prGroups.set(pr, g);

    const po = prNo(cell(row, "PO No:", "PO No."));
    const poLine = padLine(cell(row, "PO Line No.") || line);
    if (po) {
      const poRecordId = recordId("PO", po, poLine);
      const supplier = cell(row, "Supplier") || null;
      const importNo = cell(row, "IMPORT NUMBER", "Import No.") || null;
      const currency = cell(row, "PO Line Currency") || null;
      const unitPrice = num(cell(row, "Unit Price"));
      const poDate = asDate(cell(row, "Date of PO raised"));
      const linked = await prisma.purchaseRequisition.findUnique({ where: { recordId: prRecordId } });
      await prisma.purchaseOrder.upsert({
        where: { recordId: poRecordId },
        create: {
          recordId: poRecordId,
          prId: pr,
          purchaseRequisitionId: linked?.id,
          poNo: po,
          line: poLine,
          date: poDate,
          supplier,
          materialCode,
          material,
          quantity: new Prisma.Decimal(qty),
          uom,
          currency,
          unitPrice: unitPrice != null ? new Prisma.Decimal(unitPrice) : null,
          importNo,
          paymentTerms: cell(row, "Payment Term") || null,
          incoterm: cell(row, "Delivery Term") || null,
          status: cell(row, "Shipment Status") || "Sent to supplier",
          notes: cell(row, "Remarks") || null,
        },
        update: {
          supplier: supplier || undefined,
          material,
          quantity: new Prisma.Decimal(qty),
          importNo: importNo || undefined,
          currency: currency || undefined,
          unitPrice: unitPrice != null ? new Prisma.Decimal(unitPrice) : undefined,
          status: cell(row, "Shipment Status") || undefined,
          purchaseRequisitionId: linked?.id,
        },
      });
      poUpsert++;
      poList.push({
        id: poRecordId,
        recordId: poRecordId,
        prId: pr,
        poNo: po,
        line: poLine,
        date: poDate ? poDate.toISOString().slice(0, 10) : null,
        supplier,
        materialCode,
        material,
        quantity: qty,
        uom,
        currency,
        unitPrice,
        importNo,
        status: cell(row, "Shipment Status") || "Sent to supplier",
      });

      const mode = cell(row, "Air/Sea/Courier") || null;
      const importKey = importNo || `IMP-${po}`;
      if (mode || cell(row, "ETD") || cell(row, "ETA") || cell(row, "Freight Forwarder")) {
        const shipRecordId = recordId("SH", po, poLine);
        const poRow = await prisma.purchaseOrder.findUnique({ where: { recordId: poRecordId } });
        const ship = await prisma.shipment.upsert({
          where: { recordId: shipRecordId },
          create: {
            recordId: shipRecordId,
            poId: po,
            purchaseOrderId: poRow?.id,
            mode,
            importNo: importKey,
            forwarder: cell(row, "Freight Forwarder") || null,
            etd: asDate(cell(row, "ETD")),
            eta: asDate(cell(row, "ETA")),
            origin: cell(row, "Country") || null,
            status: cell(row, "Shipment Status") || "In transit",
            notes: cell(row, "Remarks") || null,
          },
          update: {
            mode: mode || undefined,
            forwarder: cell(row, "Freight Forwarder") || undefined,
            etd: asDate(cell(row, "ETD")) || undefined,
            eta: asDate(cell(row, "ETA")) || undefined,
            status: cell(row, "Shipment Status") || undefined,
            purchaseOrderId: poRow?.id,
          },
        });
        if (poRow) {
          await prisma.shipmentLineAllocation.upsert({
            where: { id: recordId("AL", po, poLine) },
            create: {
              id: recordId("AL", po, poLine),
              shipmentId: ship.id,
              purchaseOrderId: poRow.id,
              poNo: po,
              line: poLine,
              quantity: new Prisma.Decimal(qty),
              mode,
              status: "allocated",
              shippedQty: num(cell(row, "Received Qty")),
              shortQty: num(cell(row, "Pending Qty")),
            },
            update: {
              quantity: new Prisma.Decimal(qty),
              mode: mode || undefined,
              shippedQty: num(cell(row, "Received Qty")),
              shortQty: num(cell(row, "Pending Qty")),
            },
          });
        }
        shipUpsert++;
      }
    }
  }

  return { prUpsert, poUpsert, shipUpsert, prGroups, poList };
}

async function enrichSapPr() {
  const file = path.join(REAL, "pr-created-po-pending.xlsx");
  const rows = sheetRows(file, [/report/i]);
  let n = 0;
  for (const row of rows) {
    const pr = prNo(cell(row, "Purch.Req."));
    const line = padLine(cell(row, "Item"));
    if (!pr) continue;
    const material = cell(row, "Short Text") || "—";
    const qty = num(cell(row, "Quantity", "    Quantity")) ?? 1;
    const record = recordId("PR", pr, line);
    const delay = num(cell(row, "Delay in Days"));
    await prisma.purchaseRequisition.upsert({
      where: { recordId: record },
      create: {
        recordId: record,
        prNo: pr,
        line,
        date: asDate(cell(row, "Req.Date")),
        purchasingGroup: cell(row, "PGr") || null,
        createdBy: cell(row, "Created by") || null,
        plant: cell(row, "Plnt", "Plant") || null,
        materialCode: cell(row, "Material") || null,
        material,
        quantity: new Prisma.Decimal(qty),
        uom: cell(row, "Un") || null,
        reportDelay: delay,
        delayBand: cell(row, "Delay Category") || null,
        reportDate: asDate(cell(row, "Report Date")),
        sourcing: cell(row, "Local/Import") || null,
        stockType: cell(row, "Stock/Non-Stock") || null,
        materialGroup: cell(row, "Material Group Desc.") || null,
        status: "Pending PO",
        imported: true,
        priority: delay != null && delay > 90 ? "High" : "Normal",
      },
      update: {
        reportDelay: delay ?? undefined,
        delayBand: cell(row, "Delay Category") || undefined,
        status: "Pending PO",
        imported: true,
      },
    });
    n++;
    if (n % 2000 === 0) console.log(`  SAP PR upserted ${n}…`);
  }
  return n;
}

async function enrichSapPo() {
  const file = path.join(REAL, "po-delivery-pending.xlsx");
  const rows = sheetRows(file, [/report/i]);
  let n = 0;
  for (const row of rows) {
    const po = prNo(cell(row, "PO No."));
    const line = padLine(cell(row, "Item"));
    if (!po) continue;
    const record = recordId("PO", po, line);
    const qty = num(cell(row, "Order Quantity")) ?? 1;
    const pending = num(cell(row, "Still to be delivered (qty)"));
    await prisma.purchaseOrder.upsert({
      where: { recordId: record },
      create: {
        recordId: record,
        prId: prNo(cell(row, "PR No.")) || null,
        poNo: po,
        line,
        date: asDate(cell(row, "PO Date")),
        supplierCode: cell(row, "Code") || null,
        supplier: cell(row, "Supplier/Supplying Plant") || null,
        materialCode: cell(row, "Material") || null,
        material: cell(row, "Short Text") || "—",
        quantity: new Prisma.Decimal(qty),
        uom: cell(row, "Order Unit") || null,
        currency: cell(row, "Currency") || null,
        unitPrice: num(cell(row, "Net Price")) != null ? new Prisma.Decimal(num(cell(row, "Net Price"))!) : null,
        status: pending != null && pending > 0 ? "Delivery pending" : "Sent to supplier",
        notes: cell(row, "Pending Fully/Partially") || null,
      },
      update: {
        supplier: cell(row, "Supplier/Supplying Plant") || undefined,
        material: cell(row, "Short Text") || undefined,
        quantity: new Prisma.Decimal(qty),
        status: pending != null && pending > 0 ? "Delivery pending" : undefined,
        notes: cell(row, "Pending Fully/Partially") || undefined,
      },
    });
    n++;
    if (n % 500 === 0) console.log(`  SAP PO upserted ${n}…`);
  }
  return n;
}

function writeFixtures(prGroups: Map<string, any>, poList: any[]) {
  fs.mkdirSync(FIXTURES, { recursive: true });
  const groups = [...prGroups.values()].map((g) => ({
    ...g,
    statuses: [...g.statuses],
  }));
  fs.writeFileSync(path.join(FIXTURES, "may-2026-pr-groups.json"), JSON.stringify(groups, null, 0));
  // Dedupe PO list by poNo/line
  const seen = new Set<string>();
  const pos = [];
  for (const p of poList) {
    const k = `${p.poNo}/${p.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    pos.push(p);
  }
  fs.writeFileSync(path.join(FIXTURES, "may-2026-pos.json"), JSON.stringify(pos, null, 0));
  console.log(`Fixtures: ${groups.length} PR groups, ${pos.length} POs → ${FIXTURES}`);
}

async function main() {
  const fixturesOnly = process.argv.includes("--fixtures-only");
  console.log("Reading May-2026 smart sheet…");
  const may = await importMay();
  writeFixtures(may.prGroups, may.poList);
  console.log(`May spine: PR ${may.prUpsert}, PO ${may.poUpsert}, shipments ${may.shipUpsert}`);
  if (fixturesOnly) return;

  console.log("Enriching from SAP PR Created but PO Pending…");
  const prN = await enrichSapPr();
  console.log(`SAP PR rows upserted: ${prN}`);

  console.log("Enriching from SAP PO Delivery Pending…");
  const poN = await enrichSapPo();
  console.log(`SAP PO rows upserted: ${poN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
