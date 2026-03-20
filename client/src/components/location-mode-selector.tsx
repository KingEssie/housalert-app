import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, AlertCircle, Navigation, Clock, Car, Train, Bike, ChevronDown, Check, Info } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cityDistricts } from "../../../config/market";
import { useTranslation } from "@/i18n";
import { usePlacesAutocomplete, type PlaceSuggestion } from "@/hooks/use-places-autocomplete";
import { getCitySupport, type CitySupport } from "@/lib/city-support";

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

function CitySupportBadge({ cityName }: { cityName: string }) {
  const { t } = useTranslation();
  const support = getCitySupport(cityName);

  if (support.status === "supported") return null;

  if (support.status === "dynamic") {
    return (
      <div className="flex items-center gap-2 text-[#0D6EFD] text-[13px] bg-[#EBF2FF] rounded-2xl px-4 py-3" data-testid="text-city-dynamic">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>{t("cityPicker.cityDynamic")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[#92400E] text-[13px] bg-[#FEF3C7] rounded-2xl px-4 py-3" data-testid="text-city-unsupported">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{t("cityPicker.cityNotMonitored")}</span>
    </div>
  );
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
  const [cityOpen, setCityOpen] = useState(false);
  const cityContainerRef = useRef<HTMLDivElement>(null);

  const places = usePlacesAutocomplete();
  const destPlaces = usePlacesAutocomplete();

  const [nominatimCityResults, setNominatimCityResults] = useState<NominatimResult[]>([]);
  const [nominatimCityLoading, setNominatimCityLoading] = useState(false);
  const cityNominatimDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [destQuery, setDestQuery] = useState(value.commuteDestination);
  const [destOpen, setDestOpen] = useState(false);
  const [nominatimDestResults, setNominatimDestResults] = useState<NominatimResult[]>([]);
  const [nominatimDestLoading, setNominatimDestLoading] = useState(false);
  const destNominatimDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const usingGoogleForCity = places.isAvailable;
  const usingGoogleForDest = destPlaces.isAvailable;

  function handleCityInput(val: string) {
    setCityQuery(val);
    if (value.place) {
      onChange({ ...value, place: null, districts: [] });
    }

    if (cityNominatimDebounce.current) clearTimeout(cityNominatimDebounce.current);

    if (places.isAvailable) {
      places.search(val);
      setNominatimCityResults([]);
    } else {
      cityNominatimDebounce.current = setTimeout(() => {
        searchNominatim(val, setNominatimCityResults, setCityOpen, setNominatimCityLoading);
      }, 350);
    }

    if (val.trim().length >= 2) {
      setCityOpen(true);
    }
  }

  async function handleGoogleCitySelect(suggestion: PlaceSuggestion) {
    const details = await places.getDetails(suggestion.place_id);
    const cityName = details?.city_name || suggestion.city_name;
    const place: SelectedPlace = {
      city_name: cityName,
      country_code: details?.country_code || "DE",
      latitude: details?.latitude || 0,
      longitude: details?.longitude || 0,
      place_id: suggestion.place_id,
    };
    setCityQuery(cityName);
    setCityOpen(false);
    places.clear();
    setNominatimCityResults([]);
    onChange({ ...value, place, districts: [] });
  }

  function handleNominatimCitySelect(r: NominatimResult) {
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
    setNominatimCityResults([]);
    places.clear();
    onChange({ ...value, place, districts: [] });
  }

  function handleCityClear() {
    setCityQuery("");
    setNominatimCityResults([]);
    places.clear();
    onChange({ ...value, place: null, districts: [] });
  }

  function handleDestInput(val: string) {
    setDestQuery(val);
    if (value.commuteLat != null) {
      onChange({ ...value, commuteDestination: val, commuteCity: "", commuteLat: null, commuteLng: null });
    } else {
      onChange({ ...value, commuteDestination: val });
    }

    if (destNominatimDebounce.current) clearTimeout(destNominatimDebounce.current);

    if (destPlaces.isAvailable) {
      destPlaces.search(val);
      setNominatimDestResults([]);
    } else {
      destNominatimDebounce.current = setTimeout(() => {
        searchNominatim(val, setNominatimDestResults, setDestOpen, setNominatimDestLoading);
      }, 350);
    }

    if (val.trim().length >= 2) {
      setDestOpen(true);
    }
  }

  async function handleGoogleDestSelect(suggestion: PlaceSuggestion) {
    const details = await destPlaces.getDetails(suggestion.place_id);
    const displayName = details?.display_name || suggestion.display_name;
    const cityName = details?.city_name || suggestion.city_name;
    setDestQuery(displayName);
    setDestOpen(false);
    destPlaces.clear();
    setNominatimDestResults([]);
    onChange({
      ...value,
      commuteDestination: displayName,
      commuteCity: cityName,
      commuteLat: details?.latitude || 0,
      commuteLng: details?.longitude || 0,
    });
  }

  function handleNominatimDestSelect(r: NominatimResult) {
    const displayName = r.display_name.split(",").slice(0, 2).join(",").trim();
    const a = r.address;
    const city = a.city || a.town || a.village || a.municipality || displayName.split(",")[0].trim();
    setDestQuery(displayName);
    setDestOpen(false);
    setNominatimDestResults([]);
    destPlaces.clear();
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
    setNominatimDestResults([]);
    destPlaces.clear();
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

  const googleCitySuggestions = places.suggestions;
  const cityIsLoading = places.loading || nominatimCityLoading;

  const googleDestSuggestions = destPlaces.suggestions;
  const destIsLoading = destPlaces.loading || nominatimDestLoading;

  const hasCityResults = (usingGoogleForCity && googleCitySuggestions.length > 0) || nominatimCityResults.length > 0;
  const hasDestResults = (usingGoogleForDest && googleDestSuggestions.length > 0) || nominatimDestResults.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {segmentedTabs ? (
        <div className="flex bg-[#F3F4F6] rounded-2xl p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 py-2.5 text-[13px] font-medium text-center rounded-lg transition-all ${
                value.tab === tab.id
                  ? "bg-white text-[#222222] shadow-sm"
                  : "text-[#222222] hover:text-[#222222]"
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
              className={`flex-1 pb-3 text-sm font-medium text-center transition-colors relative ${
                value.tab === tab.id
                  ? "text-[#222222]"
                  : "text-[#222222] hover:text-[#222222]"
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A] pointer-events-none" />
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => handleCityInput(e.target.value)}
              onFocus={() => { if (hasCityResults && !value.place) setCityOpen(true); }}
              placeholder={t("location.searchCity")}
              className={`w-full min-h-[60px] rounded-[20px] bg-[#F3F4F6] border px-11 text-[16px] text-[#71717A] placeholder:text-[#717171] ${
                value.place ? "border-[#0D6EFD] bg-[#F5F7FA]/30" : "border-[#E5E7EB]"
              }`}
              data-testid="input-city-search"
            />
            {cityQuery && (
              <button
                onClick={handleCityClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center hover:bg-[#717171]/30 transition-colors"
                data-testid="button-clear-city"
              >
                <X className="w-3.5 h-3.5 text-[#71717A]" />
              </button>
            )}
          </div>
          {cityIsLoading && (
            <div className="absolute right-12 top-[26px] -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-[#0D6EFD]/30 border-t-[#0D6EFD] rounded-full animate-spin" />
            </div>
          )}
          {cityOpen && hasCityResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
              {usingGoogleForCity && googleCitySuggestions.length > 0 ? (
                <>
                  {googleCitySuggestions.map((s) => (
                    <button
                      key={s.place_id}
                      onClick={() => handleGoogleCitySelect(s)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                      data-testid={`option-place-${s.place_id}`}
                    >
                      <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                      <span>{s.state ? `${s.city_name}, ${s.state}` : s.city_name}</span>
                    </button>
                  ))}
                  <div className="px-4 py-2 text-[11px] text-[#717171] text-right border-t border-[#F3F4F6]" data-testid="text-powered-by-google">
                    {t("cityPicker.poweredByGoogle")}
                  </div>
                </>
              ) : (
                nominatimCityResults.map((r) => {
                  const a = r.address;
                  const label = a.city || a.town || a.village || a.municipality || "";
                  const sub = a.state ? `${label}, ${a.state}` : label;
                  return (
                    <button
                      key={r.place_id}
                      onClick={() => handleNominatimCitySelect(r)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                      data-testid={`option-place-${r.place_id}`}
                    >
                      <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                      <span>{sub}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {value.tab === "wijken" && value.place && (
        <>
          <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#71717A] font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.place.city_name}
          </div>
          <CitySupportBadge cityName={value.place.city_name} />
        </>
      )}

      {value.tab === "wijken" && value.place && availableDistricts.length > 0 && (
        <DistrictMultiSelect
          districts={availableDistricts}
          selected={value.districts}
          onToggle={toggleDistrict}
        />
      )}

      {value.tab === "wijken" && districtsNotAvailable && (
        <div className="flex items-center gap-2 text-[#71717A] text-[13px] bg-[#F3F4F6] rounded-2xl px-4 py-3" data-testid="text-districts-unavailable">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#71717A]" />
          <span>{t("location.districtsSoon")}</span>
        </div>
      )}

      {value.tab === "radius" && value.place && (
        <>
          <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#71717A] font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.place.city_name}
          </div>
          <CitySupportBadge cityName={value.place.city_name} />
        </>
      )}

      {value.tab === "radius" && (
        <div>
          <label className="text-[16px] font-medium text-[#222222] mb-3 block">{t("location.radiusLabel")}</label>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
            <select
              value={value.radiusKm}
              onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) })}
              className="w-full h-[52px] pl-11 pr-4 rounded-lg border border-transparent bg-[#F5F7FA] text-[15px] font-medium text-[#71717A] cursor-pointer appearance-none"
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
            <label className="text-[16px] font-medium text-[#222222] mb-3 block">{t("location.workAddress")}</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A] pointer-events-none" />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestInput(e.target.value)}
                onFocus={() => { if (hasDestResults && value.commuteLat == null) setDestOpen(true); }}
                placeholder={t("location.searchAddress")}
                className={`w-full min-h-[60px] rounded-[20px] bg-[#F3F4F6] border px-11 text-[16px] text-[#71717A] placeholder:text-[#717171] ${
                  value.commuteLat != null ? "border-[#0D6EFD] bg-[#F5F7FA]/30" : "border-[#E5E7EB]"
                }`}
                data-testid="input-commute-destination"
              />
              {destQuery && (
                <button
                  onClick={handleDestClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center hover:bg-[#717171]/30 transition-colors"
                  data-testid="button-clear-destination"
                >
                  <X className="w-3.5 h-3.5 text-[#71717A]" />
                </button>
              )}
            </div>
            {destIsLoading && (
              <div className="absolute right-12 top-[calc(24px+26px)] -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#0D6EFD]/30 border-t-[#0D6EFD] rounded-full animate-spin" />
              </div>
            )}
            {destOpen && hasDestResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
                {usingGoogleForDest && googleDestSuggestions.length > 0 ? (
                  <>
                    {googleDestSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onClick={() => handleGoogleDestSelect(s)}
                        className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                        data-testid={`option-dest-${s.place_id}`}
                      >
                        <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                        <span>{s.state ? `${s.city_name}, ${s.state}` : s.display_name}</span>
                      </button>
                    ))}
                    <div className="px-4 py-2 text-[11px] text-[#717171] text-right border-t border-[#F3F4F6]">
                      {t("cityPicker.poweredByGoogle")}
                    </div>
                  </>
                ) : (
                  nominatimDestResults.map((r) => (
                    <button
                      key={r.place_id}
                      onClick={() => handleNominatimDestSelect(r)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[14px] last:rounded-b-[14px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3"
                      data-testid={`option-dest-${r.place_id}`}
                    >
                      <MapPin className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                      <span>{r.display_name.split(",").slice(0, 3).join(",")}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {value.commuteLat != null && (
            <div className="inline-flex items-center gap-2 bg-[#F5F7FA] text-[#71717A] font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-destination">
              <MapPin className="w-4 h-4" />
              {value.commuteDestination}
            </div>
          )}

          <div>
            <label className="text-[16px] font-medium text-[#222222] mb-3 block">{t("location.transport")}</label>
            <div className="flex gap-2">
              {([
                { id: "auto" as const, icon: Car, label: t("location.transportOptions.car") },
                { id: "ov" as const, icon: Train, label: t("location.transportOptions.transit") },
                { id: "fiets" as const, icon: Bike, label: t("location.transportOptions.bike") },
              ]).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onChange({ ...value, commuteMode: mode.id })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all ${
                    value.commuteMode === mode.id
                      ? "bg-[#0D6EFD] text-white"
                      : "bg-[#F5F7FA] text-[#222222] hover:bg-[#E5E7EB]"
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
            <label className="text-[16px] font-medium text-[#222222] mb-3 block">{t("location.maxCommute")}</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
              <select
                value={value.commuteMinutes}
                onChange={(e) => onChange({ ...value, commuteMinutes: parseInt(e.target.value) })}
                className="w-full h-[52px] pl-11 pr-4 rounded-lg border border-transparent bg-[#F5F7FA] text-[15px] font-medium text-[#71717A] cursor-pointer appearance-none"
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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between min-h-[52px] px-4 rounded-[20px] bg-[#F3F4F6] border border-[#E5E7EB] text-[15px] text-[#71717A] hover:bg-[#F5F7FA] transition-colors"
        data-testid="button-district-dropdown"
      >
        <span className={selected.length > 0 ? "font-medium" : "text-[#717171]"}>
          {selected.length > 0
            ? t("location.districtSelected", { count: selected.length, label: selected.length === 1 ? t("location.districtSingular") : t("location.districtPlural") })
            : t("location.selectDistricts")}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#71717A] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[260px] overflow-y-auto z-30">
          {districts.map((d) => (
            <button
              key={d}
              onClick={() => onToggle(d)}
              className="w-full text-left px-4 py-3 text-[15px] text-[#71717A] hover:bg-[#F5F7FA] flex items-center gap-3 transition-colors"
              data-testid={`option-district-${d.toLowerCase().replace(/[\s-]/g, "-")}`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected.includes(d)
                  ? "bg-[#0D6EFD] border-[#0D6EFD]"
                  : "border-[#D1D5DB]"
              }`}>
                {selected.includes(d) && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <span>{d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
