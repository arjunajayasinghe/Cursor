import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { analyzePrReport, prItemKey, prNumberKey } from "./pr-import";
import { CreatePrDto, UpdatePrDto } from "./pr.dto";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

function ageingDays(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.round((Date.now() - date.getTime()) / 86400000);
}

function serializePr(row: Record<string, unknown>): Record<string, unknown> {
  const date = row.date as Date | null | undefined;
  return {
    ...row,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    age: ageingDays(date),
    date: date ? date.toISOString().slice(0, 10) : null,
    changed: row.changed ? (row.changed as Date).toISOString().slice(0, 10) : null,
    reportReceived: row.reportReceived ? (row.reportReceived as Date).toISOString().slice(0, 10) : null,
    reportDate: row.reportDate ? (row.reportDate as Date).toISOString().slice(0, 10) : null,
    need: row.need ? (row.need as Date).toISOString().slice(0, 10) : null,
    approved: row.approved ? (row.approved as Date).toISOString().slice(0, 10) : null,
  };
}

@Injectable()
export class PrService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, status?: string) {
    const where: Prisma.PurchaseRequisitionWhereInput = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { prNo: { contains: q } },
        { material: { contains: q, mode: "insensitive" } },
        { requester: { contains: q, mode: "insensitive" } },
        { plant: { contains: q, mode: "insensitive" } },
        { materialCode: { contains: q, mode: "insensitive" } },
        { recordId: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.purchaseRequisition.findMany({
      where,
      orderBy: [{ prNo: "asc" }, { line: "asc" }],
    });
    return rows.map((r) => serializePr(r as unknown as Record<string, unknown>));
  }

