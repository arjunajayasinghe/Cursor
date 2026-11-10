import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

@Injectable()
export class WorkbenchService {
  constructor(private readonly prisma: PrismaService) {}

  async listPoHeaders(q = "") {
    const rows = await this.prisma.purchaseOrder.findMany({
      orderBy: [{ poNo: "asc" }, { line: "asc" }],
      include: {
        shipmentAllocations: true,
        shipments: { select: { id: true, status: true, mode: true, recordId: true } },
      },
    });

    const byPo = new Map<
      string,
      {
        poNo: string;
        coverPoNo: string | null;
        supplier: string | null;
        importNo: string | null;
        currency: string | null;
        status: string;
        lineCount: number;
        orderQty: number;
        allocatedQty: number;
        shippedQty: number;
        shortQty: number;
        pendingQty: number;
        modes: string[];
        shipmentCount: number;
        flags: string[];
      }
    >();

    for (const line of rows) {
      if (q && !`${line.poNo} ${line.coverPoNo || ""} ${line.supplier || ""} ${line.material || ""}`
        .toLowerCase()
        .includes(q.toLowerCase())) {
        continue;
      }
      const key = line.poNo;
      let h = byPo.get(key);
      if (!h) {
        h = {
          poNo: line.poNo,
          coverPoNo: line.coverPoNo,
          supplier: line.supplier,
          importNo: line.importNo,
          currency: line.currency,
          status: line.status,
          lineCount: 0,
          orderQty: 0,
          allocatedQty: 0,
          shippedQty: 0,
          shortQty: 0,
          pendingQty: 0,
          modes: [],
          shipmentCount: 0,
          flags: [],
        };
        byPo.set(key, h);
      }
      h.lineCount += 1;
      h.orderQty += num(line.quantity);
      const allocs = line.shipmentAllocations;
      const allocated = allocs.reduce((s, a) => s + num(a.quantity), 0);
      const shipped = allocs.reduce((s, a) => s + num(a.shippedQty ?? (a.status === "shipped" || a.status === "closed" ? a.quantity : 0)), 0);
      const short = allocs.reduce((s, a) => s + num(a.shortQty), 0);
      h.allocatedQty += allocated;
      h.shippedQty += shipped;
      h.shortQty += short;
      h.pendingQty += Math.max(0, num(line.quantity) - allocated);
      for (const a of allocs) {
        if (a.mode && !h.modes.includes(a.mode)) h.modes.push(a.mode);
        if (a.status === "short-shipped" && !h.flags.includes("short-ship")) h.flags.push("short-ship");
      }
      if (allocs.length > 1 && !h.flags.includes("split")) h.flags.push("split");
      if (h.pendingQty > 0 && allocated > 0 && !h.flags.includes("partial")) h.flags.push("partial");
    }

    // shipment counts per PO from allocations
    const shipIds = await this.prisma.shipmentLineAllocation.groupBy({
      by: ["poNo", "shipmentId"],
    });
    const countByPo = new Map<string, Set<string>>();
    for (const s of shipIds) {
      if (!countByPo.has(s.poNo)) countByPo.set(s.poNo, new Set());
      countByPo.get(s.poNo)!.add(s.shipmentId);
    }
    for (const [poNo, h] of byPo) {
      h.shipmentCount = countByPo.get(poNo)?.size || 0;
      if (h.modes.length > 1 && !h.flags.includes("multi-mode")) h.flags.push("multi-mode");
    }

    return Array.from(byPo.values());
  }

