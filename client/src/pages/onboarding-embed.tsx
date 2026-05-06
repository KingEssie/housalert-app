import { apiFetch } from "@/lib/api-base";
import { useState, useRef, useEffect } from "react";
import { MapPin, Check, ChevronRight, ExternalLink, Download, Sparkles, Search, X, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { defaultCities } from "../../../config/market";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://www.housalert.com";
const TOP_CITIES = defaultCities.slice(0, 6);

type Step = "city" | "filters";
type SelectedCity = { name: string; lat: number; lng: number };

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const continueUrl = `${APP_DOMAIN}/continue?draft=${draftId}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-[56px] h-[56px] rounded-[6px] bg-ha-primary-light flex items-center justify-center mb-5">
        <Check className="w-7 h-7 text-ha-text" />
      </div>
      <h2 className="text-[20px] font-medium text-ha-text mb-1.5 tracking-wide" data-testid="embed-text-done-title">
        {t("onboardingEmbed.doneTitle")}
      </h2>
      <p className="text-[14px] text-ha-text mb-7 max-w-[300px] leading-relaxed">
        {t("onboardingEmbed.doneSubtitle")}
      </p>
      <div className="w-full max-w-[320px] space-y-2.5">
        <a
          href={continueUrl}
          target="_top"
          className="w-full min-h-[56px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white font-medium text-[15px] transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
          data-testid="embed-link-continue-browser"
        >
          <ExternalLink className="w-4 h-4" />
          {t("onboardingEmbed.continueInBrowser")}
        </a>
        <button
          className="w-full h-[56px] rounded-[6px] border border-ha-card-border bg-ha-card text-ha-text font-medium text-[14px] transition-colors flex items-center justify-center gap-2"
          data-testid="embed-button-download-app"
          onClick={() => window.open(continueUrl, "_top")}
        >
          <Download className="w-4 h-4" />
          {t("onboardingEmbed.downloadApp")}
        </button>
      </div>
      <p className="text-[11px] text-ha-text mt-6">Powered by HousAlert</p>
    </div>
  );
}

// ─── Estimate block ───────────────────────────────────────────────────────────

function EstimateBlock({ city, maxPrice }: { city: string; maxPrice: string }) {
  const { t } = useTranslation();
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || !maxPrice || Number(maxPrice) <= 0) { setEstimate(null); return; }
    setLoading(true);
    const params = new URLSearchParams({ city, maxPrice });
    apiFetch(`/api/estimate?${params}`)
      .then((r) => r.json())
      .then((d) => setEstimate(d.perWeekEstimate ?? 0))
      .catch(() => setEstimate(null))
      .finally(() => setLoading(false));
  }, [city, maxPrice]);

  if (!city || !maxPrice || Number(maxPrice) <= 0) return null;

  return (
    <div className="flex items-center gap-3 bg-ha-primary-light rounded-[6px] px-4 py-3.5" data-testid="embed-estimate-block">
      <div className="w-9 h-9 rounded-full bg-ha-primary flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-4 w-48 bg-ha-primary-light rounded animate-pulse" />
        ) : estimate !== null ? (
          <p className="text-[13px] sm:text-[14px] font-medium text-ha-text leading-snug">
            <span className="text-ha-primary text-[15px] font-medium">
              {getMatchEstimateRange(estimate).low}–{getMatchEstimateRange(estimate).high}
            </span>{" "}
            {t("onboardingEmbed.matchesPerWeek")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingEmbedPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("city");
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState("1500");
  const [propertyType, setPropertyType] = useState("any");
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const geocoder = useGeocoderSearch({ debounceMs: 250, minChars: 2, limit: 5 });

  // Pre-fill city from ?city= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cityParam = params.get("city");
    if (!cityParam) return;
    const match = defaultCities.find((c) => c.name.toLowerCase() === cityParam.toLowerCase());
    if (match) { setSelectedCity(match); setSearchText(match.name); }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const PROPERTY_TYPES = [
    { value: "any", label: t("onboardingEmbed.propertyTypes.any") },
    { value: "appartement", label: t("onboardingEmbed.propertyTypes.apartment") },
    { value: "studio", label: t("onboardingEmbed.propertyTypes.studio") },
    { value: "kamer", label: t("onboardingEmbed.propertyTypes.room") },
    { value: "gedeeld", label: t("onboardingEmbed.propertyTypes.shared") },
  ];

  function handleSearchChange(val: string) {
    setSearchText(val);
    setSelectedCity(null);
    setDropdownOpen(true);
    geocoder.search(val);
  }

  function handleSelectCity(city: SelectedCity) {
    setSelectedCity(city);
    setSearchText(city.name);
    setDropdownOpen(false);
    geocoder.clear();
  }

  function handleSelectGeoResult(r: { city: string; lat?: number; lng?: number }) {
    handleSelectCity({ name: r.city, lat: r.lat ?? 0, lng: r.lng ?? 0 });
  }

  function handleClearCity() {
    setSelectedCity(null);
    setSearchText("");
    setDropdownOpen(false);
    geocoder.clear();
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const filteredTopCities = searchText.trim().length > 0
    ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
    : TOP_CITIES;
  const showGeoResults = searchText.trim().length >= 2 && geocoder.results.length > 0;
  const showTopCities = !showGeoResults && filteredTopCities.length > 0;
  const showDropdown = dropdownOpen && !selectedCity && (showGeoResults || showTopCities || geocoder.loading);

  async function handleSubmit() {
    if (!selectedCity) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/onboarding-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country_code: "DE",
          city_name: selectedCity.name,
          latitude: selectedCity.lat,
          longitude: selectedCity.lng,
          place_id: selectedCity.name.toLowerCase().replace(/\s+/g, "_") + "_de",
          location_mode: "city",
          price_min: 0,
          price_max: parseInt(maxPrice) || 0,
          property_type: propertyType,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || t("onboardingEmbed.saveFailed"));
      }
      const { id } = await res.json();
      setDraftId(id);
    } catch (err: any) {
      setError(err.message || t("onboardingEmbed.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Completion ──────────────────────────────────────────────────────────────
  if (draftId) {
    return (
      <div className="min-h-screen bg-ha-card flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-ha-card rounded-[6px] border border-ha-card-border shadow-lg overflow-hidden">
          <CompletionScreen draftId={draftId} />
        </div>
      </div>
    );
  }

  // ── Step: city ──────────────────────────────────────────────────────────────
  if (step === "city") {
    return (
      <div className="min-h-screen bg-ha-card flex items-start justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-5">
            <h1 className="text-[21px] sm:text-[24px] font-medium text-ha-text leading-[1.25] tracking-tight" data-testid="embed-text-hero-title">
              {t("slideshow.citySearchPlaceholder") ? "In welke stad zoek je?" : "In welke stad zoek je?"}
            </h1>
          </div>

          <div className="bg-ha-card rounded-[6px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-visible">
            <div className="px-5 pt-5 pb-4">
              {/* Search input */}
              <div className="relative mb-4" data-testid="city-search-container">
                <div className="relative">
                  <MapPin
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none"
                    style={{ color: selectedCity ? "rgb(var(--ha-primary))" : "rgb(var(--ha-text-placeholder))" }}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchText}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Zoek een stad..."
                    className="w-full h-[48px] rounded-[10px] border pl-10 pr-10 text-[15px] font-medium outline-none transition-all"
                    style={{
                      borderColor: "rgb(var(--ha-card-border))",
                      backgroundColor: selectedCity ? "var(--ha-primary-light)" : "rgb(var(--ha-surface))",
                      color: "rgb(var(--ha-text))",
                    }}
                    data-testid="input-city-search"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                    {geocoder.loading && !selectedCity ? (
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                    ) : selectedCity || searchText.length > 0 ? (
                      <button
                        onClick={handleClearCity}
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "rgb(var(--ha-card-border))" }}
                        data-testid="button-clear-city"
                      >
                        <X className="w-3 h-3" style={{ color: "rgb(var(--ha-text-muted))" }} />
                      </button>
                    ) : (
                      <Search className="w-4 h-4" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                    )}
                  </div>
                </div>

                {/* Dropdown */}
                {showDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-0 right-0 top-[52px] z-50 rounded-[10px] border overflow-hidden shadow-lg"
                    style={{ borderColor: "rgb(var(--ha-card-border))", backgroundColor: "rgb(var(--ha-card))" }}
                    data-testid="city-dropdown"
                  >
                    {geocoder.loading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                      </div>
                    )}
                    {showGeoResults && (geocoder.results as any[]).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectGeoResult(r)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                        style={{ borderBottom: i < geocoder.results.length - 1 ? "1px solid rgb(var(--ha-surface))" : "none" }}
                        data-testid={`city-result-${i}`}
                      >
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[14px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{r.city}</span>
                      </button>
                    ))}
                    {showTopCities && filteredTopCities.map((city, i) => (
                      <button
                        key={city.name}
                        onClick={() => handleSelectCity(city)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                        style={{ borderBottom: i < filteredTopCities.length - 1 ? "1px solid rgb(var(--ha-surface))" : "none" }}
                        data-testid={`city-suggestion-${city.name.toLowerCase()}`}
                      >
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[14px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{city.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Top cities list (always visible when no search text) */}
              {!searchText.trim() && (
                <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: "rgb(var(--ha-card-border))" }}>
                  {TOP_CITIES.map((city, i) => (
                    <button
                      key={city.name}
                      onClick={() => handleSelectCity(city)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-ha-surface transition-colors text-left"
                      style={{
                        borderBottom: i < TOP_CITIES.length - 1 ? "1px solid rgb(var(--ha-card-border))" : "none",
                        backgroundColor: selectedCity?.name === city.name ? "rgb(var(--ha-primary-light))" : undefined,
                      }}
                      data-testid={`city-option-${city.name.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[15px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{city.name}</span>
                      </div>
                      {selectedCity?.name === city.name ? (
                        <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />
                      ) : (
                        <ChevronRight className="w-4 h-4" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => { if (selectedCity) setStep("filters"); }}
                disabled={!selectedCity}
                className="w-full h-[52px] rounded-[10px] font-semibold text-[16px] transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "rgb(var(--ha-primary))",
                  color: "white",
                }}
                data-testid="button-city-next"
              >
                Volgende
                <ChevronRight className="w-[17px] h-[17px]" />
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-ha-text mt-4">Powered by HousAlert</p>
        </div>
      </div>
    );
  }

  // ── Step: filters ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ha-card flex items-start justify-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-5">
          <button
            onClick={() => setStep("city")}
            className="text-[13px] font-medium mb-2 flex items-center gap-1 mx-auto"
            style={{ color: "rgb(var(--ha-primary))" }}
            data-testid="button-back-city"
          >
            ← {selectedCity?.name}
          </button>
          <h1 className="text-[21px] sm:text-[24px] font-medium text-ha-text leading-[1.25] tracking-tight" data-testid="embed-text-filters-title">
            Wat is je budget?
          </h1>
        </div>

        <div className="bg-ha-card rounded-[6px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="px-5 pt-5 pb-1 space-y-4">

            {/* Budget */}
            <div>
              <label className="text-[13px] font-medium text-ha-text tracking-wide mb-2 block">
                {t("onboardingEmbed.monthlyBudget")}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ha-text text-[13px] font-medium">max EUR</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="1500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full h-[48px] rounded-[10px] bg-ha-surface border border-transparent pl-[80px] pr-3 text-[15px] font-semibold text-ha-text outline-none"
                  data-testid="embed-input-max-price"
                />
              </div>
            </div>

            {/* Property type */}
            <div>
              <label className="text-[13px] font-medium text-ha-text tracking-wide mb-2 block">
                {t("onboardingEmbed.propertyType")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setPropertyType(pt.value)}
                    className={`px-3.5 py-[7px] rounded-full text-[13px] font-medium transition-all ${
                      propertyType === pt.value ? "bg-ha-primary text-white shadow-sm" : "bg-ha-surface text-ha-text"
                    }`}
                    data-testid={`embed-chip-property-${pt.value}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <EstimateBlock city={selectedCity?.name ?? ""} maxPrice={maxPrice} />
          </div>

          {error && (
            <div className="mx-5 mb-2 p-3 rounded-[6px] bg-ha-danger/5 border border-ha-danger/20 text-ha-danger text-[13px]" data-testid="embed-error">
              {error}
            </div>
          )}

          <div className="px-5 pb-5 pt-4">
            <button
              onClick={handleSubmit}
              disabled={!maxPrice || Number(maxPrice) <= 0 || submitting}
              className="w-full h-[56px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover active:scale-[0.98] text-white font-semibold text-[16px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
              data-testid="embed-button-submit"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-[18px] h-[18px]" />
                  {t("onboardingEmbed.submitButton")}
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-ha-text mt-4">Powered by HousAlert</p>
      </div>
    </div>
  );
}
