import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import { MapPin, BedDouble, Ruler, Clock, Globe, Zap, ImageIcon, ArrowLeft, Info, Lock } from "lucide-react";
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
      <button onClick={handleBack} className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform" aria-label="Back" data-testid="button-back"><ArrowLeft className="w-5 h-5 text-[#111111]" /></button>
    </div>
  );
}

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-ha-primary/20", text: "text-ha-primary" },
  nieuw: { bg: "bg-ha-primary", text: "text-white" },
  vandaag: { bg: "bg-ha-primary", text: "text-white" },
  ouder: { bg: "bg-white/20", text: "text-white/80" },
};

const FRESH_LABEL_KEYS: Record<string, string> = {
  net_binnen: "freshness.justIn",
  nieuw: "freshness.new",
  vandaag: "freshness.today",
  ouder: "freshness.older",
};

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#E5E7EB] to-[#E5E7EB]",
  münchen: "from-[#E5E7EB] to-[#E5E7EB]",
  hamburg: "from-[#E5E7EB] to-[#E5E7EB]",
  frankfurt: "from-[#E5E7EB] to-[#E5E7EB]",
  köln: "from-[#E5E7EB] to-[#E5E7EB]",
  default: "from-[#E5E7EB] to-[#E5E7EB]",
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
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;
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
      <div className="min-h-screen flex flex-col relative bg-white">
        <FloatingBackButton navigate={navigate} />
        <div className="animate-pulse">
          <div className="w-full bg-[#F7F7F7]" style={{ aspectRatio: "4/3" }} />
          <div className="px-5 pt-5 space-y-3">
            <div className="h-6 bg-[#F7F7F7] rounded w-3/4" />
            <div className="h-4 bg-[#F7F7F7] rounded w-1/2" />
            <div className="h-8 bg-[#F7F7F7] rounded w-1/3 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <FloatingBackButton navigate={navigate} />
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-20">
          <div className="text-center">
            <p className="text-[20px] font-bold text-[#111111] mb-2">{t("listing.notFound")}</p>
            <p className="text-[14px] text-[#6B7280] mb-6">{t("listing.notFoundDesc")}</p>
            <Button onClick={() => navigate("/dashboard")} className="h-[50px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-bold px-8" data-testid="button-back-dashboard">
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
    <div className="min-h-screen flex flex-col relative bg-white">
      <FloatingBackButton navigate={navigate} />

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full object-cover"
            style={{ aspectRatio: "4/3", maxHeight: "360px" }}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-listing-hero"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "4/3", maxHeight: "360px" }}>
            <div className="absolute inset-0 bg-black/5" />
            <ImageIcon className="w-12 h-12 text-[#111111]/15" />
          </div>
        )}

        <div className="absolute top-3 left-[56px] flex items-center gap-2">
          {listing.fresh_label !== "ouder" && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`} data-testid="badge-freshness">
              {t(FRESH_LABEL_KEYS[listing.fresh_label] ?? "freshness.older")}
            </span>
          )}
          <span className="text-[11px] font-medium text-white/90 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(listing.first_seen_at)}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-5 pb-36">
        <h1 className="text-[22px] font-bold text-[#111111] leading-[1.25] tracking-[-0.01em]" data-testid="text-listing-title">
          {listing.title}
        </h1>

        <div className="flex items-center gap-1 text-[14px] text-[#6B7280] mt-2">
          <MapPin className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
          <span data-testid="text-listing-location">
            {listing.district?.trim() ? `${listing.district.trim()} · ${listing.city}` : listing.city}
          </span>
        </div>

        {listing.price > 0 && (
          <div className="flex items-baseline gap-1.5 mt-4">
            <span className="text-[26px] font-bold text-[#111111]" data-testid="text-listing-price">€{listing.price}</span>
            <span className="text-[14px] text-[#9CA3AF]">{t("common.perMonth")}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-6 pt-5 border-t border-[#F0F0F0]">
          {listing.bedrooms > 0 && (
            <div className="flex items-center gap-3" data-testid="text-listing-bedrooms">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F7F7] flex items-center justify-center">
                <BedDouble className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div>
                <p className="text-[12px] text-[#9CA3AF]">{t("listing.bedrooms")}</p>
                <p className="text-[15px] font-bold text-[#111111]">{listing.bedrooms}</p>
              </div>
            </div>
          )}

          {listing.size_m2 > 0 && (
            <div className="flex items-center gap-3" data-testid="text-listing-size">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F7F7] flex items-center justify-center">
                <Ruler className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              <div>
                <p className="text-[12px] text-[#9CA3AF]">{t("listing.area")}</p>
                <p className="text-[15px] font-bold text-[#111111]">{listing.size_m2} m²</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#F7F7F7] flex items-center justify-center">
              <Globe className="w-5 h-5 text-[#9CA3AF]" />
            </div>
            <div>
              <p className="text-[12px] text-[#9CA3AF]">{t("listing.source")}</p>
              {hasAccess ? (
                <p className="text-[15px] font-bold capitalize text-ha-primary" data-testid="text-listing-source">{listing.source}</p>
              ) : (
                <p className="text-[15px] font-bold text-[#9CA3AF] flex items-center gap-1" data-testid="text-listing-source-locked">
                  <Lock className="w-3.5 h-3.5" />
                  {t("listing.sourceHidden")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#F7F7F7] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#9CA3AF]" />
            </div>
            <div>
              <p className="text-[12px] text-[#9CA3AF]">{t("listing.posted")}</p>
              <p className="text-[15px] font-bold text-[#111111]" data-testid="text-listing-time">{relativeTime(listing.first_seen_at)}</p>
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
              className="mt-5 pt-4 border-t border-[#F0F0F0] space-y-2"
              data-testid="section-hybrid-filters"
              data-hybrid-furnished={hf.furnished}
              data-hybrid-district={hf.district}
              data-hybrid-pets={hf.pets}
            >
              {unknowns.length > 0 && (
                <div className="flex items-start gap-2 text-[12px] text-[#9CA3AF]">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-[1px]" />
                  <div>
                    <p className="font-semibold">{t("hybridFilter.unknownHint")}</p>
                    <ul className="mt-1 space-y-0.5">
                      {unknowns.map((u) => (
                        <li key={u.key}>· {u.label}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {hasPetsNote && (
                <div className="flex items-start gap-2 text-[12px] text-[#9CA3AF]">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-[1px]" />
                  <p>{t("hybridFilter.petsNote")}</p>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#F0F0F0] px-5 pt-3 pb-5 z-10" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-xl mx-auto">
          {hasAccess ? (
            <div className="flex items-center gap-4">
              {listing.price > 0 && (
                <div className="flex-shrink-0">
                  <span className="text-[20px] font-bold text-[#111111]" data-testid="text-bar-price">€{listing.price}</span>
                  <span className="text-[12px] text-[#9CA3AF] ml-1">{t("common.perMonth")}</span>
                </div>
              )}
              <Button
                onClick={() => navigate(`/apply/${listing.id}`)}
                className="flex-1 h-[50px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-bold flex items-center justify-center gap-2"
                data-testid="button-reageer-detail"
              >
                <Zap className="w-4 h-4" />
                {t("listing.applyDirect")}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-[#9CA3AF] text-center mb-2" data-testid="text-locked-hint">
                {t("listing.lockedHint")}
              </p>
              <Button
                onClick={() => navigate("/paywall")}
                className="w-full h-[50px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-bold flex items-center justify-center gap-2"
                data-testid="button-upgrade-detail"
              >
                <Lock className="w-4 h-4" />
                {t("listing.upgradeCta")}
              </Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
