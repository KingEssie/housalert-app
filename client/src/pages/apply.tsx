import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import { useLocation, useRoute } from "wouter";
import {
  Copy,
  ArrowLeft,
  ImageIcon,
  MapPin,
  BedDouble,
  Ruler,
  Globe,
  Clock,
} from "lucide-react";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#1F2937] to-[#333333]",
  münchen: "from-[#1F2937] to-[#333333]",
  hamburg: "from-[#333333] to-[#1F2937]",
  frankfurt: "from-[#1F2937] to-[#333333]",
  köln: "from-[#333333] to-[#1F2937]",
  düsseldorf: "from-[#1F2937] to-[#333333]",
  stuttgart: "from-[#333333] to-[#1F2937]",
  default: "from-[#1F2937] to-[#333333]",
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
  const { toast } = useToast();
  const { t } = useTranslation();
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

  if (listingLoading || !listing) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=matches")}
          className="fixed top-[calc(12px+env(safe-area-inset-top))] left-4 z-20 w-12 h-12 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.10)] flex items-center justify-center"
          data-testid="button-back-apply"
        >
          <ArrowLeft className="w-5 h-5 text-[#1F2937]" />
        </button>
        <div className="animate-pulse">
          <div className="h-[240px] bg-[#E5E7EB]" />
          <div className="max-w-xl mx-auto w-full px-5 pt-5 space-y-4">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-3">
              <div className="h-6 bg-[#F5F7FA] rounded w-3/4" />
              <div className="h-4 bg-[#F5F7FA] rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tmpl = profileData?.application_template || DEFAULT_TEMPLATE;
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

  const facts: { icon: typeof MapPin; value: string }[] = [];
  facts.push({ icon: MapPin, value: listing.city });
  if (listing.bedrooms && listing.bedrooms > 0) {
    facts.push({ icon: BedDouble, value: `${listing.bedrooms} ${listing.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}` });
  }
  if (listing.size_m2 && listing.size_m2 > 0) {
    facts.push({ icon: Ruler, value: `${listing.size_m2} m²` });
  }
  if (listing.source) {
    facts.push({ icon: Globe, value: listing.source });
  }
  if (listing.first_seen_at) {
    facts.push({ icon: Clock, value: relativeTime(listing.first_seen_at) });
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
      <button
        onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=matches")}
        className="fixed top-[calc(12px+env(safe-area-inset-top))] left-4 z-20 w-12 h-12 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.10)] flex items-center justify-center active:scale-95 transition-transform"
        data-testid="button-back-apply"
      >
        <ArrowLeft className="w-5 h-5 text-[#1F2937]" />
      </button>

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full h-[240px] object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-apply-hero"
          />
        ) : (
          <div className={`w-full h-[240px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[12px] font-medium">{listing.source}</span>
            </div>
          </div>
        )}

        {listing.price > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3.5 py-1.5 shadow-sm" data-testid="badge-price-photo">
            <span className="text-[17px] font-[800] text-[#111C3D]">€{listing.price}</span>
            <span className="text-[11px] font-medium text-[#6B7280]"> {t("common.perMonthShort")}</span>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 -mt-4 relative z-10 pb-28">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-3">
          <h1 className="text-[20px] font-[800] text-[#111C3D] leading-[1.2] tracking-[-0.02em] mb-2" data-testid="text-apply-title">
            {listing.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#6B7280]" data-testid="facts-block">
            {facts.map((fact, i) => {
              const Icon = fact.icon;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[#E5E7EB] mr-0.5">·</span>}
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="capitalize">{fact.value}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-[#111C3D]">{t("applySheet.applicationLetter")}</p>
          </div>
          <div className="bg-[#F5F7FA] rounded-xl p-4">
            <textarea
              className="w-full text-[14px] text-[#1F2937] leading-relaxed font-[inherit] bg-transparent border-none outline-none resize-none min-h-[180px]"
              value={editedLetter ?? filledLetter}
              onChange={(e) => setEditedLetter(e.target.value)}
              data-testid="apply-letter-preview"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 pb-5 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            onClick={handleCopyAndRespond}
            className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-semibold"
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
