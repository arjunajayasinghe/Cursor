import { PrismaClient } from "@prisma/client";

/** Module keys used by the app (GUI + reports/admin). */
export const PERMISSION_MODULES = [
  "pr",
  "quotes",
  "eval",
  "po",
  "pay",
  "confirm",
  "ship",
  "vessel",
  "customs",
  "delivery",
  "grn",
  "reports",
  "roles",
] as const;

export type PermModule = (typeof PERMISSION_MODULES)[number];

/**
 * Proposed Alumex matrix (functional-spec §10) mapped to GUI roles,
 * plus Management / Technical / external restricted roles from GUI handoff.
 * Levels: 0 none · 1 view · 2 create/edit
 */
export const ROLE_MATRIX: Array<{
  name: string;
  description: string;
  isSystem?: boolean;
  assignedOnly?: boolean;
  sortOrder: number;
  access: Partial<Record<PermModule, number>>;
}> = [
  {
    name: "Administrator",
    description: "Full access to all modules and role administration",
    isSystem: true,
    sortOrder: 0,
    access: Object.fromEntries(PERMISSION_MODULES.map((k) => [k, 2])),
  },
  {
    name: "Management",
    description: "Read-only monitoring across the pipeline",
    sortOrder: 10,
    access: Object.fromEntries(PERMISSION_MODULES.filter((k) => k !== "roles").map((k) => [k, 1])),
  },
  {
    // Functional-spec "Requesting Dept."
    name: "Requester",
    description: "Requesting department — create/edit PRs; view linked stages",
    sortOrder: 20,
    access: {
      pr: 2,
      quotes: 1,
      eval: 1,
      po: 1,
      confirm: 1,
      ship: 1,
      vessel: 1,
      grn: 1,
      reports: 1,
    },
  },
  {
    name: "Procurement",
    description: "Primary owner for PR, quotations, evaluation, PO/PI and supplier confirmation",
    sortOrder: 30,
    access: {
      pr: 2,
      quotes: 2,
      eval: 2,
      po: 2,
      pay: 1,
      confirm: 2,
      ship: 1,
      vessel: 1,
      customs: 1,
      delivery: 1,
      grn: 1,
      reports: 1,
    },
  },
  {
    name: "Finance",
    description: "Payment owner; view commercial stages; edit delivery cost where required",
    sortOrder: 40,
    access: {
      pr: 1,
      quotes: 1,
      eval: 1,
      po: 1,
      pay: 2,
      delivery: 2,
      vessel: 1,
      customs: 1,
      grn: 1,
      reports: 1,
    },
  },
  {
    name: "Import Team",
    description: "Owner for shipping, vessel, customs and delivery operations",
    sortOrder: 50,
    access: {
      pr: 1,
      po: 1,
      pay: 1,
      confirm: 2,
      ship: 2,
      vessel: 2,
      customs: 2,
      delivery: 2,
      grn: 1,
      reports: 1,
    },
  },
  {
    // Functional-spec "Warehouse"
    name: "Stores",
    description: "Warehouse / stores — GRN and closure owner",
    sortOrder: 60,
    access: {
      pr: 1,
      po: 1,
      ship: 1,
      vessel: 1,
      customs: 1,
      delivery: 1,
      grn: 2,
      reports: 1,
    },
  },
  {
    name: "Technical 1",
    description: "Technical evaluator — quotation and evaluation review",
    sortOrder: 70,
    access: { pr: 1, quotes: 1, eval: 1, reports: 1 },
  },
  {
    name: "Technical 2",
    description: "Second technical reviewer on evaluation workflow",
    sortOrder: 80,
    access: { pr: 1, quotes: 1, eval: 1, reports: 1 },
  },
  {
    name: "Supplier",
    description: "External supplier — assigned confirmation and shipping records only",
    assignedOnly: true,
    sortOrder: 90,
    access: { confirm: 2, ship: 1, reports: 0 },
  },
  {
    name: "Clearing Agent",
    description: "External clearing agent — assigned customs records only",
    assignedOnly: true,
    sortOrder: 100,
    access: { customs: 2, ship: 1, reports: 0 },
  },
];

export async function seedPermissions(prisma: PrismaClient) {
  await prisma.recordAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();

  for (const def of ROLE_MATRIX) {
    const role = await prisma.role.create({
      data: {
        name: def.name,
        description: def.description,
        isSystem: Boolean(def.isSystem),
        assignedOnly: Boolean(def.assignedOnly),
        sortOrder: def.sortOrder,
        permissions: {
          create: PERMISSION_MODULES.map((moduleKey) => ({
            moduleKey,
            level: def.access[moduleKey] ?? 0,
          })),
        },
      },
    });

    // Demo record-level assignments for external parties
    if (def.name === "Supplier") {
      const confirms = await prisma.supplierConfirmation.findMany({ take: 3, orderBy: { recordId: "asc" } });
      const ships = await prisma.shipment.findMany({ take: 2, orderBy: { recordId: "asc" } });
      for (const r of confirms) {
        await prisma.recordAssignment.create({
          data: {
            roleId: role.id,
            moduleKey: "confirm",
            recordId: r.recordId,
            partyLabel: r.supplier || "Assigned supplier",
            notes: "Demo assignment — supplier portal stub",
          },
        });
      }
      for (const r of ships) {
        await prisma.recordAssignment.create({
          data: {
            roleId: role.id,
            moduleKey: "ship",
            recordId: r.recordId,
            partyLabel: r.carrier || "Assigned shipment",
            notes: "Demo assignment — supplier shipping visibility",
          },
        });
      }
    }

    if (def.name === "Clearing Agent") {
      const customs = await prisma.customsClearance.findMany({ take: 2, orderBy: { recordId: "asc" } });
      const ships = await prisma.shipment.findMany({ take: 2, orderBy: { recordId: "asc" } });
      for (const r of customs) {
        await prisma.recordAssignment.create({
          data: {
            roleId: role.id,
            moduleKey: "customs",
            recordId: r.recordId,
            partyLabel: r.broker || "Assigned broker",
            notes: "Demo assignment — clearing agent stub",
          },
        });
      }
      for (const r of ships) {
        await prisma.recordAssignment.create({
          data: {
            roleId: role.id,
            moduleKey: "ship",
            recordId: r.recordId,
            partyLabel: r.importNo || "Assigned shipment",
            notes: "Demo assignment — broker shipping visibility",
          },
        });
      }
    }
  }
}
