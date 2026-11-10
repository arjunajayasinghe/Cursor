import { PrismaClient, Prisma } from "@prisma/client";
import { seedPermissions } from "./permissions-seed";
import { seedAutomation } from "./automation-seed";

const prisma = new PrismaClient();

const today = "2026-11-09";

function day(iso: string | null | undefined, n: number): Date | null {
  if (!iso) return null;
  return new Date(Date.parse(iso) + n * 86400000);
}

function d(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  return new Date(iso);
}

const demoCases: Array<[string, string, number, string, number, string, number]> = [
  ["Aluminium billet 6063", "Gulf Alloy Trading", 7, "Delayed", 160, "MT", 2440],
  ["Powder coating · RAL 9016", "Meridian Coatings", 4, "Submitted to bank", 1200, "KG", 5.25],
  ["Extrusion die H13", "Vektor Tooling", 2, "In review", 12, "EA", 790],
  ["Anodising chemicals", "Pacific Surface Supply", 8, "Under examination", 2400, "KG", 3.55],
  ["EPDM glazing gasket", "NexSeal Industrial", 9, "Dispatched", 3000, "KG", 2.65],
  ["Aluminium ingot P1020", "Gulf Alloy Trading", 10, "Closed", 80, "MT", 2310],
  ["Protective PE film", "Harbor Polymer", 3, "Pending SAP release", 2500, "KG", 2.35],
  ["Thermal break strip", "NexSeal Industrial", 1, "Received", 1800, "KG", 4.85],
  ["Hydraulic oil ISO 46", "Meridian Coatings", 0, "Pending release", 600, "L", 3.2],
  ["Die cleaning media", "Vektor Tooling", 5, "Awaiting response", 350, "KG", 9.4],
  ["Packaging spacers", "Harbor Polymer", 6, "Booked", 1800, "EA", 0.72],
  ["Aluminium billet 6060", "Gulf Alloy Trading", 7, "In transit", 100, "MT", 2390],
  ["Warehouse racking fittings", "Vektor Tooling", 10, "Closed", 36, "SET", 33],
  ["Coating pretreatment blend", "Pacific Surface Supply", 2, "In review", 800, "KG", 6.8],
  ["Protective shrink wrap", "Harbor Polymer", 8, "Filed", 520, "KG", 2.3],
  ["Stainless steel fixing clips", "NexSeal Industrial", 0, "Draft", 3200, "EA", 0.6],
];

