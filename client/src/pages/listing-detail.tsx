import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import { MapPin, Euro, BedDouble, Ruler, Clock, Globe, Zap, ImageIcon, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

function FloatingBackButton({ navigate }: { navigate: (to: string) => void }) {
  function handleBack() {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    if (from === "matches") {
      navigate("/dashboard?tab=matches");
    } else if (from === "home") {
      navigate("/dashboard?tab=home");
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/dashboard");
    }
  }
  return (
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30">
      <button onClick={handleBack} className="w-12 h-12 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.10)] flex items-center justify-center active:scale-95 transition-transform" aria-label="Back" data-testid="button-back"><ArrowLeft className="w-5 h-5 text-[#71717A]" /></button>
    </div>
  );
}

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-[#F5F7FA]", text: "text-[#222222]" },
  nieuw: { bg: "bg-[#222222]", text: "text-white" },
  vandaag: { bg: "bg-[#222222]", text: "text-white" },
  ouder: { bg: "bg-[#F5F7FA]", text: "text-[#222222]" },
};

const FRESH_LABEL_KEYS: Record<string, string> = {
  net_binnen: "freshness.justIn",
  nieuw: "freshness.new",
  vandaag: "freshness.today",
  ouder: "freshness.older",
};

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#222222] to-[#333333]",
  münchen: "from-[#222222] to-[#333333]",
  hamburg: "from-[#333333] to-[#222222]",
  frankfurt: "from-[#222222] to-[#333333]",
  köln: "from-[#333333] to-[#222222]",
  default: "from-[#222222] to-[#333333]",
};

