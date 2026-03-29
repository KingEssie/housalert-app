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
  Globe,
  Rocket,
  Gift,
  FileText,
  Phone,
  Check,
  MoreVertical,
  Shield,
  HelpCircle,
  Loader2,
  X,
  Heart,
  Settings,
  Lock,
} from "lucide-react";
import { ExpandableCompletionCard, type CompletionStep } from "@/components/expandable-completion-card";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import TipsPage, { getTipConfig, getTipsReadSet } from "@/pages/tips";
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

type TabKey = "home" | "matches" | "favorieten" | "profiel" | "tips";
type MatchSubTab = "nieuw" | "bekeken" | "gereageerd" | "favorieten";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-ha-card to-ha-surface",
  münchen: "from-ha-card to-ha-surface",
  hamburg: "from-ha-surface to-ha-card",
  frankfurt: "from-ha-card to-ha-surface",
  köln: "from-ha-surface to-ha-card",
  düsseldorf: "from-ha-card to-ha-surface",
  stuttgart: "from-ha-surface to-ha-card",
  default: "from-ha-card to-ha-surface",
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
  isFavorited,
  onToggleFavorite,
  locked,
}: {
  match: ApiMatch;
  onStatusChange: () => void;
  isFavorited: boolean;
  onToggleFavorite: (listingId: string) => void;
  locked?: boolean;
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

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFavorite(match.listing_id);
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={handleCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="rounded-[6px] overflow-hidden bg-white border border-gray-200">
        <div className="relative">
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
              <div className="flex flex-col items-center gap-2.5 text-[#000]/50">
                <ImageIcon className="w-8 h-8" />
                <span className="text-[12px] font-medium">{match.source}</span>
              </div>
            </div>
          )}

          <div className="absolute top-3.5 left-3.5 flex gap-1.5">
            <span className="text-[11px] font-medium bg-white/95 backdrop-blur-md text-[#000] px-3 py-1.5 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.06)] capitalize">
              {match.source}
            </span>
            {(() => {
              const seenAt = match.first_seen_at || match.matched_at;
              if (!seenAt) return null;
              const hoursAgo = (Date.now() - new Date(seenAt).getTime()) / 3600000;
              if (hoursAgo < 24) {
                return (
                  <span className="text-[11px] font-semibold bg-ha-primary text-white px-3 py-1.5 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.1)]" data-testid={`badge-new-${match.listing_id}`}>
                    {t("freshness.new") || "Nieuw"}
                  </span>
                );
              }
              const h = Math.floor(hoursAgo);
              return (
                <span className="text-[11px] font-medium bg-[#000]/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full" data-testid={`badge-time-${match.listing_id}`}>
                  {h} {t("freshness.hoursAgoShort") || "uur geleden"}
                </span>
              );
            })()}
          </div>

          <button
            onClick={handleHeartClick}
            className="absolute top-3 right-3 p-0 border-0 bg-transparent active:scale-90 transition-transform"
            data-testid={`button-favorite-${match.listing_id}`}
          >
            <Heart
              className={`w-7 h-7 transition-colors duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${
                isFavorited
                  ? "fill-[#FF5A5F] text-[#000] stroke-white"
                  : "fill-[rgba(0,0,0,0.1)] text-[#000] stroke-white"
              }`}
              strokeWidth={2}
            />
          </button>
        </div>

        <div className="px-3 py-3">
          <div className="flex items-baseline justify-between gap-2 leading-[1.25]">
            <h3
              className="text-[15px] font-bold text-[#000] leading-[1.25] line-clamp-1 flex-1 min-w-0"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
            {match.price > 0 && (
              <span className="text-[17px] font-bold text-[#000] leading-[1.25] flex-shrink-0 whitespace-nowrap" data-testid={`badge-price-${match.listing_id}`}>
                €{match.price}<span className="text-[13px] font-normal text-[#9CA3AF] ml-0.5">{t("common.perMonthShort")}</span>
              </span>
            )}
          </div>
          <p className="text-[14px] text-[#9CA3AF] leading-[1.25] mt-[3px] truncate" data-testid={`text-match-city-${match.listing_id}`}>
            {match.city}
          </p>
          <div className="flex items-center gap-1.5 mt-[2px] text-[15px] text-[#4B5563] leading-[1.25]">
            {match.bedrooms > 0 && (
              <span>{match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}</span>
            )}
            {match.bedrooms > 0 && match.size_m2 > 0 && <span>·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
            {(match.bedrooms > 0 || match.size_m2 > 0) && <span>·</span>}
            <span>{relativeTime(match.matched_at || match.first_seen_at, t)}</span>
          </div>
          {locked && (
            <div className="flex items-center gap-1 mt-[6px] text-[12px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
              <Lock className="w-3 h-3" />
              <span>{t("listing.lockLabel")}</span>
            </div>
          )}
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
      className={`rounded-[6px] border border-gray-200 bg-white px-5 py-4 ${deleting ? "opacity-50 pointer-events-none" : ""}`}
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-ha-success flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] text-title text-[#000] line-clamp-1 flex-1" data-testid={`text-profile-city-${profile.id}`}>
              {getProfileTitle(profile, t, locale)}
            </h3>
            <span className="text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full flex-shrink-0" data-testid={`badge-status-${profile.id}`}>
              {t("common.active")}
            </span>
          </div>
          <p className="text-[15px] text-[#4B5563] mt-0.5 line-clamp-1" data-testid={`text-profile-summary-filters-${profile.id}`}>
            {getProfileSummary(profile, t)}
          </p>
          {profile.districts && profile.districts.length > 0 && (
            <p className="text-[15px] text-[#4B5563] mt-0.5 truncate">
              {profile.districts.length <= 2
                ? profile.districts.join(", ")
                : `${profile.districts[0]} ${t("profile.andOtherNeighborhoods", { count: profile.districts.length - 1 })}`
              }
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-[#EBEBF0] transition-colors flex-shrink-0"
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
              <Pencil className="w-4 h-4 text-[#9CA3AF]" />
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="flex items-center gap-2.5 text-ha-danger focus:text-ha-danger cursor-pointer"
              data-testid={`menu-delete-filters-${profile.id}`}
            >
              <Trash2 className="w-4 h-4" />
              {t("filters.deleteTitle")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
        <div className="rounded-[6px] border border-gray-200 bg-white p-6 text-center">
          <p className="text-[15px] text-[#4B5563] mb-4 leading-relaxed">
            {t("home.matchesWillAppear")}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="h-[56px] px-6 rounded-[6px] bg-ha-primary text-white text-[14px] font-semibold transition-colors hover:bg-ha-primary-hover"
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
              <div className="w-full bg-[#F0F0F0] rounded-[6px] animate-pulse" style={{ aspectRatio: "4/3" }} />
              <div className="pt-2.5 flex flex-col gap-2">
                <div className="h-4 bg-white rounded-md w-2/3 animate-pulse" />
                <div className="h-3.5 bg-white rounded-md w-full animate-pulse" />
                <div className="h-3 bg-white rounded-md w-1/2 animate-pulse" />
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
        <div className="rounded-[6px] border border-gray-200 bg-white p-6 text-center">
          <p className="text-[15px] text-[#4B5563] leading-relaxed">
            {t("home.firstMatchesWillAppear")}
          </p>
        </div>
      </div>
    );
  }

  const todayCount = matches.filter(m => {
    const seen = m.first_seen_at || m.matched_at;
    return seen && (Date.now() - new Date(seen).getTime()) < 86400000;
  }).length;

  return (
    <div className="flex flex-col gap-4" data-testid="section-recente-matches">
      {todayCount > 0 && (
        <p className="text-[13px] font-semibold text-ha-primary" data-testid="text-new-matches-today">
          +{todayCount} {t("home.newMatchesToday") || "nieuwe matches vandaag"}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        <button
          onClick={() => setActiveTab("matches")}
          className="text-[13px] font-medium text-ha-primary flex items-center gap-0.5"
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
      className="flex-shrink-0 w-[72vw] max-w-[280px] cursor-pointer transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[6px]"
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
      <div className="rounded-[6px] overflow-hidden bg-white border border-gray-200">
        <div className="relative">
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
              <div className="flex flex-col items-center gap-1.5 text-[#000]/50">
                <ImageIcon className="w-7 h-7" />
                <span className="text-[11px] font-medium">{match.source}</span>
              </div>
            </div>
          )}
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[10px] font-medium bg-white/95 backdrop-blur-md text-[#000] px-2.5 py-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.08)] capitalize">
              {match.source}
            </span>
          </div>
        </div>

        <div className="px-3 py-3 flex flex-col gap-0.5">
          <span className="text-[15px] text-title text-[#000] truncate" data-testid={`text-recent-city-${match.listing_id}`}>
            {match.city}
          </span>
          <p className="text-[15px] text-[#4B5563] line-clamp-1 leading-[1.35]" data-testid={`text-recent-title-${match.listing_id}`}>
            {match.title}
          </p>
          <div className="flex items-center gap-1.5 text-[15px] text-[#4B5563] mt-0.5">
            {match.bedrooms > 0 && (
              <span>{match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}</span>
            )}
            {match.bedrooms > 0 && match.size_m2 > 0 && <span className="text-[#9CA3AF]">·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </div>
          {match.price > 0 && (
            <p className="mt-1" data-testid={`badge-recent-price-${match.listing_id}`}>
              <span className="text-[15px] font-medium text-[#000]">€{match.price}</span>
              <span className="text-[12px] text-[#6B7280] ml-0.5">{t("common.perMonthShort")}</span>
            </p>
          )}
        </div>
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
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[6px]"
      onClick={() => navigate(`/apply/${match.listing_id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/apply/${match.listing_id}`);
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="rounded-[6px] overflow-hidden bg-white border border-gray-200">
        <div className="relative">
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
              <ImageIcon className="w-5 h-5 text-[#000]/40" />
            </div>
          )}
        </div>
        <div className="px-2.5 py-2 flex flex-col gap-0">
          <p className="text-[12px] text-title text-[#000] line-clamp-1">{match.title}</p>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            {match.price > 0 && <span>€{match.price}</span>}
            {match.price > 0 && match.size_m2 > 0 && <span>·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </div>
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
        <div className="rounded-[12px] bg-white px-5 py-5" style={{ border: "1px solid rgba(15, 23, 42, 0.04)" }}>
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-ha-primary flex-shrink-0" />
            <p className="text-[17px] font-bold text-black flex-1">{t("searchProfiles.sectionTitle")}</p>
            <span className="text-[13px] font-semibold text-[#0ea5e9] bg-[#e0f2fe] px-2.5 py-0.5 rounded-full">{profiles.length}/{4}</span>
          </div>
          <div className="flex flex-col gap-2">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-3.5 px-4 rounded-[10px] bg-[#F3F3F5]"
                data-testid={`card-search-profile-${p.id}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-black line-clamp-1" data-testid={`text-profile-title-${p.id}`}>
                    {getProfileTitle(p, t, locale)}
                  </p>
                  <p className="text-[14px] text-[#4B5563] mt-0.5 line-clamp-1" data-testid={`text-profile-summary-${p.id}`}>
                    {getProfileSummary(p, t)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:bg-[#EBEBED] transition-colors flex-shrink-0"
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
                      className="flex items-center gap-2.5 text-ha-danger focus:text-ha-danger cursor-pointer"
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

interface ActivationStatus {
  profileCreated: boolean;
  notificationsEnabled: boolean;
  firstMatchViewed: boolean;
  firstReaction: boolean;
  trialStarted: boolean;
  subscriptionStarted: boolean;
}

function HomeAccountCompletionCard({ accessToken, navigate }: { accessToken: string | undefined; navigate: (path: string) => void }) {
  const { t } = useTranslation();

  const statusQuery = useQuery<ActivationStatus>({
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

  const strengthQuery = useQuery<{ tasks: { id: string; completed: boolean }[] }>({
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
  if (!status) return null;

  const getStrengthTask = (id: string) => strength?.tasks?.find(t => t.id === id);

  const steps: CompletionStep[] = [
    { id: "push", label: t("activation.notificationsEnabled"), completed: status.notificationsEnabled, action: () => navigate("/onboarding/setup?step=push-test") },
    { id: "letter", label: t("strengthTask.applicationTemplate"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/onboarding/setup?step=letter-personal") },
    { id: "buddy", label: t("strengthTask.searchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/onboarding/setup?step=search-buddy") },
    { id: "search", label: t("activation.profileCreated"), completed: status.profileCreated, action: () => navigate("/onboarding/city") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("profile.completeAccount")}
      icon={<CheckCircle2 className="w-6 h-6 text-[#e91e63]" />}
      steps={steps}
      completedLabel={t("activation.completed")}
      testId="card-account-completion"
    />
  );
}

function HomeTipsCompletionCard({ setActiveTab }: { setActiveTab: (tab: TabKey) => void }) {
  const { t } = useTranslation();

  const tipConfigs = getTipConfig(t);
  const readSet = getTipsReadSet();

  const steps: CompletionStep[] = tipConfigs.map((tip) => ({
    id: tip.id,
    label: tip.title,
    completed: readSet.has(tip.id),
    action: () => setActiveTab("tips"),
  }));

  return (
    <ExpandableCompletionCard
      title={t("profile.tipsTitle")}
      icon={<Rocket className="w-6 h-6 text-[#e91e63]" />}
      steps={steps}
      completedLabel={t("activation.completed")}
      testId="card-tips-completion"
    />
  );
}

function ProfileAccountCompletionCard({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();

  const strengthQuery = useQuery<{ tasks: { id: string; completed: boolean }[]; channels: { push: boolean } }>({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No token");
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const statusQuery = useQuery<ActivationStatus>({
    queryKey: ["/api/activation-status"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No token");
      const res = await apiFetch("/api/activation-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const strength = strengthQuery.data;
  const status = statusQuery.data;

  const getStrengthTask = (id: string) => strength?.tasks?.find(t => t.id === id);

  const steps: CompletionStep[] = [
    { id: "push", label: t("activation.notificationsEnabled"), completed: status?.notificationsEnabled ?? false, action: () => navigate("/onboarding/setup?step=push-test") },
    { id: "letter", label: t("strengthTask.applicationTemplate"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/onboarding/setup?step=letter-personal") },
    { id: "buddy", label: t("strengthTask.searchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/onboarding/setup?step=search-buddy") },
    { id: "search", label: t("activation.profileCreated"), completed: status?.profileCreated ?? false, action: () => navigate("/onboarding/city") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("profile.completeAccount")}
      icon={<CheckCircle2 className="w-6 h-6 text-[#e91e63]" />}
      steps={steps}
      completedLabel={t("profile.completedLabel")}
      testId="card-profile-account-completion"
    />
  );
}

function ProfileTipsCompletionCard({ setActiveTab }: { setActiveTab: (tab: TabKey) => void }) {
  const { t } = useTranslation();

  const tipConfigs = getTipConfig(t);
  const readSet = getTipsReadSet();

  const steps: CompletionStep[] = tipConfigs.map((tip) => ({
    id: tip.id,
    label: tip.title,
    completed: readSet.has(tip.id),
    action: () => setActiveTab("tips"),
  }));

  return (
    <ExpandableCompletionCard
      title={t("profile.tipsTitle")}
      icon={<Rocket className="w-6 h-6 text-[#e91e63]" />}
      steps={steps}
      completedLabel={t("profile.completedLabel")}
      testId="card-profile-tips-completion"
    />
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
      const data = await res.json();
      console.log(`[IDENTITY] WelcomeBar profile fetch — first_name="${data?.first_name ?? "null"}", user_id="${data?.user_id ?? "unknown"}"`);
      return data;
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
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-page-title" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")}
        </h1>
      </div>
      <div className="flex flex-col gap-4 px-6">

      {!hasProfiles && (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title={t("home.noProfileTitle")}
          description={t("home.noProfileDesc")}
          ctaLabel={t("home.createProfile")}
          onCtaClick={() => navigate("/onboarding/city")}
          testId="hero-empty"
        />
      )}

      <HomeAccountCompletionCard accessToken={accessToken} navigate={navigate} />
      <HomeTipsCompletionCard setActiveTab={setActiveTab} />

      {!subscription.isTrial && !subscription.isActive && (
        <div className="rounded-[12px] bg-[#EDE9F6] px-5 py-5" data-testid="card-upgrade-warning">
          <div className="flex items-start gap-3 mb-3">
            <Lock className="w-5 h-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[16px] font-bold text-black">Je loopt mogelijk je droomwoning mis...</p>
              <p className="text-[14px] text-[#4B5563] mt-1.5 leading-relaxed">
                Met een gratis abonnement kan je niet reageren op woningen. Zo loop je mogelijk je droomwoning mis. Upgrade naar een betaald account en mis nooit meer een huurwoning!
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="w-full h-[56px] rounded-[6px] bg-[#e91e63] text-white text-[16px] font-bold hover:bg-[#d81b60] transition-colors active:scale-[0.98]"
            data-testid="button-upgrade-warning-cta"
          >
            Upgraden
          </button>
        </div>
      )}

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="rounded-[6px] border border-gray-200 bg-white px-5 py-4 flex items-center gap-3.5" data-testid="banner-trial">
          <div className="w-10 h-10 rounded-[6px] bg-[#EBEBF0] flex items-center justify-center flex-shrink-0">
            <Crown className="w-[18px] h-[18px] text-amber-400" />
          </div>
          <p className="text-[14px] font-medium text-[#000] flex-1 leading-snug">
            {t("home.trialUntil", { date: new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" }) })}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[13px] font-medium text-ha-primary hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            {t("home.upgrade")}
          </button>
        </div>
      )}

      {profiles.length > 0 && (
        <SearchProfilesSection profiles={profiles} navigate={navigate} />
      )}

      <div className="rounded-[12px] bg-white px-5 py-5" style={{ border: "1px solid rgba(15, 23, 42, 0.04)" }}>
        <button
          onClick={() => navigate("/application-letter")}
          className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
          data-testid="button-home-reaction-letter"
        >
          <Sparkles className="w-5 h-5 text-ha-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold text-black">{t("profile.reactionLetter2")}</p>
            <p className="text-[14px] text-[#4B5563] mt-0.5">{t("settings.reactionLetter")}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      </div>

      <div className="rounded-[12px] bg-white px-5 py-5" style={{ border: "1px solid rgba(15, 23, 42, 0.04)" }}>
        <button
          onClick={() => navigate("/profile/edit/search_buddy_email")}
          className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
          data-testid="button-home-zoekbuddy"
        >
          <Users className="w-5 h-5 text-ha-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold text-black">{t("profile.zoekbuddyTitle")}</p>
            <p className="text-[14px] text-[#4B5563] mt-0.5">{t("profile.buddyDescription")}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      </div>

      <RecentlyViewedSection accessToken={accessToken} />

      <div className="rounded-[6px] bg-[#1E1B4B] p-5" data-testid="card-home-referral">
        <p className="text-[11px] font-semibold text-ha-primary tracking-wider uppercase mb-1" data-testid="text-referral-label">
          {t("referral.homeLabel")}
        </p>
        <p className="text-[16px] text-title text-white" data-testid="text-referral-body">
          {t("referral.homeBody")}
        </p>
        <p className="text-[14px] text-white/60 mt-1 leading-relaxed" data-testid="text-referral-helper">
          {t("referral.homeHelper")}
        </p>
        <button
          onClick={() => setReferralModalOpen(true)}
          className="mt-4 h-[56px] px-6 rounded-[6px] bg-ha-primary text-white text-[14px] font-semibold transition-all hover:bg-ha-primary-hover active:scale-[0.97] inline-flex items-center gap-2"
          data-testid="button-home-referral-cta"
        >
          {t("referral.promoCta")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>


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
  { key: "favorieten", labelKey: "matches.subtabs.favorites", Icon: Heart },
];

function MatchesTab({ accessToken, setActiveTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { t } = useTranslation();
  const { toast } = useToast();
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;

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
          const serverApplied = new Set<string>(data.applied);
          const localApplied = safeGetSet(MATCH_APPLIED_KEY);

          let changed = false;
          for (const id of data.applied) {
            if (!localApplied.has(id)) {
              localApplied.add(id);
              changed = true;
            }
          }
          if (changed) {
            safeSetSet(MATCH_APPLIED_KEY, localApplied);
            setRefreshKey((k) => k + 1);
          }

          for (const localId of localApplied) {
            if (!serverApplied.has(localId)) {
              apiFetch(`/api/matches/${localId}/applied`, {
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
          }
        }
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/favorites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.favoriteIds && Array.isArray(data.favoriteIds)) {
          setFavoriteIds(new Set(data.favoriteIds));
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!accessToken) return;
      const wasFavorited = favoriteIds.has(listingId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });

      try {
        await apiFetch(`/api/favorites/${listingId}`, {
          method: wasFavorited ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch {
        setFavoriteIds((prev) => {
          const rollback = new Set(prev);
          if (wasFavorited) rollback.add(listingId);
          else rollback.delete(listingId);
          return rollback;
        });
      }
    },
    [accessToken, favoriteIds],
  );

  const matches = apiMatchesQuery.data?.matches ?? [];
  const totalCount = apiMatchesQuery.data?.totalCount ?? 0;

  const refreshStatuses = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const allMatchesSorted = [...matches].sort((a, b) => {
    const dateA = a.first_seen_at || a.published_at || "";
    const dateB = b.first_seen_at || b.published_at || "";
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-[#EBEBF0] pt-6 pb-4 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-page-title">{t("matches.title")}</h1>
        </div>
      </div>

      <div className="px-6 flex flex-col gap-8 mt-4">

      {apiMatchesQuery.isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="rounded-[6px] bg-white" style={{ aspectRatio: "4/3" }} />
              <div className="mt-3 flex flex-col gap-2">
                <div className="h-4 bg-white rounded w-1/3" />
                <div className="h-4 bg-white rounded w-2/3" />
                <div className="h-3 bg-white rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-[6px] border border-gray-200 p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-[6px] bg-[#EBEBF0] flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-[#6B7280]" />
          </div>
          <p className="text-[18px] text-title text-[#000]">{t("matches.loadError")}</p>
          <p className="text-[15px] text-[#4B5563] leading-relaxed">{t("matches.loadErrorDesc")}</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-medium text-ha-primary"
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
          onCtaClick={() => setActiveTab("profiel")}
          testId="empty-matches"
        />
      ) : (
        <div className="flex flex-col gap-[36px]">
          {allMatchesSorted.map((m) => (
            <MatchCard
              key={m.listing_id}
              match={m}
              onStatusChange={refreshStatuses}
              isFavorited={favoriteIds.has(m.listing_id)}
              onToggleFavorite={toggleFavorite}
              locked={!hasAccess}
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
    <div className="fixed inset-0 z-50 bg-[#EBEBF0] flex flex-col">
      <header className="sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-delete-back"
          >
            <ArrowLeft className="w-4 h-4 text-[#000]/80" />
          </button>
          <h1 className="text-[17px] text-title text-[#000] flex-1 tracking-wide">{t("filters.deleteTitle")}</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-[6px] bg-ha-primary flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-[22px] text-title text-[#000] mb-3 text-center" data-testid="text-delete-title">
          {t("filters.deleteQuestion")}
        </h2>
        <p className="text-[15px] text-[#000]/70 text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
          {t("filters.deleteConfirm")}
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full h-[56px] rounded-[6px] bg-ha-primary text-white text-[16px] font-semibold transition-colors hover:bg-ha-primary-hover"
            data-testid="button-delete-confirm"
          >
            {t("filters.deleteYes")}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[56px] rounded-[6px] border border-white/20 text-[#000] text-[16px] font-medium hover:bg-white/5 transition-colors"
            data-testid="button-delete-cancel"
          >
            {t("filters.deleteNo")}
          </button>
        </div>
      </main>
    </div>
  );
}

type FavSubTab = "favorieten" | "gereageerd";

function FavorietenTab({ accessToken }: { accessToken: string | undefined }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [favSubTab, setFavSubTab] = useState<FavSubTab>("favorieten");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteListings, setFavoriteListings] = useState<ApiMatch[]>([]);
  const [appliedListings, setAppliedListings] = useState<ApiMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;

  const fetchFavoriteListings = useCallback(() => {
    if (!accessToken) return;
    setIsLoading(true);
    apiFetch("/api/favorites/listings", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.listings) setFavoriteListings(data.listings);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const fetchAppliedListings = useCallback(() => {
    if (!accessToken) return;
    const appliedIds = safeGetSet(MATCH_APPLIED_KEY);
    apiFetch("/api/matches", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data: ApiMatchesResponse) => {
        if (data.matches) {
          const applied = data.matches.filter(
            (m) => m.canonical_applied || appliedIds.has(m.listing_id)
          );
          setAppliedListings(applied);
        }
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/favorites", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.favoriteIds && Array.isArray(data.favoriteIds)) {
          setFavoriteIds(new Set(data.favoriteIds));
        }
      })
      .catch(() => {});
    fetchFavoriteListings();
    fetchAppliedListings();
  }, [accessToken, fetchFavoriteListings, fetchAppliedListings]);

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      if (!accessToken) return;
      const wasFavorited = favoriteIds.has(listingId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      if (wasFavorited) {
        setFavoriteListings((prev) => prev.filter((l) => l.listing_id !== listingId));
      }

      try {
        const res = await apiFetch(`/api/favorites/${listingId}`, {
          method: wasFavorited ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) throw new Error("request failed");
        if (!wasFavorited) fetchFavoriteListings();
      } catch {
        setFavoriteIds((prev) => {
          const rollback = new Set(prev);
          if (wasFavorited) rollback.add(listingId);
          else rollback.delete(listingId);
          return rollback;
        });
        if (wasFavorited) fetchFavoriteListings();
      }
    },
    [accessToken, favoriteIds, fetchFavoriteListings],
  );

  const refreshStatuses = useCallback(() => {}, []);

  const currentListings = favSubTab === "favorieten" ? favoriteListings : appliedListings;

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-[#EBEBF0] pt-6 pb-0 px-6">
        <h1 className="text-page-title mb-4">{t("nav.favorites")}</h1>
        <div className="flex gap-2.5 pb-4" data-testid="fav-sub-tabs">
          {([
            { key: "favorieten" as FavSubTab, label: t("nav.favorites") },
            { key: "gereageerd" as FavSubTab, label: t("matches.subtabs.applied") },
          ]).map(({ key, label }) => {
            const isActive = favSubTab === key;
            return (
              <button
                key={key}
                onClick={() => setFavSubTab(key)}
                className={`px-5 py-2.5 rounded-[6px] text-[14px] font-medium transition-all ${
                  isActive
                    ? "bg-[#3b82f6] text-white"
                    : "bg-white text-[#4B5563]"
                }`}
                data-testid={`tab-fav-${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-6 flex flex-col gap-8 mt-4">
        {isLoading && favSubTab === "favorieten" ? (
          <div className="flex flex-col gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="rounded-[6px] bg-white" style={{ aspectRatio: "4/3" }} />
                <div className="mt-3 flex flex-col gap-2">
                  <div className="h-4 bg-white rounded w-1/3" />
                  <div className="h-4 bg-white rounded w-2/3" />
                  <div className="h-3 bg-white rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : currentListings.length === 0 ? (
          <EmptyState
            illustration={favSubTab === "favorieten" ? EMPTY_STATE_IMAGES.noFilters : EMPTY_STATE_IMAGES.noApplications}
            title={favSubTab === "favorieten" ? t("matches.emptyFavorites.title") : t("matches.emptyApplied.title")}
            description={favSubTab === "favorieten" ? t("matches.emptyFavorites.desc") : t("matches.emptyApplied.desc")}
            testId={`empty-${favSubTab}-tab`}
          />
        ) : (
          <div className="flex flex-col gap-[36px]">
            {currentListings.map((m) => (
              <MatchCard
                key={m.listing_id}
                match={m}
                onStatusChange={refreshStatuses}
                isFavorited={favoriteIds.has(m.listing_id)}
                onToggleFavorite={toggleFavorite}
                locked={!hasAccess}
              />
            ))}
          </div>
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
        className="relative w-full max-w-[480px] bg-white rounded-t-[6px] pb-10 pt-3 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#EBEBF0] rounded-full mx-auto mb-6" />
        <div className="px-6">
          <h3 className="text-[18px] text-title text-[#000] mb-6">{t("profile.photo.title")}</h3>

          {photoUrl && (
            <div className="flex justify-center mb-5">
              <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" data-testid="img-current-photo" />
            </div>
          )}

          <div className="flex flex-col">
            <label className="w-full h-[56px] flex items-center justify-center gap-2 rounded-[6px] bg-ha-primary text-white text-[15px] font-semibold cursor-pointer active:bg-ha-primary-hover transition-colors">
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
                className="mt-3 w-full h-[56px] flex items-center justify-center gap-2 rounded-[6px] border border-gray-200 text-[#000] text-[15px] font-medium active:bg-[#EBEBF0] transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                {t("profile.photo.remove")}
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[56px] flex items-center justify-center rounded-[6px] text-[#000]/70 text-[15px] font-medium active:bg-[#EBEBF0] transition-colors"
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


function ProfielTab({ user, signOut, navigate, subscription, setActiveTab, canonicalStats, computedAppliedCount }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null }; setActiveTab: (tab: TabKey) => void; canonicalStats?: CanonicalStats; computedAppliedCount: number }) {
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      window.location.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  const profileDataQuery = useQuery({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      console.log(`[IDENTITY] ProfielTab profile fetch — first_name="${data?.first_name ?? "null"}", user_id="${data?.user_id ?? "unknown"}", auth_user="${session.user?.id?.substring(0, 8) ?? "null"}"`);
      return data;
    },
  });

  const pd = profileDataQuery.data;
  const photoUrl = pd?.profile_photo_url || null;

  useEffect(() => {
    if (pd?.language && (pd.language === "de" || pd.language === "en" || pd.language === "nl") && pd.language !== locale) {
      setLocale(pd.language);
    }
  }, [pd?.language]);

  const displayName = [pd?.first_name, pd?.last_name].filter(Boolean).join(" ") || user.user_metadata?.full_name || "";
  const initials = displayName ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) : user.email?.[0]?.toUpperCase() ?? "?";
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

  const memberSinceLabel = user.created_at
    ? (() => {
        const d = new Date(user.created_at);
        const monthNames: Record<string, string[]> = {
          de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"],
          en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
          nl: ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"],
        };
        const months = monthNames[locale] || monthNames.de;
        return `${t("profile.memberSincePrefix")} ${months[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "";

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#EBEBF0]">
      <div className="relative" data-testid="card-profile-summary">
        <div className="bg-ha-profile-header h-[160px]" style={{ borderRadius: "0 0 50% 50% / 0 0 36px 36px" }} />
        <div className="flex flex-col items-center -mt-12 mb-5">
          <div className="w-24 h-24 rounded-full bg-[#312e81] flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[26px] font-bold text-white tracking-wide">{initials}</span>
            )}
          </div>
          <p className="text-[20px] font-bold text-black mt-3" data-testid="text-user-firstname">
            {displayName || t("profile.seeker")}
          </p>
          {lastName && (
            <span className="hidden" data-testid="text-user-lastname">{lastName}</span>
          )}
          <p className="text-[14px] text-[#4B5563] mt-0.5" data-testid="text-member-since">
            {memberSinceLabel}
          </p>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-5 pb-8">
        <div className="flex flex-col gap-4">

          <div>
            <p className="text-row-section-title px-1 mb-2" data-testid="text-section-account">{t("settings.sectionAccount")}</p>
            <div className="app-card !p-0">
              {[
                { label: t("settings.myDetails"), route: "/profile/details", icon: <User className="w-5 h-5 text-[#6B7280]" /> },
                { label: t("settings.password"), route: "/account/change-password", icon: <Lock className="w-5 h-5 text-[#6B7280]" /> },
              ].map((row, ri) => (
                <div key={ri}>
                  {ri > 0 && <div className="h-px bg-[#F0F0F0] mx-5" />}
                  <button
                    onClick={() => navigate(row.route)}
                    className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors"
                    data-testid={`button-profile-account-${ri}`}
                  >
                    {row.icon}
                    <p className="text-[15px] font-semibold text-[#000] flex-1">{row.label}</p>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-row-section-title px-1 mb-2" data-testid="text-section-preferences">{t("settings.preferences")}</p>
            <div className="app-card !p-0">
              <button
                onClick={() => navigate("/settings/preferences")}
                className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors"
                data-testid="button-profile-preferences"
              >
                <Bell className="w-5 h-5 text-[#6B7280]" />
                <p className="text-[15px] font-semibold text-[#000] flex-1">{t("settings.preferences")}</p>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-row-section-title px-1 mb-2" data-testid="text-section-subscription">{t("settings.subscription")}</p>
            <div className="app-card !p-0">
              <button
                onClick={() => navigate("/account/subscription")}
                className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors"
                data-testid="button-profile-subscription"
              >
                <Crown className="w-5 h-5 text-[#6B7280]" />
                <p className="text-[15px] font-semibold text-[#000] flex-1">{t("settings.subscription")}</p>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-row-section-title px-1 mb-2" data-testid="text-section-other">{t("settings.sectionHelp")}</p>
            <div className="app-card !p-0">
              {[
                { label: t("settings.contactUs"), action: () => { window.location.href = "mailto:support@housalert.com"; }, icon: <HelpCircle className="w-5 h-5 text-[#6B7280]" /> },
                { label: t("settings.privacyPolicy"), action: () => navigate("/datenschutz"), icon: <Shield className="w-5 h-5 text-[#6B7280]" /> },
                { label: t("settings.termsConditions"), action: () => navigate("/terms"), icon: <FileText className="w-5 h-5 text-[#6B7280]" /> },
              ].map((row, ri) => (
                <div key={ri}>
                  {ri > 0 && <div className="h-px bg-[#F0F0F0] mx-5" />}
                  <button
                    onClick={row.action}
                    className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors"
                    data-testid={`button-profile-other-${ri}`}
                  >
                    {row.icon}
                    <p className="text-[15px] font-semibold text-[#000] flex-1">{row.label}</p>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="app-card !p-0">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={signingOut}
              className={`w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
              data-testid="button-profile-logout"
            >
              <LogOut className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-[15px] font-semibold text-red-500 flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
            </button>
            <div className="h-px bg-[#F0F0F0] mx-5" />
            <button
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#FAFAFA] transition-colors"
              data-testid="button-profile-delete-account"
            >
              <Trash2 className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
              <p className="text-[15px] text-[#6B7280] flex-1">{t("profile.deleteAccount")}</p>
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 pt-4 pb-2">
            <p className="text-[14px] font-bold text-[#000]">HousAlert</p>
            <p className="text-[12px] text-[#9CA3AF]">v1.0.0</p>
          </div>

          {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && <div className="h-16" />}
        </div>
      </div>

      {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && (
        <button
          onClick={() => navigate("/admin/portal")}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] left-1/2 -translate-x-1/2 z-40 bg-ha-profile-header text-white text-[14px] font-medium px-4 py-2.5 rounded-[6px] shadow-[0_2px_10px_rgba(30,27,75,0.2)] active:scale-95 transition-transform"
          data-testid="button-admin-portal"
        >
          {t("profile.adminMode")}
        </button>
      )}

      {showPhotoSheet && (
        <ProfilePhotoSheet
          photoUrl={photoUrl}
          onClose={() => setShowPhotoSheet(false)}
          onUpload={handlePhotoUpload}
          onRemove={handlePhotoRemove}
        />
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-[#000] text-center">{t("profile.logoutConfirm")}</p>
            <p className="text-[15px] text-[#4B5563] text-center mt-2 mb-6">{t("profile.logoutDesc")}</p>
            <button
              onClick={handleLogout}
              className="w-full ha-btn bg-red-500 text-white font-semibold mb-3"
              data-testid="button-profile-logout-confirm"
            >
              {t("profile.logoutYes")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full ha-btn text-[#000] font-medium active:bg-[#EBEBF0]"
              data-testid="button-profile-logout-cancel"
            >
              {t("profileDetails.cancel")}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

const TAB_CONFIG: { key: TabKey; labelKey: string; Icon: any }[] = [
  { key: "home", labelKey: "nav.home", Icon: Home },
  { key: "matches", labelKey: "nav.matches", Icon: Check },
  { key: "favorieten", labelKey: "nav.favorites", Icon: Heart },
  { key: "profiel", labelKey: "nav.profile", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["home", "matches", "tips", "favorieten", "profiel"].includes(tab)) {
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
      console.log(`[IDENTITY] Dashboard user effect — invalidating all queries for user=${user.id.substring(0, 8)}`);
      queryClient.invalidateQueries();
    }
  }, [user?.id]);

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

  const dashProfileQuery = useQuery<{ profile_photo_url?: string | null }>({
    queryKey: ["/api/profile-data"],
    enabled: !!user && !!accessToken,
  });
  const tabPhotoUrl = dashProfileQuery.data?.profile_photo_url || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EBEBF0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-white animate-pulse" />
          <p className="text-[#000]/70 text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.totalCount ?? 0;
  const newCount = apiMatchesQuery.data?.newCount ?? 0;

  const allMatches = apiMatchesQuery.data?.matches ?? [];
  const computedAppliedCount = allMatches.length > 0
    ? allMatches.filter(m => getMatchTab(m) === "gereageerd").length
    : (apiMatchesQuery.data?.canonicalStats?.applied ?? 0);

  const emailNeedsVerification = user?.user_metadata?.email_needs_verification === true;

  return (
    <div className="min-h-screen bg-[#EBEBF0] flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-[100px]">
        {emailNeedsVerification && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-[#FEF3C7] rounded-[6px] px-4 py-3" data-testid="banner-email-confirm">
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
          <MatchesTab accessToken={accessToken} setActiveTab={setActiveTab} />
        )}
        {activeTab === "tips" && <TipsPage navigate={navigate} />}
        {activeTab === "favorieten" && (
          <FavorietenTab accessToken={accessToken} />
        )}
        {activeTab === "profiel" && (
          <ProfielTab
            user={user}
            signOut={signOut}
            navigate={navigate}
            subscription={{ status: sub.status, isTrial: sub.isTrial, isActive: sub.isActive, isExpired: sub.isExpired, plan: sub.plan, trialEndsAt: sub.trialEndsAt }}
            setActiveTab={setActiveTab}
            canonicalStats={apiMatchesQuery.data?.canonicalStats}
            computedAppliedCount={computedAppliedCount}
          />
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <nav className="max-w-xl mx-auto flex h-[58px]" data-testid="bottom-nav">
          {TAB_CONFIG.map(({ key, labelKey, Icon }) => {
            const isActive = activeTab === key;
            const isProfileWithPhoto = key === "profiel" && !!tabPhotoUrl;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-[5px]"
                data-testid={`tab-${key}`}
              >
                {isProfileWithPhoto ? (
                  <div className={`w-[26px] h-[26px] rounded-full overflow-hidden ${isActive ? "ring-[2px] ring-[#3b82f6] ring-offset-1 ring-offset-white" : ""}`}>
                    <img src={tabPhotoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Icon className={`w-[24px] h-[24px] transition-colors ${isActive ? "text-[#3b82f6]" : "text-[#6B7280]"}`} strokeWidth={isActive ? 2.2 : 2} />
                )}
                <span className={`text-[11px] transition-colors ${isActive ? "font-semibold text-[#3b82f6]" : "font-medium text-[#6B7280]"}`}>
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
