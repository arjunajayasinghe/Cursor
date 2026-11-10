import { Injectable } from "@nestjs/common";
import {
  VesselIdentity,
  VesselProviderSnapshot,
  VesselTrackingProvider,
} from "./vessel-provider";

/** Deterministic mock AIS positions near the Indian Ocean / Colombo approach. */
const FLEET: Array<{
  imo: string;
  mmsi: string;
  name: string;
  baseLat: number;
  baseLon: number;
  destination: string;
}> = [
  {
    imo: "9876543",
    mmsi: "417000111",
    name: "Eastern Horizon",
    baseLat: 6.95,
    baseLon: 79.2,
    destination: "Colombo",
  },
  {
    imo: "9123456",
    mmsi: "417000222",
    name: "Ocean Kestrel",
    baseLat: 5.8,
    baseLon: 80.1,
    destination: "Colombo",
  },
];

@Injectable()
export class MockVesselProvider implements VesselTrackingProvider {
  readonly name = "mock";

  async fetchByIdentity(identity: VesselIdentity): Promise<VesselProviderSnapshot | null> {
    const imo = identity.imo?.replace(/\D/g, "");
    const mmsi = identity.mmsi?.replace(/\D/g, "");
    const hit =
      FLEET.find((v) => (imo && v.imo === imo) || (mmsi && v.mmsi === mmsi)) ||
      (identity.vesselName
        ? FLEET.find((v) => v.name.toLowerCase() === identity.vesselName!.toLowerCase())
        : undefined);
    if (!hit) return null;

    const tick = Math.floor(Date.now() / 60000) % 30;
    const latitude = hit.baseLat + tick * 0.012;
    const longitude = hit.baseLon + tick * 0.008;
    const aisTimestamp = new Date();
    const apiEta = new Date(aisTimestamp.getTime() + (3 + (tick % 4)) * 86400000);

    return {
      provider: this.name,
      imo: hit.imo,
      mmsi: hit.mmsi,
      vesselName: hit.name,
      latitude,
      longitude,
      speedKnots: 12.5 + (tick % 5) * 0.4,
      courseDeg: 85 + (tick % 10),
      destination: hit.destination,
      apiEta,
      aisTimestamp,
      raw: { source: "mock-ais", tick },
    };
  }
}
