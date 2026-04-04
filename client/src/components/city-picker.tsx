import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, AlertCircle } from "lucide-react";
import MapView from "@/components/map-view";
import { useTranslation } from "@/i18n";
import { usePlacesAutocomplete, type PlaceSuggestion } from "@/hooks/use-places-autocomplete";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";

export interface SelectedPlace {
  city_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  place_id: string;
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
  const geocoder = useGeocoderSearch({ debounceMs: 300, limit: 6 });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    setTouched(true);
    if (value) onChange(null);

    if (places.isAvailable) {
      places.search(val);
      geocoder.clear();
    } else {
      geocoder.search(val);
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
    geocoder.clear();
  }

  function handleGeocoderSelect(r: typeof geocoder.results[0]) {
    const place: SelectedPlace = {
      city_name: r.city,
      country_code: r.country,
      latitude: r.lat,
      longitude: r.lng,
      place_id: r.placeId ?? "",
    };
    onChange(place);
    setQuery(r.city);
    setOpen(false);
    setTouched(false);
    places.clear();
    geocoder.clear();
  }

  function handleClear() {
    setQuery("");
    onChange(null);
    geocoder.clear();
    places.clear();
    setTouched(false);
  }

  const usingGoogle = places.isAvailable;
  const isLoading = places.loading || geocoder.loading;
  const hasResults = (usingGoogle && places.suggestions.length > 0) || geocoder.results.length > 0;
  const showValidation = touched && !value && query.trim().length > 0;

  return (
    <div className="flex flex-col gap-4" ref={containerRef}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (hasResults && !value) setOpen(true); }}
            placeholder={t("location.searchCity")}
            className={`w-full min-h-[48px] rounded-[6px] bg-ha-surface border border-transparent px-11 text-[16px] text-ha-text-muted placeholder:text-ha-text-muted ${
              showValidation ? "border-red-400" : value ? "border-ha-primary bg-ha-surface/30" : "border-ha-card-border"
            }`}
            data-testid="input-city-search"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ha-card-border flex items-center justify-center hover:bg-ha-text-muted/30 transition-colors"
              data-testid="button-clear-city"
            >
              <X className="w-3.5 h-3.5 text-ha-text-muted" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-ha-primary/30 border-t-ha-primary rounded-full animate-spin" />
          </div>
        )}

        {open && hasResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-ha-card border border-ha-card-border rounded-[6px] shadow-lg max-h-[260px] overflow-y-auto z-30">
            {usingGoogle && places.suggestions.length > 0 ? (
              <>
                {places.suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    onClick={() => handleGoogleSelect(s)}
                    className="w-full text-left px-4 py-3.5 text-[15px] transition-colors first:rounded-t-[6px] last:rounded-b-[6px] text-ha-text-muted hover:bg-ha-surface flex items-center gap-3"
                    data-testid={`option-place-${s.place_id}`}
                  >
                    <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                    <span>{s.state ? `${s.city_name}, ${s.state}` : s.city_name}</span>
                  </button>
                ))}
                <div className="px-4 py-2 text-[11px] text-ha-text-secondary text-right border-t border-ha-card-border">
                  {t("cityPicker.poweredByGoogle")}
                </div>
              </>
            ) : (
              geocoder.results.map((r) => (
                <button
                  key={r.placeId || `${r.lat}-${r.lng}`}
                  onClick={() => handleGeocoderSelect(r)}
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
          <div className="inline-flex items-center gap-2 bg-ha-surface text-ha-text-muted font-medium text-[14px] px-4 py-2 rounded-full self-start" data-testid="chip-selected-city">
            <MapPin className="w-4 h-4" />
            {value.city_name}
          </div>

          <MapView
            lat={value.latitude}
            lng={value.longitude}
            zoom={10}
            markers={[{ lat: value.latitude, lng: value.longitude, type: "primary" }]}
            height="clamp(240px, 35vh, 360px)"
            className="rounded-[6px] overflow-hidden border border-ha-card-border"
          />
        </>
      )}
    </div>
  );
}
