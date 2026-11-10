import { Injectable, Logger } from "@nestjs/common";
import {
  VesselIdentity,
  VesselProviderSnapshot,
  VesselTrackingProvider,
} from "./vessel-provider";

/**
 * REST stub for a commercial AIS provider.
 * Configure VESSEL_API_URL + VESSEL_API_KEY to enable; otherwise returns null
 * and the poll job falls back to the mock provider.
 */
@Injectable()
export class RestVesselProvider implements VesselTrackingProvider {
  readonly name = "rest";
  private readonly log = new Logger(RestVesselProvider.name);

  async fetchByIdentity(identity: VesselIdentity): Promise<VesselProviderSnapshot | null> {
    const base = process.env.VESSEL_API_URL?.replace(/\/$/, "");
    if (!base) return null;

    const params = new URLSearchParams();
    if (identity.imo) params.set("imo", identity.imo);
    if (identity.mmsi) params.set("mmsi", identity.mmsi);
    if (!params.toString()) return null;

    const url = `${base}/vessels/position?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(process.env.VESSEL_API_KEY ? { Authorization: `Bearer ${process.env.VESSEL_API_KEY}` } : {}),
        },
      });
      if (!res.ok) {
        this.log.warn(`REST vessel provider ${res.status} for ${url}`);
        return null;
      }
      const body = (await res.json()) as Record<string, unknown>;
      const lat = Number(body.latitude ?? body.lat);
      const lon = Number(body.longitude ?? body.lon ?? body.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        provider: this.name,
        imo: (body.imo as string) || identity.imo,
        mmsi: (body.mmsi as string) || identity.mmsi,
        vesselName: (body.name as string) || identity.vesselName,
        latitude: lat,
        longitude: lon,
        speedKnots: body.speed != null ? Number(body.speed) : null,
        courseDeg: body.course != null ? Number(body.course) : null,
        destination: (body.destination as string) || null,
        apiEta: body.eta ? new Date(String(body.eta)) : null,
        aisTimestamp: body.timestamp ? new Date(String(body.timestamp)) : new Date(),
        raw: body,
      };
    } catch (e) {
      this.log.warn(`REST vessel provider error: ${(e as Error).message}`);
      return null;
    }
  }
}
