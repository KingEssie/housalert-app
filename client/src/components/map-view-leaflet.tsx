import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "@/lib/location-types";

const PRIMARY_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function Updater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

export default function MapViewLeaflet({
  lat,
  lng,
  zoom,
  markers = [],
  circles = [],
  height = "200px",
  className = "",
  interactive = false,
}: MapViewProps) {
  return (
    <div className={className} style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={PRIMARY_ICON} />
        ))}
        {circles.map((c, i) => (
          <Circle
            key={i}
            center={[c.lat, c.lng]}
            radius={c.radiusMeters}
            pathOptions={{
              color: c.color ?? "rgb(var(--ha-primary))",
              fillColor: c.color ?? "rgb(var(--ha-primary))",
              fillOpacity: c.fillOpacity ?? 0.1,
              weight: 2,
            }}
          />
        ))}
        <Updater lat={lat} lng={lng} zoom={zoom} />
      </MapContainer>
    </div>
  );
}
