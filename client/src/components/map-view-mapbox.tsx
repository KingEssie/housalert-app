import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom,
      interactive,
      attributionControl: false,
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom, duration: 500 });
  }, [lat, lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((m) => {
      const marker = new mapboxgl.Marker()
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    function removeCircleLayers() {
      try {
        circles.forEach((_, i) => {
          const sourceId = `circle-source-${i}`;
          const layerId = `circle-layer-${i}`;
          const outlineId = `circle-outline-${i}`;
          if (map!.getLayer(outlineId)) map!.removeLayer(outlineId);
          if (map!.getLayer(layerId)) map!.removeLayer(layerId);
          if (map!.getSource(sourceId)) map!.removeSource(sourceId);
        });
      } catch {}
    }

    function addCircleLayers() {
      if (cancelled) return;
      removeCircleLayers();
      circles.forEach((c, i) => {
        const sourceId = `circle-source-${i}`;
        const layerId = `circle-layer-${i}`;
        const outlineId = `circle-outline-${i}`;

        map!.addSource(sourceId, {
          type: "geojson",
          data: createCircleGeoJSON(c.lat, c.lng, c.radiusMeters),
        });
        map!.addLayer({
          id: layerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": c.color ?? "#6366f1",
            "fill-opacity": c.fillOpacity ?? 0.1,
          },
        });
        map!.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": c.color ?? "#6366f1",
            "line-width": 2,
          },
        });
      });
    }

    if (map.isStyleLoaded()) {
      addCircleLayers();
    } else {
      map.on("style.load", addCircleLayers);
    }

    return () => {
      cancelled = true;
      map.off("style.load", addCircleLayers);
      try { removeCircleLayers(); } catch {}
    };
  }, [circles]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%" }}
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
