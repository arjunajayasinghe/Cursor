import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { MockVesselProvider } from "./providers/mock.provider";
import { RestVesselProvider } from "./providers/rest.provider";
import { VesselTrackingProvider } from "./providers/vessel-provider";

@Injectable()
export class VesselTrackingService implements OnModuleInit {
  private readonly log = new Logger(VesselTrackingService.name);
  private providers: VesselTrackingProvider[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly mock: MockVesselProvider,
    private readonly rest: RestVesselProvider,
  ) {}

  onModuleInit() {
    // Prefer REST when configured; always keep mock as fallback
    this.providers = [this.rest, this.mock];
  }

  async listTrackings() {
    return this.prisma.vesselTracking.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        events: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  async getTracking(idOrRecord: string) {
    const row =
      (await this.prisma.vesselTracking.findUnique({
        where: { id: idOrRecord },
        include: { events: { orderBy: { createdAt: "desc" }, take: 20 } },
      })) ||
      (await this.prisma.vesselTracking.findUnique({
        where: { recordId: idOrRecord },
        include: { events: { orderBy: { createdAt: "desc" }, take: 20 } },
      }));
    if (!row) throw new NotFoundException(`Vessel tracking ${idOrRecord} not found`);
    return this.enrich(row);
  }

  async listEvents(vesselTrackingId?: string, limit = 50) {
    return this.prisma.vesselTrackingEvent.findMany({
      where: vesselTrackingId ? { vesselTrackingId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  private enrich<T extends { eta?: Date | null; apiEta?: Date | null; etaRevised?: Date | null; latitude?: number | null; longitude?: number | null }>(
    row: T,
  ) {
    const supplierEta = row.etaRevised || row.eta;
    const apiEta = row.apiEta;
    let etaVarianceDays: number | null = null;
    if (supplierEta && apiEta) {
      etaVarianceDays = Math.round((apiEta.getTime() - supplierEta.getTime()) / 86400000);
    }
    return {
      ...row,
      supplierEta,
      apiEta,
      etaVarianceDays,
      map: row.latitude != null && row.longitude != null
        ? { lat: row.latitude, lng: row.longitude }
        : null,
      note: "Supplier ETAs (eta / etaRevised) are never overwritten by apiEta",
    };
  }

  /** Scheduled poll stub — every 5 minutes (Nest interval; BullMQ optional later). */
  @Interval(5 * 60 * 1000)
  async scheduledPoll() {
    if (process.env.VESSEL_POLL_DISABLED === "1") return;
    try {
      const result = await this.pollAll("scheduler");
      this.log.log(`Vessel poll: ${result.polled} tracked, ${result.updated} updated`);
    } catch (e) {
      this.log.warn(`Vessel poll failed: ${(e as Error).message}`);
    }
  }

  async pollAll(actor = "system") {
    const rows = await this.prisma.vesselTracking.findMany({
      where: {
        OR: [{ imo: { not: null } }, { mmsi: { not: null } }],
        status: { notIn: ["Cancelled"] },
      },
    });
    let updated = 0;
    const details: Array<{ recordId: string; provider: string | null }> = [];
    for (const row of rows) {
      const snap = await this.resolveSnapshot({
        imo: row.imo,
        mmsi: row.mmsi,
        vesselName: row.vessel,
      });
      if (!snap) {
        details.push({ recordId: row.recordId, provider: null });
        continue;
      }
      await this.applySnapshot(row.id, snap);
      updated++;
      details.push({ recordId: row.recordId, provider: snap.provider });
    }
    await this.prisma.auditEvent.create({
      data: {
        moduleKey: "vessel",
        recordId: "poll",
        actor,
        action: "Vessel tracking poll",
        detail: JSON.stringify({ polled: rows.length, updated, details }),
      },
    });
    return { polled: rows.length, updated, details, at: new Date().toISOString() };
  }

  async pollOne(idOrRecord: string, actor = "system") {
    const row = await this.getTracking(idOrRecord);
    const snap = await this.resolveSnapshot({
      imo: row.imo,
      mmsi: row.mmsi,
      vesselName: row.vessel,
    });
    if (!snap) {
      return { updated: false, reason: "No provider match for IMO/MMSI", recordId: row.recordId };
    }
    await this.applySnapshot(row.id, snap);
    await this.prisma.auditEvent.create({
      data: {
        moduleKey: "vessel",
        recordId: row.recordId,
        actor,
        action: "Vessel tracking poll one",
        detail: JSON.stringify({ provider: snap.provider, imo: snap.imo, mmsi: snap.mmsi }),
      },
    });
    return this.getTracking(row.id);
  }

  private async resolveSnapshot(identity: { imo?: string | null; mmsi?: string | null; vesselName?: string | null }) {
    // Match by IMO/MMSI first — never by name alone for identity validation
    if (!identity.imo && !identity.mmsi) return null;
    for (const provider of this.providers) {
      const snap = await provider.fetchByIdentity(identity);
      if (!snap) continue;
      if (identity.imo && snap.imo && identity.imo.replace(/\D/g, "") !== snap.imo.replace(/\D/g, "")) {
        continue;
      }
      if (identity.mmsi && snap.mmsi && identity.mmsi.replace(/\D/g, "") !== snap.mmsi.replace(/\D/g, "")) {
        continue;
      }
      return snap;
    }
    return null;
  }

  private async applySnapshot(
    vesselTrackingId: string,
    snap: {
      provider: string;
      imo?: string | null;
      mmsi?: string | null;
      vesselName?: string | null;
      latitude: number;
      longitude: number;
      speedKnots?: number | null;
      courseDeg?: number | null;
      destination?: string | null;
      apiEta?: Date | null;
      aisTimestamp: Date;
      raw?: Record<string, unknown>;
    },
  ) {
    // Persist immutable event
    await this.prisma.vesselTrackingEvent.create({
      data: {
        vesselTrackingId,
        provider: snap.provider,
        imo: snap.imo,
        mmsi: snap.mmsi,
        vesselName: snap.vesselName,
        latitude: snap.latitude,
        longitude: snap.longitude,
        speedKnots: snap.speedKnots ?? undefined,
        courseDeg: snap.courseDeg ?? undefined,
        destination: snap.destination,
        apiEta: snap.apiEta ?? undefined,
        aisTimestamp: snap.aisTimestamp,
        rawPayload: (snap.raw || {}) as object,
      },
    });

    // Update live tracking — NEVER touch eta / etaRevised (supplier ETAs)
    await this.prisma.vesselTracking.update({
      where: { id: vesselTrackingId },
      data: {
        latitude: snap.latitude,
        longitude: snap.longitude,
        speedKnots: snap.speedKnots ?? undefined,
        courseDeg: snap.courseDeg ?? undefined,
        destination: snap.destination ?? undefined,
        position: `${snap.latitude.toFixed(4)}°N, ${Math.abs(snap.longitude).toFixed(4)}°E`,
        apiEta: snap.apiEta ?? undefined,
        lastAisAt: snap.aisTimestamp,
        trackingProvider: snap.provider,
        lastPollAt: new Date(),
        updated: new Date(),
        mmsi: snap.mmsi || undefined,
        imo: snap.imo || undefined,
        // eta + etaRevised intentionally omitted
      },
    });
  }
}
