import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";

import slide1 from "@assets/CBEC0B90-CFEB-4531-9B92-189C3D5AE11C_1775582560871.png";
import slide2 from "@assets/0953D9E3-7D7C-4BFA-A772-61A8256302DE_1775582560871.png";
import slide3 from "@assets/A66E9676-D495-4D6C-A082-21D327233B05_1775582560871.png";

const SLIDES = [
  {
    image: slide1,
    title: "Vind jouw woning sneller",
    subtitle: "Ontvang direct meldingen zodra er iets online komt dat bij jou past.",
  },
  {
    image: slide2,
    title: "Wees er als eerste bij",
    subtitle: "Krijg direct meldingen en reageer sneller dan anderen.",
  },
  {
    image: slide3,
    title: "Begin jouw nieuwe hoofdstuk",
    subtitle: "Vind een plek waar jij je écht thuis voelt.",
  },
];

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
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
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
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  }

  function handleTouchEnd() {
    if (touchStart === null) return;
    if (Math.abs(touchDelta) > 50) {
      if (touchDelta < 0) {
        goTo((current + 1) % SLIDES.length);
      } else {
        goTo((current - 1 + SLIDES.length) % SLIDES.length);
      }
      resetTimer();
    }
    setTouchStart(null);
    setTouchDelta(0);
  }

  const dragOffset = touchStart !== null ? touchDelta : 0;
  const transitionStyle = prefersReducedMotion
    ? "none"
    : touchStart !== null
      ? "none"
      : "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

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
        style={{ height: "58vh" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-live="polite"
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(-${current * 100}% + ${dragOffset}px))`,
            transition: transitionStyle,
            width: `${SLIDES.length * 100}%`,
          }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="relative h-full flex-shrink-0"
              style={{ width: `${100 / SLIDES.length}%` }}
              aria-hidden={i !== current}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.08) 100%)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex-1 flex flex-col px-6 relative"
        style={{
          marginTop: "-24px",
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
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
          className="text-[26px] font-bold leading-[1.2] tracking-[-0.02em] mb-2"
          style={{ color: "#111111" }}
          data-testid="text-slide-title"
        >
          {SLIDES[current].title}
        </h2>
        <p
          className="text-[15px] leading-[1.5] mb-6"
          style={{ color: "#6B7280" }}
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
            Account aanmaken
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
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
