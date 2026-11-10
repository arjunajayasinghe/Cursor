/** Provider-neutral vessel tracking adapter (functional-spec §8.3). */

export type VesselIdentity = {
  imo?: string | null;
  mmsi?: string | null;
  vesselName?: string | null;
};

export type VesselProviderSnapshot = {
  provider: string;
  imo?: string | null;
  mmsi?: string | null;
  vesselName?: string | null;
  latitude: number;
  longitude: number;
  speedKnots?: number | null;
  courseDeg?: number | null;
  destination?: string | null;
  /** API ETA only — must never replace supplier ETA fields */
  apiEta?: Date | null;
  aisTimestamp: Date;
  raw?: Record<string, unknown>;
};

export interface VesselTrackingProvider {
  readonly name: string;
  fetchByIdentity(identity: VesselIdentity): Promise<VesselProviderSnapshot | null>;
}
