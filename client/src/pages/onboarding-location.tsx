import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, MapPin, ChevronLeft, Search, Navigation, Clock, Car, Train, Bike, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DUTCH_CITIES = [
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "Rotterdam", lat: 51.9225, lng: 4.4792 },
  { name: "Den Haag", lat: 52.0705, lng: 4.3007 },
  { name: "Utrecht", lat: 52.0907, lng: 5.1214 },
  { name: "Eindhoven", lat: 51.4416, lng: 5.4697 },
  { name: "Groningen", lat: 53.2194, lng: 6.5665 },
  { name: "Tilburg", lat: 51.5555, lng: 5.0913 },
  { name: "Almere", lat: 52.3508, lng: 5.2647 },
  { name: "Breda", lat: 51.5719, lng: 4.7683 },
  { name: "Nijmegen", lat: 51.8426, lng: 5.8527 },
  { name: "Arnhem", lat: 51.9851, lng: 5.8987 },
  { name: "Haarlem", lat: 52.3874, lng: 4.6462 },
  { name: "Enschede", lat: 52.2215, lng: 6.8937 },
  { name: "Amersfoort", lat: 52.1561, lng: 5.3878 },
  { name: "Apeldoorn", lat: 52.2112, lng: 5.9699 },
  { name: "Zaanstad", lat: 52.4575, lng: 4.8127 },
  { name: "Haarlemmermeer", lat: 52.3025, lng: 4.6903 },
  { name: "Den Bosch", lat: 51.6998, lng: 5.3049 },
  { name: "Leiden", lat: 52.1601, lng: 4.4970 },
  { name: "Maastricht", lat: 50.8514, lng: 5.6910 },
  { name: "Dordrecht", lat: 51.8133, lng: 4.6901 },
  { name: "Zoetermeer", lat: 52.0575, lng: 4.4931 },
  { name: "Zwolle", lat: 52.5168, lng: 6.0830 },
  { name: "Deventer", lat: 52.2554, lng: 6.1638 },
  { name: "Delft", lat: 52.0116, lng: 4.3571 },
  { name: "Leeuwarden", lat: 53.2012, lng: 5.7999 },
  { name: "Alkmaar", lat: 52.6324, lng: 4.7534 },
  { name: "Emmen", lat: 52.7792, lng: 6.8958 },
  { name: "Venlo", lat: 51.3704, lng: 6.1724 },
  { name: "Hilversum", lat: 52.2292, lng: 5.1769 },
  { name: "Heerlen", lat: 50.8883, lng: 5.9814 },
  { name: "Oss", lat: 51.7652, lng: 5.5183 },
  { name: "Sittard", lat: 51.0005, lng: 5.8684 },
  { name: "Roosendaal", lat: 51.5307, lng: 4.4571 },
  { name: "Helmond", lat: 51.4792, lng: 5.6614 },
  { name: "Purmerend", lat: 52.5054, lng: 4.9598 },
  { name: "Schiedam", lat: 51.9197, lng: 4.3889 },
  { name: "Vlaardingen", lat: 51.9127, lng: 4.3419 },
  { name: "Gouda", lat: 52.0115, lng: 4.7106 },
  { name: "Lelystad", lat: 52.5185, lng: 5.4714 },
];

const DISTRICTS: Record<string, string[]> = {
  Amsterdam: ["Centrum", "West", "Oost", "Zuid", "Noord", "Nieuw-West", "Zuidoost", "De Pijp", "Jordaan", "Oud-West"],
  Rotterdam: ["Centrum", "Kralingen", "Delfshaven", "Noord", "Feijenoord", "Charlois", "Hillegersberg", "Overschie"],
  "Den Haag": ["Centrum", "Scheveningen", "Loosduinen", "Laak", "Escamp", "Segbroek", "Haagse Hout"],
  Utrecht: ["Centrum", "Oost", "West", "Zuid", "Noord", "Leidsche Rijn", "Vleuten-De Meern"],
  Eindhoven: ["Centrum", "Woensel", "Stratum", "Tongelre", "Gestel", "Strijp"],
};

type TabType = "wijken" | "radius" | "reistijd";

