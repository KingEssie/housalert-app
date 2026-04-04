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
  Copy,
  ImageIcon,
  Lock,
} from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

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
  const relativeTime = useRelativeTime();

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

  if (!sub.loading && !hasAccess) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: "#F9FAFB" }}>
        <AppHeader title={t("applySheet.title") || "Reageren"} onBack={() => navigate("/dashboard?tab=matches")} />
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-8">
          <div className="app-card text-center py-10">
            <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-ha-text-muted" />
            </div>
            <h2 className="text-[18px] font-bold text-[#111111] mb-2" data-testid="text-apply-locked-title">
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
      <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: "#F9FAFB" }}>
        <AppHeader title={t("applySheet.title") || "Reageren"} onBack={() => navigate("/dashboard?tab=matches")} />
        <div className="animate-pulse">
          <div className="w-full bg-[#E5E7EB]" style={{ aspectRatio: "16/10" }} />
          <div className="max-w-xl mx-auto w-full px-5 pt-6 space-y-4">
            <div className="app-card">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 bg-ha-surface rounded-md w-4/5" />
                <div className="h-5 bg-ha-surface rounded-md w-3/5" />
                <div className="h-4 bg-ha-surface rounded-md w-2/5 mt-0.5" />
              </div>
            </div>
            <div className="app-card">
              <div className="h-4 bg-ha-surface rounded w-24 mb-3" />
              <div className="space-y-2">
                <div className="h-3.5 bg-ha-surface rounded w-full" />
                <div className="h-3.5 bg-ha-surface rounded w-5/6" />
                <div className="h-3.5 bg-ha-surface rounded w-4/6" />
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
  if (listing.first_seen_at) {
    detailParts.push(relativeTime(listing.first_seen_at));
  }
  const detailLine = detailParts.join(" · ");

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: "#F9FAFB" }}>
      <AppHeader title={t("applySheet.title") || "Reageren"} onBack={() => navigate("/dashboard?tab=matches")} />

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full object-cover"
            style={{ aspectRatio: "16/10" }}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-apply-hero"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "16/10" }}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-ha-icon-secondary">
              <ImageIcon className="w-10 h-10" />
              <span className="text-[12px] font-medium">{listing.source}</span>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full pb-[120px] -mt-5 relative z-10 px-5 pt-5">
        <div className="space-y-4">
          <div className="app-card text-center">
            {listing.price > 0 && (
              <p className="text-[24px] font-bold text-[#111111] leading-[1.1] tracking-[-0.02em]" data-testid="text-apply-price">
                €{listing.price}<span className="text-[14px] font-normal text-ha-icon-secondary ml-1">{t("common.perMonthShort")}</span>
              </p>
            )}
            <h1
              className="text-[20px] font-bold text-[#111111] leading-[1.2] tracking-[-0.02em] mt-1.5"
              data-testid="text-apply-title"
            >
              {listing.title}
            </h1>
            <p className="text-[15px] text-ha-icon-secondary mt-1.5" data-testid="text-apply-subtitle">
              {subtitle}
            </p>
            {detailLine && (
              <p className="text-[13px] text-ha-icon-secondary mt-1" data-testid="text-apply-details">
                {detailLine}
              </p>
            )}
          </div>

          <div className="app-card">
            <h2 className="text-[16px] font-bold text-[#111111] mb-1" data-testid="text-letter-title">{t("applySheet.applicationLetter")}</h2>
            <p className="text-[12px] text-ha-icon-secondary mb-3" data-testid="text-letter-helper">
              {t("applySheet.autoGenerated") || "Automatisch gegenereerd op basis van jouw profiel"}
            </p>
            <textarea
              className="w-full min-h-[220px] leading-[1.75] bg-white border-[2px] border-[#111111] rounded-[6px] p-4 text-[15px] text-[#111111] outline-none resize-vertical focus:border-ha-primary transition-colors"
              value={editedLetter ?? filledLetter}
              onChange={(e) => setEditedLetter(e.target.value)}
              data-testid="apply-letter-preview"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex items-center justify-between px-5 py-4">
          {listing.price > 0 && (
            <div className="flex flex-col" data-testid="text-sticky-price">
              <span className="text-[20px] font-bold text-[#111111]">€{listing.price}</span>
              <span className="text-[12px] text-ha-text-muted leading-none">{t("common.perMonthShort")}</span>
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
    </div>
  );
}
