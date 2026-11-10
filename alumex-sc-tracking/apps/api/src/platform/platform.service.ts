import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { machineByKey, STATUS_MACHINES } from "./workflow.constants";
import {
  analyzeGrnAgainstExisting,
  analyzePoAgainstExisting,
  analyzePrAgainstExisting,
  integrationModule,
  parseTabularPayload,
  type AnalyzePlan,
} from "./import-pipeline";

const SAMPLE_BY_INTEGRATION: Record<string, { file: string; formatHint: string }> = {
  sap_pr_tsv: { file: "sap-pr-report.tsv", formatHint: "tsv" },
  sap_pr_api: { file: "sap-pr-report.tsv", formatHint: "tsv" },
  sap_po_xlsx: { file: "sap-po-extract.csv", formatHint: "csv" },
  sap_po_api: { file: "sap-po-extract.csv", formatHint: "csv" },
  sap_grn_movements: { file: "sap-grn-extract.csv", formatHint: "csv" },
  sap_grn_api: { file: "sap-grn-extract.csv", formatHint: "csv" },
};

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
    return this.analyzeImport(key, { text }, "system");
  }

  async analyzeImport(
    key: string,
    input: { text?: string; base64?: string; fileName?: string; formatHint?: string },
    actor: string,
  ) {
    const integration = await this.prisma.integrationRegister.findUnique({ where: { key } });
    if (!integration) throw new NotFoundException(`Integration ${key} not found`);
    const moduleKey = integrationModule(key);
    if (!moduleKey) {
      throw new BadRequestException("This connector does not support tabular reconcile yet");
    }

    const table = parseTabularPayload(input);
    if (table.rows.length < 1) {
      throw new BadRequestException("Need a header row and at least one data row");
    }

    const priority = (integration.fieldPriority as Record<string, string>) || {};
    let plan: AnalyzePlan;
    if (moduleKey === "pr") {
      const existing = await this.prisma.purchaseRequisition.findMany();
      plan = analyzePrAgainstExisting(table, existing, priority);
    } else if (moduleKey === "po") {
      const existing = await this.prisma.purchaseOrder.findMany();
      plan = analyzePoAgainstExisting(table, existing as unknown as Array<Record<string, unknown>>, priority);
    } else {
      const existing = await this.prisma.goodsReceipt.findMany();
      plan = analyzeGrnAgainstExisting(table, existing as unknown as Array<Record<string, unknown>>, priority);
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        integrationKey: key,
        status: "preview",
        fileName: input.fileName || null,
        format: table.format,
        actor,
        rowCount: plan.rowCount,
        createdCount: plan.createCount,
        updatedCount: plan.updateCount,
        skippedCount: plan.skipCount,
        mismatchCount: plan.mismatchCount,
        errorCount: plan.errors.length,
        summary: plan as unknown as Prisma.InputJsonValue,
        payloadExcerpt: (input.text || "").slice(0, 4000) || null,
      },
    });

    await this.prisma.integrationRegister.update({
      where: { key },
      data: {
        lastRunAt: new Date(),
        lastResult: `Preview batch ${batch.id}: +${plan.createCount} / ~${plan.updateCount} / skip ${plan.skipCount} / mismatch ${plan.mismatchCount}`,
        status: integration.status === "stub" ? "configured" : integration.status,
      },
    });

    return {
      key,
      batchId: batch.id,
      headers: plan.headers,
      preview: plan.preview,
      rowCount: plan.rowCount,
      duplicateKeys: plan.plan.filter((p) => p.action === "skip").map((p) => p.key).slice(0, 20),
      fieldPriority: plan.fieldPriority,
      errors: plan.errors.map((e) => e.message),
      createCount: plan.createCount,
      updateCount: plan.updateCount,
      skipCount: plan.skipCount,
      mismatchCount: plan.mismatchCount,
      plan: plan.plan.slice(0, 100),
      note: "Phase 2 — validate/preview with field-priority reconcile. Call reconcile to commit.",
    };
  }

  listImportBatches(integrationKey?: string) {
    return this.prisma.importBatch.findMany({
      where: integrationKey ? { integrationKey } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  getImportBatch(id: string) {
    return this.prisma.importBatch.findUnique({ where: { id } });
  }

  async reconcileImport(batchId: string, actor: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException(`Import batch ${batchId} not found`);
    if (batch.status === "reconciled") {
      throw new BadRequestException("Batch already reconciled (immutable history)");
    }
    const plan = batch.summary as unknown as AnalyzePlan;
    if (!plan?.plan) throw new BadRequestException("Batch has no reconcile plan");

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let mismatches = 0;

    for (const row of plan.plan) {
      mismatches += row.mismatches.filter((m) => m.action === "exception").length;
      if (row.action === "skip") {
        skipped++;
        continue;
      }
      if (plan.moduleKey === "pr") {
        if (row.action === "create") {
          const p = row.payload;
          await this.prisma.purchaseRequisition.create({
            data: {
              recordId: `PR-IMP-${String(p.prNo)}-${String(p.line)}`,
              prNo: String(p.prNo),
              line: String(p.line),
              date: p.date ? new Date(String(p.date)) : null,
              purchasingGroup: p.purchasingGroup ? String(p.purchasingGroup) : null,
              createdBy: p.createdBy ? String(p.createdBy) : null,
              changed: p.changed ? new Date(String(p.changed)) : null,
              reportReceived: p.reportReceived ? new Date(String(p.reportReceived)) : null,
              reportDate: p.reportDate ? new Date(String(p.reportDate)) : null,
              reportDelay: typeof p.reportDelay === "number" ? p.reportDelay : null,
              delayBand: p.delayBand ? String(p.delayBand) : null,
              sourcing: p.sourcing ? String(p.sourcing) : null,
              stockType: p.stockType ? String(p.stockType) : null,
              plant: p.plant ? String(p.plant) : null,
              materialCode: p.materialCode ? String(p.materialCode) : null,
              material: p.material ? String(p.material) : null,
              materialGroup: p.materialGroup ? String(p.materialGroup) : null,
              quantity: Number(p.quantity || 0),
              uom: p.uom ? String(p.uom) : null,
              approved: p.approved ? new Date(String(p.approved)) : null,
              status: String(p.status || "Released"),
              imported: true,
              requester: "SAP import",
              department: "Imported",
              buyer: "Unassigned",
            },
          });
          await this.prisma.auditEvent.create({
            data: {
              moduleKey: "pr",
              recordId: `PR-IMP-${String(p.prNo)}-${String(p.line)}`,
              actor,
              action: "Import create",
              source: "import",
              newValue: JSON.stringify(p),
            },
          });
          created++;
        } else if (row.action === "update" && row.recordId) {
          const data: Record<string, unknown> = { ...row.payload };
          if (data.quantity != null) data.quantity = Number(data.quantity);
          await this.prisma.purchaseRequisition.update({
            where: { recordId: row.recordId },
            data,
          });
          await this.prisma.auditEvent.create({
            data: {
              moduleKey: "pr",
              recordId: row.recordId,
              actor,
              action: "Import reconcile",
              source: "import",
              newValue: JSON.stringify(row.payload),
              detail: row.mismatches.map((m) => `${m.field}:${m.action}`).join(", "),
            },
          });
          updated++;
        }
      } else if (plan.moduleKey === "po") {
        if (row.action === "create") {
          const p = row.payload;
          const recordId = `PO-IMP-${String(p.poNo)}-${String(p.line)}`;
          await this.prisma.purchaseOrder.create({
            data: {
              recordId,
              poNo: String(p.poNo),
              line: String(p.line),
              prId: p.prId ? String(p.prId) : null,
              date: p.date ? new Date(String(p.date)) : null,
              supplierCode: p.supplierCode ? String(p.supplierCode) : null,
              supplier: p.supplier ? String(p.supplier) : "Unknown",
              materialCode: p.materialCode ? String(p.materialCode) : null,
              material: p.material ? String(p.material) : null,
              quantity: Number(p.quantity || 0),
              uom: p.uom ? String(p.uom) : null,
              currency: p.currency ? String(p.currency) : "USD",
              unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
              incoterm: p.incoterm ? String(p.incoterm) : null,
              piNo: p.piNo ? String(p.piNo) : null,
              notes: null,
              status: "Released",
            },
          });
          await this.prisma.auditEvent.create({
            data: {
              moduleKey: "po",
              recordId,
              actor,
              action: "Import create",
              source: "import",
              newValue: JSON.stringify(p),
            },
          });
          created++;
        } else if (row.action === "update" && row.recordId) {
          const data: Record<string, unknown> = { ...row.payload };
          delete data.notes;
          await this.prisma.purchaseOrder.update({ where: { recordId: row.recordId }, data });
          await this.prisma.auditEvent.create({
            data: {
              moduleKey: "po",
              recordId: row.recordId,
              actor,
              action: "Import reconcile",
              source: "import",
              newValue: JSON.stringify(row.payload),
            },
          });
          updated++;
        }
      } else if (plan.moduleKey === "grn") {
        if (row.action === "create") {
          const p = row.payload;
          const recordId = `GRN-IMP-${String(p.grnNo)}-${String(p.year)}-${String(p.item)}`;
          await this.prisma.goodsReceipt.create({
            data: {
              recordId,
              grnNo: String(p.grnNo),
              year: Number(p.year),
              item: String(p.item),
              movement: p.movement ? String(p.movement) : null,
              posted: p.posted ? new Date(String(p.posted)) : null,
              plant: p.plant ? String(p.plant) : null,
              location: p.location ? String(p.location) : null,
              received: p.received != null ? Number(p.received) : null,
              uom: p.uom ? String(p.uom) : null,
              poId: p.poId ? String(p.poId) : null,
              prId: p.prId ? String(p.prId) : null,
              notes: null,
              status: "Posted",
            },
          });
          await this.prisma.auditEvent.create({
            data: {
              moduleKey: "grn",
              recordId,
              actor,
              action: "Import create",
              source: "import",
              newValue: JSON.stringify(p),
            },
          });
          created++;
        } else if (row.action === "update" && row.recordId) {
          const data: Record<string, unknown> = { ...row.payload };
          delete data.notes;
          await this.prisma.goodsReceipt.update({ where: { recordId: row.recordId }, data });
          updated++;
        }
      }

      for (const m of row.mismatches.filter((x) => x.action === "exception")) {
        const recordId = row.recordId || row.key;
        await this.prisma.exceptionRegister.create({
          data: {
            moduleKey: plan.moduleKey,
            recordId,
            triggerKey: "import_mismatch",
            category: "Integration",
            title: `Import mismatch · ${m.field} · ${row.key}`,
            detail: `Existing "${m.existing}" vs incoming "${m.incoming}" (priority ${m.preferred})`,
            severity: "warning",
            status: "open",
            ownerRole: "Procurement",
          },
        });
        await this.prisma.fieldMismatch.create({
          data: {
            moduleKey: plan.moduleKey,
            recordId,
            field: m.field,
            existingValue: m.existing,
            incomingValue: m.incoming,
            preferredSource: m.preferred,
            action: m.action,
            status: "open",
            integrationKey: batch.integrationKey,
            batchId,
            detail: `Existing "${m.existing}" vs incoming "${m.incoming}"`,
          },
        });
      }
    }

    const saved = await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "reconciled",
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        mismatchCount: mismatches,
        reconciledAt: new Date(),
        summary: {
          ...plan,
          reconciled: { created, updated, skipped, mismatches, actor, at: new Date().toISOString() },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.integrationRegister.update({
      where: { key: batch.integrationKey },
      data: {
        lastRunAt: new Date(),
        lastSyncAt: new Date(),
        lastResult: `Reconciled ${batchId}: +${created} / ~${updated} / skip ${skipped} / mismatch ${mismatches}`,
        status: "active",
      },
    });

    return saved;
  }

  // —— Phase 4 field mismatches ——
  listMismatches(opts: { moduleKey?: string; recordId?: string; status?: string; limit?: number }) {
    return this.prisma.fieldMismatch.findMany({
      where: {
        ...(opts.moduleKey ? { moduleKey: opts.moduleKey } : {}),
        ...(opts.recordId ? { recordId: opts.recordId } : {}),
        ...(opts.status ? { status: opts.status } : { status: "open" }),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 200,
    });
  }

  async updateMismatch(
    id: string,
    body: { status?: string; detail?: string },
    actor: string,
  ) {
    const row = await this.prisma.fieldMismatch.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Mismatch not found");
    const status = body.status || row.status;
    return this.prisma.fieldMismatch.update({
      where: { id },
      data: {
        status,
        detail: body.detail ?? row.detail,
        resolvedBy: status === "open" ? null : actor,
        resolvedAt: status === "open" ? null : new Date(),
      },
    });
  }

  // —— Phase 3 sync jobs ——
  listSyncJobs(integrationKey?: string) {
    return this.prisma.integrationSyncJob.findMany({
      where: integrationKey ? { integrationKey } : undefined,
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    });
  }

  async updateSyncJob(
    id: string,
    body: Partial<{ enabled: boolean; schedule: string; status: string; sapClient: string; name: string }>,
  ) {
    const row = await this.prisma.integrationSyncJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Sync job not found");
    const enabled = body.enabled ?? row.enabled;
    return this.prisma.integrationSyncJob.update({
      where: { id },
      data: {
        enabled,
        schedule: body.schedule ?? row.schedule,
        status: body.status ?? (enabled ? (row.status === "paused" ? "idle" : row.status) : "paused"),
        sapClient: body.sapClient ?? row.sapClient,
        name: body.name ?? row.name,
        nextRunAt: enabled ? row.nextRunAt || nextRunFromNow(row.schedule) : null,
      },
    });
  }

  async runSyncJob(id: string, actor: string) {
    const job = await this.prisma.integrationSyncJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException("Sync job not found");
    if (!job.enabled) throw new BadRequestException("Sync job is paused");

    await this.prisma.integrationSyncJob.update({
      where: { id },
      data: { status: "running", lastError: null },
    });

    try {
      const sample = SAMPLE_BY_INTEGRATION[job.integrationKey];
      if (!sample) {
        throw new BadRequestException(`No sample connector payload for ${job.integrationKey}`);
      }
      const root = path.resolve(__dirname, "..", "..", "..", "..", "samples");
      const text = await fs.readFile(path.join(root, sample.file), "utf8");
      const analyzed = await this.analyzeImport(
        job.integrationKey,
        { text, fileName: `sync-${sample.file}`, formatHint: sample.formatHint },
        `sync:${actor}`,
      );
      const batchId = analyzed.batchId as string;
      const reconciled = await this.reconcileImport(batchId, `sync:${actor}`);
      const sapClient = job.sapClient || "100";
      const moduleKey = integrationModule(job.integrationKey);
      if (moduleKey === "pr") {
        await this.prisma.purchaseRequisition.updateMany({
          data: { lastSyncAt: new Date(), sapClient },
        });
      } else if (moduleKey === "po") {
        await this.prisma.purchaseOrder.updateMany({
          data: { lastSyncAt: new Date(), sapClient },
        });
      }

      await this.prisma.integrationRegister.update({
        where: { key: job.integrationKey },
        data: {
          lastSyncAt: new Date(),
          lastRunAt: new Date(),
          sapClient,
          lastResult: `Sync ${job.name}: batch ${batchId} reconciled (+${reconciled.createdCount}/~${reconciled.updatedCount}/mismatch ${reconciled.mismatchCount})`,
          status: "active",
          ...(job.integrationKey.includes("_api") ? { channel: "api" } : {}),
        },
      });

      return this.prisma.integrationSyncJob.update({
        where: { id },
        data: {
          status: "idle",
          lastRunAt: new Date(),
          nextRunAt: nextRunFromNow(job.schedule),
          runCount: { increment: 1 },
          lastResult: `Reconciled ${batchId}: +${reconciled.createdCount} / ~${reconciled.updatedCount} / mismatch ${reconciled.mismatchCount}`,
          lastError: null,
          sapClient,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.integrationSyncJob.update({
        where: { id },
        data: {
          status: "error",
          lastRunAt: new Date(),
          lastError: message,
          lastResult: null,
        },
      });
      throw err;
    }
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

// Demo next-run: +6h when schedule contains "*/6", otherwise +24h.
function nextRunFromNow(schedule: string): Date {
  const hours = schedule.includes("*/6") ? 6 : 24;
  return new Date(Date.now() + hours * 3600_000);
}
