import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { isNativePlatform } from "@/lib/capacitor";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDefaultTemplate, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import { useLocation, useRoute } from "wouter";
import { useBuddyConnections, isBuddyMode } from "@/lib/buddy";
import {
  ArrowLeft,
  BedDouble,
  Check,
  Copy,
  Tag,
  Heart,
  Loader2,
  MapPin,
  Maximize2,
  ShieldBan,
  Info,
  Zap,
} from "lucide-react";
import { ListingFallback, isValidImageUrl } from "@/components/listing-fallback";
import { useSubscription } from "@/lib/subscription";

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
  published_at?: string | null;
  source_published_at?: string | null;
  first_seen_at?: string | null;
  display_time?: string | null;
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

const pillStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #111111",
  borderRadius: "9999px",
  padding: "4px 10px 4px 7px",
};

const UPGRADE_PLANS = [
  { id: "three_month", label: "3 maanden", price: "€44,99", perMonth: "€15,00/m", discount: "-40%", popular: false },
  { id: "two_month",   label: "2 maanden", price: "€34,99", perMonth: "€17,50/m", discount: "-30%", popular: true },
  { id: "monthly",     label: "1 maand",   price: "€24,99", perMonth: "€24,99/m", discount: "",     popular: false },
] as const;

const UPGRADE_BULLETS = [
  "Ontvang razendsnelle pushmeldingen",
  "Bespaar tijd en stress",
  "Probeer 14 dagen zonder risico",
];

