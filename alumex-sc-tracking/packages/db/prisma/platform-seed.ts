import { PrismaClient } from "@prisma/client";

const MASTERS: Array<{ category: string; code: string; name: string; extra?: string; sortOrder: number }> = [
  { category: "plant", code: "1100", name: "Sapugaskanda", sortOrder: 10 },
  { category: "plant", code: "1200", name: "Ekala", sortOrder: 20 },
  { category: "currency", code: "USD", name: "US Dollar", sortOrder: 10 },
  { category: "currency", code: "EUR", name: "Euro", sortOrder: 20 },
  { category: "currency", code: "LKR", name: "Sri Lankan Rupee", sortOrder: 30 },
  { category: "uom", code: "EA", name: "Each", sortOrder: 10 },
  { category: "uom", code: "KG", name: "Kilogram", sortOrder: 20 },
  { category: "uom", code: "M", name: "Metre", sortOrder: 30 },
  { category: "uom", code: "SET", name: "Set", sortOrder: 40 },
  { category: "incoterm", code: "CIF", name: "Cost, Insurance and Freight", sortOrder: 10 },
  { category: "incoterm", code: "FOB", name: "Free On Board", sortOrder: 20 },
  { category: "incoterm", code: "EXW", name: "Ex Works", sortOrder: 30 },
  { category: "incoterm", code: "DDP", name: "Delivered Duty Paid", sortOrder: 40 },
  {
    category: "delay_reason",
    code: "PORT_CONGESTION",
    name: "Port congestion",
    extra: "Transshipment or discharge delay",
    sortOrder: 10,
  },
  {
    category: "delay_reason",
    code: "WEATHER",
    name: "Weather / force majeure",
    sortOrder: 20,
  },
  {
    category: "delay_reason",
    code: "SUPPLIER_PROD",
    name: "Supplier production slip",
    sortOrder: 30,
  },
  {
    category: "delay_reason",
    code: "DOC_HOLD",
    name: "Documentation hold",
    sortOrder: 40,
  },
  { category: "supplier", code: "100391", name: "Solace International", sortOrder: 10 },
  { category: "supplier", code: "100412", name: "Atlas Industrial Supply", sortOrder: 20 },
  { category: "supplier", code: "100488", name: "Harbor Polymer", sortOrder: 30 },
  { category: "supplier", code: "100501", name: "NexSeal Industrial", sortOrder: 40 },
  { category: "supplier", code: "100520", name: "Pacific Surface Supply", sortOrder: 50 },
];

const INTEGRATIONS = [
  {
    key: "sap_pr_tsv",
    name: "SAP PR report (TSV/CSV)",
    kind: "sap_import",
    channel: "csv",
    status: "stub",
    description: "Phase-1 preview path aligned with PR import stub. Field priority prefers SAP for identity fields.",
    fieldPriority: {
      prNo: "S",
      line: "S",
      materialCode: "S",
      material: "S",
      quantity: "S",
      plant: "S",
      requester: "S",
      notes: "W",
      priority: "W",
      status: "W",
    },
    notes: "Use samples/sap-pr-report.tsv or POST /platform/integrations/sap_pr_tsv/preview",
  },
  {
    key: "sap_po_xlsx",
    name: "SAP PO / PI extract (XLSX)",
    kind: "sap_import",
    channel: "xlsx",
    status: "stub",
    description: "Future connector for PO headers and lines. Preview accepts CSV/TSV text for phase 1.",
    fieldPriority: {
      poNo: "S",
      line: "S",
      supplier: "S",
      unitPrice: "S",
      currency: "S",
      piNo: "W",
      notes: "W",
    },
  },
  {
    key: "sap_grn_movements",
    name: "SAP goods movements / GRN",
    kind: "sap_import",
    channel: "csv",
    status: "stub",
    description: "Material document + year + item identity. Operational notes stay web-owned.",
    fieldPriority: {
      grnNo: "S",
      year: "S",
      item: "S",
      received: "S",
      plant: "S",
      notes: "W",
      quality: "W",
    },
  },
  {
    key: "vessel_ais",
    name: "Vessel AIS provider",
    kind: "vessel_api",
    channel: "api",
    status: "configured",
    description: "Provider-neutral REST/mock adapter already live under /vessel-tracking.",
    fieldPriority: {
      latitude: "E",
      longitude: "E",
      apiEta: "E",
      eta: "W",
      etaRevised: "W",
    },
  },
];

export async function seedPlatform(prisma: PrismaClient) {
  for (const m of MASTERS) {
    await prisma.masterDataEntry.upsert({
      where: { category_code: { category: m.category, code: m.code } },
      create: m,
      update: { name: m.name, extra: m.extra, active: true, sortOrder: m.sortOrder },
    });
  }

  for (const i of INTEGRATIONS) {
    await prisma.integrationRegister.upsert({
      where: { key: i.key },
      create: {
        key: i.key,
        name: i.name,
        kind: i.kind,
        channel: i.channel,
        status: i.status,
        description: i.description,
        fieldPriority: i.fieldPriority,
        notes: "notes" in i ? (i as { notes?: string }).notes : null,
      },
      update: {
        name: i.name,
        description: i.description,
        fieldPriority: i.fieldPriority,
        channel: i.channel,
        status: i.status,
      },
    });
  }

  // Sample audit + workflow history for demo depth
  const pr = await prisma.purchaseRequisition.findFirst({ orderBy: { recordId: "asc" } });
  if (pr) {
    await prisma.auditEvent.create({
      data: {
        moduleKey: "pr",
        recordId: pr.recordId,
        actor: "seed",
        action: "Imported",
        detail: "Seed baseline",
        source: "import",
        newValue: JSON.stringify({ prNo: pr.prNo, line: pr.line, status: pr.status }),
      },
    });
  }
}
