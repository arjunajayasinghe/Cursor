import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePoDto, UpdatePoDto } from "./po.dto";

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

function ageingDays(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.round((Date.now() - date.getTime()) / 86400000);
}

function serializePo(row: Record<string, unknown>): Record<string, unknown> {
  const date = row.date as Date | null | undefined;
  const unitPrice = row.unitPrice != null ? Number(row.unitPrice) : null;
  const quantity = row.quantity != null ? Number(row.quantity) : null;
  const production = row.production != null ? Number(row.production) : null;
  const transit = row.transit != null ? Number(row.transit) : null;
  const expected =
    date && production != null && transit != null
      ? new Date(date.getTime() + (production + transit) * 86400000).toISOString().slice(0, 10)
      : null;
  return {
    ...row,
    quantity,
    unitPrice,
    total: unitPrice != null && quantity != null ? Number((unitPrice * quantity).toFixed(2)) : null,
    piAmount: row.piAmount != null ? Number(row.piAmount) : null,
    expected,
    age: ageingDays(date),
    date: date ? date.toISOString().slice(0, 10) : null,
    approved: row.approved ? (row.approved as Date).toISOString().slice(0, 10) : null,
    sapNeed: row.sapNeed ? (row.sapNeed as Date).toISOString().slice(0, 10) : null,
    sent: row.sent ? (row.sent as Date).toISOString().slice(0, 10) : null,
    piDate: row.piDate ? (row.piDate as Date).toISOString().slice(0, 10) : null,
    supplierEta: row.supplierEta ? (row.supplierEta as Date).toISOString().slice(0, 10) : null,
  };
}

@Injectable()
export class PoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, status?: string) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { poNo: { contains: q } },
        { supplier: { contains: q, mode: "insensitive" } },
        { material: { contains: q, mode: "insensitive" } },
        { importNo: { contains: q, mode: "insensitive" } },
        { piNo: { contains: q, mode: "insensitive" } },
        { prId: { contains: q, mode: "insensitive" } },
        { recordId: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ poNo: "asc" }, { line: "asc" }],
    });
    return rows.map((r) => serializePo(r as unknown as Record<string, unknown>));
  }

  async get(id: string) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
      include: { payments: true, confirmations: true, shipments: true, purchaseRequisition: true },
    });
    if (!row) throw new NotFoundException("Purchase order not found");
    return serializePo(row as unknown as Record<string, unknown>);
  }

  async create(dto: CreatePoDto) {
    const recordId = dto.recordId || `PO-${Date.now().toString().slice(-6)}`;
    const line = dto.line.padStart(5, "0");
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { poNo_line: { poNo: dto.poNo, line } },
    });
    if (existing) throw new BadRequestException(`PO ${dto.poNo} line ${line} already exists`);

    let purchaseRequisitionId = dto.purchaseRequisitionId;
    if (!purchaseRequisitionId && dto.prId) {
      const pr = await this.prisma.purchaseRequisition.findFirst({ where: { recordId: dto.prId } });
      purchaseRequisitionId = pr?.id;
    }

    const row = await this.prisma.purchaseOrder.create({
      data: {
        recordId,
        prId: dto.prId,
        purchaseRequisitionId,
        poNo: dto.poNo,
        line,
        date: parseDate(dto.date),
        supplierCode: dto.supplierCode,
        supplier: dto.supplier,
        materialCode: dto.materialCode,
        material: dto.material,
        quantity: new Prisma.Decimal(dto.quantity),
        uom: dto.uom,
        currency: dto.currency,
        unitPrice: dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null,
        paymentTerms: dto.paymentTerms,
        incoterm: dto.incoterm,
        approval: dto.approval,
        approved: parseDate(dto.approved),
        sapNeed: parseDate(dto.sapNeed),
        sent: parseDate(dto.sent),
        importNo: dto.importNo,
        piNo: dto.piNo,
        piDate: parseDate(dto.piDate),
        piAmount: dto.piAmount != null ? new Prisma.Decimal(dto.piAmount) : null,
        production: dto.production,
        transit: dto.transit,
        supplierEta: parseDate(dto.supplierEta),
        notes: dto.notes,
        status: dto.status || "Draft",
      },
    });
    await this.prisma.auditEvent.create({
      data: { moduleKey: "po", recordId: row.recordId, actor: "Demo user", action: "Created" },
    });
    return serializePo(row as unknown as Record<string, unknown>);
  }

  async update(id: string, dto: UpdatePoDto) {
    const current = await this.prisma.purchaseOrder.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
    });
    if (!current) throw new NotFoundException("Purchase order not found");

    const row = await this.prisma.purchaseOrder.update({
      where: { id: current.id },
      data: {
        prId: dto.prId,
        poNo: dto.poNo ?? current.poNo,
        line: dto.line ? dto.line.padStart(5, "0") : current.line,
        date: dto.date !== undefined ? parseDate(dto.date) : undefined,
        supplierCode: dto.supplierCode,
        supplier: dto.supplier,
        materialCode: dto.materialCode,
        material: dto.material,
        quantity: dto.quantity != null ? new Prisma.Decimal(dto.quantity) : undefined,
        uom: dto.uom,
        currency: dto.currency,
        unitPrice: dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : undefined,
        paymentTerms: dto.paymentTerms,
        incoterm: dto.incoterm,
        approval: dto.approval,
        approved: dto.approved !== undefined ? parseDate(dto.approved) : undefined,
        sapNeed: dto.sapNeed !== undefined ? parseDate(dto.sapNeed) : undefined,
        sent: dto.sent !== undefined ? parseDate(dto.sent) : undefined,
        importNo: dto.importNo,
        piNo: dto.piNo,
        piDate: dto.piDate !== undefined ? parseDate(dto.piDate) : undefined,
        piAmount: dto.piAmount != null ? new Prisma.Decimal(dto.piAmount) : undefined,
        production: dto.production,
        transit: dto.transit,
        supplierEta: dto.supplierEta !== undefined ? parseDate(dto.supplierEta) : undefined,
        notes: dto.notes,
        status: dto.status,
      },
    });
    await this.prisma.auditEvent.create({
      data: { moduleKey: "po", recordId: row.recordId, actor: "Demo user", action: "Updated" },
    });
    return serializePo(row as unknown as Record<string, unknown>);
  }

  async remove(id: string) {
    const current = await this.prisma.purchaseOrder.findFirst({
      where: { OR: [{ id }, { recordId: id }] },
    });
    if (!current) throw new NotFoundException("Purchase order not found");
    await this.prisma.purchaseOrder.delete({ where: { id: current.id } });
    return { ok: true, id: current.id };
  }
}
