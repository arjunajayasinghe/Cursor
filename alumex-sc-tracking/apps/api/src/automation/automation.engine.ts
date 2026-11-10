import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type DetectedAlert = {
  triggerKey: string;
  moduleKey: string;
  recordId: string;
  title: string;
  message: string;
  severity: string;
  action: string;
  recipientRoles: string;
  href?: string;
  ageHours?: number;
  category?: string;
};

function hoursSince(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 36e5));
}

function daysSince(date: Date | string | null | undefined, now = new Date()): number | null {
  const h = hoursSince(date, now);
  return h == null ? null : Math.floor(h / 24);
}

@Injectable()
export class AutomationEngine {
  constructor(private readonly prisma: PrismaService) {}

  async detect(): Promise<DetectedAlert[]> {
    const now = new Date();
    const [slaRules, notifRules] = await Promise.all([
      this.prisma.slaRule.findMany({ where: { active: true } }),
      this.prisma.notificationRule.findMany({ where: { active: true } }),
    ]);
    const sla = Object.fromEntries(slaRules.map((r) => [r.key, r]));
    const enabled = new Set(notifRules.map((r) => r.triggerKey));
    const ruleMeta = Object.fromEntries(notifRules.map((r) => [r.triggerKey, r]));
    const alerts: DetectedAlert[] = [];

    const push = (
      partial: Omit<DetectedAlert, "action" | "recipientRoles" | "severity"> & {
        triggerKey: string;
        severity?: string;
      },
    ) => {
      if (!enabled.has(partial.triggerKey)) return;
      const meta = ruleMeta[partial.triggerKey];
      alerts.push({
        ...partial,
        action: meta.action,
        recipientRoles: meta.recipientRoles,
        severity: partial.severity || meta.severity,
      });
    };

    // PR pending approval
    const pendingPr = await this.prisma.purchaseRequisition.findMany({
      where: { status: { in: ["Pending release", "Draft", "Pending approval"] } },
      take: 50,
    });
    for (const r of pendingPr) {
      push({
        triggerKey: "pr_pending_approval",
        moduleKey: "pr",
        recordId: r.recordId,
        title: `PR ${r.prNo} · ${r.line} pending approval`,
        message: `${r.material || "Item"} · ${r.status}`,
        severity: "info",
        href: "/pr",
        ageHours: hoursSince(r.updatedAt, now) ?? undefined,
      });
    }

    // Quotation overdue
    const quoteSlaHours = sla.quotation_response?.targetValue ?? 48;
    const openQuotes = await this.prisma.quotation.findMany({
      where: { status: { in: ["Requested", "Awaiting quote", "Partial"] }, received: null },
      take: 80,
    });
    for (const r of openQuotes) {
      const age = hoursSince(r.called || r.createdAt, now);
      if (age != null && age >= quoteSlaHours) {
        push({
          triggerKey: "quotation_overdue",
          moduleKey: "quotes",
          recordId: r.recordId,
          title: `Quotation overdue · ${r.rfq || r.recordId}`,
          message: `${r.supplier || "Supplier"} · ${age}h since call (SLA ${quoteSlaHours}h)`,
          severity: "warning",
          href: "/quotations",
          ageHours: age,
          category: "SLA",
        });
      }
    }

    // Evaluation overdue
    const evalSlaHours = sla.evaluation_turnaround?.targetValue ?? 48;
    const openEval = await this.prisma.evaluation.findMany({
      where: { status: { in: ["Draft", "In review", "Pending decision", "Pending"] } },
      take: 80,
    });
    for (const r of openEval) {
      const age = hoursSince(r.due || r.start || r.createdAt, now);
      const overdueByDue = r.due ? (r.due as Date) < now : false;
      if ((age != null && age >= evalSlaHours) || overdueByDue) {
        push({
          triggerKey: "evaluation_overdue",
          moduleKey: "eval",
          recordId: r.recordId,
          title: `Evaluation overdue · ${r.recordId}`,
          message: `${r.evaluator || "Evaluator"} · ${age ?? 0}h ageing (SLA ${evalSlaHours}h)`,
          severity: "critical",
          href: "/evaluation",
          ageHours: age ?? undefined,
          category: "SLA",
        });
      }
    }

    // Payment due / overdue
    const paySlaHours = sla.payment_due?.targetValue ?? 48;
    const openPay = await this.prisma.payment.findMany({
      where: { status: { in: ["Scheduled", "Submitted to bank", "Part paid", "Due"] } },
      take: 80,
    });
    for (const r of openPay) {
      const due = r.due;
      const age = hoursSince(due || r.createdAt, now);
      const pastDue = due ? (due as Date) <= now : false;
      if (pastDue || (age != null && age >= paySlaHours)) {
        push({
          triggerKey: "payment_due",
          moduleKey: "pay",
          recordId: r.recordId,
          title: `Payment due · ${r.recordId}`,
          message: `${r.method || "Payment"} · ${r.currency || ""} ${r.amount ?? ""} · ${r.status}`,
          severity: pastDue ? "critical" : "warning",
          href: "/payments",
          ageHours: age ?? undefined,
          category: "SLA",
        });
      }
    }

    // PO awaiting supplier acknowledgement
    const ackDays = sla.supplier_ack?.targetValue ?? 3;
    const awaitingAck = await this.prisma.supplierConfirmation.findMany({
      where: { status: { in: ["Awaiting response", "Sent", "Pending"] }, acknowledged: null },
      take: 80,
    });
    for (const r of awaitingAck) {
      const ageD = daysSince(r.createdAt, now);
      if (ageD != null && ageD >= ackDays) {
        push({
          triggerKey: "po_awaiting_ack",
          moduleKey: "confirm",
          recordId: r.recordId,
          title: `Awaiting acknowledgement · ${r.recordId}`,
          message: `${r.supplier || "Supplier"} · ${ageD}d without ack (target ${ackDays}d)`,
          severity: "warning",
          href: "/confirmations",
          ageHours: (ageD || 0) * 24,
          category: "SLA",
        });
      }
    }

    // Production overdue
    const productionLate = await this.prisma.supplierConfirmation.findMany({
      where: {
        production: { not: null, lt: now },
        status: { notIn: ["Confirmed", "Shipped", "Closed", "Cancelled"] },
      },
      take: 50,
    });
    for (const r of productionLate) {
      push({
        triggerKey: "production_overdue",
        moduleKey: "confirm",
        recordId: r.recordId,
        title: `Production overdue · ${r.recordId}`,
        message: `${r.supplier || "Supplier"} · production date passed`,
        severity: "critical",
        href: "/confirmations",
        ageHours: hoursSince(r.production, now) ?? undefined,
      });
    }

    // Shipping details missing
    const thinShips = await this.prisma.shipment.findMany({
      where: {
        status: { in: ["Booking pending", "Details incomplete", "Ready to book"] },
        OR: [{ booking: null }, { bl: null }],
      },
      take: 50,
    });
    for (const r of thinShips) {
      push({
        triggerKey: "shipping_details_missing",
        moduleKey: "ship",
        recordId: r.recordId,
        title: `Shipping details missing · ${r.importNo || r.recordId}`,
        message: `${r.carrier || "Carrier TBD"} · booking/BL incomplete`,
        severity: "warning",
        href: "/shipping",
        ageHours: hoursSince(r.updatedAt, now) ?? undefined,
      });
    }

    // ETA revised
    const etaRevised = await this.prisma.vesselTracking.findMany({
      where: { OR: [{ etaRevised: { not: null } }, { status: "Delayed" }] },
      take: 50,
    });
    for (const r of etaRevised) {
      if (!r.etaRevised && r.status !== "Delayed") continue;
      push({
        triggerKey: "eta_revised",
        moduleKey: "vessel",
        recordId: r.recordId,
        title: `ETA revised · ${r.vessel || r.recordId}`,
        message: r.reason || `Revised ETA ${r.etaRevised?.toISOString().slice(0, 10) || "updated"}`,
        severity: r.status === "Delayed" ? "warning" : "info",
        href: "/vessel",
        ageHours: hoursSince(r.updatedAt, now) ?? undefined,
      });
    }

    // Vessel arrived
    const arrived = await this.prisma.vesselTracking.findMany({
      where: { OR: [{ arrived: { not: null } }, { status: { in: ["Arrived", "At berth"] } }] },
      take: 40,
    });
    for (const r of arrived) {
      push({
        triggerKey: "vessel_arrived",
        moduleKey: "vessel",
        recordId: r.recordId,
        title: `Vessel arrived · ${r.vessel || r.recordId}`,
        message: "Start / continue customs clearance",
        severity: "info",
        href: "/customs",
        ageHours: hoursSince(r.arrived || r.updatedAt, now) ?? undefined,
      });
    }

    // Clearance overdue (FCL/LCL masters)
    const fclDays = sla.clearance_fcl?.targetValue ?? 3;
    const lclDays = sla.clearance_lcl?.targetValue ?? 5;
    const openCustoms = await this.prisma.customsClearance.findMany({
      where: { status: { notIn: ["Released", "Closed", "Cancelled"] }, released: null },
      take: 80,
    });
    for (const r of openCustoms) {
      const ageD = daysSince(r.filed || r.createdAt, now);
      // Demo heuristic: declaration containing LCL → LCL target, else FCL
      const isLcl = `${r.declaration || ""} ${r.notes || ""}`.toUpperCase().includes("LCL");
      const target = isLcl ? lclDays : fclDays;
      if (ageD != null && ageD >= target) {
        push({
          triggerKey: "clearance_overdue",
          moduleKey: "customs",
          recordId: r.recordId,
          title: `Clearance overdue · ${r.recordId}`,
          message: `${isLcl ? "LCL" : "FCL"} · ${ageD}d in clearance (target ${target}d)`,
          severity: "critical",
          href: "/customs",
          ageHours: ageD * 24,
          category: "SLA",
        });
      }

      // Duty payment approaching — assessment present, unpaid
      if (r.duty && !r.paidDate && ["Assessment issued", "Duty pending", "Awaiting duty"].includes(r.status)) {
        push({
          triggerKey: "duty_payment_approaching",
          moduleKey: "customs",
          recordId: r.recordId,
          title: `Duty payment approaching · ${r.recordId}`,
          message: `Duty ${r.duty} · ${r.status}`,
          severity: "info",
          href: "/customs",
        });
      }
    }

    // GRN pending
    const grnDays = sla.grn_pending?.targetValue ?? 2;
    const pendingGrn = await this.prisma.goodsReceipt.findMany({
      where: { status: { in: ["Awaiting posting", "Partial", "Pending closure"] } },
      take: 80,
    });
    for (const r of pendingGrn) {
      const ageD = daysSince(r.posted || r.createdAt, now);
      if (ageD != null && ageD >= grnDays) {
        push({
          triggerKey: "grn_pending",
          moduleKey: "grn",
          recordId: r.recordId,
          title: `GRN pending · ${r.grnNo || r.recordId}`,
          message: `${r.plant || "Plant"} · ${r.status} · ${ageD}d`,
          severity: "warning",
          href: "/grn",
          ageHours: ageD * 24,
          category: "SLA",
        });
      }
    }

    // Also surface delayed vessels as eta_revised if not already
    return alerts;
  }
}
