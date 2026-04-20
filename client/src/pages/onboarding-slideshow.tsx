import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowRight, MapPin, Search, X, Loader2 } from "lucide-react";
import { logoSrc } from "@/components/housalert-logo";
import { useTranslation } from "@/i18n";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { defaultCities } from "../../../config/market";
import OnboardingModal from "@/components/onboarding-modal";

import slide1 from "@assets/CBEC0B90-CFEB-4531-9B92-189C3D5AE11C_1775582560871.png";
import slide2 from "@assets/0953D9E3-7D7C-4BFA-A772-61A8256302DE_1775582560871.png";
import slide3 from "@assets/A66E9676-D495-4D6C-A082-21D327233B05_1775582560871.png";

const SLIDE_IMAGES = [slide1, slide2, slide3];
const AUTO_ADVANCE_MS = 3000;
const TOP_CITIES = defaultCities.slice(0, 6);

type SelectedCity = { name: string; lat: number; lng: number };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export default function OnboardingSlideshow() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const SLIDES = [
    { image: SLIDE_IMAGES[0], title: t("slideshow.slide1Title"), subtitle: t("slideshow.slide1Subtitle") },
    { image: SLIDE_IMAGES[1], title: t("slideshow.slide2Title"), subtitle: t("slideshow.slide2Subtitle") },
    { image: SLIDE_IMAGES[2], title: t("slideshow.slide3Title"), subtitle: t("slideshow.slide3Subtitle") },
  ];

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [searchText, setSearchText] = useState("");
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const geocoder = useGeocoderSearch({ debounceMs: 250, minChars: 2, limit: 5 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((idx: number) => { setCurrent(idx); }, []);
  const next = useCallback(() => { setCurrent((prev) => (prev + 1) % SLIDES.length); }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    timerRef.current = setInterval(next, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, prefersReducedMotion]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!prefersReducedMotion) {
      timerRef.current = setInterval(next, AUTO_ADVANCE_MS);
    }
  }, [next, prefersReducedMotion]);

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX === null) return;
    setTouchDeltaX(e.touches[0].clientX - touchStartX);
  }

  function handleTouchEnd() {
    if (touchStartX === null) return;
    if (Math.abs(touchDeltaX) > 50) {
      if (touchDeltaX < 0) goTo((current + 1) % SLIDES.length);
      else goTo((current - 1 + SLIDES.length) % SLIDES.length);
      resetTimer();
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  }

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

  function handleSelectGeoResult(r: { city: string; label: string; lat?: number; lng?: number }) {
    const city: SelectedCity = { name: r.city, lat: r.lat ?? 0, lng: r.lng ?? 0 };
    handleSelectCity(city);
  }

  function handleClearCity() {
    setSelectedCity(null);
    setSearchText("");
    setDropdownOpen(false);
    geocoder.clear();
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleInputFocus() {
    setDropdownOpen(true);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTopCities =
    searchText.trim().length > 0
      ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
      : TOP_CITIES;

  const showGeoResults = searchText.trim().length >= 2 && geocoder.results.length > 0;
  const showTopCities = !showGeoResults && filteredTopCities.length > 0;
  const showDropdown = dropdownOpen && !selectedCity && (showGeoResults || showTopCities || geocoder.loading);

  function handleStart() {
    if (!selectedCity) return;
    setModalOpen(true);
  }

  if (modalOpen && selectedCity) {
    return (
      <OnboardingModal
        city={selectedCity.name}
        lat={selectedCity.lat}
        lng={selectedCity.lng}
        onClose={() => setModalOpen(false)}
      />
    );
  }

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: "rgb(var(--ha-card))" }}
      data-testid="onboarding-slideshow"
      role="region"
      aria-label="Onboarding slides"
    >
      <div
        className="relative w-full flex-shrink-0 overflow-hidden"
        style={{ height: "52vh" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-live="polite"
      >
        {SLIDES.map((slide, i) => (
          <img
            key={i}
            src={slide.image}
            alt={slide.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === current ? 1 : 0,
              transition: prefersReducedMotion ? "none" : "opacity 0.5s ease-in-out",
              zIndex: i === current ? 1 : 0,
            }}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            aria-hidden={i !== current}
            data-testid={`slide-image-${i}`}
          />
        ))}

        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%)",
            zIndex: 2,
          }}
        />

        <div
          className="absolute left-0 right-0 flex flex-col items-center"
          style={{ bottom: "32px", zIndex: 3 }}
          data-testid="brand-overlay"
        >
          <img
            src={logoSrc}
            alt="HousAlert logo"
            className="object-contain"
            style={{ width: 44, height: 44, filter: "brightness(0) invert(1)" }}
            data-testid="img-brand-logo"
          />
          <span
            style={{
              color: "white",
              fontSize: "17px",
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: "0.02em",
              marginTop: "5px",
              textTransform: "lowercase" as const,
            }}
            data-testid="text-brand-name"
          >
            housalert
          </span>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col px-5 relative overflow-y-auto"
        style={{
          marginTop: "-20px",
          background: "rgb(var(--ha-card))",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
          zIndex: 4,
        }}
      >
        <div className="flex items-center justify-center gap-2 pt-4 pb-3" role="tablist" aria-label="Slide indicators">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              className="transition-all duration-300"
              role="tab"
              aria-selected={current === i}
              style={{
                width: current === i ? 22 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: current === i ? "rgb(var(--ha-primary))" : "rgb(var(--ha-card-border))",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              data-testid={`dot-${i}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <h2
          className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] mb-1 text-center"
          style={{ color: "rgb(var(--ha-text))" }}
          data-testid="text-slide-title"
        >
          {SLIDES[current].title}
        </h2>
        <p
          className="text-[14px] leading-[1.5] mb-4 text-center"
          style={{ color: "rgb(var(--ha-text-secondary))" }}
          data-testid="text-slide-subtitle"
        >
          {SLIDES[current].subtitle}
        </p>

        <div className="relative mb-3" data-testid="city-search-container">
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
              onFocus={handleInputFocus}
              placeholder={t("slideshow.citySearchPlaceholder")}
              className="w-full h-[48px] rounded-[12px] border pl-10 pr-10 text-[15px] font-medium outline-none transition-all"
              style={{
                borderColor: "rgb(var(--ha-card-border))",
                backgroundColor: selectedCity ? "rgba(var(--ha-primary),0.04)" : "rgb(var(--ha-surface))",
                color: "rgb(var(--ha-text))",
              }}
              data-testid="input-city-search"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
              {geocoder.loading && !selectedCity ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
              ) : selectedCity ? (
                <button
                  onClick={handleClearCity}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgb(var(--ha-card-border))" }}
                  data-testid="button-clear-city"
                >
                  <X className="w-3 h-3" style={{ color: "rgb(var(--ha-text-muted))" }} />
                </button>
              ) : searchText.length > 0 ? (
                <button
                  onClick={handleClearCity}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgb(var(--ha-card-border))" }}
                  data-testid="button-clear-search"
                >
                  <X className="w-3 h-3" style={{ color: "rgb(var(--ha-text-muted))" }} />
                </button>
              ) : (
                <Search className="w-4 h-4" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
              )}
            </div>
          </div>

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-[52px] z-50 rounded-[12px] border overflow-hidden shadow-lg"
              style={{ borderColor: "rgb(var(--ha-card-border))", backgroundColor: "rgb(var(--ha-card))" }}
              data-testid="city-dropdown"
            >
              {geocoder.loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                </div>
              )}
              {showGeoResults && geocoder.results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectGeoResult(r as any)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                  style={{ borderBottom: i < geocoder.results.length - 1 ? "1px solid rgb(var(--ha-surface))" : "none" }}
                  data-testid={`city-result-${i}`}
                >
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                  <div>
                    <span className="text-[14px] font-semibold block" style={{ color: "rgb(var(--ha-text))" }}>
                      {(r as any).city}
                    </span>
                    {(r as any).label && (r as any).label !== (r as any).city && (
                      <span className="text-[12px]" style={{ color: "rgb(var(--ha-text-placeholder))" }}>
                        {(r as any).label.replace(`${(r as any).city}, `, "")}
                      </span>
                    )}
                  </div>
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

        <div className="flex flex-col gap-2.5 pb-[max(env(safe-area-inset-bottom),16px)]">
          <button
            onClick={handleStart}
            disabled={!selectedCity}
            className="w-full border-0 font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: "52px",
              borderRadius: "14px",
              background: "rgb(var(--ha-primary))",
              color: "white",
              fontSize: "16px",
              fontWeight: 600,
              boxShadow: selectedCity ? "0 4px 15px rgba(217,26,104,0.25)" : "none",
            }}
            data-testid="button-create-account"
          >
            {t("slideshow.createAccount")}
            <ArrowRight className="w-[17px] h-[17px]" />
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "52px",
              borderRadius: "14px",
              border: "2px solid rgb(var(--ha-primary))",
              color: "rgb(var(--ha-primary))",
              backgroundColor: "transparent",
              fontSize: "16px",
              fontWeight: 600,
            }}
            data-testid="button-login"
          >
            {t("slideshow.login")}
          </button>
        </div>
      </div>
    </div>
  );
}
