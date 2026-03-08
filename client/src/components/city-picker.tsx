import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MARKER_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface SelectedPlace {
  city_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  place_id: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
  type: string;
}

function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 11, { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface CityPickerProps {
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
  error?: string | null;
}

export default function CityPicker({ value, onChange, error }: CityPickerProps) {
  const [query, setQuery] = useState(value?.city_name ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        format: "json",
        addressdetails: "1",
        countrycodes: "de",
        limit: "8",
        featuretype: "city",
        "accept-language": "de",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "Stekkies/1.0" },
      });
      const data: NominatimResult[] = await res.json();
      const filtered = data.filter((r) => {
        const a = r.address;
        return !!(a.city || a.town || a.village || a.municipality);
      });
      setResults(filtered);
      setOpen(filtered.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    setTouched(true);
    if (value) onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 300);
  }

  function handleSelect(r: NominatimResult) {
    const a = r.address;
    const cityName = a.city || a.town || a.village || a.municipality || "";
    const place: SelectedPlace = {
      city_name: cityName,
      country_code: a.country_code?.toUpperCase() || "DE",
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      place_id: String(r.place_id),
    };
    onChange(place);
    setQuery(cityName);
    setOpen(false);
    setTouched(false);
  }

  function handleClear() {
    setQuery("");
    onChange(null);
    setResults([]);
    setTouched(false);
  }

  function getDisplayName(r: NominatimResult): string {
    const a = r.address;
    const city = a.city || a.town || a.village || a.municipality || "";
    return a.state ? `${city}, ${a.state}` : city;
  }

  const showValidation = touched && !value && query.trim().length > 0;

  return (
    <div className="flex flex-col gap-4" ref={containerRef}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--yo-dark)] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (results.length > 0 && !value) setOpen(true); }}
            placeholder="Zoek een plaats in Duitsland"
            className={`w-full min-h-[52px] rounded-lg bg-[var(--yo-surface)] border px-11 text-[16px] text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)] focus:border-transparent transition-colors ${
              showValidation ? "border-red-400" : value ? "border-[var(--yo-teal)] bg-[var(--yo-chip-bg)]/30" : "border-[var(--yo-divider)]"
            }`}
            data-testid="input-city-search"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--yo-divider)] flex items-center justify-center hover:bg-[var(--yo-muted)]/30 transition-colors"
              data-testid="button-clear-city"
            >
              <X className="w-3.5 h-3.5 text-[var(--yo-dark)]" />
            </button>
          )}
        </div>

        {loading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--yo-teal)]/30 border-t-[var(--yo-teal)] rounded-full animate-spin" />
          </div>
        )}

        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[var(--yo-divider)] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
            {results.map((r) => (
              <button
                key={r.place_id}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[var(--yo-dark)] hover:bg-[var(--yo-surface)] flex items-center gap-3"
                data-testid={`option-place-${r.place_id}`}
              >
                <MapPin className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
                <span>{getDisplayName(r)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showValidation && (
        <div className="flex items-center gap-2 text-red-500 text-[13px]" data-testid="text-city-validation">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Selecteer een plaats uit de lijst.</span>
        </div>
      )}

      {error && !showValidation && (
        <div className="flex items-center gap-2 text-red-500 text-[13px]" data-testid="text-city-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {value && (
        <>
          <div className="inline-flex items-center gap-2 bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] font-semibold text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.city_name}
          </div>

          <div className="rounded-lg overflow-hidden border border-[var(--yo-divider)] h-[200px]" data-testid="map-preview">
            <MapContainer
              center={[value.latitude, value.longitude]}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[value.latitude, value.longitude]} icon={MARKER_ICON} />
              <MapUpdater lat={value.latitude} lng={value.longitude} />
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
}
