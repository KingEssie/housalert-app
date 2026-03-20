import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, type ApiMatch, type ApiMatchesResponse, type CanonicalStats } from "@/lib/listings";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/lib/subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import {
  Home,
  SlidersHorizontal,
  User,
  Plus,
  Trash2,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  Crown,
  Eye,
  Send,
  ImageIcon,
  Zap,
  Camera,
  ArrowLeft,
  Copy,
  Pencil,
  Users,
  Circle,
  Globe,
  Rocket,
  Gift,
  FileText,
  Phone,
  Lightbulb,
  Check,
  MoreVertical,
} from "lucide-react";
import { TaskModal, PrepTaskModal } from "@/components/profile-strength";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import TipsPage, { getTipsProgress } from "@/pages/tips";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const MAX_PROFILES = 4;

function bedroomLabel(min: number, t: (key: string) => string) {
  if (min === 0) return t("profile.studioPlus");
  return `${min}+`;
}

function relativeTime(dateStr: string | null | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
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
}

type TabKey = "home" | "matches" | "filters" | "tips" | "profiel";
type MatchSubTab = "nieuw" | "bekeken" | "gereageerd";

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

const MATCH_VIEWED_KEY = "housalert_match_viewed";
const MATCH_APPLIED_KEY = "housalert_match_applied";

function safeGetSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function safeSetSet(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function markViewed(listingId: string) {
  const s = safeGetSet(MATCH_VIEWED_KEY);
  const wasNew = !s.has(listingId);
  s.add(listingId);
  safeSetSet(MATCH_VIEWED_KEY, s);
  if (wasNew) {
    trackEvent("first_match_viewed", { listingId });
  }
}

function getMatchTab(match: ApiMatch): MatchSubTab {
  if (match.canonical_applied || safeGetSet(MATCH_APPLIED_KEY).has(match.listing_id)) return "gereageerd";
  if (match.canonical_viewed || safeGetSet(MATCH_VIEWED_KEY).has(match.listing_id)) return "bekeken";
  return "nieuw";
}


function MatchCard({
  match,
  onStatusChange,
}: {
  match: ApiMatch;
  onStatusChange: () => void;
}) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const gradient = getCityGradient(match.city);
  const hasImage = !!match.image_url;

  function handleCardClick() {
    markViewed(match.listing_id);
    onStatusChange();
    navigate(`/apply/${match.listing_id}`);
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={handleCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative rounded-[20px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
        {hasImage && !imgError ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ aspectRatio: "4/3" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "4/3" }}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2.5 text-white/50">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[12px] font-medium">{match.source}</span>
            </div>
          </div>
        )}

        <div className="absolute top-3.5 left-3.5 flex gap-1.5">
          <span className="text-[11px] font-medium bg-white/95 backdrop-blur-md text-[#1F2937] px-3 py-1.5 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.06)] capitalize">
            {match.source}
          </span>
        </div>
      </div>

      <div className="px-0.5 pt-[10px]">
        <div className="flex items-baseline justify-between gap-2 leading-[1.25]">
          <h3
            className="text-[16px] font-semibold text-[#000] leading-[1.25] line-clamp-1 flex-1 min-w-0"
            data-testid={`text-match-title-${match.listing_id}`}
          >
            {match.title}
          </h3>
          {match.price > 0 && (
            <span className="text-[16px] font-semibold text-[#000] leading-[1.25] flex-shrink-0 whitespace-nowrap" data-testid={`badge-price-${match.listing_id}`}>
              €{match.price} <span className="text-[16px] font-normal text-[#6B7280]">{t("common.perMonthShort")}</span>
            </span>
          )}
        </div>
        <p className="text-[16px] text-[#6B7280] leading-[1.25] mt-[3px] truncate" data-testid={`text-match-city-${match.listing_id}`}>
          {match.city}
        </p>
        <div className="flex items-center gap-1.5 mt-[2px] text-[16px] text-[#6B7280] leading-[1.25]">
          {match.bedrooms > 0 && (
            <span>{match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}</span>
          )}
          {match.bedrooms > 0 && match.size_m2 > 0 && <span>·</span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          {(match.bedrooms > 0 || match.size_m2 > 0) && <span>·</span>}
          <span>{relativeTime(match.matched_at || match.first_seen_at, t)}</span>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  onDelete,
  deleting,
  onEdit,
}: {
  profile: SearchProfile;
  onDelete: () => void;
  deleting: boolean;
  onEdit: () => void;
}) {
  const { t, locale } = useTranslation();

  return (
    <div
      className={`rounded-[20px] border border-[#F0F0F0] p-4 flex items-center gap-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] ${deleting ? "opacity-50 pointer-events-none" : ""}`}
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-[#111827] text-[15px] leading-snug line-clamp-1" data-testid={`text-profile-city-${profile.id}`}>
            {getProfileTitle(profile, t, locale)}
          </h3>
          <span className="text-[10px] font-medium text-[#22C55E] bg-[#F0FDF4] px-2 py-0.5 rounded-full flex-shrink-0" data-testid={`badge-status-${profile.id}`}>
            {t("common.active")}
          </span>
        </div>
        <p className="text-[13px] text-[#9CA3AF] mt-0.5 line-clamp-1" data-testid={`text-profile-summary-filters-${profile.id}`}>
          {getProfileSummary(profile, t)}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F5F7FA] transition-colors flex-shrink-0"
            disabled={deleting}
            data-testid={`button-menu-filters-${profile.id}`}
          >
            <MoreVertical className="w-[18px] h-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          <DropdownMenuItem
            onClick={onEdit}
            className="flex items-center gap-2.5 cursor-pointer"
            data-testid={`menu-edit-filters-${profile.id}`}
          >
            <Pencil className="w-4 h-4 text-[#6B7280]" />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="flex items-center gap-2.5 text-[#EF4444] focus:text-[#EF4444] cursor-pointer"
            data-testid={`menu-delete-filters-${profile.id}`}
          >
            <Trash2 className="w-4 h-4" />
            {t("filters.deleteTitle")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RecenteMatchesSection({ accessToken, setActiveTab, subscription, navigate }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void; subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null }; navigate: (path: string) => void }) {
  const hasActiveSub = subscription.isActive || subscription.isTrial;
  const { t } = useTranslation();

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken && hasActiveSub,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const matches = (apiMatchesQuery.data?.matches ?? [])
    .filter(m => m.title && m.url && m.listing_id)
    .slice(0, 8);
  const isLoading = apiMatchesQuery.isLoading;

  if (!hasActiveSub) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        <div className="rounded-[24px] border border-[#F0F0F0] p-6 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-[14px] text-[#6B7280] mb-4 leading-relaxed">
            {t("home.matchesWillAppear")}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="h-[42px] px-6 rounded-xl bg-[#111827] text-white text-[13px] font-medium transition-colors hover:bg-[#1F2937]"
            data-testid="button-activate-sub-matches"
          >
            {t("home.viewSubscriptions")}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        <div className="flex gap-[14px] overflow-x-auto pb-1 scrollbar-none">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[72vw] max-w-[280px]">
              <div className="w-full bg-[#F5F7FA] rounded-[16px] animate-pulse" style={{ aspectRatio: "4/3" }} />
              <div className="pt-2.5 flex flex-col gap-2">
                <div className="h-4 bg-[#F5F7FA] rounded-md w-2/3 animate-pulse" />
                <div className="h-3.5 bg-[#F5F7FA] rounded-md w-full animate-pulse" />
                <div className="h-3 bg-[#F5F7FA] rounded-md w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        <div className="rounded-[24px] border border-[#F0F0F0] p-6 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]">
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            {t("home.firstMatchesWillAppear")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="section-recente-matches">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        <button
          onClick={() => setActiveTab("matches")}
          className="text-[13px] font-medium text-[#0D6EFD] flex items-center gap-0.5"
          data-testid="button-view-all-matches"
        >
          {t("home.viewAll")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-[14px] overflow-x-auto pb-1 scrollbar-none" style={{ scrollSnapType: "x proximity" }}>
        {matches.map((match) => (
          <div key={match.listing_id} className="snap-start first:pl-0 last:pr-1">
            <RecentMatchCard match={match} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentMatchCard({ match }: { match: ApiMatch }) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[72vw] max-w-[280px] cursor-pointer transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/40 rounded-[20px]"
      onClick={() => {
        markViewed(match.listing_id);
        navigate(`/apply/${match.listing_id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          markViewed(match.listing_id);
          navigate(`/apply/${match.listing_id}`);
        }
      }}
      data-testid={`card-recent-match-${match.listing_id}`}
    >
      <div className="relative rounded-[20px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover"
            style={{ aspectRatio: "4/3" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "4/3" }}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-1.5 text-white/50">
              <ImageIcon className="w-7 h-7" />
              <span className="text-[11px] font-medium">{match.source}</span>
            </div>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[10px] font-medium bg-white/95 backdrop-blur-md text-[#1F2937] px-2.5 py-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.08)] capitalize">
            {match.source}
          </span>
        </div>
      </div>

      <div className="pt-2.5 flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-[#111827] truncate" data-testid={`text-recent-city-${match.listing_id}`}>
          {match.city}
        </span>
        <p className="text-[14px] text-[#6B7280] line-clamp-1 leading-[1.35]" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </p>
        <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF] mt-0.5">
          {match.bedrooms > 0 && (
            <span>{match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}</span>
          )}
          {match.bedrooms > 0 && match.size_m2 > 0 && <span className="text-[#D1D5DB]">·</span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
        </div>
        {match.price > 0 && (
          <p className="mt-1" data-testid={`badge-recent-price-${match.listing_id}`}>
            <span className="text-[15px] font-medium text-[#111827]">€{match.price}</span>
            <span className="text-[12px] text-[#9CA3AF] ml-0.5">{t("common.perMonthShort")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function RecentlyViewedSection({ accessToken }: { accessToken: string | undefined }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const viewedMatches = (apiMatchesQuery.data?.matches ?? [])
    .filter(m => m.title && m.url && m.listing_id && getMatchTab(m) === "bekeken")
    .slice(0, 10);

  if (apiMatchesQuery.isLoading || viewedMatches.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="section-recently-viewed">
      <h2 className="text-section-title">{t("home.recentlyViewed")}</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollSnapType: "x proximity" }}>
        {viewedMatches.map((match) => (
          <RecentlyViewedCard key={match.listing_id} match={match} />
        ))}
      </div>
    </div>
  );
}

function RecentlyViewedCard({ match }: { match: ApiMatch }) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/40 rounded-[16px]"
      onClick={() => navigate(`/apply/${match.listing_id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/apply/${match.listing_id}`);
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="relative rounded-[16px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover"
            style={{ aspectRatio: "1/1" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "1/1" }}>
            <div className="absolute inset-0 bg-black/5" />
            <ImageIcon className="w-5 h-5 text-white/40" />
          </div>
        )}
      </div>
      <div className="pt-1.5 flex flex-col gap-0">
        <p className="text-[12px] font-medium text-[#18181B] line-clamp-1 leading-snug">{match.title}</p>
        <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
          {match.price > 0 && <span>€{match.price}</span>}
          {match.price > 0 && match.size_m2 > 0 && <span>·</span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
        </div>
      </div>
    </div>
  );
}

const DUTCH_CITY_NAMES: Record<string, string> = {
  "Berlin": "Berlijn",
  "Köln": "Keulen",
  "Frankfurt": "Frankfurt",
  "Düsseldorf": "Düsseldorf",
  "München": "München",
  "Hamburg": "Hamburg",
  "Stuttgart": "Stuttgart",
  "Leipzig": "Leipzig",
  "Dresden": "Dresden",
  "Hannover": "Hannover",
  "Nürnberg": "Neurenberg",
  "Bremen": "Bremen",
  "Essen": "Essen",
  "Braunschweig": "Braunschweig",
  "Freiburg": "Freiburg",
  "Aachen": "Aken",
};

function localizeCityName(raw: string, locale: string): string {
  if (locale === "nl") return DUTCH_CITY_NAMES[raw] || raw;
  return raw;
}

function getProfileTitle(p: SearchProfile, t: (key: string, params?: Record<string, string | number>) => string, locale: string): string {
  const rawCity = p.city_name || p.city || "";
  const city = localizeCityName(rawCity, locale);
  if (p.location_mode === "commute" && p.commute_destination) {
    const dest = p.commute_destination.split(",")[0].trim();
    const mins = p.commute_minutes || 30;
    const modeMap: Record<string, string> = { transit: t("searchProfiles.transit"), bicycling: t("searchProfiles.bike"), driving: t("searchProfiles.car"), walking: t("searchProfiles.walk") };
    const modeLabel = modeMap[p.commute_mode || "transit"] || t("searchProfiles.transit");
    return t("searchProfiles.commuteTitle", { dest, mins, mode: modeLabel });
  }
  if (p.location_mode === "radius" && p.radius_km && city) {
    return t("searchProfiles.radiusTitle", { km: p.radius_km, city });
  }
  if (p.location_mode === "districts" && p.districts && p.districts.length > 0) {
    const conjunction = t("searchProfiles.and");
    const joined = p.districts.length <= 2 ? p.districts.join(` ${conjunction} `) : `${p.districts.slice(0, 2).join(", ")} +${p.districts.length - 2}`;
    return t("searchProfiles.districtTitle", { districts: joined });
  }
  return t("searchProfiles.cityTitle", { city });
}

function getProfileSummary(p: SearchProfile, t: (key: string, params?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  if (p.price_min > 0 && p.price_max > 0) parts.push(`€${p.price_min} – €${p.price_max}`);
  else if (p.price_max > 0) parts.push(`${t("searchProfiles.max")} €${p.price_max}`);
  else if (p.price_min > 0) parts.push(`${t("searchProfiles.min")} €${p.price_min}`);
  else parts.push("€0 – €5.000+");
  if (p.bedrooms_min > 0) parts.push(`${p.bedrooms_min}+ ${t("searchProfiles.bedrooms")}`);
  if (p.size_min > 0) parts.push(`${p.size_min}+ m²`);
  return parts.join(" · ");
}

function SearchProfilesSection({ profiles, navigate }: { profiles: SearchProfile[]; navigate: (path: string) => void }) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteSearchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      toast({ title: t("filters.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("filters.deleteFailed"), description: err?.message ?? t("filters.retryDesc"), variant: "destructive" });
    },
    onSettled: () => setDeletingId(null),
  });

  if (profiles.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-3" data-testid="section-search-profiles">
        <h2 className="text-section-title">{t("searchProfiles.sectionTitle")}</h2>
        <div className="flex flex-col gap-2.5">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="w-full bg-white rounded-[20px] border border-[#F0F0F0] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3.5"
              data-testid={`card-search-profile-${p.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[#18181B] leading-snug line-clamp-1" data-testid={`text-profile-title-${p.id}`}>
                  {getProfileTitle(p, t, locale)}
                </p>
                <p className="text-[13px] text-[#9CA3AF] mt-0.5 line-clamp-1" data-testid={`text-profile-summary-${p.id}`}>
                  {getProfileSummary(p, t)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F5F7FA] transition-colors flex-shrink-0"
                    data-testid={`button-menu-${p.id}`}
                  >
                    <MoreVertical className="w-[18px] h-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem
                    onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
                    className="flex items-center gap-2.5 cursor-pointer"
                    data-testid={`menu-edit-${p.id}`}
                  >
                    <Pencil className="w-4 h-4 text-[#6B7280]" />
                    {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="flex items-center gap-2.5 text-[#EF4444] focus:text-[#EF4444] cursor-pointer"
                    data-testid={`menu-delete-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("filters.deleteTitle")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
      {confirmDeleteId && (
        <DeleteConfirmScreen
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            setDeletingId(confirmDeleteId);
            deleteMutation.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
    </>
  );
}

function ProgressRing({ progress, size = 44, strokeWidth = 3.5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#0D6EFD"
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

interface ActivationStatus {
  profileCreated: boolean;
  notificationsEnabled: boolean;
  firstMatchViewed: boolean;
  firstReaction: boolean;
  trialStarted: boolean;
  subscriptionStarted: boolean;
}

function UnifiedTaskList({ accessToken, navigate, setActiveTab }: { accessToken: string | undefined; navigate: (path: string) => void; setActiveTab: (tab: TabKey) => void }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const statusQuery = useQuery<ActivationStatus & { profileCreatedAt?: string | null; totalMatches?: number }>({
    queryKey: ["/api/activation-status"],
    queryFn: async () => {
      const res = await apiFetch("/api/activation-status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const strengthQuery = useQuery<{ tasks: { id: string; completed: boolean }[]; prepTasks: { id: string; completed: boolean }[] }>({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const status = statusQuery.data;
  const strength = strengthQuery.data;
  if (!status && !strength) return null;

  const HIDDEN_TASK_IDS = new Set([
    "alerts",
    "prep_letter",
    "prep_network",
    "prep_search_profile",
    "trialStarted",
    "subscriptionStarted",
    "prep_extra_profile",
    "search_optimize",
  ]);

  const TASK_ACTION_MAP: Record<string, () => void> = {
    profileCreated: () => navigate("/dashboard/searches/new"),
    notificationsEnabled: () => {
      setActiveTab("profiel");
      setTimeout(() => {
        document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    },
    firstMatchViewed: () => setActiveTab("matches"),
    firstReaction: () => { setActiveTab("matches"); },
    search_buddy: () => navigate("/profile/edit/search_buddy_email"),
    application_template: () => navigate("/application-letter"),
    documents: () => navigate("/documents"),
    phone: () => navigate("/profile/edit/phone"),
    prep_viewing_tips: () => setActiveTab("tips"),
  };

  const TASK_ICON_MAP: Record<string, typeof Bell> = {
    profileCreated: Search,
    notificationsEnabled: Bell,
    firstMatchViewed: Eye,
    firstReaction: Send,
    search_buddy: Users,
    application_template: Pencil,
    documents: FileText,
    phone: Phone,
    tips_lezen: Lightbulb,
  };

  const allTasks: { key: string; label: string; done: boolean; action: () => void }[] = [];

  if (status) {
    const activationTasks = [
      { key: "profileCreated", label: t("activation.profileCreated"), done: status.profileCreated },
      { key: "notificationsEnabled", label: t("activation.notificationsEnabled"), done: status.notificationsEnabled },
      { key: "firstMatchViewed", label: t("activation.firstMatchViewed"), done: status.firstMatchViewed },
      { key: "firstReaction", label: t("activation.firstReaction"), done: status.firstReaction },
    ];
    activationTasks.forEach((task) => {
      allTasks.push({ ...task, action: TASK_ACTION_MAP[task.key] || (() => {}) });
    });
  }

  const STRENGTH_LABEL_MAP: Record<string, string> = {
    search_buddy: t("strengthTask.searchBuddy"),
    application_template: t("strengthTask.applicationTemplate"),
    documents: t("strengthTask.documents"),
    phone: t("strengthTask.phone"),
    prep_viewing_tips: t("strengthTask.prepViewingTips"),
  };

  if (strength) {
    const existingKeys = new Set(allTasks.map(t => t.key));
    [...strength.tasks, ...strength.prepTasks].forEach((task) => {
      if (!existingKeys.has(task.id) && task.id !== "prep_viewing_tips" && !HIDDEN_TASK_IDS.has(task.id)) {
        existingKeys.add(task.id);
        allTasks.push({
          key: task.id,
          label: STRENGTH_LABEL_MAP[task.id] || task.id,
          done: task.completed,
          action: TASK_ACTION_MAP[task.id] || (() => {}),
        });
      }
    });
  }

  const tipsProgress = getTipsProgress();
  allTasks.push({
    key: "tips_lezen",
    label: `${t("activation.tipsRead")} — ${tipsProgress.read}/${tipsProgress.total}`,
    done: tipsProgress.read >= tipsProgress.total,
    action: () => setActiveTab("tips"),
  });

  const doneCount = allTasks.filter((t) => t.done).length;
  if (doneCount === allTasks.length) return null;

  const completedTasks = allTasks.filter((t) => t.done);
  const incompleteTasks = allTasks.filter((t) => !t.done);
  const sortedTasks = [...incompleteTasks, ...completedTasks];

  const INITIAL_SHOW = 5;
  const visibleTasks = expanded ? sortedTasks : sortedTasks.slice(0, INITIAL_SHOW);
  const hasMore = sortedTasks.length > INITIAL_SHOW;

  const progressPercent = Math.round((doneCount / allTasks.length) * 100);

  return (
    <div className="rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]" data-testid="unified-task-list">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3.5 p-5 text-left"
        data-testid="button-toggle-tasks"
      >
        <div className="relative flex-shrink-0">
          <ProgressRing progress={progressPercent} size={44} strokeWidth={3.5} />
          <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-[#18181B]">
            {progressPercent}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#18181B]">{t("activation.title")}</p>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">{doneCount}/{allTasks.length} {t("activation.completed")}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <div className="h-px bg-[#F0F0F0] mb-2" />
          <div className="flex flex-col">
            {visibleTasks.map((task, idx) => {
              const IconComponent = TASK_ICON_MAP[task.key] || Circle;
              return (
                <div key={task.key}>
                  {idx > 0 && <div className="h-px bg-[#F5F5F5] mx-1" />}
                  <button
                    onClick={task.done ? undefined : task.action}
                    className={`w-full flex items-center gap-4 py-[14px] px-1 text-left transition-all duration-200 rounded-xl ${
                      task.done ? "opacity-60" : "active:bg-[#F9FAFB]"
                    }`}
                    disabled={task.done}
                    data-testid={`task-${task.key}`}
                  >
                    <div className="w-7 flex items-center justify-center flex-shrink-0">
                      <IconComponent className={`w-[18px] h-[18px] ${task.done ? "text-[#D1D5DB]" : "text-[#71717A]"}`} />
                    </div>
                    <span className={`text-[14px] font-medium flex-1 leading-snug ${
                      task.done ? "text-[#D1D5DB] line-through decoration-[#D1D5DB]" : "text-[#1F2937]"
                    }`}>
                      {task.label}
                    </span>
                    <div className="flex-shrink-0">
                      {task.done ? (
                        <div className="w-[22px] h-[22px] rounded-full bg-[#22C55E] flex items-center justify-center">
                          <Check className="w-[12px] h-[12px] text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-[22px] h-[22px] rounded-full border-2 border-[#E5E7EB]" />
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-1 text-[13px] font-medium text-[#0D6EFD] py-2"
              data-testid="button-expand-tasks"
            >
              {expanded ? t("activation.showLess") : t("activation.showMore", { count: sortedTasks.length - INITIAL_SHOW })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HomeTab({
  user,
  profiles,
  navigate,
  setActiveTab,
  subscription,
  accessToken,
}: {
  user: any;
  profiles: SearchProfile[];
  navigate: (path: string) => void;
  setActiveTab: (tab: TabKey) => void;
  subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null };
  accessToken: string | undefined;
}) {
  const { t } = useTranslation();

  const profileDataQuery = useQuery<{ first_name?: string }>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!accessToken,
  });
  const firstName = profileDataQuery.data?.first_name || null;
  const hasProfiles = profiles.length > 0;

  const [referralModalOpen, setReferralModalOpen] = useState(false);

  const { data: referralData, isLoading: referralLoading } = useQuery<{
    code: string;
    totalInvited: number;
    pending: number;
    qualified: number;
    rewarded: number;
  }>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      if (!accessToken) throw new Error("No token");
      const res = await apiFetch("/api/referrals/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!accessToken,
  });

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white pt-6 pb-4 px-6">
        <h1 className="text-[24px] font-medium text-[#111827] tracking-tight" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")}
        </h1>
      </div>
      <div className="flex flex-col gap-7 px-6 mt-1">

      <div className="rounded-[20px] bg-white border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5" data-testid="card-home-referral">
        <p className="text-[11px] font-semibold text-[#0D6EFD] tracking-wider uppercase mb-1" data-testid="text-referral-label">
          {t("referral.homeLabel")}
        </p>
        <p className="text-[16px] font-medium text-[#18181B] leading-snug" data-testid="text-referral-body">
          {t("referral.homeBody")}
        </p>
        <p className="text-[13px] text-[#6B7280] mt-1 leading-relaxed" data-testid="text-referral-helper">
          {t("referral.homeHelper")}
        </p>
        <button
          onClick={() => setReferralModalOpen(true)}
          className="mt-4 h-[42px] px-6 rounded-xl bg-[#0D6EFD] text-white text-[14px] font-medium transition-all hover:bg-[#0B5ED7] active:scale-[0.97] inline-flex items-center gap-2"
          data-testid="button-home-referral-cta"
        >
          {t("referral.promoCta")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasProfiles && (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title={t("home.noProfileTitle")}
          description={t("home.noProfileDesc")}
          ctaLabel={t("home.createProfile")}
          onCtaClick={() => navigate("/dashboard/searches/new")}
          testId="hero-empty"
        />
      )}

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="rounded-[24px] border border-[#F0F0F0] px-5 py-4 flex items-center gap-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]" data-testid="banner-trial">
          <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
            <Crown className="w-[18px] h-[18px] text-[#D97706]" />
          </div>
          <p className="text-[14px] font-medium text-[#374151] flex-1 leading-snug">
            {t("home.trialUntil", { date: new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" }) })}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[13px] font-medium text-[#0D6EFD] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            {t("home.upgrade")}
          </button>
        </div>
      )}

      <RecentlyViewedSection accessToken={accessToken} />

      <UnifiedTaskList accessToken={accessToken} navigate={navigate} setActiveTab={setActiveTab} />

      {profiles.length > 0 && (
        <SearchProfilesSection profiles={profiles} navigate={navigate} />
      )}

      <RecenteMatchesSection accessToken={accessToken} setActiveTab={setActiveTab} subscription={subscription} navigate={navigate} />


      </div>

      <ReferralCodeModal
        open={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
        code={referralData?.code || null}
        loading={referralLoading}
      />
    </div>
  );
}

const MATCH_SUB_TAB_CONFIG: { key: MatchSubTab; labelKey: string; Icon: any }[] = [
  { key: "nieuw", labelKey: "matches.subtabs.new", Icon: Sparkles },
  { key: "bekeken", labelKey: "matches.subtabs.viewed", Icon: Eye },
  { key: "gereageerd", labelKey: "matches.subtabs.applied", Icon: Send },
];

function MatchesTab({ accessToken, setActiveTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void }) {
  const [subTab, setSubTab] = useState<MatchSubTab>("nieuw");
  const [refreshKey, setRefreshKey] = useState(0);
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/matches/applied", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.applied && Array.isArray(data.applied)) {
          const existing = safeGetSet(MATCH_APPLIED_KEY);
          let changed = false;
          for (const id of data.applied) {
            if (!existing.has(id)) {
              existing.add(id);
              changed = true;
            }
          }
          if (changed) {
            safeSetSet(MATCH_APPLIED_KEY, existing);
            setRefreshKey((k) => k + 1);
          }
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const matches = apiMatchesQuery.data?.matches ?? [];
  const totalCount = apiMatchesQuery.data?.totalCount ?? 0;

  const refreshStatuses = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const matchTabs = matches.map((m) => ({ ...m, _tab: getMatchTab(m) }));
  const filteredMatches = matchTabs.filter((m) => m._tab === subTab);

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white pt-6 pb-0 px-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[24px] font-medium text-[#111827] tracking-tight">{t("matches.title")}</h1>
        </div>
        <div className="flex gap-2.5 pb-4" data-testid="match-sub-tabs">
          {MATCH_SUB_TAB_CONFIG.map(({ key, labelKey }) => {
            const isActive = subTab === key;
            return (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]"
                    : "bg-[#F8F9FA] text-[#6B7280] hover:bg-[#F0F1F3]"
                }`}
                data-testid={`tab-matches-${key}`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 flex flex-col gap-8 mt-4">

      {apiMatchesQuery.isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="rounded-xl bg-[#F3F4F6]" style={{ aspectRatio: "4/3" }} />
              <div className="mt-3 flex flex-col gap-2">
                <div className="h-4 bg-[#F3F4F6] rounded w-1/3" />
                <div className="h-4 bg-[#F3F4F6] rounded w-2/3" />
                <div className="h-3 bg-[#F3F4F6] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F8F9FA] flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-[#71717A]" />
          </div>
          <p className="text-[18px] font-medium text-[#111827]">{t("matches.loadError")}</p>
          <p className="text-[14px] text-[#6B7280] leading-relaxed">{t("matches.loadErrorDesc")}</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-medium text-[#0D6EFD]"
            data-testid="button-retry-matches"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title={t("matches.emptyNew.title")}
          description={t("matches.emptyNew.desc")}
          ctaLabel={t("matches.adjustFilters")}
          onCtaClick={() => setActiveTab("filters")}
          testId="empty-matches"
        />
      
      ) : filteredMatches.length === 0 ? (
        subTab === "gereageerd" ? (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noApplications}
            title={t("matches.emptyApplied.title")}
            description={t("matches.emptyApplied.desc")}
            ctaLabel={t("matches.discoverListings")}
            onCtaClick={() => setSubTab("nieuw")}
            testId="empty-applications"
          />
        ) : (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noFilters}
            title={t("matches.emptyViewed.title")}
            description={t("matches.emptyViewed.desc")}
            ctaLabel={t("matches.adjustFilters")}
            onCtaClick={() => setActiveTab("filters")}
            testId="empty-filtered-matches"
          />
        )
      ) : (
        <div className="flex flex-col gap-[36px]">
          {filteredMatches.map((m) => (
            <MatchCard
              key={m.listing_id}
              match={m}
              onStatusChange={refreshStatuses}
            />
          ))}
        </div>
      )}

    </div>
    </div>
  );
}

function DeleteConfirmScreen({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-[#F5F7FA] flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-delete-back"
          >
            <ArrowLeft className="w-4 h-4 text-[#71717A]" />
          </button>
          <h1 className="text-[17px] font-medium text-[#18181B] flex-1 tracking-wide">{t("filters.deleteTitle")}</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#0D6EFD] flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-[22px] font-medium text-[#18181B] mb-3 text-center" data-testid="text-delete-title">
          {t("filters.deleteQuestion")}
        </h2>
        <p className="text-[15px] text-[#1F2937] text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
          {t("filters.deleteConfirm")}
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[16px] font-medium transition-colors hover:opacity-90"
            data-testid="button-delete-confirm"
          >
            {t("filters.deleteYes")}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[52px] rounded-full border border-[#E5E7EB] text-[#1F2937] text-[16px] font-medium hover:bg-[#F5F7FA] transition-colors"
            data-testid="button-delete-cancel"
          >
            {t("filters.deleteNo")}
          </button>
        </div>
      </main>
    </div>
  );
}

function FiltersTab({ navigate }: { navigate: (path: string) => void }) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { t } = useTranslation();

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSearchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      toast({ title: t("filters.deleted") });
    },
    onError: (err: any) => {
      toast({
        title: t("filters.deleteFailed"),
        description: err?.message ?? t("filters.retryDesc"),
        variant: "destructive",
      });
    },
    onSettled: () => setDeletingId(null),
  });

  const profiles = profilesQuery.data ?? [];
  const profileCount = profiles.length;
  const atLimit = profileCount >= MAX_PROFILES;

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white pt-6 pb-4 px-6">
        <h1 className="text-[24px] font-medium text-[#111827] tracking-tight">{t("filters.title")}</h1>
      </div>
      <div className="px-6 flex flex-col gap-5">
      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] border border-[#F0F0F0] p-4 animate-pulse">
              <div className="h-4 bg-[#F5F7FA] rounded w-1/3 mb-3" />
              <div className="flex gap-2">
                <div className="h-6 bg-[#F5F7FA] rounded-full w-24" />
                <div className="h-6 bg-[#F5F7FA] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title={t("matches.emptyNew.title")}
          description={t("filters.noProfilesDesc")}
          ctaLabel={t("filters.createProfile")}
          onCtaClick={() => navigate("/dashboard/searches/new")}
          testId="empty-profiles"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onDelete={() => setConfirmDeleteId(p.id)}
              deleting={deletingId === p.id}
              onEdit={() => navigate(`/dashboard/searches/edit/${p.id}`)}
            />
          ))}

          <div className="flex flex-col items-center text-center mt-6 mb-2 px-4">
            {!atLimit && (
              <button
                onClick={() => navigate("/dashboard/searches/new")}
                className="w-14 h-14 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] flex items-center justify-center text-white transition-colors shadow-[0_4px_12px_rgba(13,110,253,0.3)] mb-5"
                data-testid="button-add-search-card"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
            <p className="text-[17px] font-medium text-[#18181B]">
              {t("filters.activeCountTitle", { count: profileCount, max: MAX_PROFILES })}
            </p>
            <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
              {t("filters.activeCountDesc")}
            </p>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <DeleteConfirmScreen
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            setDeletingId(confirmDeleteId);
            deleteMutation.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
      </div>
    </div>
  );
}

function ProfilePhotoSheet({ photoUrl, onClose, onUpload, onRemove }: { photoUrl: string | null; onClose: () => void; onUpload: (file: File) => void; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-2xl pb-10 pt-3 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E7EB] rounded-full mx-auto mb-6" />
        <div className="px-6">
          <h3 className="text-[18px] font-medium text-[#111827] mb-6">{t("profile.photo.title")}</h3>

          {photoUrl && (
            <div className="flex justify-center mb-5">
              <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" data-testid="img-current-photo" />
            </div>
          )}

          <div className="flex flex-col">
            <label className="w-full h-[52px] flex items-center justify-center gap-2 rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium cursor-pointer active:bg-[#0B5ED7] transition-colors">
              <Camera className="w-[18px] h-[18px]" />
              {photoUrl ? t("profile.photo.choose") : t("profile.photo.upload")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
                data-testid="input-photo-file"
              />
            </label>

            {photoUrl && (
              <button
                onClick={onRemove}
                className="mt-3 w-full h-[52px] flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] text-[#1F2937] text-[15px] font-medium active:bg-[#F5F7FA] transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                {t("profile.photo.remove")}
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[52px] flex items-center justify-center rounded-full text-[#1F2937] text-[15px] font-medium active:bg-[#F5F7FA] transition-colors"
              data-testid="button-cancel-photo"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function ProfielTab({ user, signOut, navigate, subscription, setActiveTab, canonicalStats }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null }; setActiveTab: (tab: TabKey) => void; canonicalStats?: CanonicalStats }) {
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [notifUpdating, setNotifUpdating] = useState<string | null>(null);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();

  const profileDataQuery = useQuery({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const notifQuery = useQuery({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await apiFetch("/api/notifications/settings", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const referralQuery = useQuery<{
    code: string;
    totalInvited: number;
    pending: number;
    qualified: number;
    rewarded: number;
  }>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No token");
      const res = await apiFetch("/api/referrals/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const [referralCopied, setReferralCopied] = useState(false);

  const pd = profileDataQuery.data;
  const phone = pd?.phone || notifQuery.data?.phone_e164;
  const photoUrl = pd?.profile_photo_url || null;
  const notifSettings = notifQuery.data;

  useEffect(() => {
    if (pd?.language && (pd.language === "de" || pd.language === "en" || pd.language === "nl") && pd.language !== locale) {
      setLocale(pd.language);
    }
  }, [pd?.language]);

  const displayName = [pd?.first_name, pd?.last_name].filter(Boolean).join(" ") || user.user_metadata?.full_name || "";
  const initials = displayName ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) : user.email?.[0]?.toUpperCase() ?? "?";
  const letterPreview = pd?.application_template?.slice(0, 120) || null;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate("/login");
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(t("profile.notLoggedIn"));

      const res = await apiFetch("/api/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("profile.uploadFailed"));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      toast({ title: t("profile.photo.saved") });
      setShowPhotoSheet(false);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoRemove() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await apiFetch("/api/profile-photo", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error(t("profile.deleteFailed"));

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      toast({ title: t("profile.photo.removed") });
      setShowPhotoSheet(false);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  }

  async function handleToggleNotif(key: "email_enabled" | "push_enabled", currentVal: boolean) {
    setNotifUpdating(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [key]: !currentVal }),
      });
      if (!res.ok) throw new Error("Update failed");
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setNotifUpdating(null);
    }
  }

  const LANG_OPTIONS = [
    { code: "de" as const, label: "Deutsch" },
    { code: "en" as const, label: "English" },
    { code: "nl" as const, label: "Nederlands" },
  ];

  const currentLangLabel = LANG_OPTIONS.find(o => o.code === (pd?.language || locale))?.label || "Deutsch";

  async function handleLanguageChange(code: "de" | "en" | "nl") {
    setShowLangSheet(false);
    setLocale(code);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("[LANG] No session token — language not saved to server");
        toast({ title: t("common.error"), description: "Session expired. Language saved locally but not synced.", variant: "destructive" });
        return;
      }
      const resp = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ language: code }),
      });
      if (!resp.ok) {
        console.error("[LANG] Server rejected language save:", resp.status);
        toast({ title: t("common.error"), variant: "destructive" });
        return;
      }
      const saved = await resp.json();
      if (saved.language !== code) {
        console.error("[LANG] Language mismatch after save:", saved.language, "expected:", code);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
    } catch (err) {
      console.error("[LANG] Failed to save language:", err);
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }


  const accountAgeDays = user.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const memberStatNumber = accountAgeDays >= 730
    ? Math.floor(accountAgeDays / 365)
    : accountAgeDays >= 60
    ? Math.floor(accountAgeDays / 30)
    : accountAgeDays >= 14
    ? Math.floor(accountAgeDays / 7)
    : Math.max(1, accountAgeDays);
  const memberStatLabel = accountAgeDays >= 730
    ? t("profile.memberYearsLabel")
    : accountAgeDays >= 60
    ? t("profile.memberMonthsLabel")
    : accountAgeDays >= 14
    ? t("profile.memberWeeksLabel")
    : t("profile.memberDaysLabel");

  const firstName = pd?.first_name || "";
  const lastName = pd?.last_name || "";

  const subStatusLabel = subscription.isActive && !subscription.isTrial
    ? t("profile.activeStatus")
    : subscription.isTrial
    ? t("profile.trialStatus")
    : subscription.isExpired
    ? t("profile.expiredStatus")
    : t("profile.freeStatus");

  const subStatusColor = subscription.isActive && !subscription.isTrial
    ? "text-[#0D6EFD] bg-[#EBF2FF]"
    : subscription.isTrial
    ? "text-[#D97706] bg-[#FEF3C7]"
    : "text-[#9CA3AF] bg-[#F3F4F6]";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white">
      <div className="max-w-[480px] mx-auto px-6 pt-8 pb-8">
        <div className="flex flex-col gap-6">

          <div
            className="rounded-[24px] bg-white border border-[#F0F0F0] shadow-[0_2px_12px_rgba(15,23,42,0.06),0_8px_32px_rgba(15,23,42,0.08)] px-5 py-7"
            data-testid="card-profile-summary"
          >
            <div className="grid grid-cols-2 gap-0">
              <button
                onClick={() => navigate("/profile/details")}
                className="flex flex-col items-center justify-center active:scale-95 transition-transform"
                data-testid="button-profile-avatar"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-[88px] h-[88px] rounded-full object-cover shadow-[0_2px_12px_rgba(0,0,0,0.08)]" data-testid="img-profile-avatar" />
                ) : (
                  <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-[#E5E7EB] to-[#F3F4F6] flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                    <span className="text-[30px] font-semibold text-[#6B7280]">{initials}</span>
                  </div>
                )}
                <p className="text-[20px] font-bold text-[#18181B] mt-3 leading-tight text-center" data-testid="text-user-firstname">
                  {firstName || displayName || t("profile.seeker")}
                </p>
                {lastName && (
                  <p className="text-[13px] font-normal text-[#9CA3AF] mt-0.5 leading-tight text-center" data-testid="text-user-lastname">
                    {lastName}
                  </p>
                )}
              </button>

              <div className="flex flex-col justify-center pl-5">
                <div className="py-3" data-testid="stat-member-since">
                  <p className="text-[22px] font-bold text-[#18181B] leading-tight">{memberStatNumber}</p>
                  <p className="text-[12px] text-[#18181B] mt-0.5 leading-snug">{memberStatLabel}</p>
                </div>
                <div className="h-px bg-[#F0F0F0]" />
                <div className="py-3" data-testid="stat-listings-viewed">
                  <p className="text-[22px] font-bold text-[#18181B] leading-tight">{canonicalStats?.viewed ?? 0}</p>
                  <p className="text-[12px] text-[#18181B] mt-0.5 leading-snug">{t("profile.listingsViewed")}</p>
                </div>
                <div className="h-px bg-[#F0F0F0]" />
                <div className="py-3" data-testid="stat-applications-sent">
                  <p className="text-[22px] font-bold text-[#18181B] leading-tight">{canonicalStats?.applied ?? 0}</p>
                  <p className="text-[12px] text-[#18181B] mt-0.5 leading-snug">{t("profile.applicationsSent")}</p>
                </div>
              </div>
            </div>
          </div>

          {subscription.isTrial && (
            <div className="rounded-2xl border border-[#D1FAE5] bg-[#F0FDF4] px-5 py-4 flex items-start gap-3.5" data-testid="trial-explanation">
              <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Gift className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#15803D]">{t("trial.explanation")}</p>
                <p className="text-[13px] text-[#15803D]/80 mt-1 leading-relaxed">{t("trial.explanationDesc")}</p>
              </div>
            </div>
          )}

          {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] rounded-xl bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-medium transition-colors flex items-center justify-center gap-2"
              data-testid="button-upgrade-subscription"
            >
              <Crown className="w-4 h-4" />
              {t("profile.chooseSubscription")}
            </button>
          )}

          <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
            <button
              onClick={async () => {
                const code = referralQuery.data?.code;
                if (!code) return;
                try {
                  await navigator.clipboard.writeText(code);
                  setReferralCopied(true);
                  toast({ title: t("referral.copied") });
                  setTimeout(() => setReferralCopied(false), 2000);
                } catch {
                  toast({ title: t("referral.copyFailed"), variant: "destructive" });
                }
              }}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-invite-friends"
            >
              <div className="w-9 h-9 rounded-xl bg-[#EBF2FF] flex items-center justify-center flex-shrink-0">
                <Gift className="w-[18px] h-[18px] text-[#0D6EFD]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#18181B]">{t("profile.inviteFriends")}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                  {referralQuery.data?.code
                    ? (referralCopied ? t("referral.copied") : referralQuery.data.code)
                    : t("profile.inviteFriendsDesc")}
                </p>
              </div>
              {referralCopied
                ? <Check className="w-4 h-4 text-[#0D6EFD] flex-shrink-0" />
                : <Copy className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
              }
            </button>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-extra-profile"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                <Plus className="w-[18px] h-[18px] text-[#16A34A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#18181B]">{t("profile.extraProfile")}</p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">{t("profile.extraProfileDesc")}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
            </button>
          </div>

          <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => navigate("/profile/details")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-personal-info"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                <User className="w-[18px] h-[18px] text-[#71717A]" />
              </div>
              <p className="text-[14px] font-medium text-[#18181B] flex-1">{t("profile.personalInfo")}</p>
              <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
            </button>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <div id="notification-settings" className="flex items-center justify-between px-5 py-[14px]">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                  <Bell className="w-[18px] h-[18px] text-[#71717A]" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#18181B]">{t("profile.notificationSettings")}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
                      disabled={notifUpdating === "push_enabled"}
                      className="flex items-center gap-1.5"
                      data-testid="toggle-push"
                    >
                      <div className={`w-[36px] h-[20px] rounded-full relative transition-colors ${notifSettings?.push_enabled ? "bg-[#0D6EFD]" : "bg-[#E5E7EB]"} ${notifUpdating === "push_enabled" ? "opacity-50" : ""}`}>
                        <span className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[18px]" : "left-[2px]"}`} />
                      </div>
                      <span className="text-[11px] text-[#9CA3AF]">Push</span>
                    </button>
                    <button
                      onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
                      disabled={notifUpdating === "email_enabled"}
                      className="flex items-center gap-1.5"
                      data-testid="toggle-email"
                    >
                      <div className={`w-[36px] h-[20px] rounded-full relative transition-colors ${notifSettings?.email_enabled ? "bg-[#0D6EFD]" : "bg-[#E5E7EB]"} ${notifUpdating === "email_enabled" ? "opacity-50" : ""}`}>
                        <span className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.email_enabled ? "left-[18px]" : "left-[2px]"}`} />
                      </div>
                      <span className="text-[11px] text-[#9CA3AF]">E-mail</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <button
              onClick={() => navigate("/application-letter")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-reaction-letter"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                <FileText className="w-[18px] h-[18px] text-[#71717A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#18181B]">{t("profile.reactionLetter2")}</p>
                {letterPreview && <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">{letterPreview}...</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
            </button>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <button
              onClick={() => navigate("/profile/edit/search_buddy_email")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-zoekbuddy"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                <Users className="w-[18px] h-[18px] text-[#71717A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#18181B]">{t("profile.searchBuddyMenu")}</p>
                {pd?.search_buddy_email && <p className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">{pd.search_buddy_email}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
            </button>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-subscription"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                <Crown className="w-[18px] h-[18px] text-[#71717A]" />
              </div>
              <p className="text-[14px] font-medium text-[#18181B] flex-1">{t("profile.subscriptionPlan")}</p>
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${subStatusColor}`} data-testid="text-subscription-status">
                {subStatusLabel}
              </span>
            </button>
          </div>

          <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-language"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F8F9FA] flex items-center justify-center flex-shrink-0">
                <Globe className="w-[18px] h-[18px] text-[#71717A]" />
              </div>
              <p className="text-[14px] font-medium text-[#18181B] flex-1">{t("profile.language")}</p>
              <span className="text-[13px] text-[#9CA3AF] mr-1">{currentLangLabel}</span>
              <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
            </button>
          </div>

          <div>
            <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-3 px-1">{t("profile.support")}</p>
            <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
              <button
                onClick={() => navigate("/datenschutz")}
                className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
                data-testid="button-privacy"
              >
                <p className="text-[14px] text-[#18181B] flex-1">{t("profile.privacy")}</p>
                <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
              </button>
              <div className="h-px bg-[#F3F4F6] mx-5" />
              <button
                onClick={() => { window.location.href = "mailto:support@housalert.com"; }}
                className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
                data-testid="button-help-support"
              >
                <p className="text-[14px] text-[#18181B] flex-1">{t("profile.helpSupport")}</p>
                <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
              </button>
              <div className="h-px bg-[#F3F4F6] mx-5" />
              <button
                onClick={() => navigate("/terms")}
                className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
                data-testid="button-terms"
              >
                <p className="text-[14px] text-[#18181B] flex-1">{t("profile.terms")}</p>
                <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
              </button>
            </div>
          </div>

          <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={signingOut}
              className={`w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
              data-testid="button-logout"
            >
              <LogOut className="w-[18px] h-[18px] text-[#EF4444]" />
              <p className="text-[14px] font-medium text-[#EF4444] flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
            </button>
            <div className="h-px bg-[#F3F4F6] mx-5" />
            <button
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
              data-testid="button-delete-account"
            >
              <Trash2 className="w-[18px] h-[18px] text-[#71717A]" />
              <p className="text-[14px] font-medium text-[#9CA3AF] flex-1">{t("profile.deleteAccount")}</p>
            </button>
          </div>

          {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && (
            <div>
              <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-3 px-1">{t("profile.adminSection")}</p>
              <div className="rounded-[20px] border border-[#F0F0F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
                <button
                  onClick={() => navigate("/admin/portal")}
                  className="w-full flex items-center gap-3.5 px-5 py-[14px] text-left active:bg-[#F9FAFB] transition-colors"
                  data-testid="button-admin-portal"
                >
                  <p className="text-[14px] font-medium text-[#18181B] flex-1">{t("profile.adminPortal")}</p>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPhotoSheet && (
        <ProfilePhotoSheet
          photoUrl={photoUrl}
          onClose={() => setShowPhotoSheet(false)}
          onUpload={handlePhotoUpload}
          onRemove={handlePhotoRemove}
        />
      )}

      {showLangSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="sheet-language">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLangSheet(false)} />
          <div className="relative w-full max-w-[480px] bg-white rounded-t-2xl px-6 pb-10 pt-3 animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 rounded-full bg-[#E5E7EB] mx-auto mb-6" />
            <h3 className="text-[18px] font-medium text-[#111827] mb-1.5">{t("profile.language")}</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-6 leading-relaxed">{t("profile.languageDesc")}</p>
            <div className="flex flex-col gap-1.5">
              {LANG_OPTIONS.map(opt => {
                const selected = (pd?.language || locale) === opt.code;
                return (
                  <button
                    key={opt.code}
                    onClick={() => handleLanguageChange(opt.code)}
                    className={`flex items-center justify-between px-5 py-4 rounded-xl transition-all ${selected ? "bg-[#EFF6FF] shadow-[0_1px_4px_rgba(13,110,253,0.08)]" : "hover:bg-[#F8F9FA] active:bg-[#F3F4F6]"}`}
                    data-testid={`button-lang-${opt.code}`}
                  >
                    <span className={`text-[15px] font-medium ${selected ? "text-[#0D6EFD]" : "text-[#1F2937]"}`}>{opt.label}</span>
                    {selected && <CheckCircle2 className="w-5 h-5 text-[#0D6EFD]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
            <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-9 h-9 rounded-full bg-[#F5F7FA] flex items-center justify-center mr-3 active:scale-95 transition-transform"
                data-testid="button-logout-back"
              >
                <ArrowLeft className="w-4 h-4 text-[#71717A]" />
              </button>
              <h1 className="text-[17px] font-medium text-[#18181B] flex-1 tracking-wide">{t("profile.logout")}</h1>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F7FA] flex items-center justify-center mb-6">
              <LogOut className="w-8 h-8 text-[#1F2937]" />
            </div>
            <h2 className="text-[22px] font-medium text-[#18181B] mb-3 text-center" data-testid="text-logout-title">
              {t("profile.logoutConfirm")}
            </h2>
            <p className="text-[15px] text-[#1F2937] text-center max-w-[320px] mb-10 leading-relaxed">
              {t("profile.logoutDesc")}
            </p>
            <div className="w-full max-w-[320px] flex flex-col gap-3">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[16px] font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                data-testid="button-logout-confirm"
              >
                {signingOut ? t("profile.signingOut") : t("profile.logoutYes")}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full h-[52px] rounded-full border border-[#E5E7EB] text-[#1F2937] text-[16px] font-medium hover:bg-[#F5F7FA] transition-colors"
                data-testid="button-logout-cancel"
              >
                {t("common.cancel")}
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; labelKey: string; Icon: any }[] = [
  { key: "home", labelKey: "nav.home", Icon: Home },
  { key: "matches", labelKey: "nav.matches", Icon: Check },
  { key: "tips", labelKey: "nav.tips", Icon: Zap },
  { key: "filters", labelKey: "nav.filters", Icon: Search },
  { key: "profiel", labelKey: "nav.profile", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["home", "matches", "tips", "filters", "profiel"].includes(tab)) {
      return tab as TabKey;
    }
    return "home";
  });
  const sub = useSubscription();

  const { toast } = useToast();

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [activeTab]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      toast({ title: t("home.paymentSuccess"), description: t("home.subscriptionNowActive") });
      window.history.replaceState({}, "", "/dashboard");
      sub.refetch?.();
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
    }
  }, []);

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const accessToken = session?.access_token;
  const hasActiveSub = sub.isActive || sub.isTrial;
  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!user && !!accessToken && hasActiveSub,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5F7FA] animate-pulse" />
          <p className="text-[#1F2937] text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.totalCount ?? 0;
  const newCount = apiMatchesQuery.data?.newCount ?? 0;

  const emailNeedsVerification = user?.user_metadata?.email_needs_verification === true;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-[100px]">
        {emailNeedsVerification && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-[#FEF3C7] rounded-xl px-4 py-3" data-testid="banner-email-confirm">
            <Mail className="w-5 h-5 text-[#92400E] flex-shrink-0" />
            <p className="text-[13px] text-[#92400E] flex-1">{t("dashboard.confirmEmailBanner")}</p>
            <button
              onClick={async () => {
                try {
                  const { data: sess } = await supabase.auth.getSession();
                  const token = sess?.session?.access_token;
                  if (token) {
                    const res = await fetch("/api/auth/send-verification", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                      toast({ title: t("dashboard.confirmEmailSent") });
                    } else {
                      await supabase.auth.resend({ type: "signup", email: user.email! });
                      toast({ title: t("dashboard.confirmEmailSent") });
                    }
                  } else {
                    await supabase.auth.resend({ type: "signup", email: user.email! });
                    toast({ title: t("dashboard.confirmEmailSent") });
                  }
                } catch {}
              }}
              className="text-[13px] font-medium text-[#92400E] underline whitespace-nowrap"
              data-testid="button-confirm-email"
            >
              {t("dashboard.confirmEmailBtn")}
            </button>
          </div>
        )}
        {activeTab === "home" && (
          <HomeTab
            user={user}
            profiles={profiles}
            navigate={navigate}
            setActiveTab={setActiveTab}
            subscription={{ isTrial: sub.isTrial, isExpired: sub.isExpired, isActive: sub.isActive, trialEndsAt: sub.trialEndsAt }}
            accessToken={accessToken}
          />
        )}
        {activeTab === "matches" && (
          <SubscriptionGate isActive={sub.isActive || sub.isTrial}>
            <MatchesTab accessToken={accessToken} setActiveTab={setActiveTab} />
          </SubscriptionGate>
        )}
        {activeTab === "tips" && <TipsPage navigate={navigate} />}
        {activeTab === "filters" && <FiltersTab navigate={navigate} />}
        {activeTab === "profiel" && (
          <ProfielTab
            user={user}
            signOut={signOut}
            navigate={navigate}
            subscription={{ status: sub.status, isTrial: sub.isTrial, isActive: sub.isActive, isExpired: sub.isExpired, plan: sub.plan, trialEndsAt: sub.trialEndsAt }}
            setActiveTab={setActiveTab}
            canonicalStats={apiMatchesQuery.data?.canonicalStats}
          />
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <nav className="max-w-xl mx-auto flex h-[56px]" data-testid="bottom-nav">
          {TAB_CONFIG.map(({ key, labelKey, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-[3px]"
                data-testid={`tab-${key}`}
              >
                <Icon className={`w-[26px] h-[26px] transition-colors ${isActive ? "text-[#0D6EFD]" : "text-[#9CA3AF]"}`} strokeWidth={isActive ? 2 : 1.5} />
                <span className={`text-[11px] transition-colors ${isActive ? "font-medium text-[#0D6EFD]" : "font-normal text-[#9CA3AF]"}`}>
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
