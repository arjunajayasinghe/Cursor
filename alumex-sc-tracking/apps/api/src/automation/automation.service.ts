import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationEngine, DetectedAlert } from "./automation.engine";

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AutomationEngine,
  ) {}

  listSlaRules() {
    return this.prisma.slaRule.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async updateSlaRule(key: string, body: { targetValue?: number; unit?: string; active?: boolean; description?: string }) {
    const existing = await this.prisma.slaRule.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`SLA rule ${key} not found`);
    return this.prisma.slaRule.update({
      where: { key },
      data: {
        targetValue: body.targetValue ?? existing.targetValue,
        unit: body.unit ?? existing.unit,
        active: body.active ?? existing.active,
        description: body.description ?? existing.description,
      },
    });
  }

  listNotificationRules() {
    return this.prisma.notificationRule.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async updateNotificationRule(
    triggerKey: string,
    body: Partial<{
      active: boolean;
      recipientRoles: string;
      channels: string;
      dedupeHours: number;
      escalateAfterHours: number | null;
      action: string;
      severity: string;
      description: string;
    }>,
  ) {
    const existing = await this.prisma.notificationRule.findUnique({ where: { triggerKey } });
    if (!existing) throw new NotFoundException(`Notification rule ${triggerKey} not found`);
    return this.prisma.notificationRule.update({
      where: { triggerKey },
      data: {
        active: body.active ?? existing.active,
        recipientRoles: body.recipientRoles ?? existing.recipientRoles,
        channels: body.channels ?? existing.channels,
        dedupeHours: body.dedupeHours ?? existing.dedupeHours,
        escalateAfterHours:
          body.escalateAfterHours === undefined ? existing.escalateAfterHours : body.escalateAfterHours,
        action: body.action ?? existing.action,
        severity: body.severity ?? existing.severity,
        description: body.description ?? existing.description,
      },
    });
  }

  async listEvents(opts: { status?: string; role?: string; limit?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    const rows = await this.prisma.notificationEvent.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
      take: opts.limit ?? 100,
    });
    if (!opts.role || opts.role === "Administrator" || opts.role === "Management") return rows;
    return rows.filter((r) =>
      r.recipientRoles
        .split(",")
        .map((x) => x.trim())
        .includes(opts.role!),
    );
  }

  listOutbox(limit = 50) {
    return this.prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  }

  listExceptions(status?: string) {
    return this.prisma.exceptionRegister.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async acknowledge(id: string, actor: string) {
    return this.prisma.notificationEvent.update({
      where: { id },
      data: { status: "acknowledged", ackAt: new Date(), ackBy: actor },
    });
  }

  async resolve(id: string) {
    return this.prisma.notificationEvent.update({
      where: { id },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  }

  /**
   * Evaluate triggers, upsert notification_events with dedupe, stub email outbox,
   * and mirror SLA breaches into exception_register.
   */
  async evaluate(actor = "system") {
    const detected = await this.engine.detect();
    const rules = await this.prisma.notificationRule.findMany();
    const ruleByKey = Object.fromEntries(rules.map((r) => [r.triggerKey, r]));
    let created = 0;
    let refreshed = 0;
    let emails = 0;
    let exceptions = 0;

    const openDedupe = new Set<string>();

    for (const alert of detected) {
      const rule = ruleByKey[alert.triggerKey];
      if (!rule?.active) continue;
      const dedupeKey = `${alert.triggerKey}:${alert.moduleKey}:${alert.recordId}`;
      openDedupe.add(dedupeKey);
      const existing = await this.prisma.notificationEvent.findUnique({ where: { dedupeKey } });
      const now = new Date();

      if (existing) {
        const hoursSinceLast = (now.getTime() - existing.lastSeenAt.getTime()) / 36e5;
        const shouldBump = hoursSinceLast >= (rule.dedupeHours || 24) || existing.status === "resolved";
        if (shouldBump || existing.status === "open" || existing.status === "acknowledged") {
          await this.prisma.notificationEvent.update({
            where: { id: existing.id },
            data: {
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
              action: alert.action,
              recipientRoles: alert.recipientRoles,
              href: alert.href,
              ageHours: alert.ageHours,
              lastSeenAt: now,
              status: existing.status === "resolved" ? "open" : existing.status,
              occurrenceCount: shouldBump ? existing.occurrenceCount + 1 : existing.occurrenceCount,
              resolvedAt: existing.status === "resolved" && shouldBump ? null : existing.resolvedAt,
            },
          });
          refreshed++;
          if (shouldBump && rule.channels.includes("email")) {
            await this.enqueueEmail(existing.id, alert);
            emails++;
          }
        }
      } else {
        const row = await this.prisma.notificationEvent.create({
          data: {
            dedupeKey,
            triggerKey: alert.triggerKey,
            moduleKey: alert.moduleKey,
            recordId: alert.recordId,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            action: alert.action,
            recipientRoles: alert.recipientRoles,
            href: alert.href,
            ageHours: alert.ageHours,
            status: "open",
          },
        });
        created++;
        if (rule.channels.includes("email")) {
          await this.enqueueEmail(row.id, alert);
          emails++;
        }
      }

      if (alert.category === "SLA" || alert.severity === "critical") {
        const exKey = { moduleKey: alert.moduleKey, recordId: alert.recordId, triggerKey: alert.triggerKey };
        const prior = await this.prisma.exceptionRegister.findFirst({
          where: { ...exKey, status: { in: ["open", "under_review"] } },
        });
        if (!prior) {
          await this.prisma.exceptionRegister.create({
            data: {
              moduleKey: alert.moduleKey,
              recordId: alert.recordId,
              triggerKey: alert.triggerKey,
              category: alert.category || "SLA",
              title: alert.title,
              detail: alert.message,
              severity: alert.severity,
              status: "open",
              ownerRole: alert.recipientRoles.split(",")[0]?.trim(),
            },
          });
          exceptions++;
        }
      }
    }

    // Auto-resolve open events no longer detected
    const openEvents = await this.prisma.notificationEvent.findMany({
      where: { status: { in: ["open", "acknowledged"] } },
    });
    let autoResolved = 0;
    for (const ev of openEvents) {
      if (!openDedupe.has(ev.dedupeKey)) {
        await this.prisma.notificationEvent.update({
          where: { id: ev.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        autoResolved++;
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        moduleKey: "automation",
        recordId: "evaluate",
        actor,
        action: "Evaluated notification engine",
        detail: JSON.stringify({ created, refreshed, emails, exceptions, autoResolved, detected: detected.length }),
      },
    });

    return {
      detected: detected.length,
      created,
      refreshed,
      emailsQueued: emails,
      exceptionsOpened: exceptions,
      autoResolved,
      actor,
      at: new Date().toISOString(),
    };
  }

  private enqueueEmail(notificationId: string, alert: DetectedAlert) {
    return this.prisma.emailOutbox.create({
      data: {
        notificationId,
        toRoles: alert.recipientRoles,
        subject: `[Alumex SCC] ${alert.action}: ${alert.title}`,
        body: `${alert.message}\n\nModule: ${alert.moduleKey}\nRecord: ${alert.recordId}\nSeverity: ${alert.severity}\n\n(Email stub — outbox only)`,
        status: "stubbed",
        attempts: 1,
        sentAt: new Date(),
      },
    });
  }

  async dashboardSlice(role?: string) {
    const events = await this.listEvents({ status: "open", role, limit: 12 });
    const exceptions = await this.prisma.exceptionRegister.count({ where: { status: "open" } });
    const byTrigger = await this.prisma.notificationEvent.groupBy({
      by: ["triggerKey"],
      where: { status: "open" },
      _count: { _all: true },
    });
    return {
      openAlerts: events.length,
      openExceptions: exceptions,
      attention: events.map((e) => ({
        module: e.moduleKey,
        id: e.recordId,
        title: e.title,
        subtitle: `${e.action} · ${e.message}`,
        tone: e.severity === "critical" ? "amber" : e.severity === "info" ? "blue" : "amber",
        triggerKey: e.triggerKey,
        href: e.href,
        eventId: e.id,
      })),
      byTrigger: byTrigger.map((g) => ({ triggerKey: g.triggerKey, count: g._count._all })),
    };
  }

  async kpisFromRules() {
    const [
      openPr,
      pendingQuotes,
      pendingEval,
      pendingConfirm,
      inTransit,
      etaChanges,
      delayed,
      clearanceOpen,
      pendingGrn,
      openPay,
    ] = await Promise.all([
      this.prisma.purchaseRequisition.count({ where: { status: { notIn: ["Cancelled", "Closed"] } } }),
      this.prisma.quotation.count({ where: { status: { in: ["Requested", "Awaiting quote", "Partial"] } } }),
      this.prisma.evaluation.count({ where: { status: { in: ["Draft", "In review", "Pending decision", "Pending"] } } }),
      this.prisma.supplierConfirmation.count({ where: { status: { in: ["Awaiting response", "Sent", "Pending"] } } }),
      this.prisma.vesselTracking.count({ where: { status: { in: ["In transit", "Delayed"] } } }),
      this.prisma.vesselTracking.count({ where: { etaRevised: { not: null } } }),
      this.prisma.vesselTracking.count({ where: { status: "Delayed" } }),
      this.prisma.customsClearance.count({ where: { status: { notIn: ["Released", "Closed", "Cancelled"] } } }),
      this.prisma.goodsReceipt.count({ where: { status: { in: ["Awaiting posting", "Partial", "Pending closure"] } } }),
      this.prisma.payment.count({ where: { status: { in: ["Scheduled", "Submitted to bank", "Part paid", "Due"] } } }),
    ]);

    return [
      { label: "Open PRs", value: openPr, detail: "PRs not completed", tone: "blue", icon: "grid" },
      { label: "Pending quotations", value: pendingQuotes, detail: "Within configurable 48h target", tone: "amber", icon: "alert" },
      { label: "Evaluation ageing", value: pendingEval, detail: "Open evaluations", tone: "amber", icon: "alert" },
      { label: "Payments due", value: openPay, detail: "Finance actions", tone: "amber", icon: "alert" },
      { label: "Awaiting confirmation", value: pendingConfirm, detail: "Supplier ack pending", tone: "blue", icon: "grid" },
      { label: "In transit", value: inTransit, detail: "Active vessel tracks", tone: "blue", icon: "ship" },
      { label: "ETA changes", value: etaChanges, detail: "Revised arrival dates", tone: "amber", icon: "alert" },
      { label: "Delayed shipments", value: delayed, detail: "Beyond committed arrival", tone: "amber", icon: "alert" },
      { label: "Clearance ageing", value: clearanceOpen, detail: "FCL/LCL targets apply", tone: "amber", icon: "alert" },
      { label: "Pending GRNs", value: pendingGrn, detail: "Warehouse posting", tone: "green", icon: "check" },
    ];
  }
}