function getCityGradient(city: string): string {
  const key = city.toLowerCase().trim();
  for (const [name, gradient] of Object.entries(CITY_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return CITY_GRADIENTS.default;
}

function useRelativeTime() {
  const { t } = useTranslation();
  return (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return t("freshness.justNow");
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("freshness.justNow");
    if (mins < 60) return t("freshness.minutesAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("freshness.hoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    return days === 1 ? t("freshness.dayAgo", { n: days }) : t("freshness.daysAgo", { n: days });
  };
}

interface Listing {
  id: string;
  title: string;
  city: string;
  district?: string | null;
  price: number;
  bedrooms: number;
  size_m2: number;
  source: string;
  url: string;
  image_url?: string | null;
  first_seen_at: string;
  fresh_label: string;
  match_score?: number | null;
  match_label?: string | null;
  match_reasons?: string[];
  hybrid_filters?: {
    furnished: "confirmed" | "unknown" | "not_filtered";
    district: "confirmed" | "unknown" | "not_filtered";
    pets: "confirmed" | "unknown" | "not_filtered";
  } | null;
}

export default function ListingDetailPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/listing/:id");
  const id = params?.id;
  const { session } = useAuth();
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const relativeTime = useRelativeTime();

  const { data: listing, isLoading, isError } = useQuery<Listing>({
    queryKey: ["/api/listings", id],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await apiFetch(`/api/listings/${id}`, { headers });
      if (!res.ok) throw new Error("Listing not found");
      return res.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!id || !session?.access_token) return;
    apiFetch(`/api/matches/${id}/viewed`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
    trackEvent("listing_opened", { listingId: id });
  }, [id, session?.access_token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
        <FloatingBackButton navigate={navigate} />
        <div className="animate-pulse">
          <div className="h-[260px] bg-[#E5E7EB]" />
          <div className="max-w-xl mx-auto w-full px-5 pt-5 space-y-4">
            <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 space-y-3">
              <div className="h-5 bg-[#F5F7FA] rounded w-28" />
              <div className="h-7 bg-[#F5F7FA] rounded w-3/4" />
              <div className="h-4 bg-[#F5F7FA] rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
        <FloatingBackButton navigate={navigate} />
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-16">
          <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-8 text-center">
            <p className="text-[18px] font-medium text-[#222222] mb-2">{t("listing.notFound")}</p>
            <p className="text-[13px] text-[#222222] mb-4">{t("listing.notFoundDesc")}</p>
            <Button onClick={() => navigate("/dashboard")} className="h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium" data-testid="button-back-dashboard">
              {t("listing.backToDashboard")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const style = FRESH_BADGE_STYLES[listing.fresh_label] ?? FRESH_BADGE_STYLES.ouder;
  const hasImage = !!listing.image_url;
  const gradient = getCityGradient(listing.city);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
      <FloatingBackButton navigate={navigate} />

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full h-[260px] object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-listing-hero"
          />
        ) : (
          <div className={`w-full h-[260px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-10 h-10" />
              <span className="text-[13px] font-medium capitalize">{listing.source}</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-[68px] flex items-center gap-2">
          {listing.fresh_label !== "ouder" && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`} data-testid="badge-freshness">
              {t(FRESH_LABEL_KEYS[listing.fresh_label] ?? "freshness.older")}
            </span>
          )}
          <span className="text-[11px] font-medium text-white/90 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(listing.first_seen_at)}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 -mt-6 relative z-10 pb-36">
        <div className="space-y-4">
          <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5">
            <h1 className="text-[24px] font-medium text-[#222222] leading-[1.2] tracking-[-0.02em] mb-2" data-testid="text-listing-title">
              {listing.title}
            </h1>

            <div className="flex items-center gap-1.5 text-[14px] text-[#222222] mb-4">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span data-testid="text-listing-location">
                {listing.district?.trim() ? `${listing.district.trim()} · ${listing.city}` : listing.city}
              </span>
            </div>

            {listing.price > 0 && (
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[28px] font-medium text-[#222222]" data-testid="text-listing-price">€{listing.price}</span>
                <span className="text-[15px] font-medium text-[#222222]">{t("common.perMonth")}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5">
            <h2 className="text-section-title mb-4">{t("listing.details")}</h2>
            <div className="grid grid-cols-2 gap-4">
              {listing.bedrooms > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F5F7FA] flex items-center justify-center">
                    <BedDouble className="w-5 h-5 text-[#71717A]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#222222]">{t("listing.bedrooms")}</p>
                    <p className="text-[15px] font-medium text-[#222222]" data-testid="text-listing-bedrooms">{listing.bedrooms}</p>
                  </div>
                </div>
              )}

              {listing.size_m2 > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F5F7FA] flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-[#71717A]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[#222222]">{t("listing.area")}</p>
                    <p className="text-[15px] font-medium text-[#222222]" data-testid="text-listing-size">{listing.size_m2} m²</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F5F7FA] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-[#71717A]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#222222]">{t("listing.source")}</p>
                  <p className="text-[15px] font-medium capitalize" style={{ color: "#0D6EFD" }} data-testid="text-listing-source">{listing.source}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F5F7FA] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#71717A]" />
                </div>
                <div>
                  <p className="text-[12px] text-[#222222]">{t("listing.posted")}</p>
                  <p className="text-[15px] font-medium text-[#222222]" data-testid="text-listing-time">{relativeTime(listing.first_seen_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const hf = listing.hybrid_filters;
            if (!hf) return null;
            const unknowns: { key: string; label: string }[] = [];
            if (hf.furnished === "unknown") unknowns.push({ key: "furnished", label: t("hybridFilter.furnishedUnknown") });
            if (hf.district === "unknown") unknowns.push({ key: "district", label: t("hybridFilter.districtUnknown") });
            const hasPetsNote = hf.pets === "unknown";
            if (unknowns.length === 0 && !hasPetsNote) return null;
            return (
              <div
                className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-4 space-y-2"
                data-testid="section-hybrid-filters"
                data-hybrid-furnished={hf.furnished}
                data-hybrid-district={hf.district}
                data-hybrid-pets={hf.pets}
              >
                {unknowns.length > 0 && (
                  <div className="flex items-start gap-2 text-[12px] text-[#222222]/50">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-[1px]" />
                    <div>
                      <p className="font-medium">{t("hybridFilter.unknownHint")}</p>
                      <ul className="mt-1 space-y-0.5">
                        {unknowns.map((u) => (
                          <li key={u.key}>· {u.label}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {hasPetsNote && (
                  <div className="flex items-start gap-2 text-[12px] text-[#222222]/50">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-[1px]" />
                    <p>{t("hybridFilter.petsNote")}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 pb-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {listing.price > 0 && (
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[20px] font-medium text-[#222222]" data-testid="text-bar-price">€{listing.price}</span>
              <span className="text-[13px] font-medium text-[#717171]">{t("common.perMonth")}</span>
            </div>
          )}
          <Button
            onClick={() => navigate(`/apply/${listing.id}`)}
            className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium flex items-center justify-center gap-2"
            data-testid="button-reageer-detail"
          >
            <Zap className="w-4 h-4" />
            {t("listing.applyDirect")}
          </Button>
        </div>
      </div>

    </div>
  );
}
