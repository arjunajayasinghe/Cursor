/**
 * STUB Excel export — placeholder columns only.
 *
 * TODO(real-template): Replace this layout with the client's fixed Excel template
 * once the template file is provided. Do not treat these columns as final.
 *
 * Planned: prescribed sheet layout, column order, formatting, and value-stream
 * mapping rules from the customer Excel template.
 */

import ExcelJS from "exceljs";
import { prisma } from "./prisma";

const STUB_COLUMNS = [
  { header: "Process Code", key: "code", width: 14 },
  { header: "Process Name", key: "name", width: 42 },
  { header: "Level", key: "level", width: 8 },
  { header: "Description", key: "description", width: 48 },
  { header: "Value Stream", key: "valueStream", width: 20 },
  { header: "Parent Code", key: "parentCode", width: 14 },
  { header: "Hidden", key: "hidden", width: 10 },
] as const;

export async function exportCompanyByValueStream(companyId: string): Promise<Buffer> {
  const [nodes, valueStreams] = await Promise.all([
    prisma.processNode.findMany({
      where: { companyId },
      orderBy: [{ code: "asc" }],
    }),
    prisma.valueStream.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: "asc" }],
    }),
  ]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const vsById = new Map(valueStreams.map((v) => [v.id, v]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Aetria Process Mapping (STUB)";
  workbook.created = new Date();

  // Cover / README sheet so stub nature is obvious in the file
  const readme = workbook.addWorksheet("_STUB_README");
  readme.getColumn(1).width = 100;
  readme.addRow(["TODO: Replace with the client's fixed Excel template."]);
  readme.addRow([
    "This workbook is a placeholder export grouped by value stream. Column layout is NOT final.",
  ]);
  readme.addRow([`Generated at: ${new Date().toISOString()}`]);
  readme.addRow([`Company ID: ${companyId}`]);
  readme.addRow([`Process count: ${nodes.length}`]);

  const groups = new Map<string, typeof nodes>();
  for (const n of nodes) {
    const key = n.valueStreamId ?? "__unassigned__";
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  // Prefer known VS order, then unassigned
  const orderedKeys = [
    ...valueStreams.map((v) => v.id),
    ...[...groups.keys()].filter((k) => k === "__unassigned__" || !vsById.has(k)),
  ];
  const seen = new Set<string>();

  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const list = groups.get(key);
    if (!list?.length) continue;

    const vs = key === "__unassigned__" ? null : vsById.get(key);
    const sheetName = sanitizeSheetName(vs ? `${vs.code} - ${vs.name}` : "Unassigned");
    const sheet = workbook.addWorksheet(sheetName);

    sheet.addRow(["STUB EXPORT — not the final client template"]);
    sheet.mergeCells(1, 1, 1, STUB_COLUMNS.length);
    sheet.getRow(1).font = { italic: true, color: { argb: "FF996600" } };

    const header = sheet.addRow(STUB_COLUMNS.map((c) => c.header));
    header.font = { bold: true };

    STUB_COLUMNS.forEach((c, i) => {
      sheet.getColumn(i + 1).width = c.width;
    });

    for (const n of list) {
      const parent = n.parentId ? byId.get(n.parentId) : null;
      sheet.addRow([
        n.code,
        n.name,
        n.level,
        n.description,
        vs?.name ?? "",
        parent?.code ?? "",
        n.isHidden ? "Y" : "N",
      ]);
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function sanitizeSheetName(name: string) {
  const cleaned = name.replace(/[:\\/?*\[\]]/g, "-").slice(0, 31);
  return cleaned || "Sheet";
}
