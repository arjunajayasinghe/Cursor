import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [prCount, poCount, openPr, openPo, delayedVessel, pendingPayments, recentPr, recentPo] =
      await Promise.all([
        this.prisma.purchaseRequisition.count(),
        this.prisma.purchaseOrder.count(),
        this.prisma.purchaseRequisition.count({
          where: { status: { notIn: ["Cancelled", "Closed"] } },
        }),
        this.prisma.purchaseOrder.count({
          where: { status: { notIn: ["Cancelled", "Closed"] } },
        }),
        this.prisma.vesselTracking.count({ where: { status: "Delayed" } }),
        this.prisma.payment.count({
          where: { status: { in: ["Scheduled", "Submitted to bank", "Part paid"] } },
        }),
        this.prisma.purchaseRequisition.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
        }),
        this.prisma.purchaseOrder.findMany({
          take: 6,
          orderBy: { updatedAt: "desc" },
        }),
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
    const attention = [
      ...(
        await this.prisma.vesselTracking.findMany({
          where: { status: "Delayed" },
          take: 3,
        })
      ).map((r) => ({
        module: "vessel",
        id: r.recordId,
        title: `${r.vessel || "Vessel"} delayed`,
        subtitle: r.reason || r.position || "ETA slip",
        tone: "amber" as const,
      })),
      ...(
        await this.prisma.purchaseRequisition.findMany({
          where: { status: { in: ["Pending release", "Draft"] } },
          take: 3,
        })
      ).map((r) => ({
        module: "pr",
        id: r.recordId,
        title: `PR ${r.prNo} · ${r.line}`,
        subtitle: `${r.material || "Item"} · ${r.status}`,
        tone: "blue" as const,
      })),
      ...(
        await this.prisma.purchaseOrder.findMany({
          where: { status: "Pending SAP release" },
          take: 2,
        })
      ).map((r) => ({
        module: "po",
        id: r.recordId,
        title: `PO ${r.poNo}`,
        subtitle: `${r.supplier || "Supplier"} · awaiting SAP release`,
        tone: "amber" as const,
      })),
    ];

    return {
      kpis: [
        { label: "Open cases", value: openPr + openPo, detail: `${prCount} PR lines · ${poCount} PO lines`, tone: "blue", icon: "grid" },
        { label: "Exceptions", value: delayedVessel + pendingPayments, detail: "Delays and finance actions", tone: "amber", icon: "alert" },
        { label: "In transit", value: await this.prisma.vesselTracking.count({ where: { status: { in: ["In transit", "Delayed"] } } }), detail: "Active vessel tracks", tone: "blue", icon: "ship" },
        { label: "Closed files", value: await this.prisma.goodsReceipt.count({ where: { status: "Closed" } }), detail: "GRN completed", tone: "green", icon: "check" },
      ],
      pipeline: pipeline.map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) })),
      attention: attention.slice(0, 6),
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