function EstimateBox({ city, loading, estimate }: { city: string; loading: boolean; estimate: number | null }) {
  if (!city) return null;
  return (
    <div className="bg-[#EBF2FE] rounded-2xl p-5" data-testid="card-estimate-preview">
      {loading ? (
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#1D6FE8] animate-spin" />
          <span className="text-sm text-[#6B7280]">Schatting laden...</span>
        </div>
      ) : (
        <p className="text-sm text-[#6B7280] leading-relaxed">
          Met deze zoekopdracht kun je ongeveer{" "}
          <span className="font-bold text-[#0B1F44]">{estimate ?? 0} matches</span>{" "}
          per week verwachten.
        </p>
      )}
    </div>
  );
}

function CitySearch({
  search,
  setSearch,
  selectedCity,
  onCitySelect,
  showDropdown,
  setShowDropdown,
  filteredCities,
}: {
  search: string;
  setSearch: (v: string) => void;
  selectedCity: { name: string } | null;
  onCitySelect: (city: typeof DUTCH_CITIES[0]) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  filteredCities: typeof DUTCH_CITIES;
}) {
  return (
    <div className="relative">
      <Label className="text-sm font-semibold text-[#0B1F44] mb-2 block">Stad</Label>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
        <Input
          type="text"
          placeholder="Zoek een stad..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="h-13 pl-11 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
          data-testid="input-city-search"
        />
      </div>
      {showDropdown && filteredCities.length > 0 && !selectedCity && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E5E7EB] rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.08)] overflow-hidden z-10 max-h-64 overflow-y-auto">
          {filteredCities.map((city) => (
            <button
              key={city.name}
              onClick={() => onCitySelect(city)}
              className="w-full px-4 py-3.5 text-left flex items-center gap-3 hover:bg-[#F2F4F7] transition-colors"
              data-testid={`option-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
            >
              <MapPin className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="text-[#0B1F44] font-medium text-[15px]">{city.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OnboardingLocationPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("wijken");
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<typeof DUTCH_CITIES[0] | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [radius, setRadius] = useState("5");
  const [travelAddress, setTravelAddress] = useState("");
  const [travelTime, setTravelTime] = useState("30");
  const [transportMode, setTransportMode] = useState("auto");

  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const filteredCities = useMemo(() => {
    if (!search.trim()) return DUTCH_CITIES.slice(0, 8);
    return DUTCH_CITIES.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [search]);

  const cityDistricts = useMemo(() => {
    if (!selectedCity) return [];
    return DISTRICTS[selectedCity.name] || [];
  }, [selectedCity]);

  function handleCitySelect(city: typeof DUTCH_CITIES[0]) {
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
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#F2F4F7] transition-colors"
            data-testid="button-back-landing"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1D6FE8] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#0B1F44] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  step === 1 ? "w-full bg-[#1D6FE8]" : "w-0"
                }`}
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#6B7280] mt-2" data-testid="text-step-indicator">Stap 1 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32 pt-4">
        <h1 className="text-[26px] font-extrabold text-[#0B1F44] leading-tight mb-6" data-testid="text-location-title">
          Waar zoek je een woning?
        </h1>

        <div className="bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden mb-5">
          <div className="flex border-b border-[#E5E7EB]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3.5 text-sm font-semibold text-center transition-colors relative ${
                  activeTab === tab.id
                    ? "text-[#1D6FE8]"
                    : "text-[#6B7280] hover:text-[#0B1F44]"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-3 right-3 h-[3px] bg-[#1D6FE8] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === "wijken" && (
              <div className="space-y-5">
                <CitySearch
                  search={search}
                  setSearch={setSearch}
                  selectedCity={selectedCity}
                  onCitySelect={handleCitySelect}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  filteredCities={filteredCities}
                />

                {selectedCity && cityDistricts.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-[#0B1F44] mb-3 block">Wijken (optioneel)</Label>
                    <div className="flex flex-wrap gap-2">
                      {cityDistricts.map((district) => (
                        <button
                          key={district}
                          onClick={() => toggleDistrict(district)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                            selectedDistricts.includes(district)
                              ? "bg-[#1D6FE8] text-white"
                              : "bg-[#F2F4F7] text-[#0B1F44] hover:bg-[#E5E7EB]"
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
                  <div className="rounded-2xl overflow-hidden bg-[#F2F4F7]" data-testid="card-map-preview">
                    <div className="h-40 flex items-center justify-center relative">
                      <div className="text-center">
                        <MapPin className="w-8 h-8 text-[#1D6FE8] mx-auto mb-1.5" />
                        <p className="text-base font-bold text-[#0B1F44]">{selectedCity.name}</p>
                        {selectedDistricts.length > 0 && (
                          <p className="text-xs text-[#6B7280] mt-0.5">{selectedDistricts.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "radius" && (
              <div className="space-y-5">
                <CitySearch
                  search={search}
                  setSearch={setSearch}
                  selectedCity={selectedCity}
                  onCitySelect={handleCitySelect}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  filteredCities={filteredCities}
                />

                <div>
                  <Label className="text-sm font-semibold text-[#0B1F44] mb-2 block">Straal</Label>
                  <Select value={radius} onValueChange={setRadius}>
                    <SelectTrigger
                      className="h-13 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8]"
                      data-testid="select-radius"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 km</SelectItem>
                      <SelectItem value="5">5 km</SelectItem>
                      <SelectItem value="10">10 km</SelectItem>
                      <SelectItem value="15">15 km</SelectItem>
                      <SelectItem value="25">25 km</SelectItem>
                      <SelectItem value="50">50 km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedCity && (
                  <div className="rounded-2xl overflow-hidden bg-[#F2F4F7]" data-testid="card-map-radius">
                    <div className="h-40 flex items-center justify-center relative">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#1D6FE8]/40 flex items-center justify-center mx-auto mb-1">
                          <Navigation className="w-6 h-6 text-[#1D6FE8]" />
                        </div>
                        <p className="text-sm font-bold text-[#0B1F44]">{selectedCity.name} +{radius} km</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reistijd" && (
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-semibold text-[#0B1F44] mb-2 block">Adres</Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
                    <Input
                      type="text"
                      placeholder="bijv. Centraal Station Amsterdam"
                      value={travelAddress}
                      onChange={(e) => setTravelAddress(e.target.value)}
                      className="h-13 pl-11 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                      data-testid="input-travel-address"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-[#0B1F44] mb-2 block">Maximale reistijd</Label>
                  <Select value={travelTime} onValueChange={setTravelTime}>
                    <SelectTrigger
                      className="h-13 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8]"
                      data-testid="select-travel-time"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minuten</SelectItem>
                      <SelectItem value="30">30 minuten</SelectItem>
                      <SelectItem value="45">45 minuten</SelectItem>
                      <SelectItem value="60">60 minuten</SelectItem>
                      <SelectItem value="90">90 minuten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-[#0B1F44] mb-3 block">Vervoersmiddel</Label>
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
                            ? "bg-[#1D6FE8] text-white"
                            : "bg-[#F2F4F7] text-[#0B1F44] hover:bg-[#E5E7EB]"
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
                  <div className="rounded-2xl overflow-hidden bg-[#F2F4F7]" data-testid="card-map-travel">
                    <div className="h-40 flex items-center justify-center relative">
                      <div className="text-center">
                        <Clock className="w-8 h-8 text-[#1D6FE8] mx-auto mb-1.5" />
                        <p className="text-sm font-bold text-[#0B1F44]">{travelTime} min reistijd</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">vanaf {travelAddress}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {(selectedCity || (activeTab === "reistijd" && travelAddress)) && (
          <EstimateBox
            city={selectedCity?.name || travelAddress}
            loading={estimateLoading}
            estimate={estimate}
          />
        )}

        {!selectedCity && activeTab !== "reistijd" && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-[#6B7280] mb-3">Populaire steden</p>
            <div className="flex flex-wrap gap-2">
              {DUTCH_CITIES.slice(0, 6).map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city)}
                  className="px-4 py-2.5 rounded-xl bg-[#F2F4F7] text-sm font-medium text-[#0B1F44] hover:bg-[#E5E7EB] transition-colors"
                  data-testid={`chip-city-${city.name.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full h-[52px] rounded-xl text-[16px] font-semibold bg-[#1D6FE8] hover:bg-[#165DD0] shadow-none"
            disabled={!canProceed}
            onClick={handleNext}
            data-testid="button-next-location"
          >
            Volgende
          </Button>
        </div>
      </div>
    </div>
  );
}
