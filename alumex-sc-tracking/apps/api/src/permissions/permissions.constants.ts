export const DEMO_ROLE_HEADER = "x-demo-role";
export const DEFAULT_DEMO_ROLE = "Administrator";

export const MODULE_OWNERS: Record<string, string> = {
  pr: "Requesting Dept. / Procurement",
  quotes: "Procurement",
  eval: "Procurement + approvers",
  po: "Procurement",
  pay: "Finance",
  confirm: "Procurement",
  ship: "Import Team",
  vessel: "Import Team",
  customs: "Import Team",
  delivery: "Import Team / Finance",
  grn: "Stores",
  reports: "Management",
  roles: "Administrator",
  automation: "Administrator / Management",
  masters: "Administrator",
  integrations: "Administrator",
};

export const MODULE_LABELS: Record<string, string> = {
  pr: "Purchase requisitions",
  quotes: "Quotations",
  eval: "Evaluation & approval",
  po: "PO / PI",
  pay: "Payments",
  confirm: "Supplier confirmation",
  ship: "Shipping",
  vessel: "Vessel tracking",
  customs: "Customs clearance",
  delivery: "Delivery & landed cost",
  grn: "GRN & closure",
  reports: "Reports",
  roles: "Role administration",
  automation: "SLA & notifications",
  masters: "Master data",
  integrations: "Integration register",
};

export type AccessLevel = 0 | 1 | 2;

export const ACCESS_LABELS = ["No access", "View only", "Create and edit"] as const;