  async getPoDetail(poNo: string) {
    const lines = await this.prisma.purchaseOrder.findMany({
      where: { poNo },
      orderBy: { line: "asc" },
      include: {
        shipmentAllocations: {
          include: {
            shipment: {
              include: {
                vesselTrackings: { take: 1, orderBy: { updatedAt: "desc" } },
                customsClearances: { take: 1, orderBy: { updatedAt: "desc" } },
                deliveries: { take: 1, orderBy: { updatedAt: "desc" } },
              },
            },
          },
        },
      },
    });
    if (!lines.length) throw new NotFoundException(`PO ${poNo} not found`);

    const header = {
      poNo,
      coverPoNo: lines[0].coverPoNo,
      supplier: lines[0].supplier,
      supplierCode: lines[0].supplierCode,
      importNo: lines[0].importNo,
      currency: lines[0].currency,
      paymentTerms: lines[0].paymentTerms,
      incoterm: lines[0].incoterm,
      status: lines.map((l) => l.status),
    };

    const lineViews = lines.map((l) => {
      const allocated = l.shipmentAllocations.reduce((s, a) => s + num(a.quantity), 0);
      const shipped = l.shipmentAllocations.reduce(
        (s, a) => s + num(a.shippedQty ?? (["shipped", "closed"].includes(a.status) ? a.quantity : 0)),
        0,
      );
      const short = l.shipmentAllocations.reduce((s, a) => s + num(a.shortQty), 0);
      const pending = Math.max(0, num(l.quantity) - allocated);
      return {
        id: l.id,
        recordId: l.recordId,
        line: l.line,
        materialCode: l.materialCode,
        material: l.material,
        quantity: num(l.quantity),
        uom: l.uom,
        unitPrice: l.unitPrice != null ? num(l.unitPrice) : null,
        status: l.status,
        allocatedQty: allocated,
        shippedQty: shipped,
        shortQty: short,
        pendingQty: pending,
        allocations: l.shipmentAllocations.map((a) => ({
          id: a.id,
          shipmentId: a.shipmentId,
          shipmentRecordId: a.shipment.recordId,
          quantity: num(a.quantity),
          mode: a.mode || a.shipment.mode,
          status: a.status,
          shippedQty: a.shippedQty != null ? num(a.shippedQty) : null,
          shortQty: a.shortQty != null ? num(a.shortQty) : null,
          notes: a.notes,
          shipment: {
            id: a.shipment.id,
            recordId: a.shipment.recordId,
            mode: a.shipment.mode,
            status: a.shipment.status,
            bl: a.shipment.bl,
            vessel: a.shipment.vessel,
            etd: a.shipment.etd,
            eta: a.shipment.eta,
            forwarder: a.shipment.forwarder,
            vesselTracking: a.shipment.vesselTrackings[0] || null,
            customs: a.shipment.customsClearances[0] || null,
            delivery: a.shipment.deliveries[0] || null,
          },
        })),
      };
    });

    const dashboard = {
      lineCount: lineViews.length,
      orderQty: lineViews.reduce((s, l) => s + l.quantity, 0),
      pendingQty: lineViews.reduce((s, l) => s + l.pendingQty, 0),
      allocatedQty: lineViews.reduce((s, l) => s + l.allocatedQty, 0),
      shortQty: lineViews.reduce((s, l) => s + l.shortQty, 0),
      shipmentCount: new Set(lineViews.flatMap((l) => l.allocations.map((a) => a.shipmentId))).size,
      modes: Array.from(
        new Set(lineViews.flatMap((l) => l.allocations.map((a) => a.mode).filter(Boolean) as string[])),
      ),
      attention: [
        ...lineViews
          .filter((l) => l.pendingQty > 0)
          .map((l) => ({
            type: "pending",
            line: l.line,
            title: `Line ${l.line} pending ${l.pendingQty} ${l.uom || ""}`.trim(),
          })),
        ...lineViews
          .filter((l) => l.allocations.some((a) => a.status === "short-shipped"))
          .map((l) => ({ type: "short-ship", line: l.line, title: `Line ${l.line} short-shipped` })),
        ...lineViews
          .filter((l) => new Set(l.allocations.map((a) => a.mode).filter(Boolean)).size > 1)
          .map((l) => ({ type: "multi-mode", line: l.line, title: `Line ${l.line} split across modes` })),
      ],
    };

    return { header, lines: lineViews, dashboard };
  }

