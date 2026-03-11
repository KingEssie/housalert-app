import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, AlertCircle, Navigation, Clock, Car, Train, Bike, ChevronDown, Check } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cityDistricts } from "../../../config/market";
import { useTranslation } from "@/i18n";

const MARKER_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEST_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type LocationTab = "wijken" | "radius" | "reistijd";

export interface SelectedPlace {
  city_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  place_id: string;
}

export interface LocationData {
  tab: LocationTab;
  place: SelectedPlace | null;
  districts: string[];
  radiusKm: number;
  commuteDestination: string;
  commuteCity: string;
  commuteLat: number | null;
  commuteLng: number | null;
  commuteMode: "auto" | "ov" | "fiets";
  commuteMinutes: number;
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

export const DEFAULT_LOCATION_DATA: LocationData = {
  tab: "wijken",
  place: null,
  districts: [],
  radiusKm: 5,
  commuteDestination: "",
  commuteCity: "",
  commuteLat: null,
  commuteLng: null,
  commuteMode: "auto",
  commuteMinutes: 30,
};

export function isLocationValid(d: LocationData): boolean {
  switch (d.tab) {
    case "wijken":
      return !!d.place;
    case "radius":
      return !!d.place && d.radiusKm > 0;
    case "reistijd":
      return !!d.commuteDestination && d.commuteLat != null && d.commuteLng != null;
    default:
      return false;
  }
}

function MapUpdater({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? 11, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

function radiusToZoom(km: number): number {
  if (km <= 2) return 13;
  if (km <= 5) return 12;
  if (km <= 10) return 11;
  if (km <= 15) return 10;
  if (km <= 25) return 9;
  return 8;
}

interface Props {
  value: LocationData;
  onChange: (data: LocationData) => void;
  segmentedTabs?: boolean;
  alwaysShowMap?: boolean;
  mapMaxHeight?: string;
}

export default function LocationModeSelector({ value, onChange, segmentedTabs, alwaysShowMap, mapMaxHeight }: Props) {
  const { t } = useTranslation();
  const [cityQuery, setCityQuery] = useState(value.place?.city_name ?? "");
  const [cityResults, setCityResults] = useState<NominatimResult[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);

  const [destQuery, setDestQuery] = useState(value.commuteDestination);
  const [destResults, setDestResults] = useState<NominatimResult[]>([]);
  const [destOpen, setDestOpen] = useState(false);
  const [destLoading, setDestLoading] = useState(false);
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cityContainerRef.current && !cityContainerRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
      if (destContainerRef.current && !destContainerRef.current.contains(e.target as Node)) {
        setDestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchNominatim = useCallback(async (q: string, setResults: (r: NominatimResult[]) => void, setOpen: (o: boolean) => void, setLoading: (l: boolean) => void) => {
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
        "accept-language": "de",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "HousAlert/1.0" },
      });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleCityInput(val: string) {
    setCityQuery(val);
    if (value.place) {
      onChange({ ...value, place: null, districts: [] });
    }
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    cityDebounce.current = setTimeout(() => {
      searchNominatim(val, setCityResults, setCityOpen, setCityLoading);
    }, 300);
  }

  function handleCitySelect(r: NominatimResult) {
    const a = r.address;
    const cityName = a.city || a.town || a.village || a.municipality || "";
    const place: SelectedPlace = {
      city_name: cityName,
      country_code: a.country_code?.toUpperCase() || "DE",
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      place_id: String(r.place_id),
    };
    setCityQuery(cityName);
    setCityOpen(false);
    setCityResults([]);
    onChange({ ...value, place, districts: [] });
  }

  function handleCityClear() {
    setCityQuery("");
    setCityResults([]);
    onChange({ ...value, place: null, districts: [] });
  }

  function handleDestInput(val: string) {
    setDestQuery(val);
    if (value.commuteLat != null) {
      onChange({ ...value, commuteDestination: val, commuteCity: "", commuteLat: null, commuteLng: null });
    } else {
      onChange({ ...value, commuteDestination: val });
    }
    if (destDebounce.current) clearTimeout(destDebounce.current);
    destDebounce.current = setTimeout(() => {
      searchNominatim(val, setDestResults, setDestOpen, setDestLoading);
    }, 300);
  }

  function handleDestSelect(r: NominatimResult) {
    const displayName = r.display_name.split(",").slice(0, 2).join(",").trim();
    const a = r.address;
    const city = a.city || a.town || a.village || a.municipality || displayName.split(",")[0].trim();
    setDestQuery(displayName);
    setDestOpen(false);
    setDestResults([]);
    onChange({
      ...value,
      commuteDestination: displayName,
      commuteCity: city,
      commuteLat: parseFloat(r.lat),
      commuteLng: parseFloat(r.lon),
    });
  }

  function handleDestClear() {
    setDestQuery("");
    setDestResults([]);
    onChange({ ...value, commuteDestination: "", commuteCity: "", commuteLat: null, commuteLng: null });
  }

  function setTab(tab: LocationTab) {
    onChange({ ...value, tab });
  }

  const availableDistricts = value.place ? (cityDistricts[value.place.city_name] ?? []) : [];
  const districtsNotAvailable = !!value.place && availableDistricts.length === 0;

  function toggleDistrict(d: string) {
    const next = value.districts.includes(d)
      ? value.districts.filter((x) => x !== d)
      : [...value.districts, d];
    onChange({ ...value, districts: next });
  }

  const tabs: { id: LocationTab; label: string }[] = [
    { id: "wijken", label: t("location.tabs.districts") },
    { id: "radius", label: t("location.tabs.radius") },
    { id: "reistijd", label: t("location.tabs.commute") },
  ];

  const mapLat = value.place?.latitude ?? (value.tab === "reistijd" ? value.commuteLat : null);
  const mapLng = value.place?.longitude ?? (value.tab === "reistijd" ? value.commuteLng : null);
  const hasLocation = mapLat != null && mapLng != null;
  const showMap = hasLocation || !!alwaysShowMap;
  const defaultLat = 52.52;
  const defaultLng = 13.405;
  const defaultZoom = 11;

  return (
    <div className="flex flex-col gap-5">
      {segmentedTabs ? (
        <div className="flex bg-[#F5F7FA] rounded-lg p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 py-2.5 text-[13px] font-semibold text-center rounded-lg transition-all ${
                value.tab === tab.id
                  ? "bg-white text-[#1F2937] shadow-sm"
                  : "text-[#1F2937] hover:text-[#1F2937]"
              }`}
              data-testid={`tab-location-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-[#E5E7EB]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors relative ${
                value.tab === tab.id
                  ? "text-[#1F2937]"
                  : "text-[#1F2937] hover:text-[#1F2937]"
              }`}
              data-testid={`tab-location-${tab.id}`}
            >
              {tab.label}
              {value.tab === tab.id && (
                <div className="absolute bottom-0 left-3 right-3 h-[3px] bg-[#0D6EFD] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {(value.tab === "wijken" || value.tab === "radius") && (
        <div ref={cityContainerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#1F2937] pointer-events-none" />
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => handleCityInput(e.target.value)}
              onFocus={() => { if (cityResults.length > 0 && !value.place) setCityOpen(true); }}
              placeholder={t("location.searchCity")}
              className={`w-full min-h-[52px] rounded-lg bg-[#F5F7FA] border px-11 text-[16px] text-[#1F2937] placeholder:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD] focus:border-transparent transition-colors ${
                value.place ? "border-[#0D6EFD] bg-[#F5F7FA]/30" : "border-[#E5E7EB]"
              }`}
              data-testid="input-city-search"
            />
            {cityQuery && (
              <button
                onClick={handleCityClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center hover:bg-[#6B7280]/30 transition-colors"
                data-testid="button-clear-city"
              >
                <X className="w-3.5 h-3.5 text-[#1F2937]" />
              </button>
            )}
          </div>
          {cityLoading && (
            <div className="absolute right-12 top-[26px] -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#0D6EFD]/30 border-t-[#0D6EFD] rounded-full animate-spin" />
            </div>
          )}
          {cityOpen && cityResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
              {cityResults.map((r) => {
                const a = r.address;
                const label = a.city || a.town || a.village || a.municipality || "";
                const sub = a.state ? `${label}, ${a.state}` : label;
                return (
                  <button
                    key={r.place_id}
                    onClick={() => handleCitySelect(r)}
                    className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#1F2937] hover:bg-[#F5F7FA] flex items-center gap-3"
                    data-testid={`option-place-${r.place_id}`}
                  >
                    <MapPin className="w-4 h-4 text-[#1F2937] flex-shrink-0" />
                    <span>{sub}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value.tab === "wijken" && value.place && (
        <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#1F2937] font-semibold text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
          <MapPin className="w-4 h-4" />
          {value.place.city_name}
        </div>
      )}

      {value.tab === "wijken" && value.place && availableDistricts.length > 0 && (
        <DistrictMultiSelect
          districts={availableDistricts}
          selected={value.districts}
          onToggle={toggleDistrict}
        />
      )}

      {value.tab === "wijken" && districtsNotAvailable && (
        <div className="flex items-center gap-2 text-[#1F2937] text-[13px] bg-[#F5F7FA] rounded-lg px-4 py-3" data-testid="text-districts-unavailable">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#1F2937]" />
          <span>{t("location.districtsSoon")}</span>
        </div>
      )}

      {value.tab === "radius" && value.place && (
        <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#1F2937] font-semibold text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
          <MapPin className="w-4 h-4" />
          {value.place.city_name}
        </div>
      )}

      {value.tab === "radius" && (
        <div>
          <label className="text-[16px] font-[700] text-[#1F2937] mb-3 block">{t("location.radiusLabel")}</label>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F2937]" />
            <select
              value={value.radiusKm}
              onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) })}
              className="w-full h-[52px] pl-11 pr-4 rounded-lg border-0 bg-[#F5F7FA] text-[15px] font-medium text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] cursor-pointer appearance-none transition-all"
              data-testid="select-radius"
            >
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="15">15 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
          </div>
        </div>
      )}

      {value.tab === "reistijd" && (
        <>
          <div ref={destContainerRef} className="relative">
            <label className="text-[16px] font-[700] text-[#1F2937] mb-3 block">{t("location.workAddress")}</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#1F2937] pointer-events-none" />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestInput(e.target.value)}
                onFocus={() => { if (destResults.length > 0 && value.commuteLat == null) setDestOpen(true); }}
                placeholder={t("location.searchAddress")}
                className={`w-full min-h-[52px] rounded-lg bg-[#F5F7FA] border px-11 text-[16px] text-[#1F2937] placeholder:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD] focus:border-transparent transition-colors ${
                  value.commuteLat != null ? "border-[#0D6EFD] bg-[#F5F7FA]/30" : "border-[#E5E7EB]"
                }`}
                data-testid="input-commute-destination"
              />
              {destQuery && (
                <button
                  onClick={handleDestClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center hover:bg-[#6B7280]/30 transition-colors"
                  data-testid="button-clear-destination"
                >
                  <X className="w-3.5 h-3.5 text-[#1F2937]" />
                </button>
              )}
            </div>
            {destLoading && (
              <div className="absolute right-12 top-[calc(24px+26px)] -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#0D6EFD]/30 border-t-[#0D6EFD] rounded-full animate-spin" />
              </div>
            )}
            {destOpen && destResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
                {destResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleDestSelect(r)}
                    className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#1F2937] hover:bg-[#F5F7FA] flex items-center gap-3"
                    data-testid={`option-dest-${r.place_id}`}
                  >
                    <MapPin className="w-4 h-4 text-[#1F2937] flex-shrink-0" />
                    <span>{r.display_name.split(",").slice(0, 3).join(",")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {value.commuteLat != null && (
            <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#1F2937] font-semibold text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-destination">
              <MapPin className="w-4 h-4" />
              {value.commuteDestination}
            </div>
          )}

          <div>
            <label className="text-[16px] font-[700] text-[#1F2937] mb-3 block">{t("location.transport")}</label>
            <div className="flex gap-2">
              {([
                { id: "auto" as const, icon: Car, label: t("location.transportOptions.car") },
                { id: "ov" as const, icon: Train, label: t("location.transportOptions.transit") },
                { id: "fiets" as const, icon: Bike, label: t("location.transportOptions.bike") },
              ]).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onChange({ ...value, commuteMode: mode.id })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-semibold transition-all ${
                    value.commuteMode === mode.id
                      ? "bg-[#0D6EFD] text-white"
                      : "bg-[#F5F7FA] text-[#1F2937] hover:bg-[#E5E7EB]"
                  }`}
                  data-testid={`button-transport-${mode.id}`}
                >
                  <mode.icon className="w-5 h-5" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[16px] font-[700] text-[#1F2937] mb-3 block">{t("location.maxCommute")}</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F2937]" />
              <select
                value={value.commuteMinutes}
                onChange={(e) => onChange({ ...value, commuteMinutes: parseInt(e.target.value) })}
                className="w-full h-[52px] pl-11 pr-4 rounded-lg border-0 bg-[#F5F7FA] text-[15px] font-medium text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] cursor-pointer appearance-none transition-all"
                data-testid="select-commute-minutes"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>
        </>
      )}

      {showMap && (
        <div className="rounded-lg overflow-hidden border border-[#E5E7EB] relative" style={{ height: "200px", maxHeight: mapMaxHeight || "none", zIndex: 0 }} data-testid="map-preview">
          <MapContainer
            center={hasLocation ? [mapLat!, mapLng!] : [defaultLat, defaultLng]}
            zoom={hasLocation ? (value.tab === "radius" ? radiusToZoom(value.radiusKm) : 11) : defaultZoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {hasLocation && (
              <>
                <Marker position={[mapLat!, mapLng!]} icon={value.tab === "reistijd" ? DEST_ICON : MARKER_ICON} />
                {value.tab === "radius" && value.place && (
                  <Circle
                    center={[value.place.latitude, value.place.longitude]}
                    radius={value.radiusKm * 1000}
                    pathOptions={{
                      color: "#0D6EFD",
                      fillColor: "#0D6EFD",
                      fillOpacity: 0.1,
                      weight: 2,
                    }}
                  />
                )}
              </>
            )}
            <MapUpdater
              lat={hasLocation ? mapLat! : defaultLat}
              lng={hasLocation ? mapLng! : defaultLng}
              zoom={hasLocation ? (value.tab === "radius" ? radiusToZoom(value.radiusKm) : 11) : defaultZoom}
            />
          </MapContainer>
        </div>
      )}
    </div>
  );
}

function DistrictMultiSelect({
  districts,
  selected,
  onToggle,
}: {
  districts: string[];
  selected: string[];
  onToggle: (d: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-[16px] font-[700] text-[#1F2937] mb-2 block">
        {t("location.districtLabel")} <span className="font-normal text-[13px] text-[#1F2937]">{t("location.districtOptional")}</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[#F5F7FA] text-[15px] font-medium text-[#1F2937] text-left relative flex items-center"
        data-testid="dropdown-districts"
      >
        <span className={selected.length === 0 ? "opacity-50" : ""}>
          {selected.length === 0
            ? t("location.selectDistricts")
            : t("location.districtSelected", { count: selected.length, label: selected.length === 1 ? t("location.districtSingular") : t("location.districtPlural") })}
        </span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1F2937] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-[60] w-full mt-1 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#E5E7EB] max-h-[280px] overflow-y-auto">
          {districts.map((d) => {
            const isSelected = selected.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggle(d)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F7FA] transition-colors"
                data-testid={`option-district-${d.toLowerCase().replace(/[\s.]/g, "-")}`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                  isSelected ? "bg-[#0D6EFD] border-[#0D6EFD]" : "border-[#E5E7EB] bg-white"
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="text-[14px] text-[#1F2937]">{d}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0D6EFD]/15 text-[12px] font-medium text-[#1F2937]"
            >
              {d}
              <button
                type="button"
                onClick={() => onToggle(d)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-black/10"
                data-testid={`remove-district-${d.toLowerCase().replace(/[\s.]/g, "-")}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
