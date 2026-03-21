import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation } from "@/i18n";
import slide1Img from "@assets/D17B6106-C626-4314-85C9-A17B7DD5D425_1774073011189.png";
import slide2Img from "@assets/50F77D08-ED68-40B2-AFD3-67D49A86100C_1774073011189.png";
import slide3Img from "@assets/9E0288D3-EDA2-445A-98E3-220B0CB5FAA4_1774073011189.png";

const IMAGES = [slide1Img, slide2Img, slide3Img];
const BRAND = "#F97316";
const BRAND_HOVER = "#EA580C";

export default function WelcomePage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);
  const imageTrackRef = useRef<HTMLDivElement>(null);
  const textTrackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);
  const slideCount = 3;

  const slides = [
    { title: t("welcomeSlides.slide1Title"), desc: t("welcomeSlides.slide1Desc") },
    { title: t("welcomeSlides.slide2Title"), desc: t("welcomeSlides.slide2Desc") },
    { title: t("welcomeSlides.slide3Title"), desc: t("welcomeSlides.slide3Desc") },
  ];

  const animateTracks = useCallback((percent: string, transition: string) => {
    [imageTrackRef, textTrackRef].forEach((ref) => {
      if (ref.current) {
        ref.current.style.transition = transition;
        ref.current.style.transform = `translateX(${percent})`;
      }
    });
  }, []);

  const goToSlide = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, index));
    setActiveSlide(clamped);
    animateTracks(
      `-${clamped * 100}%`,
      "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    );
  }, [animateTracks]);

  const getContainerWidth = useCallback(() => {
    return imageTrackRef.current?.parentElement?.clientWidth || window.innerWidth;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    animateTracks("", "none");
  }, [animateTracks]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = delta;
    const baseOffset = -activeSlide * 100;
    const pxToPercent = (delta / getContainerWidth()) * 100;
    const val = `${baseOffset + pxToPercent}%`;
    [imageTrackRef, textTrackRef].forEach((ref) => {
      if (ref.current) {
        ref.current.style.transition = "none";
        ref.current.style.transform = `translateX(${val})`;
      }
    });
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
          animateTracks(
            `-${next * 100}%`,
            "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
          );
          return next;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [animateTracks]);

  return (
    <div
      className="h-[100dvh] bg-white flex flex-col overflow-hidden relative"
      data-testid="welcome-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="relative w-full" style={{ height: "55%" }}>
        <div className="absolute inset-0 overflow-hidden">
          <div
            ref={imageTrackRef}
            className="flex h-full"
            style={{ width: `${slideCount * 100}%`, transform: "translateX(0%)" }}
          >
            {IMAGES.map((src, i) => (
              <div
                key={i}
                className="h-full"
                style={{ width: `${100 / slideCount}%` }}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                  data-testid={`slide-image-${i}`}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
          <HousAlertLogo size={36} showText={true} textClassName="font-semibold text-white text-[17px] drop-shadow-sm" />
        </div>
      </div>

      <div
        className="relative flex-1 bg-white flex flex-col"
        style={{ borderRadius: "28px 28px 0 0", marginTop: "-28px", zIndex: 5 }}
      >
        <div className="flex items-center justify-center gap-2 pt-5 pb-4" data-testid="progress-dots">
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
                  backgroundColor: activeSlide === i ? BRAND : "#D1D5DB",
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          <div
            ref={textTrackRef}
            className="flex h-full"
            style={{ width: `${slideCount * 100}%`, transform: "translateX(0%)" }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-start text-center px-8 pt-2"
                style={{ width: `${100 / slideCount}%` }}
                data-testid={`slide-${i}`}
              >
                <h2
                  className="text-[26px] font-bold text-[#222222] leading-[1.15] tracking-[-0.02em] mb-3"
                  data-testid={`text-slide-title-${i}`}
                >
                  {slide.title}
                </h2>
                <p
                  className="text-[15px] text-[#717171] leading-[1.55] max-w-[320px]"
                  data-testid={`text-slide-desc-${i}`}
                >
                  {slide.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-8 pt-3 flex flex-col gap-3">
          <button
            onClick={() => navigate("/onboarding/location")}
            className="w-full h-[54px] rounded-full text-[16px] font-semibold text-white transition-colors active:scale-[0.98]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-create-account"
          >
            {t("welcomeSlides.createAccount")}
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full h-[54px] rounded-full text-[16px] font-semibold text-[#222222] border border-[#E0E0E0] bg-white hover:bg-[#F9FAFB] transition-colors active:scale-[0.98]"
            data-testid="button-login"
          >
            {t("welcomeSlides.login")}
          </button>
        </div>
      </div>
    </div>
  );
}