function UpgradeSheet({
  open,
  onClose,
  accessToken,
}: {
  open: boolean;
  onClose: () => void;
  accessToken?: string;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>("two_month");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { toast } = useToast();

  async function handleCheckout() {
    if (!accessToken || checkoutLoading) return;

    // Native app subscriptions are handled via Google Play / App Store.
    if (isNativePlatform()) {
      toast({
        title: "Binnenkort beschikbaar",
        description: "Abonnementen in de app komen binnenkort beschikbaar.",
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await apiFetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (data.url) {
        console.log("[apply] Opening checkout session_id:", data.session_id?.substring(0, 20));
        window.location.href = data.url;
      } else {
        toast({ title: "Betaling niet beschikbaar", description: "Probeer het later opnieuw.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Er is iets misgegaan", description: "Probeer het later opnieuw.", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
      data-testid="overlay-upgrade-sheet"
    >
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[20px] px-5 pt-4 animate-in slide-in-from-bottom-4 duration-200"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="sheet-upgrade"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: "rgb(var(--ha-card-border))" }} />

        {/* Title */}
        <h2 className="text-[20px] font-bold text-ha-text mb-4" data-testid="text-upgrade-title">
          Upgrade jouw abonnement
        </h2>

        {/* 3 benefit bullets */}
        <div className="flex flex-col gap-2.5 mb-5">
          {UPGRADE_BULLETS.map((bullet) => (
            <div key={bullet} className="flex items-center gap-3">
              <div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgb(var(--ha-success))" }}
              >
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[14px] text-ha-text">{bullet}</p>
            </div>
          ))}
        </div>

        {/* Plan options */}
        <div
          className="flex flex-col mb-4 rounded-[10px] overflow-hidden"
          style={{ border: "1px solid rgb(var(--ha-card-border))" }}
          data-testid="upgrade-plan-options"
        >
          {UPGRADE_PLANS.map((plan, i) => {
            const isSelected = selectedPlan === plan.id;
            const isLast = i === UPGRADE_PLANS.length - 1;
            return (
              <div key={plan.id} className="relative">
                {plan.popular && (
                  <div className="flex justify-center" style={{ marginBottom: "-10px", position: "relative", zIndex: 2 }}>
                    <span
                      className="text-[11px] font-semibold px-3 py-[3px] rounded-full text-white"
                      style={{ backgroundColor: "rgb(var(--ha-success))" }}
                      data-testid="badge-most-chosen"
                    >
                      Meest gekozen
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className="w-full flex items-center justify-between text-left transition-colors"
                  style={{
                    padding: plan.popular ? "18px 14px 14px" : "13px 14px",
                    borderBottom: !isLast ? "1px solid rgb(var(--ha-card-border))" : "none",
                    backgroundColor: isSelected ? "var(--ha-primary-light)" : "white",
                  }}
                  data-testid={`button-plan-${plan.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0"
                      style={{
                        border: isSelected ? "none" : "1.5px solid rgb(var(--ha-card-border))",
                        backgroundColor: isSelected ? "rgb(var(--ha-primary))" : "transparent",
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-ha-text">{plan.label}</p>
                      <p className="text-[12px] text-ha-text-secondary">{plan.perMonth}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-ha-text">{plan.price}</span>
                    {plan.discount && (
                      <span
                        className="text-[11px] font-semibold px-[7px] py-[2px] rounded-[4px]"
                        style={{ backgroundColor: "var(--ha-success-light)", color: "rgb(var(--ha-success))" }}
                      >
                        {plan.discount}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleCheckout}
          disabled={checkoutLoading}
          className="w-full h-[50px] rounded-[12px] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 mb-3"
          style={{ background: "rgb(var(--ha-primary))", boxShadow: "0 4px 14px rgb(var(--ha-primary) / 0.25)" }}
          data-testid="button-upgrade-checkout"
        >
          {checkoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Korting selecteren →"}
        </button>

        {/* Secondary CTA — closes modal only, no navigation */}
        <button
          onClick={onClose}
          className="w-full h-[44px] text-[14px] font-medium text-ha-text-secondary flex items-center justify-center active:opacity-70 transition-opacity"
          data-testid="button-upgrade-skip"
        >
          Doorgaan zonder abonnement →
        </button>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/apply/:id");
  const listingId = params?.id;
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const buddyConns = useBuddyConnections();
  const inBuddyMode = isBuddyMode(buddyConns.data);
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;
  const [marked, setMarked] = useState(false);
  const [editedLetter, setEditedLetter] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const relativeTime = useRelativeTime();
  const postedTime = usePostedTime();

  const accessToken = session?.access_token;

  // Performance: start the listing fetch as soon as we have the listing ID.
  // We pass the auth token only when available — the listing endpoint is public
  // so this lets us avoid blocking on auth loading time.
  const { data: listing, isLoading: listingLoading } = useQuery<ListingData | null>({
    queryKey: ["/api/listing", listingId],
    queryFn: async () => {
      const t0 = performance.now();
      const res = await apiFetch(`/api/listings/${listingId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      console.log(`[apply] listing fetch done in ${Math.round(performance.now() - t0)}ms — status:`, res.status);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!listingId,
    staleTime: 5 * 60 * 1000,
  });

  // Timing log: track how long from mount to listing data being ready.
  useEffect(() => {
    const t0 = performance.now();
    console.log("[apply] mounted — listingId:", listingId);
    return () => console.log("[apply] unmounted after", Math.round(performance.now() - t0), "ms");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (listing) {
      console.log("[apply] listing data ready:", listing.id, "at", performance.now().toFixed(0) + "ms since page load");
    }
  }, [listing]);

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

  const StickyHeader = ({ showBlock = false }: { showBlock?: boolean }) => (
    <div className="sticky top-0 z-30 bg-white border-b border-ha-card-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center h-12 px-4 gap-2">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input flex items-center justify-center transition-colors shrink-0"
          aria-label="Back"
          data-testid="button-back-apply"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text-secondary" />
        </button>
        <span className="text-[16px] font-semibold text-ha-text">Huurwoning</span>
        <div className="flex-1" />
        {showBlock && listing?.source && (
          <button
            onClick={() => setShowBlockModal(true)}
            className="w-10 h-10 rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input flex items-center justify-center transition-colors shrink-0"
            aria-label="Block source"
            data-testid="button-block-source-apply"
          >
            <ShieldBan className="w-[18px] h-[18px] text-ha-text-secondary" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );

  if (listingLoading || !listing) {
    return (
      <div className="min-h-screen flex flex-col bg-ha-bg">
        <StickyHeader />
        <div className="animate-pulse mx-4 mt-4 bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgb(var(--ha-card-border))" }}>
          <div className="w-full bg-ha-card-border" style={{ aspectRatio: "2/1" }} />
          <div className="px-5 pt-4 pb-5 space-y-3">
            <div className="h-5 bg-ha-card-border rounded-md w-4/5" />
            <div className="h-4 bg-ha-card-border rounded-md w-3/5" />
            <div className="flex gap-1.5 mt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[29px] bg-ha-card-border rounded-[8px] w-16" />
              ))}
            </div>
          </div>
        </div>
        <div className="animate-pulse mx-4 mt-4 bg-white rounded-[12px] p-5 space-y-3" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgb(var(--ha-card-border))" }}>
          <div className="h-5 bg-ha-surface rounded w-32" />
          <div className="h-3.5 bg-ha-surface rounded w-56" />
          <div className="h-[220px] bg-ha-surface rounded-[10px]" />
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

    // 1. Copy the letter text first — never pre-open a blank window.
    //    On Android Capacitor, window.open("about:blank", "_blank") opens a real
    //    Chrome process that the app cannot control, producing a blank white page.
    let copied = false;
    try {
      await navigator.clipboard.writeText(editedLetter ?? filledLetter);
      copied = true;
    } catch {
      toast({ title: t("applySheet.copyFailed"), description: t("applySheet.copyFailedDesc"), variant: "destructive" });
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

    // 2. Open the external source URL AFTER copying.
    //    Native: use Capacitor Browser (Chrome Custom Tab) so the WebView stays alive.
    //    Web: window.open in a new tab is safe since there's no popup-blocker risk
    //    after a user gesture and we don't need the reference.
    if (externalUrl) {
      const native = isNativePlatform();
      console.log("[apply] Opening source URL — native:", native, "url:", externalUrl.substring(0, 60));
      if (native) {
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({ url: externalUrl, presentationStyle: "fullscreen" });
        } catch (err) {
          console.warn("[apply] Capacitor Browser failed, falling back to window.open:", err);
          window.open(externalUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const hasImage = isValidImageUrl(listing.image_url);
  const displayTime = listing.display_time || listing.published_at || listing.source_published_at || listing.first_seen_at;
  const timeAgoLabel = relativeTime(displayTime);
  const sourceLabel = listing.source ? formatSourceDisplay(listing.source) : null;
  const metaLine = [timeAgoLabel, sourceLabel].filter(Boolean).join(" · ");
  const postedLabel = displayTime ? postedTime(displayTime) : "";

  const cardStyle: React.CSSProperties = { boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgb(var(--ha-card-border))" };

  return (
    <div className="min-h-screen flex flex-col bg-ha-bg">
      {/* Sticky header: back + "Huurwoning" left, block button right */}
      <StickyHeader showBlock />

      {/* White content section */}
      <div className="mx-4 mt-4 bg-white rounded-[12px] overflow-hidden" style={cardStyle}>

        {/* Section title */}
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-[20px] font-semibold text-ha-text" data-testid="text-detail-section-title">
            Is dit jouw droomhuis?
          </h2>
        </div>

        {/* Listing card — matchVariant style (matches the Matches screen) */}
        <div className="mx-3 mb-4 overflow-hidden" style={{ backgroundColor: "#faf9ff", borderRadius: "24px", boxShadow: "0 6px 24px rgba(0,0,0,0.04)" }}>
          <div className="relative">
            {hasImage && !imgError ? (
              <img
                src={listing.image_url!}
                alt={listing.title}
                className="w-full object-cover"
                style={{ aspectRatio: "2/1" }}
                onError={() => setImgError(true)}
                referrerPolicy="no-referrer"
                data-testid="img-apply-hero"
              />
            ) : (
              <div className="w-full" style={{ aspectRatio: "2/1" }}>
                <ListingFallback title={listing.title} source={listing.source || undefined} city={listing.city} size="hero" />
              </div>
            )}
            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className="absolute top-3 right-3 w-[36px] h-[36px] rounded-full bg-white flex items-center justify-center transition-all duration-150 active:scale-110"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              aria-label="Favorite"
              data-testid="button-favorite-apply"
            >
              <Heart
                className="w-[20px] h-[20px] transition-all duration-150"
                fill={isFavorited ? "#85fb8c" : "none"}
                stroke="#85fb8c"
                strokeWidth={2.5}
              />
            </button>
          </div>

          <div className="p-4 flex flex-col gap-1.5">
            <h3
              className="text-[16px] leading-snug line-clamp-2"
              style={{ color: "#111111", fontWeight: 800 }}
              data-testid="text-apply-title"
            >
              {listing.title}
            </h3>
            {metaLine && (
              <p className="text-[13px]" style={{ color: "#111111", fontWeight: 500 }} data-testid="text-apply-meta">
                {metaLine}
              </p>
            )}
            <div className="flex flex-nowrap gap-1.5 mt-0.5 overflow-hidden">
              {listing.city && (
                <span
                  className="inline-flex items-center gap-[4px] text-[13px] font-medium text-black min-w-0 shrink"
                  style={pillStyle}
                  data-testid="detail-city-apply"
                >
                  <MapPin className="w-[17px] h-[17px] flex-shrink-0" fill="#bbadfb" stroke="#111111" strokeWidth={2.2} />
                  <span className="truncate">{listing.city}</span>
                </span>
              )}
              {listing.bedrooms != null && listing.bedrooms > 0 && (
                <span
                  className="inline-flex items-center gap-[4px] text-[13px] font-medium text-black shrink-0"
                  style={pillStyle}
                  data-testid="detail-bedrooms-apply"
                >
                  <BedDouble className="w-[17px] h-[17px] flex-shrink-0" fill="#bbadfb" stroke="#111111" strokeWidth={2.2} />
                  {listing.bedrooms}
                </span>
              )}
              {listing.size_m2 != null && listing.size_m2 > 0 && (
                <span
                  className="inline-flex items-center gap-[4px] text-[13px] font-medium text-black shrink-0"
                  style={pillStyle}
                  data-testid="detail-size-apply"
                >
                  <Maximize2 className="w-[17px] h-[17px] flex-shrink-0" fill="#bbadfb" stroke="#111111" strokeWidth={2.2} />
                  {listing.size_m2} m²
                </span>
              )}
              {listing.price > 0 && (
                <span
                  className="inline-flex items-center gap-[4px] text-[13px] font-semibold text-black shrink-0"
                  style={pillStyle}
                  data-testid="detail-price-apply"
                >
                  <Tag className="w-[17px] h-[17px] flex-shrink-0" fill="#bbadfb" stroke="#111111" strokeWidth={2.2} />
                  €{listing.price}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* No-subscription: upgrade CTA + info block */}
        {!hasAccess && (
          <div className="px-3 pb-5 flex flex-col gap-3">
            <button
              onClick={() => setShowUpgradeSheet(true)}
              className="w-full h-[48px] rounded-[12px] text-black text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "rgb(var(--ha-highlight))" }}
              data-testid="button-upgrade-to-react"
            >
              <Zap className="w-[18px] h-[18px] text-black" strokeWidth={2} />
              Upgrade om te kunnen reageren
            </button>
            <div className="rounded-[10px] bg-ha-surface px-4 py-3.5 flex items-start gap-3" data-testid="info-no-subscription">
              <Info className="w-[18px] h-[18px] flex-shrink-0 text-ha-text-muted mt-0.5" strokeWidth={2} />
              <p className="text-[14px] text-ha-text-secondary leading-[1.55]">
                Je kunt deze woning bekijken, maar reageren is alleen mogelijk met een abonnement.
              </p>
            </div>
          </div>
        )}

        {/* Active subscription: reactiebrief inside white section */}
        {hasAccess && (
          <div className="px-3 pb-5">
            <h2 className="text-[18px] font-semibold text-ha-text mb-1" data-testid="text-letter-title">
              {t("applySheet.applicationLetter")}
            </h2>
            <p className="text-[12px] text-ha-text-secondary mb-3" data-testid="text-letter-helper">
              {t("applySheet.autoGenerated")}
            </p>
            <textarea
              className="w-full min-h-[220px] leading-[1.75] bg-white rounded-[8px] p-4 text-[16px] text-ha-text outline-none resize-vertical transition-all"
              style={{ border: "1.5px solid #111111" }}
              value={editedLetter ?? filledLetter}
              onChange={(e) => !inBuddyMode && setEditedLetter(e.target.value)}
              readOnly={inBuddyMode}
              data-testid="apply-letter-preview"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="mb-[140px]" />

      {/* Sticky bottom CTA — only for premium users. Free users see inline upgrade CTA above. */}
      {!inBuddyMode && hasAccess && (
        <div
          className="fixed bottom-0 left-0 right-0 z-10"
          style={{
            backgroundColor: "#bbadfb",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4 px-5 py-3">
            {listing.price > 0 && (
              <div className="flex flex-col justify-center flex-shrink-0" data-testid="text-sticky-price">
                <span className="text-[18px] font-semibold" style={{ color: "#111111" }}>
                  €{listing.price}
                  <span className="text-[12px] font-normal ml-1" style={{ color: "rgba(17,17,17,0.6)" }}>{t("common.perMonthShort")}</span>
                </span>
              </div>
            )}
            <Button
              onClick={handleCopyAndRespond}
              className={`ha-btn font-semibold ${listing.price > 0 ? "" : "w-full"}`}
              style={{
                borderRadius: "9999px",
                backgroundColor: "#171429",
                color: "#ffffff",
                paddingLeft: "22px",
                paddingRight: "22px",
                minHeight: "44px",
                height: "44px",
                boxShadow: "0 6px 18px rgba(23,20,41,0.16)",
              }}
              data-testid="button-copy-and-respond"
            >
              <Copy className="w-4 h-4 mr-2" />
              {t("applySheet.copyAndApply")}
            </Button>
          </div>
        </div>
      )}

      {/* Upgrade bottom sheet */}
      <UpgradeSheet
        open={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
        accessToken={accessToken}
      />

      {/* Block source modal */}
      {showBlockModal && listing?.source && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBlockModal(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[20px] sm:rounded-[12px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-ha-highlight flex items-center justify-center">
                <ShieldBan className="w-6 h-6 text-ha-text" />
              </div>
            </div>
            <p className="text-[17px] font-semibold text-ha-text text-center" data-testid="text-block-title-apply">
              {t("listing.blockSource.title")}
            </p>
            <p className="text-[15px] text-ha-text-secondary text-center mt-2 mb-6" data-testid="text-block-desc-apply">
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
              className="w-full h-[48px] rounded-full text-ha-text text-[15px] font-medium active:bg-ha-surface transition-colors"
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