  async splitToShipment(
    poNo: string,
    body: {
      line: string;
      quantity: number;
      mode: string;
      notes?: string;
      coverPoNo?: string;
    },
  ) {
    const qty = Number(body.quantity);
    if (!body.line || !qty || qty <= 0) throw new BadRequestException("line and positive quantity required");
    if (!body.mode) throw new BadRequestException("mode required (Air|Sea|Courier|FCL|LCL)");

    const poLine = await this.prisma.purchaseOrder.findUnique({
      where: { poNo_line: { poNo, line: body.line.padStart(5, "0") } },
      include: { shipmentAllocations: true },
    });
    if (!poLine) {
      // try unpadded
      const alt = await this.prisma.purchaseOrder.findFirst({
        where: { poNo, line: body.line },
        include: { shipmentAllocations: true },
      });
      if (!alt) throw new NotFoundException(`PO ${poNo} line ${body.line} not found`);
      return this.splitLine(alt, qty, body.mode, body.notes, body.coverPoNo);
    }
    return this.splitLine(poLine, qty, body.mode, body.notes, body.coverPoNo);
  }

  private async splitLine(
    poLine: {
      id: string;
      recordId: string;
      poNo: string;
      line: string;
      quantity: Prisma.Decimal;
      importNo: string | null;
      coverPoNo: string | null;
      shipmentAllocations: Array<{ quantity: Prisma.Decimal }>;
    },
    qty: number,
    mode: string,
    notes?: string,
    coverPoNo?: string,
  ) {
    const orderQty = num(poLine.quantity);
    const already = poLine.shipmentAllocations.reduce((s, a) => s + num(a.quantity), 0);
    const pending = orderQty - already;
    if (qty > pending + 1e-9) {
      throw new BadRequestException(`Only ${pending} pending on line ${poLine.line}; cannot allocate ${qty}`);
    }

    const n = await this.prisma.shipment.count();
    const recordId = `SHP-SPLIT-${poLine.poNo}-${poLine.line}-${n + 1}`;
    const shipment = await this.prisma.shipment.create({
      data: {
        recordId,
        poId: poLine.recordId,
        purchaseOrderId: poLine.id,
        coverPoNo: coverPoNo || poLine.coverPoNo,
        mode,
        importNo: poLine.importNo,
        status: "Booking pending",
        notes: notes || `Split ${qty} via ${mode}`,
      },
    });

    const allocation = await this.prisma.shipmentLineAllocation.create({
      data: {
        shipmentId: shipment.id,
        purchaseOrderId: poLine.id,
        poNo: poLine.poNo,
        line: poLine.line,
        quantity: new Prisma.Decimal(qty),
        mode,
        status: "allocated",
        notes: notes || null,
      },
    });

    return { shipment, allocation, pendingAfter: pending - qty };
  }

  async markShortShip(
    allocationId: string,
    body: { shippedQty: number; notes?: string },
  ) {
    const row = await this.prisma.shipmentLineAllocation.findUnique({ where: { id: allocationId } });
    if (!row) throw new NotFoundException("Allocation not found");
    const allocated = num(row.quantity);
    const shipped = Number(body.shippedQty);
    if (shipped < 0 || shipped > allocated) {
      throw new BadRequestException(`shippedQty must be between 0 and ${allocated}`);
    }
    const short = allocated - shipped;
    return this.prisma.shipmentLineAllocation.update({
      where: { id: allocationId },
      data: {
        shippedQty: new Prisma.Decimal(shipped),
        shortQty: new Prisma.Decimal(short),
        status: short > 0 ? "short-shipped" : "shipped",
        notes: body.notes ?? row.notes,
      },
    });
  }

  async dashboardSummary() {
    const headers = await this.listPoHeaders("");
    return {
      poCount: headers.length,
      withPending: headers.filter((h) => h.pendingQty > 0).length,
      withSplit: headers.filter((h) => h.flags.includes("split") || h.flags.includes("multi-mode")).length,
      withShortShip: headers.filter((h) => h.flags.includes("short-ship")).length,
      openShipments: headers.reduce((s, h) => s + h.shipmentCount, 0),
      attention: headers
        .filter((h) => h.flags.length || h.pendingQty > 0)
        .slice(0, 12)
        .map((h) => ({
          poNo: h.poNo,
          coverPoNo: h.coverPoNo,
          flags: h.flags,
          pendingQty: h.pendingQty,
          modes: h.modes,
        })),
    };
  }
}
