import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { Search, Bell, Zap } from "lucide-react";

const SLIDE_ICONS = [Search, Bell, Zap] as const;
const ICON_BG = ["#EFF6FF", "#FFF7ED", "#F0FDF4"] as const;
const ICON_COLOR = ["#2563EB", "#F97316", "#16A34A"] as const;

export default function WelcomePage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);
  const slideCount = 3;

  const slides = [
    { title: t("welcomeSlides.slide1Title"), desc: t("welcomeSlides.slide1Desc") },
    { title: t("welcomeSlides.slide2Title"), desc: t("welcomeSlides.slide2Desc") },
    { title: t("welcomeSlides.slide3Title"), desc: t("welcomeSlides.slide3Desc") },
  ];

  const goToSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, index));
    setActiveSlide(clamped);
    if (trackRef.current) {
      trackRef.current.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      trackRef.current.style.transform = `translateX(-${clamped * 100}%)`;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    if (trackRef.current) {
      trackRef.current.style.transition = "none";
    }
  }, []);

  const getContainerWidth = useCallback(() => {
    return trackRef.current?.parentElement?.clientWidth || window.innerWidth;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = delta;
    if (trackRef.current) {
      const baseOffset = -activeSlide * 100;
      const pxToPercent = (delta / getContainerWidth()) * 100;
      trackRef.current.style.transform = `translateX(${baseOffset + pxToPercent}%)`;
    }
  }, [activeSlide, getContainerWidth]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const threshold = getContainerWidth() * 0.2;
    if (touchDeltaX.current < -threshold && activeSlide < slideCount - 1) {
      goToSlide(activeSlide + 1);
    } else if (touchDeltaX.current > threshold && activeSlide > 0) {
      goToSlide(activeSlide - 1);
    } else {
      goToSlide(activeSlide);
    }
  }, [activeSlide, goToSlide, getContainerWidth]);

  const handleTouchCancel = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    goToSlide(activeSlide);
  }, [activeSlide, goToSlide]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDragging.current) {
        setActiveSlide((prev) => {
          const next = (prev + 1) % slideCount;
          if (trackRef.current) {
            trackRef.current.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            trackRef.current.style.transform = `translateX(-${next * 100}%)`;
          }
          return next;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="welcome-page">
      <div className="flex-1 flex flex-col items-center justify-between px-6 py-8 max-w-md mx-auto w-full">
        <div className="pt-6 pb-4">
          <HousAlertLogo size={40} showText={false} />
        </div>

        <div
          className="w-full overflow-hidden flex-1 flex flex-col justify-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div
            ref={trackRef}
            className="flex w-full"
            style={{ transform: "translateX(0%)" }}
          >
            {slides.map((slide, i) => {
              const Icon = SLIDE_ICONS[i];
              return (
                <div
                  key={i}
                  className="w-full flex-shrink-0 flex flex-col items-center text-center px-4"
                  data-testid={`slide-${i}`}
                >
                  <div
                    className="w-[120px] h-[120px] rounded-[32px] flex items-center justify-center mb-10"
                    style={{ backgroundColor: ICON_BG[i] }}
                  >
                    <Icon
                      className="w-12 h-12"
                      style={{ color: ICON_COLOR[i] }}
                      strokeWidth={1.5}
                    />
                  </div>

                  <h2
                    className="text-[28px] font-semibold text-[#222222] leading-[1.15] tracking-[-0.03em] mb-4 max-w-[300px]"
                    data-testid={`text-slide-title-${i}`}
                  >
                    {slide.title}
                  </h2>
                  <p
                    className="text-[16px] text-[#717171] leading-[1.5] max-w-[300px]"
                    data-testid={`text-slide-desc-${i}`}
                  >
                    {slide.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4 pb-6 pt-8">
          <div className="flex items-center gap-2 mb-4" data-testid="progress-dots">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className="p-1"
                data-testid={`dot-${i}`}
                aria-label={`Slide ${i + 1}`}
              >
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: activeSlide === i ? 24 : 8,
                    height: 8,
                    backgroundColor: activeSlide === i ? "hsl(214, 97%, 52%)" : "#D1D5DB",
                  }}
                />
              </button>
            ))}
          </div>

          <Button
            onClick={() => navigate("/onboarding/location")}
            className="w-full h-[56px] rounded-full text-[16px] font-semibold shadow-none"
            style={{ backgroundColor: "hsl(214, 97%, 52%)" }}
            data-testid="button-create-account"
          >
            {t("welcomeSlides.createAccount")}
          </Button>

          <button
            onClick={() => navigate("/login")}
            className="w-full h-[56px] rounded-full text-[16px] font-semibold text-[#222222] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
            data-testid="button-login"
          >
            {t("welcomeSlides.login")}
          </button>
        </div>
      </div>
    </div>
  );
}
