import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDefaultTemplate, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Copy,
  Heart,
  ImageIcon,
  Lock,
  ShieldBan,
} from "lucide-react";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#E5E7EB] to-[#E5E7EB]",
  münchen: "from-[#E5E7EB] to-[#E5E7EB]",
  hamburg: "from-[#E5E7EB] to-[#E5E7EB]",
  frankfurt: "from-[#E5E7EB] to-[#E5E7EB]",
  köln: "from-[#E5E7EB] to-[#E5E7EB]",
  düsseldorf: "from-[#E5E7EB] to-[#E5E7EB]",
  stuttgart: "from-[#E5E7EB] to-[#E5E7EB]",
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

function usePostedTime() {
  const { t } = useTranslation();
  return (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return t("freshness.postedJustNow");
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("freshness.postedJustNow");
    if (mins < 60) return t("freshness.postedMinutesAgo", { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("freshness.postedHoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    return days === 1 ? t("freshness.postedDayAgo", { n: days }) : t("freshness.postedDaysAgo", { n: days });
  };
}

interface ProfileData {
  application_template: string | null;
  document_checklist?: Record<string, boolean> | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
}

interface NotifSettings {
  phone_e164: string | null;
}

interface ListingData {
  id: string;
  title: string;
  city: string;
  district?: string;
  price: number;
  bedrooms?: number;
  size_m2?: number;
  source?: string | null;
  url?: string | null;
  image_url?: string | null;
  first_seen_at?: string | null;
}

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/apply/:id");
  const listingId = params?.id;
  const { user, session } = useAuth();
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [marked, setMarked] = useState(false);
  const [editedLetter, setEditedLetter] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const relativeTime = useRelativeTime();
  const postedTime = usePostedTime();

  const accessToken = session?.access_token;

  const { data: listing, isLoading: listingLoading } = useQuery<ListingData | null>({
    queryKey: ["/api/listing", listingId],
    queryFn: async () => {
      const res = await apiFetch(`/api/listings/${listingId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!listingId && !!accessToken,
  });

  useEffect(() => {
    if (!listingId || !accessToken) return;
    apiFetch(`/api/matches/${listingId}/viewed`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
    trackEvent("listing_opened", { listingId });
  }, [listingId, accessToken]);

  useEffect(() => {
    if (!listingId || !accessToken) return;
    apiFetch("/api/favorites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.favoriteIds && Array.isArray(data.favoriteIds)) {
          setIsFavorited(data.favoriteIds.includes(listingId));
        }
      })
      .catch(() => {});
  }, [listingId, accessToken]);

  async function handleToggleFavorite() {
    if (!listingId || !accessToken || favLoading) return;
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);
    setFavLoading(true);
    try {
      const res = await apiFetch(`/api/favorites/${listingId}`, {
        method: wasFavorited ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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

  function formatSourceDisplay(source: string): string {
    return source
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async function handleBlockSource() {
    if (!listing || !accessToken || blockLoading) return;
    setBlockLoading(true);
    try {
      const res = await apiFetch("/api/blocked-sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ source: listing.source }),
      });
      if (!res.ok) throw new Error("request failed");
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-sources"] });
      toast({
        title: t("listing.blockSource.success"),
        description: t("listing.blockSource.successDesc", { source: formatSourceDisplay(listing.source || "") }),
      });
      setShowBlockModal(false);
    } catch {
      toast({ title: t("listing.blockSource.error"), variant: "destructive" });
    } finally {
      setBlockLoading(false);
    }
  }

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { application_template: null };
      return res.json();
    },
    enabled: !!accessToken,
  });

  const { data: notifSettings } = useQuery<NotifSettings>({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/settings", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { phone_e164: null };
      return res.json();
    },
    enabled: !!accessToken,
  });

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/dashboard?tab=matches");
    }
  }

  if (!sub.loading && !hasAccess) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30">
          <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} aria-label="Back" data-testid="button-back-apply">
            <ArrowLeft className="w-[18px] h-[18px] text-[#111111]" />
          </button>
        </div>
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-20">
          <div className="app-card text-center py-10">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-ha-text-muted" />
            </div>
            <h2 className="text-[18px] font-semibold text-[#111111] mb-2" data-testid="text-apply-locked-title">
              {t("listing.upgradeCta")}
            </h2>
            <p className="text-[14px] text-ha-text-muted mb-6 leading-relaxed max-w-[280px] mx-auto" data-testid="text-apply-locked-desc">
              {t("listing.lockedHint")}
            </p>
            <Button
              onClick={() => navigate("/paywall")}
              className="w-full max-w-[280px] h-[48px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-semibold flex items-center justify-center gap-2"
              data-testid="button-apply-upgrade"
            >
              <Lock className="w-4 h-4" />
              {t("listing.upgradeCta")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (listingLoading || !listing) {
    return (
      <div className="min-h-screen flex flex-col relative bg-white">
        <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30">
          <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} aria-label="Back" data-testid="button-back-apply">
            <ArrowLeft className="w-[18px] h-[18px] text-[#111111]" />
          </button>
        </div>
        <div className="animate-pulse">
          <div className="w-full bg-[#E5E7EB]" style={{ aspectRatio: "4/3" }} />
          <div className="max-w-xl mx-auto w-full px-5 -mt-6 relative z-10">
            <div className="bg-white rounded-t-[20px] px-5 pt-6 pb-4 space-y-3">
              <div className="h-5 bg-[#F3F4F6] rounded-md w-4/5" />
              <div className="h-4 bg-[#F3F4F6] rounded-md w-3/5" />
              <div className="h-3.5 bg-[#F3F4F6] rounded-md w-2/5" />
              <div className="h-px bg-[#F0F0F0] my-4" />
              <div className="h-4 bg-[#F3F4F6] rounded w-28" />
              <div className="space-y-2 mt-2">
                <div className="h-3.5 bg-[#F3F4F6] rounded w-full" />
                <div className="h-3.5 bg-[#F3F4F6] rounded w-5/6" />
                <div className="h-3.5 bg-[#F3F4F6] rounded w-4/6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const defaultTemplate = getDefaultTemplate(locale);
  const tmpl = profileData?.application_template || defaultTemplate;
  const address = listing.district
    ? `${listing.title}, ${listing.district}`
    : listing.title;
  const filledLetter = fillTemplate(
    tmpl,
    {
      title: listing.title,
      city: listing.city,
      price: listing.price,
      address,
    },
    {
      email: user?.email || undefined,
      name: [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ") || undefined,
      phone: profileData?.phone || notifSettings?.phone_e164 || undefined,
      occupation: profileData?.occupation || undefined,
      income: profileData?.monthly_income != null ? String(profileData.monthly_income) : undefined,
    }
  );

  const handleCopyAndRespond = async () => {
    const externalUrl = listing.url;
    let externalWindow: Window | null = null;
    if (externalUrl) {
      externalWindow = window.open("about:blank", "_blank");
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(editedLetter ?? filledLetter);
      copied = true;
    } catch {
      toast({ title: t("applySheet.copyFailed"), description: t("applySheet.copyFailedDesc"), variant: "destructive" });
      if (externalWindow) externalWindow.close();
    }

    if (!copied) return;

    toast({ title: t("applySheet.copiedOpening") });

    setMarked(true);
    trackEvent("first_reaction", { listingId: listing.id, source: "apply_page" });
    const MATCH_APPLIED_KEY = "housalert_match_applied";
    try {
      const stored = localStorage.getItem(MATCH_APPLIED_KEY);
      const appliedSet = new Set<string>(stored ? JSON.parse(stored) : []);
      appliedSet.add(listing.id);
      localStorage.setItem(MATCH_APPLIED_KEY, JSON.stringify(Array.from(appliedSet)));
    } catch {}
    if (accessToken) {
      apiFetch(`/api/matches/${listing.id}/applied`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ applied: true }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      }).catch(() => {});
    }

    if (externalWindow && externalUrl) {
      externalWindow.location.href = externalUrl;
    } else if (externalUrl) {
      window.location.href = externalUrl;
    }
  };

  const hasImage = !!listing.image_url;
  const gradient = getCityGradient(listing.city);

  const propertyType = t("listingDetail.propertyFallback");
  const subtitle = `${propertyType} ${t("listingDetail.subtitleIn")} ${listing.city}, ${t("listingDetail.country")}`;

  const detailParts: string[] = [];
  if (listing.bedrooms && listing.bedrooms > 0) {
    detailParts.push(`${listing.bedrooms} ${listing.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}`);
  }
  if (listing.size_m2 && listing.size_m2 > 0) {
    detailParts.push(`${listing.size_m2} m²`);
  }
  const detailLine = detailParts.join(" · ");
  const postedLabel = listing.first_seen_at ? postedTime(listing.first_seen_at) : "";

  return (
    <div className="min-h-screen flex flex-col relative bg-white">
      {/* Floating back button */}
      <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30">
        <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} aria-label="Back" data-testid="button-back-apply">
          <ArrowLeft className="w-[18px] h-[18px] text-[#111111]" />
        </button>
      </div>

      {/* Floating action icons — top-right on image */}
      <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-30 flex items-center gap-2.5">
        <button
          onClick={handleToggleFavorite}
          disabled={favLoading}
          className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform duration-150"
          aria-label="Favorite"
          data-testid="button-favorite-apply"
        >
          <Heart
            className={`w-[22px] h-[22px] transition-colors duration-200 ${isFavorited ? "text-ha-primary" : "text-white"}`}
            fill={isFavorited ? "currentColor" : "none"}
            strokeWidth={2}
            style={{ filter: isFavorited ? "none" : "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
          />
        </button>

        {listing.source && (
          <button
            onClick={() => setShowBlockModal(true)}
            className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform duration-150"
            aria-label="Block source"
            data-testid="button-block-source-apply"
          >
            <ShieldBan
              className="w-[22px] h-[22px] text-white"
              strokeWidth={2}
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
            />
          </button>
        )}
      </div>

      {/* Hero image */}
      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full object-cover"
            style={{ aspectRatio: "4/3" }}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-apply-hero"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "4/3" }}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-[#D1D5DB]">
              <ImageIcon className="w-10 h-10" />
              <span className="text-[12px] font-medium">{listing.source}</span>
            </div>
          </div>
        )}
      </div>

      {/* Overlapping white content sheet */}
      <main className="flex-1 max-w-xl mx-auto w-full pb-[120px] -mt-6 relative z-10">
        <div className="bg-white rounded-t-[20px] px-5 pt-6">
          {/* Title */}
          <h1
            className="text-[22px] font-semibold text-[#111111] leading-[1.3] tracking-[-0.01em] line-clamp-2 text-center"
            data-testid="text-apply-title"
          >
            {listing.title}
          </h1>

          {/* Subtitle + details — same size and color */}
          <p className="text-[14px] text-[#4B5563] mt-2 leading-[1.5] text-center" data-testid="text-apply-subtitle">
            {subtitle}
          </p>
          {detailLine && (
            <p className="text-[14px] text-[#4B5563] mt-0.5 leading-[1.5] text-center" data-testid="text-apply-details">
              {detailLine}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-[#E5E7EB] my-5" />

          {/* Reaction letter section */}
          <h2 className="text-[16px] font-semibold text-[#111111] mb-1" data-testid="text-letter-title">{t("applySheet.applicationLetter")}</h2>
          <p className="text-[12px] text-[#6B7280] mb-3" data-testid="text-letter-helper">
            {t("applySheet.autoGenerated") || "Automatisch gegenereerd op basis van jouw profiel"}
          </p>
          <textarea
            className="w-full min-h-[220px] leading-[1.75] bg-white border border-[#E5E7EB] rounded-[10px] p-4 text-[15px] text-[#111111] outline-none resize-vertical focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20 transition-all"
            value={editedLetter ?? filledLetter}
            onChange={(e) => setEditedLetter(e.target.value)}
            data-testid="apply-letter-preview"
            autoComplete="off"
            autoCorrect="on"
          />
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-center justify-between px-5 py-4">
          {listing.price > 0 && (
            <div className="flex flex-col" data-testid="text-sticky-price">
              <span className="text-[20px] font-semibold text-[#111111]">€{listing.price}<span className="text-[13px] font-normal text-[#6B7280] ml-1">{t("common.perMonthShort")}</span></span>
              {postedLabel && (
                <span className="text-[11px] font-normal text-[#9CA3AF] leading-none mt-0.5" data-testid="text-footer-posted">{postedLabel}</span>
              )}
            </div>
          )}
          <Button
            onClick={handleCopyAndRespond}
            className={`ha-btn bg-ha-primary hover:bg-ha-primary-hover text-white font-semibold ${listing.price > 0 ? "" : "w-full"}`}
            data-testid="button-copy-and-respond"
          >
            <Copy className="w-4 h-4 mr-2" />
            {t("applySheet.copyAndApply")}
          </Button>
        </div>
      </div>

      {/* Block source modal */}
      {showBlockModal && listing?.source && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBlockModal(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[20px] sm:rounded-[20px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-[#FDF1F6] flex items-center justify-center">
                <ShieldBan className="w-6 h-6 text-ha-primary" />
              </div>
            </div>
            <p className="text-[17px] font-semibold text-[#111111] text-center" data-testid="text-block-title-apply">
              {t("listing.blockSource.title")}
            </p>
            <p className="text-[15px] text-[#6B7280] text-center mt-2 mb-6" data-testid="text-block-desc-apply">
              {t("listing.blockSource.description", { source: formatSourceDisplay(listing.source) })}
            </p>
            <button
              onClick={handleBlockSource}
              disabled={blockLoading}
              className="w-full h-[48px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-semibold mb-3 active:scale-[0.98] transition-transform disabled:opacity-60"
              data-testid="button-block-confirm-apply"
            >
              {blockLoading ? "..." : t("listing.blockSource.confirm")}
            </button>
            <button
              onClick={() => setShowBlockModal(false)}
              className="w-full h-[48px] rounded-full text-[#111111] text-[15px] font-medium active:bg-[#F9FAFB] transition-colors"
              data-testid="button-block-cancel-apply"
            >
              {t("listing.blockSource.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
