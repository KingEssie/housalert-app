import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
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
  BedDouble,
  Copy,
  Tag,
  Heart,
  MapPin,
  Maximize2,
  ShieldBan,
} from "lucide-react";
import { ListingFallback, isValidImageUrl } from "@/components/listing-fallback";

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

const pillStyle: React.CSSProperties = { boxShadow: "0 1px 2px rgba(0,0,0,0.06)" };

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/apply/:id");
  const listingId = params?.id;
  const { user, session } = useAuth();
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

  const StickyHeader = ({ children }: { children?: React.ReactNode }) => (
    <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center h-[52px] px-4">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
          aria-label="Back"
          data-testid="button-back-apply"
        >
          <ArrowLeft className="w-[18px] h-[18px] text-[#111111]" />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-[#111111] mx-3 truncate">
          Is dit jouw droomhuis?
        </span>
        {children}
      </div>
    </div>
  );

  if (listingLoading || !listing) {
    return (
      <div className="min-h-screen flex flex-col bg-[#eaeaeb]">
        <StickyHeader />
        <div className="animate-pulse mx-4 mt-4 bg-white rounded-[20px] overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" }}>
          <div className="w-full bg-[#E5E7EB]" style={{ aspectRatio: "16/9" }} />
          <div className="px-5 pt-4 pb-5 space-y-3">
            <div className="h-5 bg-[#E5E7EB] rounded-md w-4/5" />
            <div className="h-4 bg-[#E5E7EB] rounded-md w-3/5" />
            <div className="flex gap-1.5 mt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[29px] bg-[#E5E7EB] rounded-[8px] w-16" />
              ))}
            </div>
          </div>
        </div>
        <div className="animate-pulse mx-4 mt-4 bg-white rounded-[20px] p-5 space-y-3" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" }}>
          <div className="h-5 bg-[#F3F4F6] rounded w-32" />
          <div className="h-3.5 bg-[#F3F4F6] rounded w-56" />
          <div className="h-[220px] bg-[#F3F4F6] rounded-[16px]" />
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

  const hasImage = isValidImageUrl(listing.image_url);
  const timeAgoLabel = relativeTime(listing.first_seen_at);
  const sourceLabel = listing.source ? formatSourceDisplay(listing.source) : null;
  const metaLine = [timeAgoLabel, sourceLabel].filter(Boolean).join(" · ");
  const postedLabel = listing.first_seen_at ? postedTime(listing.first_seen_at) : "";

  const cardStyle: React.CSSProperties = { boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" };

  return (
    <div className="min-h-screen flex flex-col bg-[#eaeaeb]">
      {/* Sticky white header */}
      <StickyHeader>
        {listing.source && (
          <button
            onClick={() => setShowBlockModal(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
            aria-label="Block source"
            data-testid="button-block-source-apply"
          >
            <ShieldBan className="w-[18px] h-[18px] text-[#111111]" strokeWidth={2} />
          </button>
        )}
      </StickyHeader>

      {/* Main listing card — image + info in one rounded white card */}
      <div className="mx-4 mt-4 bg-white rounded-[20px] overflow-hidden" style={cardStyle}>
        {/* Image with floating heart */}
        <div className="relative">
          {hasImage && !imgError ? (
            <img
              src={listing.image_url!}
              alt={listing.title}
              className="w-full object-cover"
              style={{ aspectRatio: "16/9" }}
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
              data-testid="img-apply-hero"
            />
          ) : (
            <div className="w-full" style={{ aspectRatio: "16/9" }}>
              <ListingFallback title={listing.title} source={listing.source || undefined} city={listing.city} size="hero" />
            </div>
          )}
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            className="absolute top-3 right-3 w-[38px] h-[38px] flex items-center justify-center transition-all duration-150 active:scale-110"
            aria-label="Favorite"
            data-testid="button-favorite-apply"
          >
            <Heart
              className="w-[22px] h-[22px] transition-all duration-150"
              fill={isFavorited ? "#FF385C" : "none"}
              stroke={isFavorited ? "#FF385C" : "#ffffff"}
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))" }}
            />
          </button>
        </div>

        {/* Listing info */}
        <div className="px-5 pt-4 pb-5">
          <h2
            className="text-[18px] font-bold text-[#111111] leading-snug line-clamp-2"
            data-testid="text-apply-title"
          >
            {listing.title}
          </h2>
          {metaLine && (
            <p className="text-[13px] text-[#111111] mt-1" data-testid="text-apply-meta">
              {metaLine}
            </p>
          )}
          <div className="flex flex-nowrap gap-1.5 mt-3 overflow-hidden">
            {listing.city && (
              <span
                className="inline-flex items-center gap-[4px] bg-[#F9FAFB] text-[13px] font-medium text-[#111111] px-2 py-[5px] rounded-[6px] min-w-0 shrink"
                style={pillStyle}
                data-testid="detail-city-apply"
              >
                <MapPin className="w-[19px] h-[19px] flex-shrink-0 text-[#111111]" strokeWidth={1.7} />
                <span className="truncate">{listing.city}</span>
              </span>
            )}
            {listing.bedrooms != null && listing.bedrooms > 0 && (
              <span
                className="inline-flex items-center gap-[4px] bg-[#F9FAFB] text-[13px] font-medium text-[#111111] px-2 py-[5px] rounded-[6px] shrink-0"
                style={pillStyle}
                data-testid="detail-bedrooms-apply"
              >
                <BedDouble className="w-[19px] h-[19px] flex-shrink-0 text-[#111111]" strokeWidth={1.7} />
                {listing.bedrooms}
              </span>
            )}
            {listing.size_m2 != null && listing.size_m2 > 0 && (
              <span
                className="inline-flex items-center gap-[4px] bg-[#F9FAFB] text-[13px] font-medium text-[#111111] px-2 py-[5px] rounded-[6px] shrink-0"
                style={pillStyle}
                data-testid="detail-size-apply"
              >
                <Maximize2 className="w-[19px] h-[19px] flex-shrink-0 text-[#111111]" strokeWidth={1.7} />
                {listing.size_m2} m²
              </span>
            )}
            {listing.price > 0 && (
              <span
                className="inline-flex items-center gap-[4px] bg-[#F9FAFB] text-[13px] font-semibold text-[#111111] px-2 py-[5px] rounded-[6px] shrink-0"
                style={pillStyle}
                data-testid="detail-price-apply"
              >
                <Tag className="w-[19px] h-[19px] flex-shrink-0 text-[#111111]" strokeWidth={1.7} />
                {listing.price}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reactiebrief — separate white card */}
      <div className="mx-4 mt-4 mb-[140px] bg-white rounded-[20px] p-5" style={cardStyle}>
        <h2 className="text-[18px] font-semibold text-[#111111] mb-1" data-testid="text-letter-title">
          {t("applySheet.applicationLetter")}
        </h2>
        <p className="text-[12px] text-[#334855] mb-3" data-testid="text-letter-helper">
          {t("applySheet.autoGenerated") || "Automatisch gegenereerd op basis van jouw profiel"}
        </p>
        <textarea
          className="w-full min-h-[220px] leading-[1.75] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[16px] p-4 text-[16px] text-[#111111] outline-none resize-vertical focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25 transition-all"
          value={editedLetter ?? filledLetter}
          onChange={(e) => setEditedLetter(e.target.value)}
          data-testid="apply-letter-preview"
          autoComplete="off"
          autoCorrect="on"
        />
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-center justify-between px-5 py-4">
          {listing.price > 0 ? (
            <div className="flex flex-col" data-testid="text-sticky-price">
              <span className="text-[20px] font-semibold text-[#111111]">
                €{listing.price}
                <span className="text-[13px] font-normal text-[#334855] ml-1">{t("common.perMonthShort")}</span>
              </span>
              {postedLabel && (
                <span className="text-[11px] text-[#334855] leading-none mt-0.5" data-testid="text-footer-posted">
                  {postedLabel}
                </span>
              )}
            </div>
          ) : (
            <div />
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
              <div className="w-12 h-12 rounded-full bg-[#F5F0EB] flex items-center justify-center">
                <ShieldBan className="w-6 h-6 text-[#111111]" />
              </div>
            </div>
            <p className="text-[17px] font-semibold text-[#111111] text-center" data-testid="text-block-title-apply">
              {t("listing.blockSource.title")}
            </p>
            <p className="text-[15px] text-[#334855] text-center mt-2 mb-6" data-testid="text-block-desc-apply">
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
