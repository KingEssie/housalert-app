import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, AlertCircle, Navigation, Clock, Car, Train, Bike, ChevronDown, Check } from "lucide-react";
import MapView from "@/components/map-view";
import { cityDistricts } from "../../../config/market";
import { useTranslation } from "@/i18n";
import { usePlacesAutocomplete, type PlaceSuggestion } from "@/hooks/use-places-autocomplete";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";

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
  const [cityOpen, setCityOpen] = useState(false);
  const cityContainerRef = useRef<HTMLDivElement>(null);

  const places = usePlacesAutocomplete();
  const destPlaces = usePlacesAutocomplete();
  const cityGeocoder = useGeocoderSearch({ debounceMs: 300, limit: 6 });
  const destGeocoder = useGeocoderSearch({ debounceMs: 300, limit: 6 });

  const [destQuery, setDestQuery] = useState(value.commuteDestination);
  const [destOpen, setDestOpen] = useState(false);
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

  const usingGoogleForCity = places.isAvailable;
  const usingGoogleForDest = destPlaces.isAvailable;

  function handleCityInput(val: string) {
    setCityQuery(val);
    if (value.place) {
      onChange({ ...value, place: null, districts: [] });
    }

    if (places.isAvailable) {
      places.search(val);
      cityGeocoder.clear();
    } else {
      cityGeocoder.search(val);
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
    cityGeocoder.clear();
    onChange({ ...value, place, districts: [] });
  }

  function handleGeocoderCitySelect(r: typeof cityGeocoder.results[0]) {
    const place: SelectedPlace = {
      city_name: r.city,
      country_code: r.country,
      latitude: r.lat,
      longitude: r.lng,
      place_id: r.placeId ?? "",
    };
    setCityQuery(r.city);
    setCityOpen(false);
    cityGeocoder.clear();
    places.clear();
    onChange({ ...value, place, districts: [] });
  }

  function handleCityClear() {
    setCityQuery("");
    cityGeocoder.clear();
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

    if (destPlaces.isAvailable) {
      destPlaces.search(val);
      destGeocoder.clear();
    } else {
      destGeocoder.search(val);
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
    destGeocoder.clear();
    onChange({
      ...value,
      commuteDestination: displayName,
      commuteCity: cityName,
      commuteLat: details?.latitude || 0,
      commuteLng: details?.longitude || 0,
    });
  }

  function handleGeocoderDestSelect(r: typeof destGeocoder.results[0]) {
    setDestQuery(r.label);
    setDestOpen(false);
    destGeocoder.clear();
    destPlaces.clear();
    onChange({
      ...value,
      commuteDestination: r.label,
      commuteCity: r.city,
      commuteLat: r.lat,
      commuteLng: r.lng,
    });
  }

  function handleDestClear() {
    setDestQuery("");
    destGeocoder.clear();
    destPlaces.clear();
    onChange({ ...value, commuteDestination: "", commuteCity: "", commuteLat: null, commuteLng: null });
  }

  function setTab(tab: LocationTab) {
    onChange({ ...value, tab });
  }

  const availableDistricts = value.place ? (cityDistricts[value.place.city_name] ?? []) : [];

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
  const cityIsLoading = places.loading || cityGeocoder.loading;

  const googleDestSuggestions = destPlaces.suggestions;
  const destIsLoading = destPlaces.loading || destGeocoder.loading;

  const hasCityResults = (usingGoogleForCity && googleCitySuggestions.length > 0) || cityGeocoder.results.length > 0;
  const hasDestResults = (usingGoogleForDest && googleDestSuggestions.length > 0) || destGeocoder.results.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {segmentedTabs ? (
        <div className="flex bg-ha-surface rounded-[6px] p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 py-2.5 text-[13px] font-medium text-center rounded-[6px] transition-all ${
                value.tab === tab.id
                  ? "bg-ha-card text-ha-text shadow-sm"
                  : "text-ha-text hover:text-ha-text"
              }`}
              data-testid={`tab-location-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-ha-card-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 pb-3 text-sm font-medium text-center transition-colors relative ${
                value.tab === tab.id
                  ? "text-ha-text"
                  : "text-ha-text hover:text-ha-text"
              }`}
              data-testid={`tab-location-${tab.id}`}
            >
              {tab.label}
              {value.tab === tab.id && (
                <div className="absolute bottom-0 left-3 right-3 h-[3px] bg-ha-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {(value.tab === "wijken" || value.tab === "radius") && (
        <div ref={cityContainerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted pointer-events-none" />
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => handleCityInput(e.target.value)}
              onFocus={() => { if (hasCityResults && !value.place) setCityOpen(true); }}
              placeholder={t("location.searchCity")}
              className={`w-full min-h-[56px] rounded-[6px] bg-ha-surface border px-11 text-[16px] text-ha-text-muted placeholder:text-ha-text-secondary ${
                value.place ? "border-ha-primary bg-ha-surface/30" : "border-ha-card-border"
              }`}
              data-testid="input-city-search"
            />
            {cityQuery && (
              <button
                onClick={handleCityClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ha-card-border flex items-center justify-center hover:bg-ha-text-muted/30 transition-colors"
                data-testid="button-clear-city"
              >
                <X className="w-3.5 h-3.5 text-ha-text-muted" />
              </button>
            )}
          </div>
          {cityIsLoading && (
            <div className="absolute right-12 top-[26px] -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-ha-primary/30 border-t-ha-primary rounded-full animate-spin" />
            </div>
          )}
          {cityOpen && hasCityResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-ha-card border border-ha-card-border rounded-[6px] shadow-lg max-h-[260px] overflow-y-auto z-30">
              {usingGoogleForCity && googleCitySuggestions.length > 0 ? (
                <>
                  {googleCitySuggestions.map((s) => (
                    <button
                      key={s.place_id}
                      onClick={() => handleGoogleCitySelect(s)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[6px] last:rounded-b-[6px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3"
                      data-testid={`option-place-${s.place_id}`}
                    >
                      <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                      <span>{s.state ? `${s.city_name}, ${s.state}` : s.city_name}</span>
                    </button>
                  ))}
                  <div className="px-4 py-2 text-[11px] text-ha-text-secondary text-right border-t border-ha-card-border" data-testid="text-powered-by-google">
                    {t("cityPicker.poweredByGoogle")}
                  </div>
                </>
              ) : (
                cityGeocoder.results.map((r) => (
                    <button
                      key={r.placeId || `${r.lat}-${r.lng}`}
                      onClick={() => handleGeocoderCitySelect(r)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[6px] last:rounded-b-[6px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3"
                      data-testid={`option-place-${r.placeId}`}
                    >
                      <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                      <span>{r.label}</span>
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
      )}

      {value.tab === "wijken" && value.place && (
        <>
          <div className="inline-flex items-center gap-2 bg-ha-surface text-ha-text-muted font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.place.city_name}
          </div>
        </>
      )}

      {value.tab === "wijken" && value.place && availableDistricts.length > 0 && (
        <DistrictMultiSelect
          districts={availableDistricts}
          selected={value.districts}
          onToggle={toggleDistrict}
        />
      )}

      {value.tab === "radius" && value.place && (
        <>
          <div className="inline-flex items-center gap-2 bg-ha-surface text-ha-text-muted font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.place.city_name}
          </div>
        </>
      )}

      {value.tab === "radius" && (
        <div>
          <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("location.radiusLabel")}</label>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
            <select
              value={value.radiusKm}
              onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) })}
              className="w-full h-[56px] pl-11 pr-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text-muted cursor-pointer appearance-none"
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
            <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("location.workAddress")}</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted pointer-events-none" />
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestInput(e.target.value)}
                onFocus={() => { if (hasDestResults && value.commuteLat == null) setDestOpen(true); }}
                placeholder={t("location.searchAddress")}
                className={`w-full min-h-[56px] rounded-[6px] bg-ha-surface border px-11 text-[16px] text-ha-text-muted placeholder:text-ha-text-secondary ${
                  value.commuteLat != null ? "border-ha-primary bg-ha-surface/30" : "border-ha-card-border"
                }`}
                data-testid="input-commute-destination"
              />
              {destQuery && (
                <button
                  onClick={handleDestClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ha-card-border flex items-center justify-center hover:bg-ha-text-muted/30 transition-colors"
                  data-testid="button-clear-destination"
                >
                  <X className="w-3.5 h-3.5 text-ha-text-muted" />
                </button>
              )}
            </div>
            {destIsLoading && (
              <div className="absolute right-12 top-[calc(24px+26px)] -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-ha-primary/30 border-t-ha-primary rounded-full animate-spin" />
              </div>
            )}
            {destOpen && hasDestResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-ha-card border border-ha-card-border rounded-[6px] shadow-lg max-h-[260px] overflow-y-auto z-30">
                {usingGoogleForDest && googleDestSuggestions.length > 0 ? (
                  <>
                    {googleDestSuggestions.map((s) => (
                      <button
                        key={s.place_id}
                        onClick={() => handleGoogleDestSelect(s)}
                        className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[6px] last:rounded-b-[6px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3"
                        data-testid={`option-dest-${s.place_id}`}
                      >
                        <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                        <span>{s.state ? `${s.city_name}, ${s.state}` : s.display_name}</span>
                      </button>
                    ))}
                    <div className="px-4 py-2 text-[11px] text-ha-text-secondary text-right border-t border-ha-card-border">
                      {t("cityPicker.poweredByGoogle")}
                    </div>
                  </>
                ) : (
                  destGeocoder.results.map((r) => (
                    <button
                      key={r.placeId || `${r.lat}-${r.lng}`}
                      onClick={() => handleGeocoderDestSelect(r)}
                      className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[6px] last:rounded-b-[6px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3"
                      data-testid={`option-dest-${r.placeId}`}
                    >
                      <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                      <span>{r.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {value.commuteLat != null && (
            <div className="inline-flex items-center gap-2 bg-ha-surface text-ha-text-muted font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-destination">
              <MapPin className="w-4 h-4" />
              {value.commuteDestination}
            </div>
          )}

          <div>
            <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("location.transport")}</label>
            <div className="flex gap-2">
              {([
                { id: "auto" as const, icon: Car, label: t("location.transportOptions.car") },
                { id: "ov" as const, icon: Train, label: t("location.transportOptions.transit") },
                { id: "fiets" as const, icon: Bike, label: t("location.transportOptions.bike") },
              ]).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onChange({ ...value, commuteMode: mode.id })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-[6px] text-xs font-medium transition-all ${
                    value.commuteMode === mode.id
                      ? "bg-ha-primary text-white"
                      : "bg-ha-surface text-ha-text hover:bg-ha-card-border"
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
            <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("location.maxCommute")}</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
              <select
                value={value.commuteMinutes}
                onChange={(e) => onChange({ ...value, commuteMinutes: parseInt(e.target.value) })}
                className="w-full h-[56px] pl-11 pr-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text-muted cursor-pointer appearance-none"
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
        <div data-testid="map-preview" style={{ maxHeight: mapMaxHeight || "none" }}>
          <MapView
            lat={hasLocation ? mapLat! : defaultLat}
            lng={hasLocation ? mapLng! : defaultLng}
            zoom={hasLocation ? (value.tab === "radius" ? radiusToZoom(value.radiusKm) : 10) : defaultZoom}
            markers={
              hasLocation
                ? [{ lat: mapLat!, lng: mapLng!, type: value.tab === "reistijd" ? "destination" : "primary" }]
                : []
            }
            circles={
              value.tab === "radius" && value.place
                ? [{ lat: value.place.latitude, lng: value.place.longitude, radiusMeters: value.radiusKm * 1000 }]
                : []
            }
            height="clamp(240px, 35vh, 360px)"
            className="rounded-[6px] overflow-hidden border border-ha-card-border"
          />
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
        className="w-full flex items-center justify-between min-h-[56px] px-4 rounded-[6px] bg-ha-surface border border-ha-card-border text-[15px] text-ha-text-muted hover:bg-ha-surface transition-colors"
        data-testid="button-district-dropdown"
      >
        <span className={selected.length > 0 ? "font-medium" : "text-ha-text-secondary"}>
          {selected.length > 0
            ? t("location.districtSelected", { count: selected.length, label: selected.length === 1 ? t("location.districtSingular") : t("location.districtPlural") })
            : t("location.selectDistricts")}
        </span>
        <ChevronDown className={`w-4 h-4 text-ha-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-ha-card border border-ha-card-border rounded-[6px] shadow-lg max-h-[260px] overflow-y-auto z-30">
          {districts.map((d) => (
            <button
              key={d}
              onClick={() => onToggle(d)}
              className="w-full text-left px-4 py-3 text-[15px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3 transition-colors"
              data-testid={`option-district-${d.toLowerCase().replace(/[\s-]/g, "-")}`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected.includes(d)
                  ? "bg-ha-primary border-ha-primary"
                  : "border-ha-input-border"
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
