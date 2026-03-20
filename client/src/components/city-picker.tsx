import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, AlertCircle, Info } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "@/i18n";
import { usePlacesAutocomplete, type PlaceSuggestion } from "@/hooks/use-places-autocomplete";
import { getCitySupport } from "@/lib/city-support";

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
  const { t } = useTranslation();
  const [query, setQuery] = useState(value?.city_name ?? "");
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const places = usePlacesAutocomplete();

  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const nominatimDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchNominatim = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setNominatimResults([]);
      return;
    }
    setNominatimLoading(true);
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
        headers: { "User-Agent": "HousAlert/1.0" },
      });
      const data: NominatimResult[] = await res.json();
      const filtered = data.filter((r) => {
        const a = r.address;
        return !!(a.city || a.town || a.village || a.municipality);
      });
      setNominatimResults(filtered);
      setOpen(filtered.length > 0);
    } catch {
      setNominatimResults([]);
    } finally {
      setNominatimLoading(false);
    }
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    setTouched(true);
    if (value) onChange(null);

    if (nominatimDebounce.current) clearTimeout(nominatimDebounce.current);

    if (places.isAvailable) {
      places.search(val);
      setNominatimResults([]);
    } else {
      nominatimDebounce.current = setTimeout(() => searchNominatim(val), 350);
    }

    if (val.trim().length >= 2) {
      setOpen(true);
    }
  }

  async function handleGoogleSelect(suggestion: PlaceSuggestion) {
    const details = await places.getDetails(suggestion.place_id);
    const cityName = details?.city_name || suggestion.city_name;
    const place: SelectedPlace = {
      city_name: cityName,
      country_code: details?.country_code || "DE",
      latitude: details?.latitude || 0,
      longitude: details?.longitude || 0,
      place_id: suggestion.place_id,
    };
    onChange(place);
    setQuery(cityName);
    setOpen(false);
    setTouched(false);
    places.clear();
    setNominatimResults([]);
  }

  function handleNominatimSelect(r: NominatimResult) {
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
    places.clear();
    setNominatimResults([]);
  }

  function handleClear() {
    setQuery("");
    onChange(null);
    setNominatimResults([]);
    places.clear();
    setTouched(false);
  }

  const usingGoogle = places.isAvailable;
  const isLoading = places.loading || nominatimLoading;
  const hasResults = (usingGoogle && places.suggestions.length > 0) || nominatimResults.length > 0;
  const showValidation = touched && !value && query.trim().length > 0;

  const support = value ? getCitySupport(value.city_name) : null;

  return (
    <div className="flex flex-col gap-4" ref={containerRef}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (hasResults && !value) setOpen(true); }}
            placeholder={t("location.searchCity")}
            className={`w-full min-h-[52px] rounded-lg bg-[#F5F7FA] border border-transparent px-11 text-[16px] text-[#71717A] placeholder:text-[#71717A] ${
              showValidation ? "border-red-400" : value ? "border-[#F97316] bg-[#F5F7FA]/30" : "border-[#E5E7EB]"
            }`}
            data-testid="input-city-search"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center hover:bg-[#717171]/30 transition-colors"
              data-testid="button-clear-city"
            >
              <X className="w-3.5 h-3.5 text-[#71717A]" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[#F97316]/30 border-t-[#F97316] rounded-full animate-spin" />
          </div>
        )}

        {open && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
            {usingGoogle && places.suggestions.length > 0 ? (
              <>
                {places.suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => handleGoogleSelect(s)}
                    className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                    data-testid={`option-place-${s.place_id}`}
                  >
                    <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                    <span>{s.state ? `${s.city_name}, ${s.state}` : s.city_name}</span>
                  </button>
                ))}
                <div className="px-4 py-2 text-[11px] text-[#717171] text-right border-t border-[#F3F4F6]">
                  {t("cityPicker.poweredByGoogle")}
                </div>
              </>
            ) : (
              nominatimResults.map((r) => {
                const a = r.address;
                const city = a.city || a.town || a.village || a.municipality || "";
                const label = a.state ? `${city}, ${a.state}` : city;
                return (
                  <button
                    key={r.place_id}
                    onClick={() => handleNominatimSelect(r)}
                    className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                    data-testid={`option-place-${r.place_id}`}
                  >
                    <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {showValidation && (
        <div className="flex items-center gap-2 text-red-500 text-[13px]" data-testid="text-city-validation">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t("cityPicker.selectFromList")}</span>
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
          <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#71717A] font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.city_name}
          </div>

          {support && support.status === "unsupported" && (
            <div className="flex items-center gap-2 text-[#92400E] text-[13px] bg-[#FEF3C7] rounded-2xl px-4 py-3" data-testid="text-city-unsupported">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t("cityPicker.cityNotMonitored")}</span>
            </div>
          )}

          {support && support.status === "dynamic" && (
            <div className="flex items-center gap-2 text-[#F97316] text-[13px] bg-[#FFF7ED] rounded-2xl px-4 py-3" data-testid="text-city-dynamic">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>{t("cityPicker.cityDynamic")}</span>
            </div>
          )}

          <div className="rounded-lg overflow-hidden border border-[#E5E7EB] h-[200px]" data-testid="map-preview">
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
