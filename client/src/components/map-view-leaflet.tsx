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

function Updater({ lat, lng, zoom, circles }: { lat: number; lng: number; zoom: number; circles: MapViewProps["circles"] }) {
  const map = useMap();
  useEffect(() => {
    if (circles && circles.length > 0) {
      const c = circles[0];
      const km = c.radiusMeters / 1000;
      const pad = 1.3;
      const dlat = (km * pad) / 110.574;
      const dlng = (km * pad) / (111.32 * Math.cos((c.lat * Math.PI) / 180));
      map.fitBounds([[c.lat - dlat, c.lng - dlng], [c.lat + dlat, c.lng + dlng]], { animate: true, padding: [24, 24] });
    } else {
      map.setView([lat, lng], zoom, { animate: true });
    }
  }, [lat, lng, zoom, circles, map]);
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
        <Updater lat={lat} lng={lng} zoom={zoom} circles={circles} />
      </MapContainer>
    </div>
  );
}
