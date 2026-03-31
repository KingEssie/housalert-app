export interface LocationResult {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  source: "google" | "nominatim" | "mapbox" | "preset";
  placeId?: string;
}

export interface MapMarker {
  lat: number;
  lng: number;
  type?: "primary" | "destination";
}

export interface MapCircle {
  lat: number;
  lng: number;
  radiusMeters: number;
  color?: string;
  fillOpacity?: number;
}

export interface MapViewProps {
  lat: number;
  lng: number;
  zoom: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  height?: string;
  className?: string;
  interactive?: boolean;
}
