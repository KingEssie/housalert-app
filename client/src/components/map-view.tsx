import { useEffect, useRef, lazy, Suspense } from "react";
import { USE_MAPBOX_MAPS, MAPBOX_TOKEN } from "@/lib/feature-flags";
import type { MapViewProps } from "@/lib/location-types";

const LeafletMap = lazy(() => import("./map-view-leaflet"));
const MapboxMap = lazy(() => import("./map-view-mapbox"));

export default function MapView(props: MapViewProps) {
  const Provider = USE_MAPBOX_MAPS && MAPBOX_TOKEN ? MapboxMap : LeafletMap;

  return (
    <Suspense
      fallback={
        <div
          className={props.className}
          style={{ height: props.height ?? "200px", background: "#1a1a2e" }}
        />
      }
    >
      <Provider {...props} />
    </Suspense>
  );
}

export type { MapViewProps };
