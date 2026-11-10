/** Module metadata aligned with GUI handoff schema.js */

export type ModuleKey =
  | "quotes"
  | "eval"
  | "pay"
  | "confirm"
  | "ship"
  | "vessel"
  | "customs"
  | "delivery"
  | "grn";

export type ModuleDef = {
  key: ModuleKey;
  prisma: string;
  recordPrefix: string;
  title: string;
  search: string[];
  dateFields: string[];
  decimalFields: string[];
  intFields: string[];
  jsonFields: string[];
  linkFields?: string[];
  defaultStatus: string;
};

export const MODULE_DEFS: ModuleDef[] = [
  {
    key: "quotes",
    prisma: "quotation",
    recordPrefix: "QT",
    title: "Quotations",
    search: ["supplier", "quoteRef", "prId", "recordId", "currency", "status"],
    dateFields: ["called", "received", "validity"],
    decimalFields: ["unitPrice", "quantity"],
    intFields: ["lead"],
    jsonFields: [],
    linkFields: ["prId", "purchaseRequisitionId"],
    defaultStatus: "Requested",
  },
  {
    key: "eval",
    prisma: "evaluation",
    recordPrefix: "EV",
    title: "Evaluation & approval",
    search: ["evaluator", "prId", "recommended", "recordId", "status", "compliance"],
    dateFields: ["start", "due"],
    decimalFields: [],
    intFields: [],
    jsonFields: ["decisions"],
    linkFields: ["prId", "purchaseRequisitionId"],
    defaultStatus: "Draft",
  },
  {
    key: "pay",
    prisma: "payment",
    recordPrefix: "PAY",
    title: "Payments",
    search: ["method", "bank", "reference", "poId", "recordId", "status", "currency"],
    dateFields: ["due", "bankDate", "lcDate", "maturity", "completed"],
    decimalFields: ["amount", "paid"],
    intFields: [],
    jsonFields: [],
    linkFields: ["poId", "purchaseOrderId"],
    defaultStatus: "Scheduled",
  },
  {
    key: "confirm",
    prisma: "supplierConfirmation",
    recordPrefix: "CF",
    title: "Supplier confirmation",
    search: ["supplier", "contact", "poId", "recordId", "status"],
    dateFields: ["acknowledged", "production", "ready", "shipBy", "revised"],
    decimalFields: ["confirmedQuantity"],
    intFields: [],
    jsonFields: [],
    linkFields: ["poId", "purchaseOrderId"],
    defaultStatus: "Awaiting response",
  },
  {
    key: "ship",
    prisma: "shipment",
    recordPrefix: "SHP",
    title: "Shipping",
    search: ["importNo", "booking", "carrier", "vessel", "bl", "poId", "recordId", "status"],
    dateFields: ["booked", "blDate", "etd", "atd", "eta", "etaRevised", "arrived"],
    decimalFields: ["weight"],
    intFields: ["packages"],
    jsonFields: [],
    linkFields: ["poId", "purchaseOrderId"],
    defaultStatus: "Booking pending",
  },
  {
    key: "vessel",
    prisma: "vesselTracking",
    recordPrefix: "TRK",
    title: "Vessel tracking",
    search: ["vessel", "voyage", "imo", "position", "recordId", "status"],
    dateFields: ["updated", "eta", "etaRevised", "arrived"],
    decimalFields: [],
    intFields: [],
    jsonFields: [],
    linkFields: ["shipmentId"],
    defaultStatus: "Awaiting departure",
  },
  {
    key: "customs",
    prisma: "customsClearance",
    recordPrefix: "CUS",
    title: "Customs clearance",
    search: ["broker", "declaration", "hs", "recordId", "status"],
    dateFields: ["filed", "paidDate", "inspection", "released"],
    decimalFields: ["value", "duty", "tax"],
    intFields: [],
    jsonFields: [],
    linkFields: ["shipmentId"],
    defaultStatus: "Awaiting documents",
  },
  {
    key: "delivery",
    prisma: "deliveryLandedCost",
    recordPrefix: "DLV",
    title: "Delivery & landed cost",
    search: ["site", "transport", "vehicle", "recordId", "status", "currency"],
    dateFields: ["dispatch", "delivered"],
    decimalFields: ["quantity", "goods", "fx", "freight", "insurance", "duty", "handling", "demurrage", "local", "other"],
    intFields: [],
    jsonFields: [],
    linkFields: ["shipmentId"],
    defaultStatus: "Dispatch pending",
  },
  {
    key: "grn",
    prisma: "goodsReceipt",
    recordPrefix: "GRN",
    title: "GRN & closure",
    search: ["grnNo", "prId", "poId", "plant", "recordId", "status", "quality"],
    dateFields: ["posted", "closed"],
    decimalFields: ["received", "accepted"],
    intFields: ["year"],
    jsonFields: [],
    linkFields: ["prId", "poId"],
    defaultStatus: "Awaiting posting",
  },
];

export const byModuleKey = Object.fromEntries(MODULE_DEFS.map((m) => [m.key, m])) as Record<ModuleKey, ModuleDef>;
