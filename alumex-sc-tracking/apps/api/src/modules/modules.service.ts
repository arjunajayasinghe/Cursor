import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MODULE_DEFS, ModuleDef, ModuleKey, byModuleKey } from "./module-defs";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

function serialize(def: ModuleDef, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const f of def.dateFields) {
    const v = row[f];
    out[f] = v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null;
  }
  for (const f of def.decimalFields) {
    out[f] = row[f] != null ? Number(row[f]) : null;
  }
  // Calculated helpers
  if (def.key === "quotes") {
    const unit = Number(out.unitPrice) || 0;
    const qty = Number(out.quantity) || 0;
    out.total = unit && qty ? Number((unit * qty).toFixed(2)) : null;
  }
  if (def.key === "pay") {
    const amount = Number(out.amount) || 0;
    const paid = Number(out.paid) || 0;
    out.outstanding = Number((amount - paid).toFixed(2));
  }
  if (def.key === "vessel") {
    const eta = out.eta ? Date.parse(String(out.eta)) : NaN;
    const revised = out.etaRevised ? Date.parse(String(out.etaRevised)) : NaN;
    out.delay =
      Number.isFinite(eta) && Number.isFinite(revised)
        ? Math.max(0, Math.round((revised - eta) / 86400000))
        : null;
  }
  if (def.key === "delivery") {
    const goods = Number(out.goods) || 0;
    const fx = Number(out.fx) || 0;
    const extras = ["freight", "insurance", "duty", "handling", "demurrage", "local", "other"].reduce(
      (sum, k) => sum + (Number(out[k]) || 0),
      0,
    );
    const landed = goods * fx + extras;
    const qty = Number(out.quantity) || 0;
    out.landed = Number(landed.toFixed(2));
    out.perUnit = qty ? Number((landed / qty).toFixed(2)) : null;
  }
  if (def.key === "grn") {
    const received = Number(out.received) || 0;
    const accepted = Number(out.accepted) || 0;
    out.rejected = Number((received - accepted).toFixed(3));
  }
  if (def.key === "eval" && out.decisions && typeof out.decisions === "object") {
    // keep as-is
  }
  return out;
}

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  private model(def: ModuleDef): any {
    const client = (this.prisma as any)[def.prisma];
    if (!client) throw new BadRequestException(`Unknown prisma model ${def.prisma}`);
    return client;
  }

  listDefs() {
    return MODULE_DEFS.map((m) => ({ key: m.key, title: m.title, defaultStatus: m.defaultStatus }));
  }

  async list(key: ModuleKey, q?: string, status?: string) {
    const def = byModuleKey[key];
    if (!def) throw new NotFoundException("Unknown module");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (q) {
      where.OR = def.search.map((field) => ({
        [field]: { contains: q, mode: "insensitive" },
      }));
    }
    const rows = await this.model(def).findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r: Record<string, unknown>) => serialize(def, r));
  }

  async get(key: ModuleKey, id: string) {
    const def = byModuleKey[key];
    const row = await this.model(def).findFirst({
      where: { OR: [{ id }, { recordId: id }] },
    });
    if (!row) throw new NotFoundException(`${def.title} record not found`);
    return serialize(def, row);
  }

  private async buildData(def: ModuleDef, dto: Record<string, unknown>, isCreate: boolean) {
    const data: Record<string, unknown> = {};
    const skip = new Set(["id", "createdAt", "updatedAt", "total", "outstanding", "delay", "landed", "perUnit", "rejected"]);
    for (const [k, v] of Object.entries(dto)) {
      if (skip.has(k) || v === undefined) continue;
      if (def.dateFields.includes(k)) data[k] = parseDate(v as string | null);
      else if (def.decimalFields.includes(k)) data[k] = v == null || v === "" ? null : new Prisma.Decimal(Number(v));
      else if (def.intFields.includes(k)) data[k] = v == null || v === "" ? null : Number(v);
      else if (def.jsonFields.includes(k)) data[k] = v ?? null;
      else data[k] = v;
    }
    if (isCreate) {
      data.recordId = (dto.recordId as string) || `${def.recordPrefix}-${Date.now().toString().slice(-6)}`;
      data.status = (dto.status as string) || def.defaultStatus;
    }
    // Resolve FK helpers from PR/PO record ids when provided
    if (dto.prId && !dto.purchaseRequisitionId && ["quotes", "eval"].includes(def.key)) {
      const pr = await this.prisma.purchaseRequisition.findFirst({ where: { recordId: String(dto.prId) } });
      if (pr) data.purchaseRequisitionId = pr.id;
    }
    if (dto.poId && !dto.purchaseOrderId && ["pay", "confirm", "ship"].includes(def.key)) {
      const po = await this.prisma.purchaseOrder.findFirst({ where: { recordId: String(dto.poId) } });
      if (po) data.purchaseOrderId = po.id;
    }
    return data;
  }

  async create(key: ModuleKey, dto: Record<string, unknown>) {
    const def = byModuleKey[key];
    const data = await this.buildData(def, dto, true);
    const row = await this.model(def).create({ data });
    await this.prisma.auditEvent.create({
      data: {
        moduleKey: def.key,
        recordId: String(row.recordId),
        actor: "Demo user",
        action: "Created",
      },
    });
    return serialize(def, row);
  }

  async update(key: ModuleKey, id: string, dto: Record<string, unknown>) {
    const def = byModuleKey[key];
    const current = await this.model(def).findFirst({ where: { OR: [{ id }, { recordId: id }] } });
    if (!current) throw new NotFoundException(`${def.title} record not found`);
    const data = await this.buildData(def, dto, false);
    const row = await this.model(def).update({ where: { id: current.id }, data });
    const changed: Record<string, unknown> = {};
    for (const k of Object.keys(data)) {
      if (String((current as any)[k]) !== String((row as any)[k])) changed[k] = (row as any)[k];
    }
    await this.prisma.auditEvent.create({
      data: {
        moduleKey: def.key,
        recordId: String(row.recordId),
        actor: "Demo user",
        action: "Updated",
        oldValue: JSON.stringify(Object.fromEntries(Object.keys(changed).map((k) => [k, (current as any)[k]]))),
        newValue: JSON.stringify(changed),
        source: "manual",
      },
    });
    return serialize(def, row);
  }

  async remove(key: ModuleKey, id: string) {
    const def = byModuleKey[key];
    const current = await this.model(def).findFirst({ where: { OR: [{ id }, { recordId: id }] } });
    if (!current) throw new NotFoundException(`${def.title} record not found`);
    await this.model(def).delete({ where: { id: current.id } });
    return { ok: true, id: current.id };
  }

  async reports(type: string = "pipeline") {
    const [prs, quotes, evals, pos, pays, confirms, ships, vessels, customs, deliveries, grns] =
      await Promise.all([
        this.prisma.purchaseRequisition.findMany(),
        this.prisma.quotation.findMany(),
        this.prisma.evaluation.findMany(),
        this.prisma.purchaseOrder.findMany(),
        this.prisma.payment.findMany(),
        this.prisma.supplierConfirmation.findMany(),
        this.prisma.shipment.findMany(),
        this.prisma.vesselTracking.findMany(),
        this.prisma.customsClearance.findMany(),
        this.prisma.deliveryLandedCost.findMany(),
        this.prisma.goodsReceipt.findMany(),
      ]);

    const byPr = new Map(prs.map((p) => [p.recordId, p]));
    const byPo = new Map(pos.map((p) => [p.recordId, p]));

    if (type === "attention") {
      const rows: Array<Record<string, unknown>> = [];
      for (const v of vessels.filter((x) => x.status === "Delayed")) {
        const delay =
          v.eta && v.etaRevised
            ? Math.max(0, Math.round((v.etaRevised.getTime() - v.eta.getTime()) / 86400000))
            : null;
        rows.push({
          module: "vessel",
          reference: v.recordId,
          material: v.vessel,
          supplier: v.position,
          stage: "Vessel tracking",
          status: v.status,
          detail: delay != null ? `ETA slip +${delay} days` : v.reason,
        });
      }
      for (const p of pays.filter((x) => ["Scheduled", "Submitted to bank", "Part paid"].includes(x.status))) {
        const po = p.poId ? byPo.get(p.poId) : null;
        rows.push({
          module: "pay",
          reference: p.recordId,
          material: po?.material,
          supplier: po?.supplier,
          stage: "Payments",
          status: p.status,
          detail: p.due ? `Due ${p.due.toISOString().slice(0, 10)}` : p.method,
        });
      }
      for (const pr of prs.filter((x) => ["Draft", "Pending release", "Release unverified"].includes(x.status))) {
        rows.push({
          module: "pr",
          reference: `${pr.prNo}/${pr.line}`,
          material: pr.material,
          supplier: pr.buyer,
          stage: "Purchase requisitions",
          status: pr.status,
          detail: pr.priority,
        });
      }
      return { type, headers: ["Reference", "Material", "Supplier", "Stage", "Status", "Detail"], rows };
    }

    if (type === "cost") {
      const rows = deliveries.map((d) => {
        const goods = Number(d.goods || 0);
        const fx = Number(d.fx || 0);
        const extras =
          Number(d.freight || 0) +
          Number(d.insurance || 0) +
          Number(d.duty || 0) +
          Number(d.handling || 0) +
          Number(d.demurrage || 0) +
          Number(d.local || 0) +
          Number(d.other || 0);
        const landed = goods * fx + extras;
        const qty = Number(d.quantity || 0);
        return {
          module: "delivery",
          reference: d.recordId,
          site: d.site,
          quantity: qty,
          uom: d.uom,
          landed: Number(landed.toFixed(2)),
          perUnit: qty ? Number((landed / qty).toFixed(2)) : null,
          status: d.status,
        };
      });
      return {
        type,
        headers: ["Reference", "Site", "Quantity", "UoM", "Landed (LKR)", "Per unit (LKR)", "Status"],
        rows,
      };
    }

    if (type === "closure") {
      const rows = grns.map((g) => ({
        module: "grn",
        reference: g.recordId,
        grnNo: g.grnNo,
        prId: g.prId,
        poId: g.poId,
        plant: g.plant,
        accepted: g.accepted != null ? Number(g.accepted) : null,
        quality: g.quality,
        closed: g.closed ? g.closed.toISOString().slice(0, 10) : null,
        status: g.status,
      }));
      return {
        type,
        headers: ["Reference", "GRN", "PR", "PO", "Plant", "Accepted", "Quality", "Closed", "Status"],
        rows,
      };
    }

    // pipeline default — one row per PR line with latest stage
    const stageOrder: Array<{ key: string; label: string; records: Array<{ prId?: string | null; poId?: string | null; status: string; recordId: string }> }> = [
      { key: "pr", label: "Purchase requisitions", records: prs.map((r) => ({ prId: r.recordId, status: r.status, recordId: r.recordId })) },
      { key: "quotes", label: "Quotations", records: quotes.map((r) => ({ prId: r.prId, status: r.status, recordId: r.recordId })) },
      { key: "eval", label: "Evaluation & approval", records: evals.map((r) => ({ prId: r.prId, status: r.status, recordId: r.recordId })) },
      { key: "po", label: "PO / PI", records: pos.map((r) => ({ prId: r.prId, poId: r.recordId, status: r.status, recordId: r.recordId })) },
      { key: "pay", label: "Payments", records: pays.map((r) => ({ poId: r.poId, status: r.status, recordId: r.recordId })) },
      { key: "confirm", label: "Supplier confirmation", records: confirms.map((r) => ({ poId: r.poId, status: r.status, recordId: r.recordId })) },
      { key: "ship", label: "Shipping", records: ships.map((r) => ({ poId: r.poId, status: r.status, recordId: r.recordId })) },
      { key: "vessel", label: "Vessel tracking", records: vessels.map((r) => ({ status: r.status, recordId: r.recordId })) },
      { key: "customs", label: "Customs", records: customs.map((r) => ({ status: r.status, recordId: r.recordId })) },
      { key: "delivery", label: "Delivery & landed cost", records: deliveries.map((r) => ({ status: r.status, recordId: r.recordId })) },
      { key: "grn", label: "GRN & closure", records: grns.map((r) => ({ prId: r.prId, poId: r.poId, status: r.status, recordId: r.recordId })) },
    ];

    const rows = prs.map((pr) => {
      let stage = "Purchase requisitions";
      let status = pr.status;
      let owner = pr.buyer || "Procurement";
      let supplier: string | null = null;
      const po = pos.find((p) => p.prId === pr.recordId);
      if (po) {
        supplier = po.supplier;
        for (const s of stageOrder) {
          const hit = s.records.find((r) => r.prId === pr.recordId || (po && r.poId === po.recordId));
          if (hit) {
            stage = s.label;
            status = hit.status;
          }
        }
      } else {
        for (const s of stageOrder.slice(0, 3)) {
          const hit = s.records.find((r) => r.prId === pr.recordId);
          if (hit) {
            stage = s.label;
            status = hit.status;
          }
        }
      }
      return {
        module: "pr",
        reference: `${pr.prNo}/${pr.line}`,
        material: pr.material,
        supplier,
        stage,
        status,
        owner,
        recordId: pr.recordId,
      };
    });

    return {
      type: "pipeline",
      headers: ["Reference", "Material", "Supplier", "Current stage", "Status", "Owner"],
      rows,
      counts: stageOrder.map((s) => ({ key: s.key, label: s.label, count: s.records.length })),
    };
  }
}
