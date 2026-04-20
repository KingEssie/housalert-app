import { lazy, Suspense } from "react";
import { USE_MAPBOX_MAPS, MAPBOX_TOKEN } from "@/lib/feature-flags";
import type { MapViewProps } from "@/lib/location-types";

const useMapbox = USE_MAPBOX_MAPS && !!MAPBOX_TOKEN;

if (import.meta.env.DEV) {
  console.log("[MapView] provider:", useMapbox ? "mapbox" : "leaflet",
    "| USE_MAPBOX_MAPS:", USE_MAPBOX_MAPS,
    "| token present:", !!MAPBOX_TOKEN);
}

const LeafletMap = lazy(() => import("./map-view-leaflet"));
const MapboxMap = lazy(() => import("./map-view-mapbox"));

export default function MapView(props: MapViewProps) {
  const Provider = useMapbox ? MapboxMap : LeafletMap;

  return (
    <Suspense
      fallback={
        <div
          className={props.className}
          style={{ height: props.height ?? "200px", background: "rgb(var(--ha-text))" }}
        />
      }
    >
      <Provider {...props} />
    </Suspense>
  );
}

export type { MapViewProps };
