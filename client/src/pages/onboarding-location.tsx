import { apiFetch } from "@/lib/api-base";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { MapPin, ChevronLeft, Search, ChevronRight, Navigation, Clock, Car, Train, Bike, Loader2, ChevronDown, Check, X } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { defaultCities, cityDistricts } from "../../../config/market";
import { useTranslation } from "@/i18n";
import { usePlacesAutocomplete, type PlaceSuggestion } from "@/hooks/use-places-autocomplete";
import { useHashSearch } from "@/lib/hash-search";
import { useEmbedded } from "@/hooks/use-embedded";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
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

function RecenterMap({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

type CityEntry = typeof defaultCities[0];

type TabType = "wijken" | "radius" | "reistijd";

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
}

export default function OnboardingLocationPage({ onNext, onBack }: { onNext?: (params: string) => void; onBack?: () => void } = {}) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const { isEmbedded, containerClass } = useEmbedded();
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const initialCity = useMemo(() => {
    const cityName = urlParams.get("city");
    if (cityName) {
      const lat = parseFloat(urlParams.get("lat") || "0") || 0;
      const lng = parseFloat(urlParams.get("lng") || "0") || 0;
      return { name: cityName, lat, lng } as CityEntry;
    }
    return defaultCities[0];
  }, []);

  const initialTab = useMemo((): TabType => {
    const mode = urlParams.get("locationMode");
    if (mode === "radius") return "radius";
    if (mode === "commute") return "reistijd";
    return "wijken";
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [search, setSearch] = useState(initialCity.name);
  const [selectedCity, setSelectedCity] = useState<CityEntry | null>(initialCity);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    urlParams.get("districts")?.split(",").filter(Boolean) || []
  );
  const [radius, setRadius] = useState(urlParams.get("radiusKm") || "5");
  const [travelAddress, setTravelAddress] = useState(urlParams.get("commuteAddress") || "");
  const [travelTime, setTravelTime] = useState(urlParams.get("commuteTime") || "30");
  const [transportMode, setTransportMode] = useState(urlParams.get("commuteMode") || "auto");
  const containerRef = useRef<HTMLDivElement>(null);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const districtDropdownRef = useRef<HTMLDivElement>(null);

  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const places = usePlacesAutocomplete();

  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  const nominatimDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (filtered.length > 0) setShowDropdown(true);
    } catch {
      setNominatimResults([]);
    } finally {
      setNominatimLoading(false);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(e.target as Node)) {
        setDistrictDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const usingGoogle = places.isAvailable;
  const isLoading = places.loading || nominatimLoading;
  const googleSuggestions = places.suggestions;
  const hasSearchResults = (usingGoogle && googleSuggestions.length > 0) || nominatimResults.length > 0;

  const filteredCities = useMemo(() => {
    if (!search.trim()) return defaultCities.slice(0, 8);
    return defaultCities.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [search]);

  const activeCityDistricts = useMemo(() => {
    if (!selectedCity) return [];
    return cityDistricts[selectedCity.name] || [];
  }, [selectedCity]);

  function handleCitySelect(city: CityEntry) {
    setSelectedCity(city);
    setSearch(city.name);
    setShowDropdown(false);
    setSelectedDistricts([]);
    places.clear();
    setNominatimResults([]);
  }

  async function handleGoogleSelect(suggestion: PlaceSuggestion) {
    const details = await places.getDetails(suggestion.place_id);
    const cityName = details?.city_name || suggestion.city_name;
    const lat = details?.latitude || 0;
    const lng = details?.longitude || 0;
    const city: CityEntry = { name: cityName, lat, lng };
    setSelectedCity(city);
    setSearch(cityName);
    setShowDropdown(false);
    setSelectedDistricts([]);
    places.clear();
    setNominatimResults([]);
  }

  function handleNominatimSelect(r: NominatimResult) {
    const a = r.address;
    const cityName = a.city || a.town || a.village || a.municipality || "";
    const city: CityEntry = { name: cityName, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    setSelectedCity(city);
    setSearch(cityName);
    setShowDropdown(false);
    setSelectedDistricts([]);
    places.clear();
    setNominatimResults([]);
  }

  function handleSearchInput(val: string) {
    setSearch(val);
    setSelectedCity(null);
    setSelectedDistricts([]);

    if (nominatimDebounce.current) clearTimeout(nominatimDebounce.current);

    if (places.isAvailable) {
      places.search(val);
      setNominatimResults([]);
    } else {
      nominatimDebounce.current = setTimeout(() => searchNominatim(val), 350);
    }

    if (val.trim().length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(true);
    }
  }

  function toggleDistrict(district: string) {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district]
    );
  }

  useEffect(() => {
    const cityName = selectedCity?.name || (activeTab === "reistijd" ? travelAddress : "");
    if (!cityName) {
      setEstimate(null);
      return;
    }
    setEstimateLoading(true);
    const p = new URLSearchParams({ city: cityName });
    apiFetch(`/api/estimate?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : { perWeekEstimate: 0 }))
      .then((data) => setEstimate(data.perWeekEstimate ?? 0))
      .catch(() => setEstimate(0))
      .finally(() => setEstimateLoading(false));
  }, [selectedCity, activeTab, travelAddress]);

  function handleNext() {
    let params: URLSearchParams;
    if (activeTab === "reistijd") {
      if (!travelAddress) return;
      params = new URLSearchParams({ city: travelAddress });
      params.set("locationMode", "commute");
      params.set("commuteAddress", travelAddress);
      params.set("commuteTime", travelTime);
      params.set("commuteMode", transportMode);
    } else {
      if (!selectedCity) return;
      params = new URLSearchParams({ city: selectedCity.name });
      if (selectedCity.lat) params.set("lat", String(selectedCity.lat));
      if (selectedCity.lng) params.set("lng", String(selectedCity.lng));
      if (activeTab === "wijken" && selectedDistricts.length > 0) {
        params.set("locationMode", "districts");
        params.set("districts", selectedDistricts.join(","));
      } else if (activeTab === "radius") {
        params.set("locationMode", "radius");
        params.set("radiusKm", radius);
      } else {
        params.set("locationMode", "city");
      }
    }
    if (onNext) {
      onNext(params.toString());
    } else {
      navigate(`/signup?${params.toString()}`);
    }
  }

  const canProceed =
    activeTab === "reistijd" ? !!travelAddress : !!selectedCity;

  const tabs: { id: TabType; label: string }[] = [
    { id: "wijken", label: t("location.tabs.districts") },
    { id: "radius", label: t("location.tabs.radius") },
    { id: "reistijd", label: t("location.tabs.commute") },
  ];

  const showGoogleResults = usingGoogle && googleSuggestions.length > 0 && !selectedCity;
  const showNominatimFallback = !showGoogleResults && nominatimResults.length > 0 && !selectedCity;
  const showStaticDropdown = !showGoogleResults && !showNominatimFallback && !selectedCity && filteredCities.length > 0;

  return (
    <div className="min-h-screen bg-ha-card flex flex-col">
      {!isEmbedded && (
        <header className="w-full bg-ha-card sticky top-0 z-20 border-b border-ha-card-border">
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <button
              onClick={() => onBack ? onBack() : navigate("/onboarding/intro")}
              className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-back-landing"
            >
              <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
            </button>
            <HousAlertLogo size={28} />
          </div>
        </header>
      )}

      <div className={`${containerClass} mx-auto w-full px-5 ${isEmbedded ? "pt-2 pb-0" : "pt-4 pb-1"}`}>
        <div className="flex items-center justify-center gap-2 py-2">
          {(isEmbedded ? [1, 2] : [1, 2, 3, 4]).map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step <= 1 ? "bg-ha-primary" : "bg-ha-input-border"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 ${isEmbedded ? "pb-4 pt-1" : "pb-8 pt-3"}`}>
        {!isEmbedded && (
          <h1 className="text-[24px] font-medium text-ha-text leading-[1.15] tracking-[-0.02em] mb-5" data-testid="text-location-title">
            {t("onboardingLocation.title")}
          </h1>
        )}

        <div className={`bg-ha-card rounded-[6px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] ${isEmbedded ? "p-4" : "p-6"}`}>
          <div className="flex border-b border-ha-card-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setDistrictDropdownOpen(false); }}
                className={`flex-1 py-3.5 text-[15px] font-medium text-center transition-colors relative ${
                  activeTab === tab.id
                    ? "text-ha-text"
                    : "text-ha-text-secondary"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-ha-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className={isEmbedded ? "pt-3" : "pt-5"}>
            {activeTab === "wijken" && (
              <div className="space-y-0">
                <div className="relative" ref={containerRef}>
                  <div
                    className="flex items-center gap-3 h-[44px] px-4 rounded-[6px] border border-transparent bg-ha-surface cursor-text focus-within:ring-2 focus-within:ring-ha-primary focus-within:border-ha-primary focus-within:bg-ha-card transition-all"
                    onClick={() => {
                      const input = document.getElementById("city-search-input");
                      input?.focus();
                    }}
                  >
                    <Search className="w-5 h-5 text-ha-text-muted flex-shrink-0" />
                    <input
                      id="city-search-input"
                      type="text"
                      placeholder={t("location.searchPlaceholder")}
                      value={search}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => setShowDropdown(true)}
                      className="flex-1 text-[15px] font-medium text-ha-text-muted placeholder:text-ha-text-secondary placeholder:font-normal bg-transparent border-none outline-none"
                      data-testid="input-city-search"
                    />
                    {isLoading && (
                      <div className="w-4 h-4 border-2 border-ha-primary/30 border-t-ha-primary rounded-full animate-spin" />
                    )}
                    {selectedCity && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCity(null);
                          setSearch("");
                          setSelectedDistricts([]);
                          places.clear();
                          setNominatimResults([]);
                        }}
                        className={isEmbedded ? "w-6 h-6 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-input-border" : "text-xs text-ha-text-muted hover:text-ha-text-muted"}
                        data-testid="button-clear-city"
                      >
                        {isEmbedded ? <X className="w-3.5 h-3.5 text-ha-text-secondary" /> : t("onboardingLocation.clear")}
                      </button>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-ha-card rounded-[6px] shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-10 max-h-64 overflow-y-auto">
                      {showGoogleResults && googleSuggestions.map((s) => (
                        <button
                          key={s.place_id}
                          onClick={() => handleGoogleSelect(s)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                          data-testid={`option-city-${s.city_name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                          <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">
                            {s.state ? `${s.city_name}, ${s.state}` : s.city_name}
                          </span>
                          <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                        </button>
                      ))}
                      {showGoogleResults && (
                        <div className="px-4 py-2 text-[11px] text-ha-text-secondary text-right">
                          {t("cityPicker.poweredByGoogle")}
                        </div>
                      )}
                      {showNominatimFallback && nominatimResults.map((r) => {
                        const a = r.address;
                        const label = a.city || a.town || a.village || a.municipality || "";
                        return (
                          <button
                            key={r.place_id}
                            onClick={() => handleNominatimSelect(r)}
                            className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                            data-testid={`option-city-${label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                            <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">
                              {a.state ? `${label}, ${a.state}` : label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                          </button>
                        );
                      })}
                      {showStaticDropdown && filteredCities.map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                          data-testid={`option-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                          <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">{city.name}</span>
                          <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCity && activeCityDistricts.length > 0 && (
                  <div className={isEmbedded ? "pt-3 pb-2" : "py-5 border-b border-ha-card-border"}>
                    <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.districtsLabel")} <span className="font-normal text-[13px] text-ha-text-muted">{t("onboardingLocation.optional")}</span></label>
                    <div className="relative" ref={districtDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setDistrictDropdownOpen((v) => !v)}
                        className="w-full flex items-center justify-between h-[44px] px-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-left focus:bg-ha-card"
                        data-testid="dropdown-districts-trigger"
                      >
                        <span className={selectedDistricts.length > 0 ? "text-ha-text" : "text-ha-text-secondary font-normal"}>
                          {selectedDistricts.length > 0
                            ? selectedDistricts.length === 1
                              ? selectedDistricts[0]
                              : `${selectedDistricts.length} ${t("onboardingLocation.districtsSelected")}`
                            : t("onboardingLocation.selectDistricts")}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-ha-text-muted transition-transform ${districtDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {selectedDistricts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedDistricts.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ha-primary/10 text-ha-primary text-[13px] font-medium"
                            >
                              {d}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleDistrict(d); }}
                                className="hover:text-ha-primary-hover"
                                data-testid={`remove-district-${d.toLowerCase().replace(/[\s-]/g, "-")}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {districtDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-ha-card rounded-[6px] shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-[9999] max-h-56 overflow-y-auto">
                          {activeCityDistricts.map((district) => (
                            <button
                              key={district}
                              type="button"
                              onClick={() => toggleDistrict(district)}
                              className="w-full flex items-center gap-3 py-3 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0 text-left"
                              data-testid={`option-district-${district.toLowerCase().replace(/[\s-]/g, "-")}`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selectedDistricts.includes(district)
                                  ? "bg-ha-primary border-ha-primary"
                                  : "border-ha-input-border"
                              }`}>
                                {selectedDistricts.includes(district) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-[15px] font-medium text-ha-text-muted">{district}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedCity && selectedCity.lat !== 0 && selectedCity.lng !== 0 && !districtDropdownOpen && (
                  <div className={isEmbedded ? "pt-2 pb-1" : "py-5 border-b border-ha-card-border"}>
                    <div className="rounded-[6px] overflow-hidden" data-testid="card-map-preview" style={{ height: "180px" }}>
                      <MapContainer
                        center={[selectedCity.lat, selectedCity.lng]}
                        zoom={12}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={false}
                        attributionControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[selectedCity.lat, selectedCity.lng]} icon={MARKER_ICON} />
                        <RecenterMap lat={selectedCity.lat} lng={selectedCity.lng} zoom={12} />
                      </MapContainer>
                    </div>
                  </div>
                )}

                {!selectedCity && (
                  <div className="py-5">
                    <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.popularCities")}</label>
                    <div className="flex flex-wrap gap-2">
                      {defaultCities.slice(0, 6).map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="px-4 py-2.5 rounded-full bg-ha-surface text-sm font-medium text-ha-text-muted hover:bg-ha-card-hover transition-colors"
                          data-testid={`chip-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          {city.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "radius" && (
              <div className="space-y-0">
                <div className="relative" ref={containerRef}>
                  <div
                    className="flex items-center gap-3 h-[44px] px-4 rounded-[6px] border border-transparent bg-ha-surface cursor-text focus-within:ring-2 focus-within:ring-ha-primary focus-within:border-ha-primary focus-within:bg-ha-card transition-all"
                    onClick={() => {
                      const input = document.getElementById("radius-city-input");
                      input?.focus();
                    }}
                  >
                    <Search className="w-5 h-5 text-ha-text-muted flex-shrink-0" />
                    <input
                      id="radius-city-input"
                      type="text"
                      placeholder={t("location.searchPlaceholder")}
                      value={search}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => setShowDropdown(true)}
                      className="flex-1 text-[15px] font-medium text-ha-text-muted placeholder:text-ha-text-secondary placeholder:font-normal bg-transparent border-none outline-none"
                      data-testid="input-city-search"
                    />
                    {isLoading && (
                      <div className="w-4 h-4 border-2 border-ha-primary/30 border-t-ha-primary rounded-full animate-spin" />
                    )}
                    {selectedCity && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCity(null);
                          setSearch("");
                          places.clear();
                          setNominatimResults([]);
                        }}
                        className={isEmbedded ? "w-6 h-6 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-input-border" : "text-xs text-ha-text-muted hover:text-ha-text-muted"}
                        data-testid="button-clear-city"
                      >
                        {isEmbedded ? <X className="w-3.5 h-3.5 text-ha-text-secondary" /> : t("onboardingLocation.clear")}
                      </button>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-ha-card rounded-[6px] shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-10 max-h-64 overflow-y-auto">
                      {showGoogleResults && googleSuggestions.map((s) => (
                        <button
                          key={s.place_id}
                          onClick={() => handleGoogleSelect(s)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                          data-testid={`option-city-${s.city_name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                          <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">
                            {s.state ? `${s.city_name}, ${s.state}` : s.city_name}
                          </span>
                          <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                        </button>
                      ))}
                      {showGoogleResults && (
                        <div className="px-4 py-2 text-[11px] text-ha-text-secondary text-right">
                          {t("cityPicker.poweredByGoogle")}
                        </div>
                      )}
                      {showNominatimFallback && nominatimResults.map((r) => {
                        const a = r.address;
                        const label = a.city || a.town || a.village || a.municipality || "";
                        return (
                          <button
                            key={r.place_id}
                            onClick={() => handleNominatimSelect(r)}
                            className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                            data-testid={`option-city-${label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                            <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">
                              {a.state ? `${label}, ${a.state}` : label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                          </button>
                        );
                      })}
                      {showStaticDropdown && filteredCities.map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                          data-testid={`option-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-ha-text-muted flex-shrink-0" />
                          <span className="text-[15px] font-medium text-ha-text-muted flex-1 text-left">{city.name}</span>
                          <ChevronRight className="w-4 h-4 text-ha-text-muted" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.radiusLabel")}</label>
                  <div className="relative">
                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
                    <select
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text-muted focus:bg-ha-card cursor-pointer appearance-none"
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

                {selectedCity && selectedCity.lat !== 0 && selectedCity.lng !== 0 && (
                  <div className="py-5">
                    <div className="rounded-[6px] overflow-hidden" data-testid="card-map-radius" style={{ height: "180px" }}>
                      <MapContainer
                        center={[selectedCity.lat, selectedCity.lng]}
                        zoom={12}
                        style={{ height: "100%", width: "100%" }}
                        zoomControl={false}
                        attributionControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        touchZoom={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[selectedCity.lat, selectedCity.lng]} icon={MARKER_ICON} />
                        <Circle
                          center={[selectedCity.lat, selectedCity.lng]}
                          radius={parseInt(radius) * 1000}
                          pathOptions={{ color: "rgb(var(--ha-primary))", fillColor: "rgb(var(--ha-primary))", fillOpacity: 0.1, weight: 2 }}
                        />
                        <RecenterMap lat={selectedCity.lat} lng={selectedCity.lng} zoom={parseInt(radius) <= 5 ? 12 : parseInt(radius) <= 15 ? 10 : 9} />
                      </MapContainer>
                    </div>
                    <p className="text-sm font-medium text-ha-text-secondary text-center mt-2">{selectedCity.name} +{radius} km</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reistijd" && (
              <div className="space-y-0">
                <div>
                  <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.destinationLabel")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
                    <input
                      type="text"
                      placeholder={t("onboardingLocation.destinationPlaceholder")}
                      value={travelAddress}
                      onChange={(e) => setTravelAddress(e.target.value)}
                      className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text-muted placeholder:text-ha-text-secondary placeholder:font-normal focus:bg-ha-card"
                      data-testid="input-travel-address"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.maxTravelTime")}</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
                    <select
                      value={travelTime}
                      onChange={(e) => setTravelTime(e.target.value)}
                      className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text-muted focus:bg-ha-card cursor-pointer appearance-none"
                      data-testid="select-travel-time"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-[16px] font-medium text-ha-text mb-3 block">{t("onboardingLocation.transportLabel")}</label>
                  <div className="flex gap-2">
                    {[
                      { id: "auto", icon: Car, label: t("onboardingLocation.auto") },
                      { id: "ov", icon: Train, label: t("onboardingLocation.ov") },
                      { id: "fiets", icon: Bike, label: t("onboardingLocation.fiets") },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setTransportMode(mode.id)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all ${
                          transportMode === mode.id
                            ? "bg-ha-primary text-white"
                            : "bg-ha-surface text-ha-text hover:bg-ha-card-hover"
                        }`}
                        data-testid={`button-transport-${mode.id}`}
                      >
                        <mode.icon className="w-5 h-5" />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {travelAddress && (
                  <div className="py-5">
                    <div className="rounded-[6px] overflow-hidden bg-ha-surface" data-testid="card-map-travel">
                      <div className="h-36 flex items-center justify-center">
                        <div className="text-center">
                          <Clock className="w-7 h-7 text-ha-primary mx-auto mb-1.5" />
                          <p className="text-sm font-medium text-ha-text">{t("onboardingLocation.travelTimePreview", { time: travelTime })}</p>
                          <p className="text-xs text-ha-text-muted mt-0.5">{t("onboardingLocation.fromAddress", { address: travelAddress })}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {isEmbedded ? (
            <>
              <Button
                size="lg"
                className="w-full h-[48px] rounded-[6px] text-[16px] font-medium bg-ha-primary hover:bg-ha-primary-hover shadow-none mt-3"
                disabled={!canProceed}
                onClick={handleNext}
                data-testid="button-next-step"
              >
                {t("onboardingLocation.nextStep")}
              </Button>

              {(selectedCity || (activeTab === "reistijd" && travelAddress)) && !districtDropdownOpen && (
                <div className="mt-3">
                  <div className="bg-ha-primary-light rounded-lg p-3" data-testid="card-estimate-preview">
                    {estimateLoading ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-ha-primary animate-spin" />
                        <span className="text-sm text-ha-text-muted">{t("onboardingLocation.estimateLoading")}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-ha-text-muted leading-relaxed">
                          {t("onboardingLocation.estimateText", getMatchEstimateRange(estimate ?? 0))}
                        </p>
                        {estimate !== null && getMatchEstimateRange(estimate).low <= 3 && (
                          <p className="text-[13px] text-ha-text-secondary mt-1">
                            {t("onboardingLocation.lowMatchHint")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {(selectedCity || (activeTab === "reistijd" && travelAddress)) && !districtDropdownOpen && (
                <div className="pt-5 mt-1">
                  <div className="bg-ha-primary-light rounded-lg p-4 mb-6" data-testid="card-estimate-preview">
                    {estimateLoading ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-ha-primary animate-spin" />
                        <span className="text-sm text-ha-text-muted">{t("onboardingLocation.estimateLoading")}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-ha-text-muted leading-relaxed">
                          {t("onboardingLocation.estimateText", getMatchEstimateRange(estimate ?? 0))}
                        </p>
                        {estimate !== null && getMatchEstimateRange(estimate).low <= 3 && (
                          <p className="text-[13px] text-ha-text-secondary mt-1.5">
                            {t("onboardingLocation.lowMatchHint")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={`bg-ha-surface rounded-[6px] p-4 mt-4 mb-2 ${districtDropdownOpen ? "hidden" : ""}`} data-testid="info-helper-box">
                <p className="text-[13px] text-ha-text-secondary leading-[1.5]">
                  {t("onboardingLocation.helperText")}
                </p>
              </div>

              <Button
                size="lg"
                className="w-full h-[56px] rounded-[6px] text-[16px] font-medium bg-ha-primary hover:bg-ha-primary-hover shadow-none mt-2"
                disabled={!canProceed}
                onClick={handleNext}
                data-testid="button-next-step"
              >
                {t("onboardingLocation.nextStep")}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