  async groups(q?: string, status?: string) {
    const items = await this.list(q, status);
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = prNumberKey(item.prNo);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([, lines]) => ({
      prNo: lines[0].prNo as string,
      lineCount: lines.length,
      requester: lines[0].requester,
      department: lines[0].department,
      plant: lines[0].plant,
      date: lines[0].date,
      buyer: lines[0].buyer,
      priority: lines.some((l) => l.priority === "Urgent")
        ? "Urgent"
        : lines.some((l) => l.priority === "High")
          ? "High"
          : lines[0].priority,
      statuses: Array.from(new Set(lines.map((l) => String(l.status)))),
      material: lines.length === 1 ? lines[0].material : `${lines.length} materials`,
      quantity: lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
      lines,
    }));
  }

  async get(id: string) {
    const row = await this.prisma.purchaseRequisition.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
      include: { quotations: true, evaluations: true, purchaseOrders: true },
    });
    if (!row) throw new NotFoundException("Purchase requisition not found");
    return serializePr(row as unknown as Record<string, unknown>);
  }

  async create(dto: CreatePrDto) {
    const recordId = dto.recordId || `PR-${Date.now().toString().slice(-6)}`;
    const line = dto.line.padStart(5, "0");
    const existing = await this.prisma.purchaseRequisition.findUnique({
      where: { prNo_line: { prNo: dto.prNo, line } },
    });
    if (existing) throw new BadRequestException(`PR ${dto.prNo} line ${line} already exists`);

    const row = await this.prisma.purchaseRequisition.create({
      data: {
        recordId,
        prNo: dto.prNo,
        line,
        date: parseDate(dto.date),
        purchasingGroup: dto.purchasingGroup,
        createdBy: dto.createdBy,
        requester: dto.requester,
        changed: parseDate(dto.changed),
        reportReceived: parseDate(dto.reportReceived),
        reportDate: parseDate(dto.reportDate),
        reportDelay: dto.reportDelay,
        delayBand: dto.delayBand,
        sourcing: dto.sourcing,
        stockType: dto.stockType,
        department: dto.department,
        plant: dto.plant,
        materialCode: dto.materialCode,
        material: dto.material,
        materialGroup: dto.materialGroup,
        quantity: new Prisma.Decimal(dto.quantity),
        uom: dto.uom,
        brand: dto.brand,
        need: parseDate(dto.need),
        approved: parseDate(dto.approved),
        release: dto.release,
        handler: dto.handler,
        buyer: dto.buyer,
        priority: dto.priority || "Normal",
        notes: dto.notes,
        status: dto.status || "Draft",
        imported: dto.imported || false,
      },
    });
    await this.prisma.auditEvent.create({
      data: { moduleKey: "pr", recordId: row.recordId, actor: "Demo user", action: "Created" },
    });
    return serializePr(row as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdatePrDto) {
    const current = await this.prisma.purchaseRequisition.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
    });
    if (!current) throw new NotFoundException("Purchase requisition not found");

    const row = await this.prisma.purchaseRequisition.update({
      where: { id: current.id },
      data: {
        prNo: dto.prNo ?? current.prNo,
        line: dto.line ? dto.line.padStart(5, "0") : current.line,
        date: dto.date !== undefined ? parseDate(dto.date) : undefined,
        purchasingGroup: dto.purchasingGroup,
        createdBy: dto.createdBy,
        requester: dto.requester,
        changed: dto.changed !== undefined ? parseDate(dto.changed) : undefined,
        reportReceived: dto.reportReceived !== undefined ? parseDate(dto.reportReceived) : undefined,
        reportDate: dto.reportDate !== undefined ? parseDate(dto.reportDate) : undefined,
        reportDelay: dto.reportDelay,
        delayBand: dto.delayBand,
        sourcing: dto.sourcing,
        stockType: dto.stockType,
        department: dto.department,
        plant: dto.plant,
        materialCode: dto.materialCode,
        material: dto.material,
        materialGroup: dto.materialGroup,
        quantity: dto.quantity != null ? new Prisma.Decimal(dto.quantity) : undefined,
        uom: dto.uom,
        brand: dto.brand,
        need: dto.need !== undefined ? parseDate(dto.need) : undefined,
        approved: dto.approved !== undefined ? parseDate(dto.approved) : undefined,
        release: dto.release,
        handler: dto.handler,
        buyer: dto.buyer,
        priority: dto.priority,
        notes: dto.notes,
        status: dto.status,
        imported: dto.imported,
      },
    });
    await this.prisma.auditEvent.create({
      data: { moduleKey: "pr", recordId: row.recordId, actor: "Demo user", action: "Updated" },
    });
    return serializePr(row as unknown as Record<string, unknown>);
  }

  async remove(id: string) {
    const current = await this.prisma.purchaseRequisition.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
    });
    if (!current) throw new NotFoundException("Purchase requisition not found");
    await this.prisma.purchaseRequisition.delete({ where: { id: current.id } });
    return { ok: true, id: current.id };
  }

  async analyzeImport(text: string) {
    const existing = await this.prisma.purchaseRequisition.findMany({
      select: { id: true, prNo: true, line: true, plant: true, imported: true },
    });
    try {
      return analyzePrReport(text, existing);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  async commitImport(text: string) {
    const preview = await this.analyzeImport(text);
    if (preview.errors.length) {
      throw new BadRequestException({ message: "Import has validation errors", preview });
    }
    const created = [];
    for (const r of preview.records) {
      const key = prItemKey(r.prNo, r.line);
      const exists = await this.prisma.purchaseRequisition.findUnique({
        where: { prNo_line: { prNo: String(r.prNo), line: String(r.line) } },
      });
      if (exists) continue;
      const row = await this.create({
        recordId: `PR-IMP-${key.replace("/", "-")}`,
        prNo: String(r.prNo),
        line: String(r.line),
        date: String(r.date || ""),
        purchasingGroup: r.purchasingGroup ? String(r.purchasingGroup) : undefined,
        createdBy: r.createdBy ? String(r.createdBy) : undefined,
        changed: r.changed ? String(r.changed) : undefined,
        reportReceived: r.reportReceived ? String(r.reportReceived) : undefined,
        reportDate: r.reportDate ? String(r.reportDate) : undefined,
        reportDelay: typeof r.reportDelay === "number" ? r.reportDelay : undefined,
        delayBand: r.delayBand ? String(r.delayBand) : undefined,
        sourcing: r.sourcing ? String(r.sourcing) : undefined,
        stockType: r.stockType ? String(r.stockType) : undefined,
        plant: r.plant ? String(r.plant) : undefined,
        materialCode: r.materialCode ? String(r.materialCode) : undefined,
        material: r.material ? String(r.material) : undefined,
        materialGroup: r.materialGroup ? String(r.materialGroup) : undefined,
        quantity: Number(r.quantity),
        uom: r.uom ? String(r.uom) : undefined,
        approved: r.approved ? String(r.approved) : undefined,
        status: String(r.status),
        imported: true,
        requester: "SAP import",
        department: "Imported",
        buyer: "Unassigned",
      });
      created.push(row);
    }
    for (const p of preview.plants) {
      await this.prisma.purchaseRequisition.update({
        where: { id: p.id },
        data: { plant: p.plant },
      });
    }
    return { created: created.length, plantsFilled: preview.plants.length, duplicates: preview.duplicates };
  }
}
