import { Injectable } from "@nestjs/common";
import { AutomationService } from "../automation/automation.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: AutomationService,
  ) {}

  async dashboard(roleName?: string) {
    // Ensure alerts reflect current SLA/notification rules
    try {
      await this.automation.evaluate(roleName || "system");
    } catch {
      /* first boot before seed is ok */
    }

    const [prCount, poCount, openPr, openPo, recentPr, recentPo, slice, kpiRows] = await Promise.all([
      this.prisma.purchaseRequisition.count(),
      this.prisma.purchaseOrder.count(),
      this.prisma.purchaseRequisition.count({
        where: { status: { notIn: ["Cancelled", "Closed"] } },
      }),
      this.prisma.purchaseOrder.count({
        where: { status: { notIn: ["Cancelled", "Closed"] } },
      }),
      this.prisma.purchaseRequisition.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.purchaseOrder.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
      }),
      this.automation.dashboardSlice(roleName),
      this.automation.kpisFromRules(),
    ]);

    const pipeline = [
      { key: "pr", label: "Purchase requisitions", count: await this.prisma.purchaseRequisition.count() },
      { key: "quotes", label: "Quotations", count: await this.prisma.quotation.count() },
      { key: "eval", label: "Evaluation & approval", count: await this.prisma.evaluation.count() },
      { key: "po", label: "PO / PI", count: await this.prisma.purchaseOrder.count() },
      { key: "pay", label: "Payments", count: await this.prisma.payment.count() },
      { key: "confirm", label: "Supplier confirmation", count: await this.prisma.supplierConfirmation.count() },
      { key: "ship", label: "Shipping", count: await this.prisma.shipment.count() },
      { key: "vessel", label: "Vessel tracking", count: await this.prisma.vesselTracking.count() },
      { key: "customs", label: "Customs", count: await this.prisma.customsClearance.count() },
      { key: "delivery", label: "Delivery & landed cost", count: await this.prisma.deliveryLandedCost.count() },
      { key: "grn", label: "GRN & closure", count: await this.prisma.goodsReceipt.count() },
    ];

    const max = Math.max(...pipeline.map((p) => p.count), 1);

    const topKpis = [
      {
        label: "Open cases",
        value: openPr + openPo,
        detail: `${prCount} PR lines · ${poCount} PO lines`,
        tone: "blue",
        icon: "grid",
      },
      {
        label: "Open alerts",
        value: slice.openAlerts,
        detail: `${slice.openExceptions} exceptions on register`,
        tone: "amber",
        icon: "alert",
      },
      {
        label: "In transit",
        value: await this.prisma.vesselTracking.count({ where: { status: { in: ["In transit", "Delayed"] } } }),
        detail: "Active vessel tracks",
        tone: "blue",
        icon: "ship",
      },
      {
        label: "Closed files",
        value: await this.prisma.goodsReceipt.count({ where: { status: "Closed" } }),
        detail: "GRN completed",
        tone: "green",
        icon: "check",
      },
    ];

    return {
      kpis: topKpis,
      kpiDetail: kpiRows,
      pipeline: pipeline.map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) })),
      attention: slice.attention.slice(0, 8).map((a) => ({
        module: a.module,
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        tone: a.tone,
        href: a.href,
        triggerKey: a.triggerKey,
      })),
      alertSummary: slice.byTrigger,
      recentPr: recentPr.map((r) => ({
        id: r.recordId,
        prNo: r.prNo,
        line: r.line,
        material: r.material,
        status: r.status,
        plant: r.plant,
      })),
      recentPo: recentPo.map((r) => ({
        id: r.recordId,
        poNo: r.poNo,
        supplier: r.supplier,
        material: r.material,
        status: r.status,
        piNo: r.piNo,
      })),
    };
  }
}
