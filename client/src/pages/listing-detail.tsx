import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/track-event";
import { queryClient } from "@/lib/queryClient";
import { MapPin, BedDouble, Ruler, Clock, Globe, Zap, Home as HomeIcon, ArrowLeft, Info, Lock, Heart, ShieldBan } from "lucide-react";
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
      <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} aria-label="Back" data-testid="button-back"><ArrowLeft className="w-[18px] h-[18px] text-[#111111]" /></button>
    </div>
  );
}

const SOURCE_DISPLAY: Record<string, string> = {
  immowelt: "immowelt.de",
  kleinanzeigen: "kleinanzeigen.de",
  "wg-gesucht": "wg-gesucht.de",
  wohnungsboerse: "wohnungsboerse.net",
  immoscout: "immobilienscout24.de",
  immonet: "immonet.de",
  rentola: "rentola.de",
  nestpick: "nestpick.com",
  pararius: "pararius.nl",
  funda: "funda.nl",
  kamernet: "kamernet.nl",
};

function formatSourceDisplay(source: string): string {
  const s = (source || "").trim().toLowerCase();
  return SOURCE_DISPLAY[s] || s;
}

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-white", text: "text-[#111111]" },
  nieuw: { bg: "bg-white", text: "text-[#111111]" },
  vandaag: { bg: "bg-white", text: "text-[#111111]" },
  ouder: { bg: "bg-white/80", text: "text-[#111111]/60" },
};