const completed = [
  "Released",
  "Shortlisted",
  "Approved",
  "Sent to supplier",
  "Paid",
  "Confirmed",
  "Departed",
  "Arrived",
  "Released",
  "Cost finalized",
  "Closed",
];

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.deliveryLandedCost.deleteMany();
  await prisma.customsClearance.deleteMany();
  await prisma.vesselTracking.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.supplierConfirmation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.purchaseRequisition.deleteMany();

  for (let i = 0; i < demoCases.length; i++) {
    const [material, supplier, stage, status, quantity, uom, unitPrice] = demoCases[i];
    const n = 101 + i;
    const prDate = day(today, -37 - i)!;
    const poDate = day(prDate.toISOString().slice(0, 10), 13)!;
    const eta = day(today, i === 0 ? -1 : i === 11 ? 4 : -7 - i)!;
    const poNo = String(4500012987 + i);
    const supplierIdx = demoCases.findIndex((x) => x[1] === supplier);
    const supplierCode = String(100352 + supplierIdx);
    const plant = i % 3 === 0 ? "1200 · Ekala" : "1100 · Sapugaskanda";
    const prId = `PR-${n}`;
    const poId = `PO-${n}`;
    const importNo = `IMP-${256 + i}`;
    const currency = "USD";
    const due = day(today, i === 1 ? -2 : -7)!;
    const paid = stage > 4;
    const prNo = String(100002481 + i);
    const materialCode = `ALX-${301 + i}`;

    const prStatus = stage === 0 ? status : completed[0];
    const pr = await prisma.purchaseRequisition.create({
      data: {
        recordId: prId,
        prNo,
        line: "00010",
        date: prDate,
        requester: ["N. Perera", "S. Silva", "R. Fernando"][i % 3],
        department: "Manufacturing",
        plant,
        materialCode,
        material,
        materialGroup: i % 3 === 0 ? "Raw materials" : "Production supplies",
        quantity: new Prisma.Decimal(quantity),
        uom,
        need: day(today, 10 + i),
        approved: stage > 0 ? day(prDate.toISOString().slice(0, 10), 2) : null,
        buyer: "A. Jayasinghe",
        priority: i < 2 ? "High" : "Normal",
        status: prStatus,
        sourcing: i % 4 === 0 ? "Local" : "Import",
        stockType: i % 2 === 0 ? "Stock" : "Non-Stock",
      },
    });

    if (stage >= 1) {
      const quoteBase = {
        called: day(prDate.toISOString().slice(0, 10), 3),
        supplierCode,
        supplier,
        received: day(prDate.toISOString().slice(0, 10), 6),
        quoteRef: `Q-${2401 + i}`,
        currency,
        unitPrice: new Prisma.Decimal(unitPrice),
        quantity: new Prisma.Decimal(quantity),
        paymentTerms: "30% advance · 70% on documents",
        incoterm: "CIF",
        lead: 24 + (i % 6),
        validity: day(today, 20),
        purchaseRequisitionId: pr.id,
        prId,
      };
      await prisma.quotation.create({
        data: {
          ...quoteBase,
          recordId: `QT-${n}`,
          status: stage === 1 ? status : completed[1],
        },
      });
      for (const [alt, k] of [
        ["Atlas Industrial Supply", 0],
        ["Solace International", 1],
      ] as const) {
        await prisma.quotation.create({
          data: {
            ...quoteBase,
            recordId: `QT-${n}${k ? "C" : "B"}`,
            supplier: alt,
            supplierCode: `10039${k}`,
            quoteRef: `Q-${2401 + i}${k ? "C" : "B"}`,
            unitPrice: new Prisma.Decimal(Number((unitPrice * (1.07 + k * 0.045)).toFixed(2))),
            lead: 28 + k * 3,
            status: "Received",
          },
        });
      }
    }

    if (stage >= 2) {
      await prisma.evaluation.create({
        data: {
          recordId: `EV-${n}`,
          prId,
          purchaseRequisitionId: pr.id,
          start: day(prDate.toISOString().slice(0, 10), 7),
          evaluator: "Procurement review panel",
          due: day(today, i === 2 ? -1 : 3),
          compliance: "Compliant",
          recommended: `QT-${n}`,
          technical: "Specification and quality evidence reviewed.",
          compare: "Comparable USD offers assessed on price, payment terms and lead time.",
          status: stage === 2 ? status : completed[2],
          decisions:
            stage > 2
              ? {
                  Procurement: { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                  "Technical 1": { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                  Management: { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                  Finance: { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                  "Technical 2": { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                }
              : {
                  Procurement: { decision: "Approve", date: day(prDate.toISOString().slice(0, 10), 10)?.toISOString().slice(0, 10), note: "Reviewed." },
                },
        },
      });
    }

    let poDbId: string | undefined;
    if (stage >= 3) {
      const po = await prisma.purchaseOrder.create({
        data: {
          recordId: poId,
          prId,
          purchaseRequisitionId: pr.id,
          poNo,
          line: "00010",
          date: poDate,
          supplierCode,
          supplier,
          materialCode,
          material,
          quantity: new Prisma.Decimal(quantity),
          uom,
          currency,
          unitPrice: new Prisma.Decimal(unitPrice),
          paymentTerms: "30% advance · 70% on documents",
          incoterm: "CIF",
          approval: "L2",
          approved: stage > 3 ? day(poDate.toISOString().slice(0, 10), 1) : null,
          sent: stage > 3 ? day(poDate.toISOString().slice(0, 10), 2) : null,
          importNo,
          piNo: `PI-${732 + i}`,
          piDate: day(poDate.toISOString().slice(0, 10), 2),
          piAmount: new Prisma.Decimal(quantity * unitPrice),
          production: 15,
          transit: 12,
          status: stage === 3 ? status : completed[3],
        },
      });
      poDbId = po.id;
    }

    if (stage >= 4 && poDbId) {
      await prisma.payment.create({
        data: {
          recordId: `PAY-${n}`,
          poId,
          purchaseOrderId: poDbId,
          method: i % 2 ? "LC" : "TT",
          due,
          currency,
          amount: new Prisma.Decimal(quantity * unitPrice),
          bank: "Demo Trade Bank",
          bankDate: day(due.toISOString().slice(0, 10), -2),
          reference: `BT-${427 + i}`,
          completed: paid ? day(due.toISOString().slice(0, 10), -1) : null,
          paid: paid ? new Prisma.Decimal(quantity * unitPrice) : new Prisma.Decimal(0),
          status: stage === 4 ? status : completed[4],
        },
      });
    }

    if (stage >= 5 && poDbId) {
      await prisma.supplierConfirmation.create({
        data: {
          recordId: `CF-${n}`,
          poId,
          purchaseOrderId: poDbId,
          supplier,
          contact: "Export desk",
          acknowledged: stage > 5 ? day(poDate.toISOString().slice(0, 10), 3) : null,
          confirmedQuantity: stage > 5 ? new Prisma.Decimal(quantity) : null,
          ready: day(poDate.toISOString().slice(0, 10), 14),
          shipBy: day(poDate.toISOString().slice(0, 10), 16),
          status: stage === 5 ? status : completed[5],
        },
      });
    }

    let shipmentId: string | undefined;
    if (stage >= 6 && poDbId) {
      const shipment = await prisma.shipment.create({
        data: {
          recordId: `SHP-${n}`,
          poId,
          purchaseOrderId: poDbId,
          importNo,
          booking: `BKG-${5261 + i}`,
          booked: day(poDate.toISOString().slice(0, 10), 10),
          forwarder: "Ceylon Freight Services",
          carrier: "Bluewave Line",
          vessel: i === 11 ? "Ocean Kestrel" : "Eastern Horizon",
          voyage: `0${18 + i}W`,
          bl: `BWL-${4120 + i}`,
          blDate: day(eta.toISOString().slice(0, 10), -9),
          container: "BWLU 274601-8 · 40 HC",
          loading: i % 2 ? "Singapore" : "Jebel Ali",
          destination: "Colombo",
          etd: day(eta.toISOString().slice(0, 10), -9),
          atd: stage > 6 ? day(eta.toISOString().slice(0, 10), -9) : null,
          eta,
          etaRevised: i === 0 ? day(eta.toISOString().slice(0, 10), 4) : null,
          arrived: stage > 7 ? eta : null,
          status: stage === 6 ? status : completed[6],
        },
      });
      shipmentId = shipment.id;
    }

    if (stage >= 7 && shipmentId) {
      await prisma.vesselTracking.create({
        data: {
          recordId: `TRK-${n}`,
          shipmentId,
          vessel: i === 11 ? "Ocean Kestrel" : "Eastern Horizon",
          imo: "9876543",
          voyage: `0${18 + i}W`,
          position: stage > 7 ? "Colombo terminal" : i === 0 ? "Arabian Sea" : "Approaching Colombo",
          updated: stage > 7 ? eta : d(today),
          eta,
          etaRevised: i === 0 ? day(eta.toISOString().slice(0, 10), 4) : eta,
          arrived: stage > 7 ? eta : null,
          reason: i === 0 ? "Carrier reported congestion at the transshipment port." : null,
          status: stage === 7 ? status : completed[7],
        },
      });
    }

    if (stage >= 8 && shipmentId) {
      await prisma.customsClearance.create({
        data: {
          recordId: `CUS-${n}`,
          shipmentId,
          broker: "Ceylon Clearance Services",
          declaration: `CD-${38127 + i}`,
          filed: day(eta.toISOString().slice(0, 10), 1),
          hs: "7601.20",
          value: new Prisma.Decimal(quantity * unitPrice * 306),
          duty: new Prisma.Decimal(42000),
          tax: new Prisma.Decimal(18000),
          released: stage > 8 ? day(eta.toISOString().slice(0, 10), 3) : null,
          status: stage === 8 ? status : completed[8],
        },
      });
    }

    if (stage >= 9 && shipmentId) {
      await prisma.deliveryLandedCost.create({
        data: {
          recordId: `DLV-${n}`,
          shipmentId,
          site: plant,
          transport: "Lakeview Haulage",
          vehicle: "WP NC-4520",
          dispatch: day(eta.toISOString().slice(0, 10), 4),
          delivered: stage > 9 ? day(eta.toISOString().slice(0, 10), 4) : null,
          quantity: new Prisma.Decimal(quantity),
          uom,
          currency,
          goods: new Prisma.Decimal(quantity * unitPrice),
          fx: new Prisma.Decimal(306),
          freight: new Prisma.Decimal(0),
          insurance: new Prisma.Decimal(0),
          duty: new Prisma.Decimal(60000),
          handling: new Prisma.Decimal(28500),
          local: new Prisma.Decimal(18000),
          status: stage === 9 ? status : completed[9],
        },
      });
    }

    if (stage >= 10) {
      await prisma.goodsReceipt.create({
        data: {
          recordId: `GRN-${n}`,
          prId,
          poId,
          grnNo: String(5000010571 + i),
          year: 2026,
          item: "0001",
          movement: "101",
          posted: day(eta.toISOString().slice(0, 10), 5),
          plant,
          location: "RM01",
          received: new Prisma.Decimal(quantity),
          accepted: new Prisma.Decimal(quantity),
          uom,
          quality: "Passed",
          closed: day(eta.toISOString().slice(0, 10), 6),
          closedBy: "Stores supervisor",
          status: stage === 10 ? status : completed[10],
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        moduleKey: "pr",
        recordId: prId,
        actor: "Demo seed",
        action: "Record created",
      },
    });
  }

  // Extra lines under PR 100002489 (demo walkthrough PR from GUI handoff)
  const maintenance = await prisma.purchaseRequisition.findFirst({
    where: { recordId: "PR-109" },
  });
  if (maintenance) {
    for (const [recordId, line, materialCode, material, quantity] of [
      ["PR-117", "00020", "ALX-317", "Gear oil ISO 220", 120],
      ["PR-118", "00030", "ALX-318", "Compressor oil ISO 68", 60],
    ] as const) {
      await prisma.purchaseRequisition.create({
        data: {
          recordId,
          prNo: maintenance.prNo,
          line,
          date: maintenance.date,
          requester: maintenance.requester,
          department: maintenance.department,
          plant: maintenance.plant,
          materialCode,
          material,
          materialGroup: maintenance.materialGroup,
          quantity: new Prisma.Decimal(quantity),
          uom: maintenance.uom,
          need: maintenance.need,
          approved: maintenance.approved,
          buyer: maintenance.buyer,
          priority: maintenance.priority,
          status: maintenance.status,
          sourcing: "Local",
          stockType: maintenance.stockType,
        },
      });
    }
  }

  await seedPermissions(prisma);
  await seedAutomation(prisma);
  console.log("Seeded Alumex demo data from GUI schema + role matrix + SLA/notifications.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
