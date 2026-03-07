import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, MapPin, ChevronLeft, Search, ChevronRight, Navigation, Clock, Car, Train, Bike, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultCities, cityDistricts } from "../../../config/market";

type CityEntry = typeof defaultCities[0];

type TabType = "wijken" | "radius" | "reistijd";

export default function OnboardingLocationPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("wijken");
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityEntry | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [radius, setRadius] = useState("5");
  const [travelAddress, setTravelAddress] = useState("");
  const [travelTime, setTravelTime] = useState("30");
  const [transportMode, setTransportMode] = useState("auto");

  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

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
    fetch(`/api/estimate?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : { perWeekEstimate: 0 }))
      .then((data) => setEstimate(data.perWeekEstimate ?? 0))
      .catch(() => setEstimate(0))
      .finally(() => setEstimateLoading(false));
  }, [selectedCity, activeTab, travelAddress]);

  function handleNext() {
    if (activeTab === "reistijd") {
      if (!travelAddress) return;
      const params = new URLSearchParams({ city: travelAddress });
      navigate(`/onboarding/filters?${params.toString()}`);
      return;
    }
    if (!selectedCity) return;
    const params = new URLSearchParams({ city: selectedCity.name });
    navigate(`/onboarding/filters?${params.toString()}`);
  }

  const canProceed =
    activeTab === "reistijd" ? !!travelAddress : !!selectedCity;

  const tabs: { id: TabType; label: string }[] = [
    { id: "wijken", label: "Wijken" },
    { id: "radius", label: "Radius" },
    { id: "reistijd", label: "Reistijd" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors"
            data-testid="button-back-landing"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#673DE5] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111827] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  step === 1 ? "w-full bg-[#673DE5]" : "w-0"
                }`}
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#6B7280] mt-2" data-testid="text-step-indicator">Stap 1 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-4">
        <h1 className="text-[32px] font-[800] text-[#111827] leading-[1.1] tracking-[-0.03em] mb-8" data-testid="text-location-title">
          Waar zoek je een woning?
        </h1>

        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <div className="flex border-b border-[#E5E7EB]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 pb-3 text-sm font-semibold text-center transition-colors relative ${
                  activeTab === tab.id
                    ? "text-[#673DE5]"
                    : "text-[#6B7280] hover:text-[#111827]"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-3 right-3 h-[3px] bg-[#673DE5] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="pt-5">
            {activeTab === "wijken" && (
              <div className="space-y-0">
                <div className="relative">
                  <div
                    className="flex items-center gap-3 h-[52px] px-4 rounded-xl bg-[#F3F4F6] cursor-text focus-within:ring-2 focus-within:ring-[#673DE5]/15 focus-within:bg-[#F8FAFC] transition-all"
                    onClick={() => {
                      const input = document.getElementById("city-search-input");
                      input?.focus();
                    }}
                  >
                    <Search className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                    <input
                      id="city-search-input"
                      type="text"
                      placeholder="Zoek een stad..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="flex-1 text-[15px] font-medium text-[#111827] placeholder:text-[#6B7280] placeholder:font-normal bg-transparent border-none outline-none"
                      data-testid="input-city-search"
                    />
                    {selectedCity && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCity(null);
                          setSearch("");
                          setSelectedDistricts([]);
                        }}
                        className="text-xs text-[#6B7280] hover:text-[#111827]"
                        data-testid="button-clear-city"
                      >
                        Wissen
                      </button>
                    )}
                  </div>

                  {showDropdown && filteredCities.length > 0 && !selectedCity && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-10 max-h-64 overflow-y-auto">
                      {filteredCities.map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-[#F3F4F6] transition-colors border-b border-[#E5E7EB] last:border-b-0"
                          data-testid={`option-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-[#6B7280] flex-shrink-0" />
                          <span className="text-[15px] font-medium text-[#111827] flex-1 text-left">{city.name}</span>
                          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedCity && activeCityDistricts.length > 0 && (
                  <div className="py-5 border-b border-[#E5E7EB]">
                    <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Wijken <span className="font-normal text-[13px] text-[#6B7280]">(optioneel)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {activeCityDistricts.map((district) => (
                        <button
                          key={district}
                          onClick={() => toggleDistrict(district)}
                          className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                            selectedDistricts.includes(district)
                              ? "bg-[#673DE5] text-white"
                              : "bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]"
                          }`}
                          data-testid={`chip-district-${district.toLowerCase().replace(/[\s-]/g, "-")}`}
                        >
                          {district}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCity && (
                  <div className="py-5 border-b border-[#E5E7EB]">
                    <div className="rounded-2xl overflow-hidden bg-[#F3F4F6]" data-testid="card-map-preview">
                      <div className="h-36 flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="w-7 h-7 text-[#673DE5] mx-auto mb-1.5" />
                          <p className="text-base font-bold text-[#111827]">{selectedCity.name}</p>
                          {selectedDistricts.length > 0 && (
                            <p className="text-xs text-[#6B7280] mt-0.5">{selectedDistricts.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!selectedCity && (
                  <div className="py-5">
                    <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Populaire steden</label>
                    <div className="flex flex-wrap gap-2">
                      {defaultCities.slice(0, 6).map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="px-4 py-2.5 rounded-full bg-[#F3F4F6] text-sm font-medium text-[#111827] hover:bg-[#E5E7EB] transition-colors"
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
                <div className="relative">
                  <div
                    className="flex items-center gap-3 h-[52px] px-4 rounded-xl bg-[#F3F4F6] cursor-text focus-within:ring-2 focus-within:ring-[#673DE5]/15 focus-within:bg-[#F8FAFC] transition-all"
                    onClick={() => {
                      const input = document.getElementById("radius-city-input");
                      input?.focus();
                    }}
                  >
                    <Search className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                    <input
                      id="radius-city-input"
                      type="text"
                      placeholder="Zoek een stad..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      className="flex-1 text-[15px] font-medium text-[#111827] placeholder:text-[#6B7280] placeholder:font-normal bg-transparent border-none outline-none"
                      data-testid="input-city-search"
                    />
                    {selectedCity && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCity(null);
                          setSearch("");
                        }}
                        className="text-xs text-[#6B7280] hover:text-[#111827]"
                        data-testid="button-clear-city"
                      >
                        Wissen
                      </button>
                    )}
                  </div>

                  {showDropdown && filteredCities.length > 0 && !selectedCity && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] overflow-hidden z-10 max-h-64 overflow-y-auto">
                      {filteredCities.map((city) => (
                        <button
                          key={city.name}
                          onClick={() => handleCitySelect(city)}
                          className="w-full flex items-center gap-3 py-4 px-4 hover:bg-[#F3F4F6] transition-colors border-b border-[#E5E7EB] last:border-b-0"
                          data-testid={`option-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          <MapPin className="w-4.5 h-4.5 text-[#6B7280] flex-shrink-0" />
                          <span className="text-[15px] font-medium text-[#111827] flex-1 text-left">{city.name}</span>
                          <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Straal</label>
                  <div className="relative">
                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <select
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] cursor-pointer appearance-none transition-all"
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

                {selectedCity && (
                  <div className="py-5">
                    <div className="rounded-2xl overflow-hidden bg-[#F3F4F6]" data-testid="card-map-radius">
                      <div className="h-36 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#673DE5]/40 flex items-center justify-center mx-auto mb-1">
                            <Navigation className="w-6 h-6 text-[#673DE5]" />
                          </div>
                          <p className="text-sm font-bold text-[#111827]">{selectedCity.name} +{radius} km</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reistijd" && (
              <div className="space-y-0">
                <div>
                  <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Werkadres / bestemming</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <input
                      type="text"
                      placeholder="bijv. Berlin Hauptbahnhof"
                      value={travelAddress}
                      onChange={(e) => setTravelAddress(e.target.value)}
                      className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#6B7280] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] transition-all"
                      data-testid="input-travel-address"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Maximale reistijd</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                    <select
                      value={travelTime}
                      onChange={(e) => setTravelTime(e.target.value)}
                      className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] cursor-pointer appearance-none transition-all"
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
                  <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Vervoersmiddel</label>
                  <div className="flex gap-2">
                    {[
                      { id: "auto", icon: Car, label: "Auto" },
                      { id: "ov", icon: Train, label: "OV" },
                      { id: "fiets", icon: Bike, label: "Fiets" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setTransportMode(mode.id)}
                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                          transportMode === mode.id
                            ? "bg-[#673DE5] text-white"
                            : "bg-[#F3F4F6] text-[#111827] hover:bg-[#E5E7EB]"
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
                    <div className="rounded-2xl overflow-hidden bg-[#F3F4F6]" data-testid="card-map-travel">
                      <div className="h-36 flex items-center justify-center">
                        <div className="text-center">
                          <Clock className="w-7 h-7 text-[#673DE5] mx-auto mb-1.5" />
                          <p className="text-sm font-bold text-[#111827]">{travelTime} min reistijd</p>
                          <p className="text-xs text-[#6B7280] mt-0.5">vanaf {travelAddress}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {(selectedCity || (activeTab === "reistijd" && travelAddress)) && (
            <div className="pt-5 mt-1">
              <div className="bg-[#DCDBFA] rounded-2xl p-4 mb-6" data-testid="card-estimate-preview">
                {estimateLoading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-[#673DE5] animate-spin" />
                    <span className="text-sm text-[#6B7280]">Schatting laden...</span>
                  </div>
                ) : (
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Met deze zoekopdracht kun je ongeveer{" "}
                    <span className="font-bold text-[#111827]">{estimate ?? 0} matches</span>{" "}
                    per week verwachten.
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="w-full h-[56px] rounded-xl text-[16px] font-semibold bg-[#673DE5] hover:bg-[#5B30D6] shadow-none mt-2"
            disabled={!canProceed}
            onClick={handleNext}
            data-testid="button-next-step"
          >
            Volgende stap
          </Button>
        </div>
      </main>
    </div>
  );
}