const FRESH_LABEL_KEYS: Record<string, string> = {
  net_binnen: "freshness.justIn",
  nieuw: "freshness.new",
  vandaag: "freshness.today",
  ouder: "freshness.older",
};

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
  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
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
    apiFetch("/api/favorites", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.favoriteIds && Array.isArray(data.favoriteIds)) {
          setIsFavorited(data.favoriteIds.includes(id));
        }
      })
      .catch(() => {});
  }, [id, session?.access_token]);

  useEffect(() => {
    if (!id || !session?.access_token) return;
    apiFetch(`/api/matches/${id}/viewed`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
    trackEvent("listing_opened", { listingId: id });
  }, [id, session?.access_token]);

  async function handleToggleFavorite() {
    if (!id || !session?.access_token || favLoading) return;
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);
    setFavLoading(true);
    try {
      const res = await apiFetch(`/api/favorites/${id}`, {
        method: wasFavorited ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("request failed");
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites/listings"] });
      toast({
        title: wasFavorited ? t("listing.favoriteRemoved") : t("listing.favoriteAdded"),
      });
    } catch {
      setIsFavorited(wasFavorited);
    } finally {
      setFavLoading(false);
    }
  }

  async function handleBlockSource() {
    if (!listing || !session?.access_token || blockLoading) return;
    setBlockLoading(true);
    try {
      const res = await apiFetch("/api/blocked-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ source: listing.source }),
      });
      if (!res.ok) throw new Error("request failed");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-sources"] });
      toast({
        title: t("listing.blockSource.success"),
        description: t("listing.blockSource.successDesc", { source: formatSourceDisplay(listing.source) }),
      });
      setShowBlockModal(false);
      trackEvent("source_blocked", { source: listing.source });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setBlockLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <FloatingBackButton navigate={navigate} />
        <div className="animate-pulse">
          <div className="w-full bg-[#F0F0F0]" style={{ aspectRatio: "4/3" }} />
          <div className="px-5 pt-5 space-y-3">
            <div className="h-6 bg-[#F0F0F0] rounded-lg w-3/4" />
            <div className="h-4 bg-[#F0F0F0] rounded-lg w-1/2" />
            <div className="h-8 bg-[#F0F0F0] rounded-lg w-1/3 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <FloatingBackButton navigate={navigate} />
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-24 text-center">
          <p className="text-[20px] font-bold text-[#111111] mb-2">{t("listing.notFound")}</p>
          <p className="text-[14px] text-[#9CA3AF] mb-6">{t("listing.notFoundDesc")}</p>
          <Button onClick={() => navigate("/dashboard")} className="h-[50px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-bold px-8" data-testid="button-back-dashboard">
            {t("listing.backToDashboard")}
          </Button>
        </main>
      </div>
    );
  }

  const style = FRESH_BADGE_STYLES[listing.fresh_label] ?? FRESH_BADGE_STYLES.ouder;
  const hasImage = !!listing.image_url;

  const detailItems: { icon: typeof BedDouble; label: string; value: string; color?: string; locked?: boolean }[] = [];
  if (listing.bedrooms > 0) detailItems.push({ icon: BedDouble, label: t("listing.bedrooms"), value: String(listing.bedrooms) });
  if (listing.size_m2 > 0) detailItems.push({ icon: Ruler, label: t("listing.area"), value: `${listing.size_m2} m²` });
  detailItems.push({
    icon: Globe,
    label: t("listing.source"),
    value: hasAccess ? formatSourceDisplay(listing.source) : t("listing.sourceHidden"),
    color: hasAccess ? "text-ha-primary" : undefined,
    locked: !hasAccess,
  });

  return (
    <div className="min-h-screen flex flex-col relative bg-white">
      <FloatingBackButton navigate={navigate} />

      <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-30 flex items-center gap-2.5">
        <button
          onClick={handleToggleFavorite}
          disabled={favLoading}
          className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 ${
            isFavorited
              ? "bg-ha-primary"
              : "bg-black/35 backdrop-blur-sm"
          }`}
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          aria-label="Favorite"
          data-testid="button-favorite-detail"
        >
          <Heart
            className="w-[18px] h-[18px] text-white"
            fill={isFavorited ? "white" : "none"}
            strokeWidth={2}
          />
        </button>

        {hasAccess && (
          <button
            onClick={() => setShowBlockModal(true)}
            className="w-9 h-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform duration-200"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            aria-label="Block source"
            data-testid="button-block-source"
          >
            <ShieldBan className="w-[18px] h-[18px] text-white" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full object-cover"
            style={{ aspectRatio: "4/3", maxHeight: "420px" }}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-listing-hero"
          />
        ) : (
          <div className="w-full bg-[#F3F4F6] flex items-center justify-center" style={{ aspectRatio: "4/3", maxHeight: "420px" }}>
            <HomeIcon className="w-12 h-12 text-[#9CA3AF]" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        <div className="absolute top-3 left-[56px] flex items-center gap-2">
          {listing.fresh_label !== "ouder" && (
            <span className={`text-[11px] font-bold px-2.5 py-[5px] rounded-full ${style.bg} ${style.text}`} style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} data-testid="badge-freshness">
              {t(FRESH_LABEL_KEYS[listing.fresh_label] ?? "freshness.older")}
            </span>
          )}
        </div>

        {listing.price > 0 && (
          <div className="absolute bottom-4 left-5">
            <span className="text-[24px] font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }} data-testid="text-listing-price">€{listing.price}</span>
            <span className="text-[13px] text-white/70 ml-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{t("common.perMonth")}</span>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-4 pb-28">
        <h1 className="text-[20px] font-bold text-[#111111] leading-[1.3]" data-testid="text-listing-title">
          {listing.title}
        </h1>

        <div className="flex items-center gap-1 text-[14px] text-[#6B7280] mt-1">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
          <span data-testid="text-listing-location">
            {listing.district?.trim() ? `${listing.district.trim()} · ${listing.city}` : listing.city}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-5 text-[13px] text-[#6B7280]">
          {detailItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {item.locked ? <Lock className="w-3.5 h-3.5 text-[#C4C4C4]" /> : <item.icon className="w-4 h-4 text-[#9CA3AF]" />}
              <span className={`font-semibold ${item.color || "text-[#111111]"} capitalize`} data-testid={`text-detail-${i}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 mt-3 text-[12px] text-[#9CA3AF]">
          <Clock className="w-3 h-3" />
          <span data-testid="text-listing-time">{relativeTime(listing.first_seen_at)}</span>
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

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#F0F0F0] px-5 pt-3 z-10" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-xl mx-auto">
          {hasAccess ? (
            <Button
              onClick={() => navigate(`/apply/${listing.id}`)}
              className="w-full h-[48px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-bold flex items-center justify-center gap-2"
              style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
              data-testid="button-reageer-detail"
            >
              <Zap className="w-4 h-4" />
              {t("listing.applyDirect")}
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-bold flex items-center justify-center gap-2"
              style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
              data-testid="button-upgrade-detail"
            >
              <Lock className="w-4 h-4" />
              {t("listing.upgradeCta")}
            </Button>
          )}
        </div>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBlockModal(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[20px] sm:rounded-[20px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#FFF1F3] flex items-center justify-center">
                <ShieldBan className="w-6 h-6 text-ha-primary" />
              </div>
            </div>
            <p className="text-[17px] font-bold text-[#111111] text-center" data-testid="text-block-title">
              {t("listing.blockSource.title")}
            </p>
            <p className="text-[15px] text-[#6B7280] text-center mt-2 mb-6" data-testid="text-block-desc">
              {t("listing.blockSource.description", { source: formatSourceDisplay(listing.source) })}
            </p>
            <button
              onClick={handleBlockSource}
              disabled={blockLoading}
              className="w-full h-[48px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-bold mb-3 active:scale-[0.98] transition-transform disabled:opacity-60"
              data-testid="button-block-confirm"
            >
              {blockLoading ? "..." : t("listing.blockSource.confirm")}
            </button>
            <button
              onClick={() => setShowBlockModal(false)}
              className="w-full h-[48px] rounded-full text-[#111111] text-[15px] font-medium active:bg-[#F9FAFB] transition-colors"
              data-testid="button-block-cancel"
            >
              {t("listing.blockSource.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
