import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { machineByKey, STATUS_MACHINES } from "./workflow.constants";

const PRISMA_BY_MODULE: Record<string, string> = {
  pr: "purchaseRequisition",
  quotes: "quotation",
  eval: "evaluation",
  po: "purchaseOrder",
  pay: "payment",
  confirm: "supplierConfirmation",
  ship: "shipment",
  vessel: "vesselTracking",
  customs: "customsClearance",
  delivery: "deliveryLandedCost",
  grn: "goodsReceipt",
};

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  // —— Audit ——
  listAudit(moduleKey?: string, recordId?: string, limit = 100) {
    return this.prisma.auditEvent.findMany({
      where: {
        ...(moduleKey ? { moduleKey } : {}),
        ...(recordId ? { recordId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async writeAudit(input: {
    moduleKey: string;
    recordId: string;
    actor: string;
    action: string;
    detail?: string;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
    source?: string;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        moduleKey: input.moduleKey,
        recordId: input.recordId,
        actor: input.actor,
        action: input.action,
        detail: input.detail,
        oldValue: input.oldValue != null ? JSON.stringify(input.oldValue) : null,
        newValue: input.newValue != null ? JSON.stringify(input.newValue) : null,
        reason: input.reason,
        source: input.source || "manual",
      },
    });
  }

  // —— Workflow ——
  listMachines() {
    return STATUS_MACHINES;
  }

  getMachine(moduleKey: string) {
    const m = machineByKey[moduleKey];
    if (!m) throw new NotFoundException(`No status machine for ${moduleKey}`);
    return m;
  }

  async allowedTransitions(moduleKey: string, recordId: string) {
    const machine = this.getMachine(moduleKey);
    const row = await this.findRecord(moduleKey, recordId);
    const current = String(row.status || machine.initial);
    return {
      moduleKey,
      recordId: row.recordId,
      current,
      next: machine.transitions[current] || [],
      statuses: machine.statuses,
    };
  }

  async transition(
    moduleKey: string,
    recordId: string,
    toStatus: string,
    actor: string,
    note?: string,
  ) {
    const machine = this.getMachine(moduleKey);
    const row = await this.findRecord(moduleKey, recordId);
    const from = String(row.status || machine.initial);
    const allowed = machine.transitions[from] || [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`Cannot transition ${moduleKey} from "${from}" to "${toStatus}"`);
    }
    const model = this.model(moduleKey);
    const updated = await model.update({
      where: { id: row.id },
      data: { status: toStatus },
    });
    await this.prisma.workflowAction.create({
      data: {
        moduleKey,
        recordId: row.recordId,
        fromStatus: from,
        toStatus,
        actor,
        note,
      },
    });
    await this.writeAudit({
      moduleKey,
      recordId: row.recordId,
      actor,
      action: "Status transition",
      oldValue: { status: from },
      newValue: { status: toStatus },
      reason: note,
      source: "manual",
    });
    return { ...updated, fromStatus: from, toStatus };
  }

  listWorkflowHistory(moduleKey: string, recordId: string) {
    return this.prisma.workflowAction.findMany({
      where: { moduleKey, recordId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // —— Master data ——
  listMasters(category?: string) {
    return this.prisma.masterDataEntry.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });
  }

  async upsertMaster(input: {
    category: string;
    code: string;
    name: string;
    extra?: string;
    active?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.masterDataEntry.upsert({
      where: { category_code: { category: input.category, code: input.code } },
      create: {
        category: input.category,
        code: input.code,
        name: input.name,
        extra: input.extra,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 100,
      },
      update: {
        name: input.name,
        extra: input.extra,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 100,
      },
    });
  }

  async deleteMaster(id: string) {
    await this.prisma.masterDataEntry.delete({ where: { id } });
    return { ok: true };
  }

  // —— Exceptions ——
  listExceptions(status?: string) {
    return this.prisma.exceptionRegister.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async updateException(
    id: string,
    body: { status?: string; authorizedBy?: string; detail?: string },
    actor: string,
  ) {
    const row = await this.prisma.exceptionRegister.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Exception not found");
    const updated = await this.prisma.exceptionRegister.update({
      where: { id },
      data: {
        status: body.status ?? row.status,
        detail: body.detail ?? row.detail,
        authorizedBy: body.authorizedBy ?? (body.status === "authorized" ? actor : row.authorizedBy),
        authorizedAt: body.status === "authorized" ? new Date() : row.authorizedAt,
      },
    });
    await this.writeAudit({
      moduleKey: "exceptions",
      recordId: row.recordId,
      actor,
      action: `Exception ${body.status || "updated"}`,
      oldValue: { status: row.status },
      newValue: { status: updated.status },
      source: "manual",
    });
    return updated;
  }

  // —— Integrations ——
  listIntegrations() {
    return this.prisma.integrationRegister.findMany({ orderBy: { name: "asc" } });
  }

  async updateIntegration(
    key: string,
    body: Partial<{
      status: string;
      channel: string;
      description: string;
      fieldPriority: Record<string, string>;
      notes: string;
    }>,
  ) {
    const row = await this.prisma.integrationRegister.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Integration ${key} not found`);
    return this.prisma.integrationRegister.update({
      where: { key },
      data: {
        status: body.status ?? row.status,
        channel: body.channel ?? row.channel,
        description: body.description ?? row.description,
        fieldPriority: body.fieldPriority ?? row.fieldPriority ?? undefined,
        notes: body.notes ?? row.notes,
      },
    });
  }

  async previewSapImport(key: string, text: string) {
    const integration = await this.prisma.integrationRegister.findUnique({ where: { key } });
    if (!integration) throw new NotFoundException(`Integration ${key} not found`);
    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((l) => l.trim());
    if (lines.length < 2) {
      return {
        key,
        headers: [],
        preview: [],
        errors: ["Need a header row and at least one data row"],
        fieldPriority: integration.fieldPriority,
      };
    }
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delim).map((h) => h.trim());
    const preview = lines.slice(1, 21).map((line) => {
      const cols = line.split(delim);
      return Object.fromEntries(headers.map((h, i) => [h, cols[i]?.trim() ?? ""]));
    });
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    for (const row of preview) {
      const id = `${row["PR"] || row["PR Number"] || row["prNo"] || ""}|${row["Item"] || row["Line"] || row["line"] || ""}`;
      if (id !== "|" && seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    await this.prisma.integrationRegister.update({
      where: { key },
      data: {
        lastRunAt: new Date(),
        lastResult: `Preview ${preview.length} rows · ${duplicates.size} duplicate keys in sample`,
      },
    });
    return {
      key,
      headers,
      preview,
      rowCount: lines.length - 1,
      duplicateKeys: Array.from(duplicates),
      fieldPriority: integration.fieldPriority,
      note: "Phase-1 stub — validate/preview only. Commit uses module-specific importers (e.g. PR TSV).",
    };
  }

  // —— Monitoring report ——
  async monitoring(filters: {
    prNo?: string;
    poNo?: string;
    importNo?: string;
    supplier?: string;
    plant?: string;
    material?: string;
    department?: string;
    stage?: string;
    status?: string;
    overdue?: string;
    vessel?: string;
  }) {
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

    const rows = prs.map((pr) => {
      const linkedPos = pos.filter((p) => p.prId === pr.recordId || p.purchaseRequisitionId === pr.id);
      const po = linkedPos[0];
      const q = quotes.filter((x) => x.prId === pr.recordId);
      const ev = evals.find((x) => x.prId === pr.recordId);
      const pay = po ? pays.find((x) => x.poId === po.recordId) : undefined;
      const conf = po ? confirms.find((x) => x.poId === po.recordId) : undefined;
      const ship = po ? ships.find((x) => x.poId === po.recordId) : undefined;
      const vessel = ship
        ? vessels.find((v) => v.shipmentId === ship.id)
        : vessels.find((v) => v.recordId.includes(pr.recordId.slice(-3)));
      const clear = ship ? customs.find((c) => c.shipmentId === ship.id) : undefined;
      const del = ship ? deliveries.find((d) => d.shipmentId === ship.id) : undefined;
      const grn = grns.find((g) => g.prId === pr.recordId || (po && g.poId === po.recordId));

      const stage = grn
        ? "GRN"
        : del
          ? "Delivery"
          : clear
            ? "Customs"
            : vessel
              ? "Vessel"
              : ship
                ? "Shipping"
                : conf
                  ? "Confirmation"
                  : pay
                    ? "Payment"
                    : po
                      ? "PO"
                      : ev
                        ? "Evaluation"
                        : q.length
                          ? "Quotation"
                          : "PR";

      const etaSlip =
        vessel?.eta && vessel?.etaRevised
          ? Math.max(0, Math.round((vessel.etaRevised.getTime() - vessel.eta.getTime()) / 86400000))
          : vessel?.eta && vessel?.apiEta
            ? Math.round((vessel.apiEta.getTime() - vessel.eta.getTime()) / 86400000)
            : null;

      const openQuotes = q.filter((x) => ["Requested", "Awaiting quote", "Partial"].includes(x.status));
      const quotesOverdue = openQuotes.length > 0 && !quotesWithinSla(openQuotes, 48);
      const paymentOverdue = Boolean(
        pay &&
          ["Scheduled", "Overdue", "Submitted to bank", "Part paid"].includes(pay.status) &&
          pay.due &&
          pay.due < new Date(),
      );
      const overdue =
        quotesOverdue ||
        paymentOverdue ||
        vessel?.status === "Delayed" ||
        Boolean(clear && !clear.released && clear.status !== "Closed");

      return {
        prNo: pr.prNo,
        prLine: pr.line,
        prRecordId: pr.recordId,
        prDate: pr.date,
        requester: pr.requester,
        department: pr.department,
        plant: pr.plant,
        material: pr.material,
        materialCode: pr.materialCode,
        quantity: Number(pr.quantity),
        uom: pr.uom,
        prStatus: pr.status,
        buyer: pr.buyer,
        quoteCount: q.length,
        quoteStatus: q.map((x) => x.status).join(", ") || null,
        evaluationStatus: ev?.status || null,
        poNo: po?.poNo || null,
        poLine: po?.line || null,
        supplier: po?.supplier || q[0]?.supplier || null,
        poStatus: po?.status || null,
        piNo: po?.piNo || null,
        paymentStatus: pay?.status || null,
        paymentDue: pay?.due || null,
        confirmationStatus: conf?.status || null,
        importNo: ship?.importNo || null,
        vessel: vessel?.vessel || ship?.vessel || null,
        etd: ship?.etd || null,
        eta: ship?.eta || vessel?.eta || null,
        etaRevised: ship?.etaRevised || vessel?.etaRevised || null,
        apiEta: vessel?.apiEta || null,
        etaSlipDays: etaSlip,
        shippingStatus: ship?.status || null,
        vesselStatus: vessel?.status || null,
        customsStatus: clear?.status || null,
        deliveryStatus: del?.status || null,
        grnNo: grn?.grnNo || null,
        grnStatus: grn?.status || null,
        stage,
        owner: stageOwner(stage),
        overdue: Boolean(overdue),
        currentStatus:
          grn?.status ||
          del?.status ||
          clear?.status ||
          vessel?.status ||
          ship?.status ||
          conf?.status ||
          pay?.status ||
          po?.status ||
          ev?.status ||
          pr.status,
      };
    });

    let filtered = rows;
    const f = filters;
    if (f.prNo) filtered = filtered.filter((r) => String(r.prNo).includes(f.prNo!));
    if (f.poNo) filtered = filtered.filter((r) => String(r.poNo || "").includes(f.poNo!));
    if (f.importNo) filtered = filtered.filter((r) => String(r.importNo || "").includes(f.importNo!));
    if (f.supplier)
      filtered = filtered.filter((r) =>
        String(r.supplier || "")
          .toLowerCase()
          .includes(f.supplier!.toLowerCase()),
      );
    if (f.plant)
      filtered = filtered.filter((r) =>
        String(r.plant || "")
          .toLowerCase()
          .includes(f.plant!.toLowerCase()),
      );
    if (f.material)
      filtered = filtered.filter((r) =>
        String(r.material || "")
          .toLowerCase()
          .includes(f.material!.toLowerCase()),
      );
    if (f.department)
      filtered = filtered.filter((r) =>
        String(r.department || "")
          .toLowerCase()
          .includes(f.department!.toLowerCase()),
      );
    if (f.stage) filtered = filtered.filter((r) => r.stage === f.stage);
    if (f.status)
      filtered = filtered.filter((r) =>
        String(r.currentStatus || "")
          .toLowerCase()
          .includes(f.status!.toLowerCase()),
      );
    if (f.overdue === "1" || f.overdue === "true") filtered = filtered.filter((r) => r.overdue);
    if (f.vessel)
      filtered = filtered.filter((r) =>
        String(r.vessel || "")
          .toLowerCase()
          .includes(f.vessel!.toLowerCase()),
      );

    const headers = [
      "prNo",
      "prLine",
      "department",
      "plant",
      "material",
      "quantity",
      "uom",
      "prStatus",
      "quoteCount",
      "evaluationStatus",
      "poNo",
      "supplier",
      "poStatus",
      "paymentStatus",
      "confirmationStatus",
      "importNo",
      "vessel",
      "etd",
      "eta",
      "etaRevised",
      "etaSlipDays",
      "shippingStatus",
      "customsStatus",
      "deliveryStatus",
      "grnNo",
      "grnStatus",
      "stage",
      "owner",
      "currentStatus",
      "overdue",
    ];

    return {
      type: "monitoring",
      headers,
      rows: filtered,
      counts: {
        total: filtered.length,
        overdue: filtered.filter((r) => r.overdue).length,
        byStage: Object.entries(
          filtered.reduce(
            (acc, r) => {
              acc[r.stage] = (acc[r.stage] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        ).map(([stage, count]) => ({ stage, count })),
      },
    };
  }

  // —— Validation / duplicates ——
  async checkDuplicate(moduleKey: string, fields: Record<string, string>) {
    if (moduleKey === "pr" && fields.prNo && fields.line) {
      const hit = await this.prisma.purchaseRequisition.findFirst({
        where: { prNo: fields.prNo, line: fields.line },
      });
      return { duplicate: Boolean(hit), existingId: hit?.recordId || null };
    }
    if (moduleKey === "po" && fields.poNo && fields.line) {
      const hit = await this.prisma.purchaseOrder.findFirst({
        where: { poNo: fields.poNo, line: fields.line },
      });
      return { duplicate: Boolean(hit), existingId: hit?.recordId || null };
    }
    if (moduleKey === "grn" && fields.grnNo && fields.year) {
      const hit = await this.prisma.goodsReceipt.findFirst({
        where: { grnNo: fields.grnNo, year: Number(fields.year) },
      });
      return { duplicate: Boolean(hit), existingId: hit?.recordId || null };
    }
    return { duplicate: false, existingId: null };
  }

  private model(moduleKey: string): any {
    const name = PRISMA_BY_MODULE[moduleKey];
    if (!name) throw new BadRequestException(`Unknown module ${moduleKey}`);
    return (this.prisma as any)[name];
  }

  private async findRecord(moduleKey: string, idOrRecord: string) {
    const model = this.model(moduleKey);
    const row = await model.findFirst({
      where: { OR: [{ id: idOrRecord }, { recordId: idOrRecord }] },
    });
    if (!row) throw new NotFoundException(`${moduleKey} record ${idOrRecord} not found`);
    return row;
  }
}

function quotesWithinSla(
  quotes: Array<{ called: Date | null; received: Date | null; createdAt: Date }>,
  hours: number,
) {
  return quotes.every((q) => {
    if (q.received) return true;
    const start = q.called || q.createdAt;
    return (Date.now() - start.getTime()) / 36e5 < hours;
  });
}

function stageOwner(stage: string) {
  const map: Record<string, string> = {
    PR: "Requesting Dept.",
    Quotation: "Procurement",
    Evaluation: "Procurement",
    PO: "Procurement",
    Payment: "Finance",
    Confirmation: "Procurement",
    Shipping: "Import Team",
    Vessel: "Import Team",
    Customs: "Import Team",
    Delivery: "Import Team",
    GRN: "Stores",
  };
  return map[stage] || "—";
}
