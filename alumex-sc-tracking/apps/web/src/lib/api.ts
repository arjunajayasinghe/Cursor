const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let demoRole = "Administrator";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Demo-Role": demoRole,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body || `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message || parsed.error || message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {
      /* plain text */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  setDemoRole: (role: string) => {
    demoRole = role || "Administrator";
  },
  getDemoRole: () => demoRole,
  health: () => request<{ ok: boolean }>("/health"),
  permissionsMe: () => request<PermissionsMe>("/permissions/me"),
  permissionsRoles: () => request<PermissionsRole[]>("/permissions/roles"),
  permissionsRole: (name: string) =>
    request<PermissionsRoleDetail>(`/permissions/roles/${encodeURIComponent(name)}`),
  savePermissionsRole: (name: string, access: Record<string, number>) =>
    request<PermissionsRoleDetail>(`/permissions/roles/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ access }),
    }),
  permissionsAssignments: () => request<RecordAssignment[]>("/permissions/assignments"),
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
  moduleList: (path: string, q = "", status = "") =>
    request<Array<Record<string, unknown>>>(
      `/${path}?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`,
    ),
  moduleGet: (path: string, id: string) =>
    request<Record<string, unknown>>(`/${path}/${encodeURIComponent(id)}`),
  moduleCreate: (path: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/${path}`, { method: "POST", body: JSON.stringify(body) }),
  moduleUpdate: (path: string, id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/${path}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reports: (type = "pipeline") =>
    request<ReportPayload>(`/reports?type=${encodeURIComponent(type)}`),
  automationSlaRules: () => request<SlaRule[]>("/automation/sla-rules"),
  updateSlaRule: (key: string, body: Partial<SlaRule>) =>
    request<SlaRule>(`/automation/sla-rules/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  automationNotificationRules: () => request<NotificationRule[]>("/automation/notification-rules"),
  updateNotificationRule: (triggerKey: string, body: Partial<NotificationRule>) =>
    request<NotificationRule>(`/automation/notification-rules/${encodeURIComponent(triggerKey)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  automationEvents: (status = "open") =>
    request<NotificationEvent[]>(`/automation/events?status=${encodeURIComponent(status)}`),
  automationOutbox: () => request<EmailOutboxItem[]>("/automation/outbox"),
  automationExceptions: (status = "open") =>
    request<ExceptionItem[]>(`/automation/exceptions?status=${encodeURIComponent(status)}`),
  automationEvaluate: () =>
    request<AutomationEvalResult>("/automation/evaluate", { method: "POST", body: "{}" }),
  automationAck: (id: string) =>
    request<NotificationEvent>(`/automation/events/${encodeURIComponent(id)}/ack`, {
      method: "POST",
      body: "{}",
    }),
  automationResolve: (id: string) =>
    request<NotificationEvent>(`/automation/events/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      body: "{}",
    }),
  vesselTrackingList: () => request<VesselTrackingDetail[]>("/vessel-tracking"),
  vesselTrackingGet: (id: string) =>
    request<VesselTrackingDetail>(`/vessel-tracking/${encodeURIComponent(id)}`),
  vesselTrackingEvents: (vesselTrackingId?: string) =>
    request<VesselTrackingEvent[]>(
      `/vessel-tracking/events${vesselTrackingId ? `?vesselTrackingId=${encodeURIComponent(vesselTrackingId)}` : ""}`,
    ),
  vesselTrackingPollAll: () =>
    request<{ polled: number; updated: number; at: string }>("/vessel-tracking/poll", {
      method: "POST",
      body: "{}",
    }),
  vesselTrackingPollOne: (id: string) =>
    request<VesselTrackingDetail>(`/vessel-tracking/${encodeURIComponent(id)}/poll`, {
      method: "POST",
      body: "{}",
    }),
  documentsList: (moduleKey: string, recordId: string) =>
    request<DocumentAsset[]>(
      `/documents?moduleKey=${encodeURIComponent(moduleKey)}&recordId=${encodeURIComponent(recordId)}`,
    ),
  documentUpload: async (input: {
    file: File;
    moduleKey: string;
    category: string;
    recordId: string;
    notes?: string;
  }) => {
    const fd = new FormData();
    fd.append("file", input.file);
    fd.append("moduleKey", input.moduleKey);
    fd.append("category", input.category);
    fd.append("recordId", input.recordId);
    if (input.notes) fd.append("notes", input.notes);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const res = await fetch(`${API_URL}/documents/upload`, {
      method: "POST",
      headers: { "X-Demo-Role": demoRole },
      body: fd,
    });
    if (!res.ok) {
      const body = await res.text();
      let message = body || `Upload failed (${res.status})`;
      try {
        message = JSON.parse(body).message || message;
      } catch {
        /* */
      }
      throw new Error(Array.isArray(message) ? message.join(", ") : message);
    }
    return res.json() as Promise<DocumentAsset>;
  },
  documentDownloadUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/documents/${encodeURIComponent(id)}/download`,
  documentDownloadBlob: async (id: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const res = await fetch(
      `${API_URL}/documents/${encodeURIComponent(id)}/download`,
      { headers: { "X-Demo-Role": demoRole }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return res.blob();
  },
  documentDelete: (id: string) =>
    request<{ ok: boolean }>(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  auditHistory: (moduleKey: string, recordId: string) =>
    request<AuditEvent[]>(
      `/platform/audit/${encodeURIComponent(moduleKey)}/${encodeURIComponent(recordId)}`,
    ),
  workflowState: (moduleKey: string, recordId: string) =>
    request<WorkflowState>(
      `/platform/workflow/${encodeURIComponent(moduleKey)}/${encodeURIComponent(recordId)}`,
    ),
  workflowHistory: (moduleKey: string, recordId: string) =>
    request<WorkflowHistoryItem[]>(
      `/platform/workflow/${encodeURIComponent(moduleKey)}/${encodeURIComponent(recordId)}/history`,
    ),
  workflowTransition: (moduleKey: string, recordId: string, toStatus: string, note?: string) =>
    request<Record<string, unknown>>(
      `/platform/workflow/${encodeURIComponent(moduleKey)}/${encodeURIComponent(recordId)}/transition`,
      { method: "POST", body: JSON.stringify({ toStatus, note }) },
    ),
  mastersList: (category = "") =>
    request<MasterDataEntry[]>(
      `/platform/masters${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),
  mastersUpsert: (body: Partial<MasterDataEntry> & { category: string; code: string; name: string }) =>
    request<MasterDataEntry>("/platform/masters", { method: "PUT", body: JSON.stringify(body) }),
  mastersDelete: (id: string) =>
    request<{ ok: boolean }>(`/platform/masters/${encodeURIComponent(id)}`, { method: "DELETE" }),
  exceptionsList: (status = "") =>
    request<ExceptionItem[]>(
      `/platform/exceptions${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  exceptionPatch: (id: string, body: { status?: string; detail?: string }) =>
    request<ExceptionItem>(`/platform/exceptions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  integrationsList: () => request<IntegrationItem[]>("/platform/integrations"),
  integrationPatch: (key: string, body: Partial<IntegrationItem>) =>
    request<IntegrationItem>(`/platform/integrations/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  integrationPreview: (
    key: string,
    body: { text?: string; base64?: string; fileName?: string; formatHint?: string } | string,
  ) =>
    request<IntegrationPreview>(`/platform/integrations/${encodeURIComponent(key)}/preview`, {
      method: "POST",
      body: JSON.stringify(typeof body === "string" ? { text: body } : body),
    }),
  integrationAnalyze: (
    key: string,
    body: { text?: string; base64?: string; fileName?: string; formatHint?: string },
  ) =>
    request<IntegrationPreview>(`/platform/integrations/${encodeURIComponent(key)}/analyze`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  integrationReconcile: (batchId: string) =>
    request<ImportBatch>(`/platform/integrations/batches/${encodeURIComponent(batchId)}/reconcile`, {
      method: "POST",
      body: "{}",
    }),
  integrationBatches: (key = "") =>
    request<ImportBatch[]>(
      `/platform/integrations/batches${key ? `?key=${encodeURIComponent(key)}` : ""}`,
    ),
  monitoringReport: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<MonitoringReport>(`/platform/monitoring${q ? `?${q}` : ""}`);
  },
  checkDuplicate: (moduleKey: string, fields: Record<string, string>) =>
    request<{ duplicate: boolean; existingId: string | null }>("/platform/validate/duplicate", {
      method: "POST",
      body: JSON.stringify({ moduleKey, fields }),
    }),
};

export type ReportPayload = {
  type: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  counts?: Array<{ key: string; label: string; count: number }>;
};

export type PermissionsMe = {
  role: string;
  assignedOnly: boolean;
  access: Record<string, number>;
  accessLabels: string[];
  availableRoles: string[];
  modules: Array<{ key: string; label: string; owner: string; level: number }>;
  assignments: Array<{ moduleKey: string; recordId: string; partyLabel?: string | null }>;
  note?: string;
};

export type PermissionsRole = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  assignedOnly: boolean;
  assignmentCount: number;
  access: Record<string, number>;
};

export type PermissionsRoleDetail = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  assignedOnly: boolean;
  modules: Array<{ key: string; label: string; owner: string; level: number }>;
  assignments: Array<{ moduleKey: string; recordId: string; partyLabel?: string | null; notes?: string | null }>;
};

export type RecordAssignment = {
  id: string;
  moduleKey: string;
  recordId: string;
  partyLabel?: string | null;
  notes?: string | null;
  role: { name: string; assignedOnly: boolean };
};

export type OverviewData = {
  kpis: Array<{ label: string; value: number; detail: string; tone: string; icon: string }>;
  kpiDetail?: Array<{ label: string; value: number; detail: string; tone: string; icon: string }>;
  pipeline: Array<{ key: string; label: string; count: number; pct: number }>;
  attention: Array<{
    module: string;
    id: string;
    title: string;
    subtitle: string;
    tone: string;
    href?: string;
    triggerKey?: string;
  }>;
  alertSummary?: Array<{ triggerKey: string; count: number }>;
  recentPr: Array<{ id: string; prNo: string; line: string; material?: string; status: string; plant?: string }>;
  recentPo: Array<{ id: string; poNo: string; supplier?: string; material?: string; status: string; piNo?: string }>;
};

export type SlaRule = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  moduleKey: string;
  unit: string;
  targetValue: number;
  loadType?: string | null;
  active: boolean;
  sortOrder: number;
};

export type NotificationRule = {
  id: string;
  triggerKey: string;
  name: string;
  description?: string | null;
  moduleKey: string;
  action: string;
  severity: string;
  recipientRoles: string;
  channels: string;
  dedupeHours: number;
  slaKey?: string | null;
  escalateAfterHours?: number | null;
  active: boolean;
  sortOrder: number;
};

export type NotificationEvent = {
  id: string;
  dedupeKey: string;
  triggerKey: string;
  moduleKey: string;
  recordId: string;
  title: string;
  message: string;
  severity: string;
  action: string;
  recipientRoles: string;
  status: string;
  href?: string | null;
  ageHours?: number | null;
  occurrenceCount: number;
  lastSeenAt: string;
};

export type EmailOutboxItem = {
  id: string;
  notificationId?: string | null;
  toRoles: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  sentAt?: string | null;
};

export type ExceptionItem = {
  id: string;
  moduleKey: string;
  recordId: string;
  triggerKey?: string | null;
  category: string;
  title: string;
  detail?: string | null;
  severity: string;
  status: string;
  ownerRole?: string | null;
};

export type AutomationEvalResult = {
  detected: number;
  created: number;
  refreshed: number;
  emailsQueued: number;
  exceptionsOpened: number;
  autoResolved: number;
  actor: string;
  at: string;
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


export type VesselTrackingEvent = {
  id: string;
  provider: string;
  imo?: string | null;
  mmsi?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedKnots?: number | null;
  courseDeg?: number | null;
  apiEta?: string | null;
  aisTimestamp?: string | null;
  createdAt: string;
};

export type VesselTrackingDetail = {
  id: string;
  recordId: string;
  vessel?: string | null;
  imo?: string | null;
  mmsi?: string | null;
  voyage?: string | null;
  position?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedKnots?: number | null;
  courseDeg?: number | null;
  eta?: string | null;
  etaRevised?: string | null;
  apiEta?: string | null;
  etaVarianceDays?: number | null;
  trackingProvider?: string | null;
  lastAisAt?: string | null;
  status: string;
  events?: VesselTrackingEvent[];
  [key: string]: unknown;
};

export type DocumentAsset = {
  id: string;
  category: string;
  moduleKey: string;
  recordId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageBackend: string;
  storageKey: string;
  uploadedBy?: string | null;
  notes?: string | null;
  createdAt: string;
};


export type AuditEvent = {
  id: string;
  moduleKey: string;
  recordId: string;
  actor: string;
  action: string;
  detail?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  source?: string | null;
  createdAt: string;
};

export type WorkflowState = {
  moduleKey: string;
  recordId: string;
  current: string;
  next: string[];
  statuses: string[];
};

export type WorkflowHistoryItem = {
  fromStatus?: string | null;
  toStatus: string;
  actor: string;
  note?: string | null;
  createdAt: string;
};

export type MasterDataEntry = {
  id: string;
  category: string;
  code: string;
  name: string;
  extra?: string | null;
  active: boolean;
  sortOrder: number;
};

export type IntegrationItem = {
  id: string;
  key: string;
  name: string;
  kind: string;
  channel: string;
  status: string;
  description?: string | null;
  fieldPriority?: Record<string, string> | null;
  lastRunAt?: string | null;
  lastResult?: string | null;
  notes?: string | null;
};

export type IntegrationPreview = {
  key: string;
  batchId?: string;
  headers: string[];
  preview: Array<Record<string, string>>;
  rowCount?: number;
  duplicateKeys?: string[];
  fieldPriority?: Record<string, string> | null;
  errors?: string[];
  note?: string;
  createCount?: number;
  updateCount?: number;
  skipCount?: number;
  mismatchCount?: number;
  plan?: Array<{
    action: string;
    key: string;
    recordId?: string;
    mismatches: Array<{ field: string; existing: string; incoming: string; action: string }>;
  }>;
};

export type ImportBatch = {
  id: string;
  integrationKey: string;
  status: string;
  fileName?: string | null;
  format: string;
  actor: string;
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  mismatchCount: number;
  errorCount: number;
  createdAt: string;
  reconciledAt?: string | null;
  lastResult?: string | null;
};

export type MonitoringReport = {
  type: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  counts: { total: number; overdue: number; byStage: Array<{ stage: string; count: number }> };
};
