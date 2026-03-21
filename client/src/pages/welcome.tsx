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
      "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)"
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
            "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)"
          );
          return next;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [animateTracks]);

  return (
    <div
      className="h-[100dvh] bg-[#FAFAFA] flex flex-col overflow-hidden relative"
      data-testid="welcome-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="relative w-full flex-shrink-0" style={{ height: "58%" }}>
        <div className="absolute inset-0 overflow-hidden">
          <div
            ref={imageTrackRef}
            className="flex h-full will-change-transform"
            style={{ width: `${slideCount * 100}%`, transform: "translateX(0%)" }}
          >
            {IMAGES.map((src, i) => (
              <div
                key={i}
                className="h-full relative"
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

        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.45) 100%)"
        }} />

        <div className="absolute top-0 left-0 right-0 pt-[max(env(safe-area-inset-top),12px)] px-5 flex justify-center z-10">
          <div className="pt-3">
            <HousAlertLogo
              size={34}
              showText={true}
              textClassName="font-bold text-white text-[18px] tracking-[-0.01em]"
            />
          </div>
        </div>
      </div>

      <div
        className="relative flex-1 bg-white flex flex-col shadow-[0_-4px_30px_rgba(0,0,0,0.08)]"
        style={{ borderRadius: "32px 32px 0 0", marginTop: "-36px", zIndex: 5 }}
      >
        <div className="flex items-center justify-center gap-2.5 pt-6 pb-1" data-testid="progress-dots">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className="p-1"
              data-testid={`dot-${i}`}
              aria-label={`Slide ${i + 1}`}
            >
              <div
                className="rounded-full transition-all duration-400 ease-out"
                style={{
                  width: activeSlide === i ? 28 : 8,
                  height: 8,
                  backgroundColor: activeSlide === i ? BRAND : "#E5E7EB",
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div
            ref={textTrackRef}
            className="flex h-full will-change-transform"
            style={{ width: `${slideCount * 100}%`, transform: "translateX(0%)" }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center text-center px-8"
                style={{ width: `${100 / slideCount}%` }}
                data-testid={`slide-${i}`}
              >
                <h2
                  className="text-[28px] font-bold text-[#1A1A1A] leading-[1.12] tracking-[-0.03em] mb-3"
                  data-testid={`text-slide-title-${i}`}
                >
                  {slide.title}
                </h2>
                <p
                  className="text-[15px] text-[#888888] leading-[1.6] max-w-[300px]"
                  data-testid={`text-slide-desc-${i}`}
                >
                  {slide.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-2 flex flex-col gap-3">
          <button
            onClick={() => navigate("/onboarding/location")}
            className="w-full h-[56px] rounded-full text-[16px] font-bold text-white transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(249,115,22,0.35)]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-create-account"
          >
            {t("welcomeSlides.createAccount")}
          </button>

          <button
            onClick={() => navigate("/login")}
            className="w-full h-[52px] rounded-full text-[15px] font-semibold text-[#555555] bg-transparent hover:text-[#222222] transition-colors active:scale-[0.97]"
            data-testid="button-login"
          >
            {t("welcomeSlides.login")}
          </button>
        </div>
      </div>
    </div>
  );
}
