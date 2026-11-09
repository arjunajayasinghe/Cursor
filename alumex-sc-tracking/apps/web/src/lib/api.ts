const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  overview: () => request<OverviewData>("/overview"),
  prGroups: (q = "", status = "") =>
    request<PrGroup[]>(`/pr/groups?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  prList: (q = "", status = "") =>
    request<PrItem[]>(`/pr?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  prGet: (id: string) => request<PrItem>(`/pr/${encodeURIComponent(id)}`),
  prCreate: (body: Partial<PrItem>) =>
    request<PrItem>("/pr", { method: "POST", body: JSON.stringify(body) }),
  prUpdate: (id: string, body: Partial<PrItem>) =>
    request<PrItem>(`/pr/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  prAnalyzeImport: (text: string) =>
    request<PrImportPreview>("/pr/import/analyze", { method: "POST", body: JSON.stringify({ text }) }),
  prCommitImport: (text: string) =>
    request<{ created: number; plantsFilled: number; duplicates: number }>("/pr/import/commit", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  poList: (q = "", status = "") =>
    request<PoItem[]>(`/po?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  poGet: (id: string) => request<PoItem>(`/po/${encodeURIComponent(id)}`),
  poCreate: (body: Partial<PoItem>) =>
    request<PoItem>("/po", { method: "POST", body: JSON.stringify(body) }),
  poUpdate: (id: string, body: Partial<PoItem>) =>
    request<PoItem>(`/po/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export type OverviewData = {
  kpis: Array<{ label: string; value: number; detail: string; tone: string; icon: string }>;
  pipeline: Array<{ key: string; label: string; count: number; pct: number }>;
  attention: Array<{ module: string; id: string; title: string; subtitle: string; tone: string }>;
  recentPr: Array<{ id: string; prNo: string; line: string; material?: string; status: string; plant?: string }>;
  recentPo: Array<{ id: string; poNo: string; supplier?: string; material?: string; status: string; piNo?: string }>;
};

export type PrItem = {
  id: string;
  recordId: string;
  prNo: string;
  line: string;
  date?: string | null;
  requester?: string | null;
  department?: string | null;
  plant?: string | null;
  materialCode?: string | null;
  material?: string | null;
  materialGroup?: string | null;
  quantity?: number | null;
  uom?: string | null;
  brand?: string | null;
  need?: string | null;
  approved?: string | null;
  buyer?: string | null;
  priority?: string | null;
  notes?: string | null;
  status: string;
  sourcing?: string | null;
  stockType?: string | null;
  purchasingGroup?: string | null;
  createdBy?: string | null;
  changed?: string | null;
  reportReceived?: string | null;
  reportDate?: string | null;
  reportDelay?: number | null;
  delayBand?: string | null;
  release?: string | null;
  handler?: string | null;
  age?: number | null;
  imported?: boolean;
};

export type PrGroup = {
  prNo: string;
  lineCount: number;
  requester?: string | null;
  department?: string | null;
  plant?: string | null;
  date?: string | null;
  buyer?: string | null;
  priority?: string | null;
  statuses: string[];
  material?: string | null;
  quantity: number;
  lines: PrItem[];
};

export type PoItem = {
  id: string;
  recordId: string;
  prId?: string | null;
  poNo: string;
  line: string;
  date?: string | null;
  supplierCode?: string | null;
  supplier?: string | null;
  materialCode?: string | null;
  material?: string | null;
  quantity?: number | null;
  uom?: string | null;
  currency?: string | null;
  unitPrice?: number | null;
  total?: number | null;
  paymentTerms?: string | null;
  incoterm?: string | null;
  approval?: string | null;
  approved?: string | null;
  sapNeed?: string | null;
  sent?: string | null;
  importNo?: string | null;
  piNo?: string | null;
  piDate?: string | null;
  piAmount?: number | null;
  production?: number | null;
  transit?: number | null;
  expected?: string | null;
  supplierEta?: string | null;
  notes?: string | null;
  status: string;
  age?: number | null;
};

export type PrImportPreview = {
  records: Array<Record<string, unknown>>;
  plants: Array<{ id: string; plant: string }>;
  errors: Array<{ line: number; message: string }>;
  duplicates: number;
  groups: number;
};

export const SOURCE_CODES: Record<string, [string, string]> = {
  S: ["SAP-originated", "Enter manually now. Candidate for a future SAP report or released API."],
  W: ["Web application", "Captured and maintained by the process owner."],
  A: ["Calculated", "Derived from the values captured in the application."],
  E: ["External", "Manual update in this demo. Candidate for a carrier or tracking feed."],
  M: ["Master data", "Maintained as reference data. Candidate for SAP sync where appropriate."],
};

export const PR_FIELDS: Array<{ key: keyof PrItem | string; label: string; source: keyof typeof SOURCE_CODES }> = [
  { key: "prNo", label: "SAP PR number", source: "S" },
  { key: "line", label: "PR line", source: "S" },
  { key: "date", label: "PR date", source: "S" },
  { key: "purchasingGroup", label: "Purchasing group", source: "S" },
  { key: "createdBy", label: "Created by (SAP user)", source: "S" },
  { key: "requester", label: "Requester", source: "S" },
  { key: "changed", label: "Changed date", source: "S" },
  { key: "reportReceived", label: "PR received date (report)", source: "S" },
  { key: "reportDate", label: "Report date", source: "S" },
  { key: "reportDelay", label: "Delay in days (report)", source: "S" },
  { key: "delayBand", label: "Delay category (report)", source: "S" },
  { key: "sourcing", label: "Local or import", source: "S" },
  { key: "stockType", label: "Stock or non-stock", source: "S" },
  { key: "department", label: "Requesting department", source: "M" },
  { key: "plant", label: "Plant", source: "S" },
  { key: "materialCode", label: "Material code", source: "S" },
  { key: "material", label: "Material description", source: "S" },
  { key: "materialGroup", label: "Material group", source: "S" },
  { key: "quantity", label: "Requested quantity", source: "S" },
  { key: "uom", label: "Unit of measure", source: "S" },
  { key: "brand", label: "Required brand", source: "W" },
  { key: "need", label: "Required delivery date", source: "S" },
  { key: "approved", label: "PR approved date", source: "S" },
  { key: "release", label: "PR release level", source: "S" },
  { key: "handler", label: "Shipment handled by", source: "W" },
  { key: "buyer", label: "Procurement owner", source: "W" },
  { key: "priority", label: "Priority", source: "W" },
  { key: "age", label: "PR ageing (days)", source: "A" },
  { key: "notes", label: "Remarks", source: "W" },
  { key: "status", label: "Status", source: "W" },
];

export const PR_REPORT_COLUMNS: Array<{ key: keyof PrItem | string; label: string }> = [
  { key: "purchasingGroup", label: "PGr" },
  { key: "prNo", label: "Purch.Req." },
  { key: "date", label: "Req.Date" },
  { key: "changed", label: "Chngd" },
  { key: "approved", label: "Release Dt" },
  { key: "reportReceived", label: "PR Received Date" },
  { key: "reportDate", label: "Report Date" },
  { key: "reportDelay", label: "Delay in Days" },
  { key: "delayBand", label: "Delay Category" },
  { key: "line", label: "Item" },
  { key: "materialCode", label: "Material" },
  { key: "material", label: "Short Text" },
  { key: "uom", label: "Un" },
  { key: "quantity", label: "Quantity" },
  { key: "createdBy", label: "Created by" },
  { key: "sourcing", label: "Local/Import" },
  { key: "stockType", label: "Stock/Non-Stock" },
  { key: "materialGroup", label: "Material Group Desc." },
  { key: "plant", label: "Plant" },
];

export const PO_FIELDS: Array<{ key: keyof PoItem | string; label: string; source: keyof typeof SOURCE_CODES }> = [
  { key: "poNo", label: "SAP PO number", source: "S" },
  { key: "line", label: "PO line", source: "S" },
  { key: "date", label: "PO date", source: "S" },
  { key: "prId", label: "Linked PR", source: "S" },
  { key: "supplierCode", label: "Supplier code", source: "S" },
  { key: "supplier", label: "Supplier name", source: "S" },
  { key: "materialCode", label: "Material code", source: "S" },
  { key: "material", label: "Material description", source: "S" },
  { key: "quantity", label: "PO quantity", source: "S" },
  { key: "uom", label: "Unit of measure", source: "S" },
  { key: "currency", label: "PO currency", source: "S" },
  { key: "unitPrice", label: "PO unit price", source: "S" },
  { key: "total", label: "PO line amount", source: "A" },
  { key: "paymentTerms", label: "Payment terms", source: "S" },
  { key: "incoterm", label: "Incoterm", source: "S" },
  { key: "approval", label: "SAP approval level", source: "S" },
  { key: "approved", label: "SAP PO approved date", source: "S" },
  { key: "sapNeed", label: "SAP expected delivery date", source: "S" },
  { key: "sent", label: "PO sent to supplier", source: "W" },
  { key: "importNo", label: "Import number", source: "W" },
  { key: "piNo", label: "Proforma invoice number", source: "W" },
  { key: "piDate", label: "PI date", source: "W" },
  { key: "piAmount", label: "PI amount", source: "W" },
  { key: "production", label: "Standard production (days)", source: "M" },
  { key: "transit", label: "Standard transit (days)", source: "M" },
  { key: "expected", label: "Calculated delivery date", source: "A" },
  { key: "supplierEta", label: "Supplier delivery estimate", source: "W" },
  { key: "age", label: "PO ageing (days)", source: "A" },
  { key: "notes", label: "PO remarks", source: "W" },
  { key: "status", label: "Status", source: "W" },
];
