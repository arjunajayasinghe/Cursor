"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Marker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status?: string;
};

/**
 * Leaflet + OSM map — loaded client-side only (no SSR).
 */
export function VesselMap({
  markers,
  height = 320,
  focus,
}: {
  markers: Marker[];
  height?: number;
  focus?: { lat: number; lng: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: LeafletMap; layer: LayerGroup } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      const L = await import("leaflet");

      if (cancelled || !ref.current) return;

      if (!mapRef.current) {
        const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(
          [6.9, 79.8],
          6,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 18,
        }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        mapRef.current = { map, layer };
      }

      const { map, layer } = mapRef.current;
      layer.clearLayers();
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#075bb3;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const latLngs: [number, number][] = [];
      for (const m of markers) {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
        latLngs.push([m.lat, m.lng]);
        L.marker([m.lat, m.lng], { icon })
          .bindPopup(`<strong>${m.label}</strong><br/>${m.status || ""}<br/>${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`)
          .addTo(layer);
      }
      if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lng)) {
        map.setView([focus.lat, focus.lng], 7);
      } else if (latLngs.length) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 8 });
      }
      setTimeout(() => map.invalidateSize(), 80);
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, focus]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-md border border-line"
      style={{ height }}
    />
  );
}
