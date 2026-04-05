import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "@/lib/feature-flags";
import type { MapViewProps } from "@/lib/location-types";

export default function MapViewMapbox({
  lat,
  lng,
  zoom,
  markers = [],
  circles = [],
  height = "200px",
  className = "",
  interactive = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((m) => {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#FF5A5F";
      el.style.border = "2px solid #fff";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [markers]);

  const syncCircles = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    for (let i = 0; i < 20; i++) {
      const outlineId = `circle-outline-${i}`;
      const layerId = `circle-layer-${i}`;
      const sourceId = `circle-source-${i}`;
      try {
        if (map.getLayer(outlineId)) map.removeLayer(outlineId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {}
    }

    circles.forEach((c, i) => {
      const sourceId = `circle-source-${i}`;
      const layerId = `circle-layer-${i}`;
      const outlineId = `circle-outline-${i}`;

      map.addSource(sourceId, {
        type: "geojson",
        data: createCircleGeoJSON(c.lat, c.lng, c.radiusMeters),
      });
      map.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": c.color ?? "#FF5A5F",
          "fill-opacity": c.fillOpacity ?? 0.15,
        },
      });
      map.addLayer({
        id: outlineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": c.color ?? "#FF5A5F",
          "line-width": 2,
        },
      });
    });
  }, [circles]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: el,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [lng, lat],
      zoom,
      interactive,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;
    readyRef.current = false;

    map.on("error", (e) => {
      console.error("[MapViewMapbox] map error:", e.error?.message || e);
    });

    map.on("load", () => {
      readyRef.current = true;
      map.resize();
      syncMarkers();
      syncCircles();
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (circles.length > 0) {
      const c = circles[0];
      const km = c.radiusMeters / 1000;
      const pad = 1.3;
      const dlat = (km * pad) / 110.574;
      const dlng = (km * pad) / (111.32 * Math.cos((c.lat * Math.PI) / 180));
      map.fitBounds(
        [[c.lng - dlng, c.lat - dlat], [c.lng + dlng, c.lat + dlat]],
        { padding: 24, duration: 400 }
      );
    } else {
      map.easeTo({ center: [lng, lat], zoom, duration: 400 });
    }
  }, [lat, lng, zoom, circles]);

  useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (readyRef.current) {
      syncCircles();
    } else {
      const onLoad = () => syncCircles();
      map.on("load", onLoad);
      return () => { map.off("load", onLoad); };
    }
  }, [syncCircles]);

  return (
    <div
      ref={containerRef}
      data-testid="mapbox-container"
      className={className}
      style={{ height, width: "100%", minHeight: "120px" }}
    />
  );
}

function createCircleGeoJSON(
  lat: number,
  lng: number,
  radiusMeters: number,
  points = 64
): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    const dlat = dy / 110.574;
    const dlng = dx / (111.32 * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + dlng, lat + dlat]);
  }
  coords.push(coords[0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}
