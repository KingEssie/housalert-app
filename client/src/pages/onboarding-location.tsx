import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Home, MapPin, ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface OnboardingData {
  city: string;
  lat: number;
  lng: number;
}

export default function OnboardingLocationPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<OnboardingData | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredCities = useMemo(() => {
    if (!search.trim()) return DUTCH_CITIES.slice(0, 8);
    return DUTCH_CITIES.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [search]);

  function handleCitySelect(city: typeof DUTCH_CITIES[0]) {
    setSelectedCity({ city: city.name, lat: city.lat, lng: city.lng });
    setSearch(city.name);
    setShowDropdown(false);
  }

  function handleNext() {
    if (!selectedCity) return;
    const params = new URLSearchParams({ city: selectedCity.city });
    navigate(`/onboarding/filters?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white/90 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            data-testid="button-back-landing"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-6 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === 1 ? "bg-primary" : "bg-gray-200"
              }`}
              data-testid={`progress-step-${step}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1" data-testid="text-step-indicator">Stap 1 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-location-title">
            Waar zoek je een woning?
          </h1>
          <p className="text-gray-500">
            Kies de stad waar je wilt wonen.
          </p>
        </div>

        <div className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Zoek een stad..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
                if (selectedCity && e.target.value !== selectedCity.city) {
                  setSelectedCity(null);
                }
              }}
              onFocus={() => setShowDropdown(true)}
              className="h-14 pl-12 rounded-xl text-base border-gray-200 focus:border-primary"
              data-testid="input-city-search"
            />
          </div>

          {showDropdown && filteredCities.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10">
              {filteredCities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city)}
                  className={`w-full px-5 py-3.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    selectedCity?.city === city.name ? "bg-blue-50" : ""
                  }`}
                  data-testid={`option-city-${city.name.toLowerCase()}`}
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">{city.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCity && (
          <div className="rounded-2xl overflow-hidden border border-gray-200 mb-6" data-testid="card-map-preview">
            <div className="h-48 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
              <div className="text-center">
                <MapPin className="w-10 h-10 text-primary mx-auto mb-2" />
                <p className="text-lg font-bold text-gray-900">{selectedCity.city}</p>
                <p className="text-sm text-gray-500">Nederland</p>
              </div>
            </div>
          </div>
        )}

        {!selectedCity && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500 mb-3">Populaire steden</p>
            <div className="flex flex-wrap gap-2">
              {DUTCH_CITIES.slice(0, 6).map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  data-testid={`chip-city-${city.name.toLowerCase()}`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-5 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full h-14 rounded-xl text-lg font-semibold shadow-none"
            disabled={!selectedCity}
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
