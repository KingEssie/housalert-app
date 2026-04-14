import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { logoSrc } from "@/components/housalert-logo";
import { useTranslation } from "@/i18n";

import slide1 from "@assets/CBEC0B90-CFEB-4531-9B92-189C3D5AE11C_1775582560871.png";
import slide2 from "@assets/0953D9E3-7D7C-4BFA-A772-61A8256302DE_1775582560871.png";
import slide3 from "@assets/A66E9676-D495-4D6C-A082-21D327233B05_1775582560871.png";

const SLIDE_IMAGES = [slide1, slide2, slide3];

const AUTO_ADVANCE_MS = 3000;

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

  const SLIDES = [
    { image: SLIDE_IMAGES[0], title: t("slideshow.slide1Title"), subtitle: t("slideshow.slide1Subtitle") },
    { image: SLIDE_IMAGES[1], title: t("slideshow.slide2Title"), subtitle: t("slideshow.slide2Subtitle") },
    { image: SLIDE_IMAGES[2], title: t("slideshow.slide3Title"), subtitle: t("slideshow.slide3Subtitle") },
  ];
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    timerRef.current = setInterval(next, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
      if (touchDeltaX < 0) {
        goTo((current + 1) % SLIDES.length);
      } else {
        goTo((current - 1 + SLIDES.length) % SLIDES.length);
      }
      resetTimer();
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  }

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: "#FFFFFF" }}
      data-testid="onboarding-slideshow"
      role="region"
      aria-label="Onboarding slides"
    >
      <div
        className="relative w-full flex-shrink-0 overflow-hidden"
        style={{ height: "60vh" }}
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
          style={{ bottom: "36px", zIndex: 3 }}
          data-testid="brand-overlay"
        >
          <img
            src={logoSrc}
            alt="HousAlert logo"
            className="object-contain"
            style={{
              width: 48,
              height: 48,
              filter: "brightness(0) invert(1)",
            }}
            data-testid="img-brand-logo"
          />
          <span
            style={{
              color: "#FFFFFF",
              fontSize: "18px",
              fontWeight: 600,
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: "0.02em",
              marginTop: "6px",
              textTransform: "lowercase" as const,
            }}
            data-testid="text-brand-name"
          >
            housalert
          </span>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col px-6 relative"
        style={{
          marginTop: "-24px",
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
          zIndex: 4,
        }}
      >
        <div className="flex items-center justify-center gap-2 pt-5 pb-4" role="tablist" aria-label="Slide indicators">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              className="transition-all duration-300"
              role="tab"
              aria-selected={current === i}
              style={{
                width: current === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: current === i ? "rgb(var(--ha-primary))" : "#E5E7EB",
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
          className="text-[26px] font-bold leading-[1.2] tracking-[-0.02em] mb-2 text-center"
          style={{ color: "#111111" }}
          data-testid="text-slide-title"
        >
          {SLIDES[current].title}
        </h2>
        <p
          className="text-[15px] leading-[1.55] mb-5 text-center"
          style={{ color: "#334855" }}
          data-testid="text-slide-subtitle"
        >
          {SLIDES[current].subtitle}
        </p>

        <div className="flex-1" />

        <div className="flex flex-col gap-3 pb-[max(env(safe-area-inset-bottom),16px)]">
          <button
            onClick={() => navigate("/onboarding/intro")}
            className="w-full border-0 font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "56px",
              borderRadius: "14px",
              background: "rgb(var(--ha-primary))",
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: 600,
              boxShadow: "0 4px 15px rgba(217,26,104,0.25)",
            }}
            data-testid="button-create-account"
          >
            {t("slideshow.createAccount")}
            <ArrowRight className="w-[18px] h-[18px]" />
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "56px",
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
