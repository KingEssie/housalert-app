import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, type ApiMatch, type ApiMatchesResponse, type CanonicalStats } from "@/lib/listings";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dateLocale } from "../../../config/market";
import { useSubscription } from "@/lib/subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import {
  Home,
  Heart,
  SlidersHorizontal,
  User,
  Plus,
  MapPin,
  Trash2,
  Euro,
  BedDouble,
  Ruler,
  Clock,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  Crown,
  AlertTriangle,
  ExternalLink,
  Eye,
  Send,
  ImageIcon,
  Zap,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { AccountCompletionCard, SearchPreparationCard, TaskModal, PrepTaskModal } from "@/components/profile-strength";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import TipsPage from "@/pages/tips";

const MAX_PROFILES = 4;

function bedroomLabel(min: number) {
  if (min === 0) return "Studio+";
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

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-[#0D6EFD]", text: "text-white" },
  nieuw: { bg: "bg-[#1F2937]", text: "text-white" },
  vandaag: { bg: "bg-[#1F2937]", text: "text-white" },
  ouder: { bg: "bg-[#F5F7FA]", text: "text-[#1F2937]" },
};

const FRESH_LABEL_KEYS: Record<string, string> = {
  net_binnen: "freshness.justIn",
  nieuw: "freshness.new",
  vandaag: "freshness.today",
  ouder: "freshness.older",
};

type TabKey = "home" | "matches" | "filters" | "tips" | "profiel";
type MatchSubTab = "nieuw" | "bekeken" | "opgeslagen" | "gereageerd";

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
const MATCH_SAVED_KEY = "housalert_match_saved";
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
  localStorage.setItem(key, JSON.stringify([...set]));
}

function markViewed(listingId: string) {
  const s = safeGetSet(MATCH_VIEWED_KEY);
  s.add(listingId);
  safeSetSet(MATCH_VIEWED_KEY, s);
}

function toggleSaved(listingId: string): boolean {
  const s = safeGetSet(MATCH_SAVED_KEY);
  if (s.has(listingId)) { s.delete(listingId); } else { s.add(listingId); }
  safeSetSet(MATCH_SAVED_KEY, s);
  return s.has(listingId);
}

function markApplied(listingId: string) {
  const s = safeGetSet(MATCH_APPLIED_KEY);
  s.add(listingId);
  safeSetSet(MATCH_APPLIED_KEY, s);
  markViewed(listingId);
}

function getMatchTab(match: ApiMatch): MatchSubTab {
  if (match.canonical_applied) return "gereageerd";
  if (match.canonical_saved) return "opgeslagen";
  if (match.canonical_viewed) return "bekeken";
  return "nieuw";
}

const MATCH_REASON_KEYS: Record<string, string> = {
  Standort: "matchReason.district",
  Preis: "matchReason.budget",
  Zimmer: "matchReason.preferences",
  Größe: "matchReason.size",
  nieuw: "matchReason.fresh",
  goede_prijs: "matchReason.price",
};


function MatchCard({
  match,
  onSaveToggle,
  onApplyClick,
  isSaved,
  onStatusChange,
}: {
  match: ApiMatch;
  onSaveToggle: (listingId: string) => void;
  onApplyClick: (match: ApiMatch) => void;
  isSaved: boolean;
  onStatusChange: () => void;
}) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const style = FRESH_BADGE_STYLES[match.fresh_label] ?? FRESH_BADGE_STYLES.ouder;
  const gradient = getCityGradient(match.city);
  const hasImage = !!match.image_url;

  function handleCardClick() {
    markViewed(match.listing_id);
    onStatusChange();
    navigate(`/listing/${match.listing_id}`);
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    onSaveToggle(match.listing_id);
  }

  function handleApply(e: React.MouseEvent) {
    e.stopPropagation();
    onApplyClick(match);
  }

  return (
    <div
      className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
      onClick={handleCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full h-[200px] object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-[200px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[12px] font-medium">{match.source}</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`}>
            {FRESH_LABEL_KEYS[match.fresh_label] ? t(FRESH_LABEL_KEYS[match.fresh_label]) : match.fresh_label}
          </span>
          {(() => {
            const reasons = match.match_reasons ?? [];
            const label = reasons.length > 0 && MATCH_REASON_KEYS[reasons[0]]
              ? t(MATCH_REASON_KEYS[reasons[0]])
              : match.in_latest_email ? "E-mail" : null;
            return label ? (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-sm bg-white/80 text-[#1F2937]" data-testid={`badge-context-${match.listing_id}`}>
                {label}
              </span>
            ) : null;
          })()}
        </div>

        <button
          onClick={handleSave}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          data-testid={`button-save-match-${match.listing_id}`}
        >
          {isSaved ? (
            <Heart className="w-[18px] h-[18px] text-[#EF4444] fill-[#EF4444]" />
          ) : (
            <Heart className="w-[18px] h-[18px] text-[#1F2937]" />
          )}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3
              className="font-[700] text-[#111C3D] text-[18px] leading-[1.3] line-clamp-2 flex-1"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
            {match.price > 0 && (
              <span className="text-[17px] font-bold text-[#111C3D] whitespace-nowrap flex-shrink-0 mt-0.5">
                €{match.price}
                <span className="text-[12px] font-normal text-[#1F2937]"> {t("common.perMonth")}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-[#1F2937]">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {match.city}
          </span>
          <span className="text-[#E5E7EB]">·</span>
          {match.bedrooms > 0 && (
            <>
              <span className="flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" />
                {match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}
              </span>
              <span className="text-[#E5E7EB]">·</span>
            </>
          )}
          {match.size_m2 > 0 && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              {match.size_m2} m²
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
          <span className="capitalize font-medium">{match.source}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(match.matched_at || match.first_seen_at, t)}
          </span>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleApply}
            className="flex-1 h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid={`button-apply-${match.listing_id}`}
          >
            <Zap className="w-4 h-4" />
            {t("matches.applyDirect")}
          </button>
          {match.url ? (
            <a
              href={match.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                markViewed(match.listing_id);
                onStatusChange();
              }}
              className="h-[56px] px-5 rounded-full border border-[#E5E7EB] bg-white text-[#1F2937] text-[14px] font-bold hover:bg-[#F5F7FA] transition-colors flex items-center justify-center gap-1.5"
              data-testid={`button-view-listing-${match.listing_id}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("matches.viewOriginal")}
            </a>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markViewed(match.listing_id);
                onStatusChange();
                navigate(`/listing/${match.listing_id}`);
              }}
              className="h-[56px] px-5 rounded-full border border-[#E5E7EB] bg-white text-[#1F2937] text-[14px] font-bold hover:bg-[#F5F7FA] transition-colors flex items-center justify-center gap-1.5"
              data-testid={`button-view-listing-${match.listing_id}`}
            >
              <Eye className="w-3.5 h-3.5" />
              {t("matches.view")}
            </button>
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
  const { t } = useTranslation();

  return (
    <div
      className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#E5E7EB] p-5 flex flex-col gap-5"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
            <MapPin className="w-[18px] h-[18px] text-[#1F2937]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-[700] text-[#111C3D] text-[18px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city_name || profile.city}
              </h3>
              <span className="text-[10px] font-semibold text-[#0D6EFD] bg-[#EBF2FF] px-2 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                {t("common.active")}
              </span>
            </div>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              {t("filters.createdOn", { date: new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F5F7FA] transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {profile.location_mode === "districts" && profile.districts && profile.districts.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]" data-testid={`badge-districts-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.districts.length === 1 ? profile.districts[0] : t("filters.districtsCount", { count: profile.districts.length })}
          </span>
        )}
        {profile.location_mode === "radius" && profile.radius_km && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]" data-testid={`badge-radius-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.radius_km} {t("filters.radius")}
          </span>
        )}
        {profile.location_mode === "commute" && profile.commute_destination && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]" data-testid={`badge-commute-${profile.id}`}>
            <Clock className="w-3 h-3" />
            {profile.commute_minutes ? t("filters.commute", { time: profile.commute_minutes }) : ""} {profile.commute_mode === "ov" ? t("filters.transit") : profile.commute_mode === "fiets" ? t("filters.bike") : t("filters.car")}
          </span>
        )}
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? t("filters.fromPrice", { price: profile.price_min })
              : t("filters.toPrice", { price: profile.price_max })}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F5F7FA] text-[#1F2937] px-2.5 py-1 rounded-full border border-[#E5E7EB]">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <div>
        <button
          onClick={onEdit}
          className="h-9 px-5 rounded-full border border-[#0D6EFD] bg-white text-[13px] font-semibold text-[#0D6EFD] hover:bg-[#EBF2FF] transition-colors inline-flex items-center gap-1.5"
          data-testid={`button-edit-${profile.id}`}
        >
          {t("common.edit")}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
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
  });
  const matches = (apiMatchesQuery.data?.matches ?? [])
    .filter(m => m.title && m.url && m.listing_id)
    .slice(0, 5);
  const isLoading = apiMatchesQuery.isLoading;

  if (!hasActiveSub) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#1F2937]" />
          <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        </div>
        <div className="bg-[#F5F7FA] rounded-2xl p-5 text-center">
          <p className="text-[14px] text-[#1F2937] mb-3">
            {t("home.matchesWillAppear")}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="h-[44px] px-6 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-semibold transition-colors"
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-[#F5F7FA] rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#1F2937]" />
          <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        </div>
        <div className="bg-[#F5F7FA] rounded-2xl p-5 text-center">
          <p className="text-[14px] text-[#1F2937]">
            {t("home.firstMatchesWillAppear")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="section-recente-matches">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#1F2937]" />
          <h2 className="text-section-title">{t("home.recentMatches")}</h2>
        </div>
        <button
          onClick={() => setActiveTab("matches")}
          className="text-[13px] font-semibold text-[#0D6EFD]"
          data-testid="button-view-all-matches"
        >
          {t("home.viewAll")}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((match) => (
          <RecentMatchMiniCard key={match.listing_id} match={match} />
        ))}
      </div>
    </div>
  );
}

function RecentMatchMiniCard({ match }: { match: ApiMatch }) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);

  return (
    <div
      className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 active:scale-[0.985] flex"
      onClick={() => navigate(`/listing/${match.listing_id}`)}
      data-testid={`card-recent-match-${match.listing_id}`}
    >
      {hasImage ? (
        <img
          src={match.image_url!}
          alt={match.title}
          className="w-20 h-20 object-cover flex-shrink-0"
          loading="lazy"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`w-20 h-20 bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
          <ImageIcon className="w-5 h-5 text-white/60" />
        </div>
      )}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-0.5">
        <h3 className="text-[14px] font-[700] text-[#111C3D] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </h3>
        <div className="flex items-center gap-2 text-[12px] text-[#1F2937]">
          <span className="flex items-center gap-0.5">
            <MapPin className="w-3 h-3" />
            {match.city}
          </span>
          {match.bedrooms > 0 && (
            <span className="flex items-center gap-0.5">
              <BedDouble className="w-3 h-3" />
              {match.bedrooms}
            </span>
          )}
          {match.size_m2 > 0 && (
            <span className="flex items-center gap-0.5">
              <Ruler className="w-3 h-3" />
              {match.size_m2}m²
            </span>
          )}
        </div>
      </div>
      {match.price > 0 && (
        <div className="flex items-center pr-3 flex-shrink-0">
          <span className="text-[15px] font-bold text-[#111C3D]">€{match.price}</span>
        </div>
      )}
    </div>
  );
}

function HomeTab({
  user,
  profiles,
  matchCount,
  navigate,
  setActiveTab,
  subscription,
  accessToken,
}: {
  user: any;
  profiles: SearchProfile[];
  matchCount: number;
  navigate: (path: string) => void;
  setActiveTab: (tab: TabKey) => void;
  subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null };
  accessToken: string | undefined;
}) {
  const [activeTaskModal, setActiveTaskModal] = useState<string | null>(null);
  const [activePrepModal, setActivePrepModal] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleAccountTaskClick = (taskId: string) => {
    setActiveTaskModal(taskId);
  };

  const handlePrepTaskClick = (taskId: string) => {
    setActivePrepModal(taskId);
  };

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
  const profileCount = profiles.length;
  const hasProfiles = profileCount > 0;
  const hasMatches = matchCount > 0;

  const firstProfile = profiles[0];
  const hasActiveSub = subscription.isActive || subscription.isTrial;

  const estimateQuery = useQuery<{ perWeekEstimate: number; last7dCount: number }>({
    queryKey: ["/api/estimate", firstProfile?.city],
    queryFn: async () => {
      const params = new URLSearchParams({ city: firstProfile.city });
      if (firstProfile.price_min) params.set("minPrice", String(firstProfile.price_min));
      if (firstProfile.price_max) params.set("maxPrice", String(firstProfile.price_max));
      if (firstProfile.bedrooms_min) params.set("minRooms", String(firstProfile.bedrooms_min));
      if (firstProfile.size_min) params.set("minSize", String(firstProfile.size_min));
      const res = await apiFetch(`/api/estimate?${params}`);
      if (!res.ok) throw new Error("estimate failed");
      return res.json();
    },
    enabled: hasProfiles,
    staleTime: 5 * 60 * 1000,
  });
  const perWeekEstimate = estimateQuery.data?.perWeekEstimate ?? 0;

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-10 bg-white pt-5 pb-3 px-6">
        <h1 className="text-page-title" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")}
        </h1>
      </div>
      <div className="flex flex-col gap-8 px-6 mt-4">

      {hasActiveSub && hasMatches ? (
        <div className="rounded-2xl bg-[#0F172A] p-6" data-testid="hero-matches">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-bold text-white leading-tight" data-testid="text-match-count">
                {t("home.matchesBanner", { count: matchCount > 999 ? "999+" : matchCount, label: matchCount === 1 ? t("home.matchSingular") : t("home.matchPlural") })}
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                {hasProfiles
                  ? t("home.basedOnProfiles", { count: profileCount, label: profileCount === 1 ? t("home.profileSingular") : t("home.profilePlural") })
                  : t("home.basedOnSearch")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="ml-14 h-[48px] px-6 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-bold transition-colors inline-flex items-center gap-2"
            data-testid="button-view-matches"
          >
            {t("home.viewMatches")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : hasActiveSub && hasProfiles ? (
        <div className="rounded-2xl bg-[#0F172A] p-6" data-testid="hero-active-no-matches">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white leading-tight" data-testid="text-active-searching">
                {t("home.searchingActive")}
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                {t("home.receivingMatches", { count: profileCount, label: profileCount === 1 ? t("home.profileSingular") : t("home.profilePlural") })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("filters")}
            className="ml-14 h-[48px] px-6 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-bold transition-colors inline-flex items-center gap-2"
            data-testid="button-adjust-filters"
          >
            {t("home.adjustFilters")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : hasProfiles ? (
        <div className="rounded-2xl bg-[#0F172A] p-6" data-testid="hero-estimate">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white leading-tight" data-testid="text-estimate-count">
                {perWeekEstimate > 0
                  ? t("home.weekEstimate", { count: perWeekEstimate })
                  : t("home.profileReady")}
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                {perWeekEstimate > 0
                  ? t("home.basedOnProfiles", { count: profileCount, label: profileCount === 1 ? t("home.profileSingular") : t("home.profilePlural") })
                  : t("home.activateSubToReceive")}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="ml-14 h-[48px] px-6 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[14px] font-bold transition-colors inline-flex items-center gap-2"
            data-testid="button-activate-sub"
          >
            {t("home.activateSubscription")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
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
        <div className="bg-[#F5F7FA] rounded-2xl px-5 py-3.5 flex items-center gap-3" data-testid="banner-trial">
          <Crown className="w-4 h-4 text-[#1F2937] flex-shrink-0" />
          <p className="text-[13px] font-[500] text-[#1F2937] flex-1">
            {t("home.trialUntil", { date: new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" }) })}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#0D6EFD] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            {t("home.upgrade")}
          </button>
        </div>
      )}

      <AccountCompletionCard onTaskClick={handleAccountTaskClick} />
      <SearchPreparationCard onTaskClick={handlePrepTaskClick} />

      <RecenteMatchesSection accessToken={accessToken} setActiveTab={setActiveTab} subscription={subscription} navigate={navigate} />

      {activeTaskModal && (
        <TaskModal
          taskId={activeTaskModal}
          onClose={() => setActiveTaskModal(null)}
          navigate={navigate}
        />
      )}
      {activePrepModal && (
        <PrepTaskModal
          taskId={activePrepModal}
          onClose={() => setActivePrepModal(null)}
          navigate={navigate}
        />
      )}

      {hasActiveSub && hasMatches && (
        <button
          onClick={() => setActiveTab("filters")}
          className="w-full h-[56px] rounded-full border border-[#E5E7EB] bg-white text-[#1F2937] text-[15px] font-bold hover:bg-[#F5F7FA] transition-colors flex items-center justify-center gap-2"
          data-testid="button-manage-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t("home.manageFilters")}
        </button>
      )}
      </div>
    </div>
  );
}

const MATCH_SUB_TAB_CONFIG: { key: MatchSubTab; labelKey: string; Icon: any }[] = [
  { key: "nieuw", labelKey: "matches.subtabs.new", Icon: Sparkles },
  { key: "bekeken", labelKey: "matches.subtabs.viewed", Icon: Eye },
  { key: "opgeslagen", labelKey: "matches.subtabs.saved", Icon: Heart },
  { key: "gereageerd", labelKey: "matches.subtabs.applied", Icon: Send },
];

function MatchesTab({ accessToken, setActiveTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void }) {
  const [subTab, setSubTab] = useState<MatchSubTab>("nieuw");
  const [refreshKey, setRefreshKey] = useState(0);
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
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

  const handleSaveToggle = useCallback((listingId: string) => {
    toggleSaved(listingId);
    if (accessToken) {
      const isSaved = safeGetSet(MATCH_SAVED_KEY).has(listingId);
      apiFetch(`/api/matches/${listingId}/saved`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ saved: isSaved }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      }).catch(() => {});
    }
    refreshStatuses();
  }, [refreshStatuses, accessToken]);

  const handleApplyClick = useCallback((match: ApiMatch) => {
    navigate(`/apply/${match.listing_id}`);
  }, [navigate]);

  const canonicalStats = apiMatchesQuery.data?.canonicalStats;
  const matchTabs = matches.map((m) => ({ ...m, _tab: getMatchTab(m) }));
  const filteredMatches = matchTabs.filter((m) => m._tab === subTab);

  const tabCounts: Record<string, number> = canonicalStats
    ? {
        nieuw: canonicalStats.new_count,
        bekeken: canonicalStats.viewed,
        opgeslagen: canonicalStats.saved,
        gereageerd: canonicalStats.applied,
      }
    : matchTabs.reduce((acc, m) => {
        acc[m._tab] = (acc[m._tab] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-5 px-6 pt-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title">{t("matches.title")}</h1>
        {totalCount > 0 && (
          <span className="text-[13px] font-medium text-[#1F2937] bg-[#F5F7FA] px-2.5 py-1 rounded-full" data-testid="badge-match-count">
            {totalCount > 999 ? "999+" : totalCount} {totalCount === 1 ? t("matches.listingSingular") : t("matches.listingPlural")}
          </span>
        )}
      </div>

      <div className="flex relative border-b border-[#E5E7EB]" data-testid="match-sub-tabs">
        {MATCH_SUB_TAB_CONFIG.map(({ key, labelKey }) => {
          const count = tabCounts[key] || 0;
          const isActive = subTab === key;
          return (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-[15px] font-semibold transition-colors ${
                isActive ? "text-[#1F2937]" : "text-[#6B7280]"
              }`}
              data-testid={`tab-matches-${key}`}
            >
              <span>{t(labelKey)}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full ${
                  isActive ? "bg-[#0D6EFD] text-white" : "bg-[#E5E7EB] text-[#1F2937]"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div
          className="absolute bottom-0 h-[3px] bg-[#0D6EFD] rounded-full transition-transform duration-300 ease-in-out"
          style={{
            width: `${100 / MATCH_SUB_TAB_CONFIG.length}%`,
            transform: `translateX(${MATCH_SUB_TAB_CONFIG.findIndex(t => t.key === subTab) * 100}%)`,
          }}
        />
      </div>

      {apiMatchesQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden animate-pulse">
              <div className="h-[200px] bg-[#F5F7FA]" />
              <div className="p-4 flex flex-col gap-2.5">
                <div className="h-6 bg-[#F5F7FA] rounded-full w-28" />
                <div className="h-5 bg-[#F5F7FA] rounded w-3/4" />
                <div className="h-4 bg-[#F5F7FA] rounded w-1/2" />
                <div className="flex gap-1.5">
                  <div className="h-6 bg-[#F5F7FA] rounded-full w-24" />
                  <div className="h-6 bg-[#F5F7FA] rounded-full w-28" />
                </div>
                <div className="flex gap-2 mt-1">
                  <div className="h-[44px] bg-[#F5F7FA] rounded-lg flex-1" />
                  <div className="h-[44px] bg-[#F5F7FA] rounded-lg w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F5F7FA] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[#1F2937]" />
          </div>
          <p className="text-[18px] font-[700] text-[#111C3D]">{t("matches.loadError")}</p>
          <p className="text-[13px] text-[#1F2937]">{t("matches.loadErrorDesc")}</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-semibold text-[#0D6EFD]"
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
        subTab === "opgeslagen" ? (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noSaved}
            title={t("matches.emptySaved.title")}
            description={t("matches.emptySaved.desc")}
            ctaLabel={t("matches.discoverListings")}
            onCtaClick={() => setSubTab("nieuw")}
            testId="empty-saved"
          />
        ) : subTab === "gereageerd" ? (
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
        <div className="flex flex-col gap-4">
          {filteredMatches.map((m) => (
            <MatchCard
              key={m.listing_id}
              match={m}
              onSaveToggle={handleSaveToggle}
              onApplyClick={handleApplyClick}
              isSaved={m.canonical_saved ?? safeGetSet(MATCH_SAVED_KEY).has(m.listing_id)}
              onStatusChange={refreshStatuses}
            />
          ))}
        </div>
      )}

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
            <ArrowLeft className="w-4 h-4 text-[#1F2937]" />
          </button>
          <h1 className="text-[17px] font-bold text-[#111C3D] flex-1 tracking-wide">{t("filters.deleteTitle")}</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#0D6EFD] flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-[22px] font-bold text-[#111C3D] mb-3 text-center" data-testid="text-delete-title">
          {t("filters.deleteQuestion")}
        </h2>
        <p className="text-[15px] text-[#1F2937] text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
          {t("filters.deleteConfirm")}
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[16px] font-bold transition-colors hover:opacity-90"
            data-testid="button-delete-confirm"
          >
            {t("filters.deleteYes")}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[52px] rounded-full border border-[#E5E7EB] text-[#1F2937] text-[16px] font-bold hover:bg-[#F5F7FA] transition-colors"
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
    <div className="flex flex-col gap-5 px-6 pt-6 pb-6">
      <h1 className="text-page-title">{t("filters.title")}</h1>

      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 animate-pulse">
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
            <p className="text-[17px] font-bold text-[#111C3D]">
              {t("filters.activeCountTitle", { count: profileCount, max: MAX_PROFILES })}
            </p>
            <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
              {t("filters.activeCountDesc")}
            </p>
            {!atLimit && (
              <button
                onClick={() => navigate("/dashboard/searches/new")}
                className="w-14 h-14 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] flex items-center justify-center text-white transition-colors shadow-[0_4px_12px_rgba(13,110,253,0.3)] mt-5"
                data-testid="button-add-search-card"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
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
  );
}

type ProfileSubTab = "over" | "account";

function ProfilePhotoSheet({ photoUrl, onClose, onUpload, onRemove }: { photoUrl: string | null; onClose: () => void; onUpload: (file: File) => void; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-lg pb-8 pt-2 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E7EB] rounded-full mx-auto mb-6" />
        <div className="px-5">
          <h3 className="text-[18px] font-bold text-[#111C3D] tracking-wide mb-5">{t("profile.photo.title")}</h3>

          {photoUrl && (
            <div className="flex justify-center mb-5">
              <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" data-testid="img-current-photo" />
            </div>
          )}

          <div className="flex flex-col">
            <label className="w-full h-[52px] flex items-center justify-center gap-2 rounded-full bg-[#0D6EFD] text-white text-[15px] font-bold cursor-pointer active:bg-[#0B5ED7] transition-colors">
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
                className="mt-3 w-full h-[52px] flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] text-[#1F2937] text-[15px] font-bold active:bg-[#F5F7FA] transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                {t("profile.photo.remove")}
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[52px] flex items-center justify-center rounded-full text-[#1F2937] text-[15px] font-bold active:bg-[#F5F7FA] transition-colors"
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

function AccountSettingsRow({ label, subtext, onClick, trailing }: { label: string; subtext?: string; onClick: () => void; trailing?: JSX.Element }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[#F5F7FA] transition-colors"
      data-testid={`row-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[500] text-[#1F2937]">{label}</p>
        {subtext && <p className="text-[13px] text-[#1F2937] mt-0.5">{subtext}</p>}
      </div>
      {trailing || <ChevronRight className="w-[18px] h-[18px] text-[#1F2937] flex-shrink-0" />}
    </button>
  );
}

function ProfielTab({ user, signOut, navigate, subscription, setActiveTab, initialSubTab, matchCount }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null }; setActiveTab: (tab: TabKey) => void; initialSubTab?: ProfileSubTab; matchCount: number }) {
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>(initialSubTab || "over");
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

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

  const statsQuery = useQuery({
    queryKey: ["/api/profile-stats"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { matches_received: 0, reactions_sent: 0 };
      const res = await apiFetch("/api/profile-stats", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const pd = profileDataQuery.data;
  const phone = notifQuery.data?.phone_e164;
  const stats = statsQuery.data ?? { matches_received: 0, reactions_sent: 0 };
  const photoUrl = pd?.profile_photo_url || null;

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

  const PROFILE_SUBTABS: { key: ProfileSubTab; label: string }[] = [
    { key: "over", label: t("profile.subtabs.about") },
    { key: "account", label: t("profile.subtabs.account") },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F5F7FA]">
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[480px] mx-auto flex relative">
          {PROFILE_SUBTABS.map(t2 => (
            <button
              key={t2.key}
              onClick={() => setProfileSubTab(t2.key)}
              className={`flex-1 text-center py-3.5 text-[15px] font-semibold transition-colors ${
                profileSubTab === t2.key ? "text-[#1F2937]" : "text-[#6B7280]"
              }`}
              data-testid={`tab-profile-${t2.key}`}
            >
              {t2.label}
            </button>
          ))}
          <div
            className="absolute bottom-0 h-[3px] bg-[#0D6EFD] rounded-full transition-transform duration-300 ease-in-out"
            style={{
              width: "50%",
              transform: profileSubTab === "over" ? "translateX(0%)" : "translateX(100%)",
            }}
          />
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-5 py-6">
        {profileSubTab === "over" ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <button
                onClick={() => navigate("/profile/details")}
                className="flex items-center gap-4 active:opacity-80 transition-opacity text-left w-full"
                data-testid="button-profile-header"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" data-testid="img-profile-avatar" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                    <span className="text-[22px] font-bold text-[#111C3D]">{initials}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[22px] font-[700] text-[#111C3D] truncate leading-tight" data-testid="text-user-name">{displayName || t("profile.seeker")}</p>
                  <p className="text-[14px] text-[#1F2937] mt-0.5">{t("profile.seeker")}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[#1F2937] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              {(subscription.isActive || subscription.isTrial) ? (
              <div className="flex">
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-matches">
                  <div className="w-10 h-10 rounded-full bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                    <Heart className="w-[18px] h-[18px] text-[#1F2937]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[#111C3D] leading-none">{matchCount > 999 ? "999+" : matchCount}</p>
                    <p className="text-[12px] text-[#1F2937] mt-1 leading-tight">{t("profile.stats.matchesReceived")}</p>
                  </div>
                </div>
                <div className="w-px bg-[#E5E7EB] my-3" />
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-reactions">
                  <div className="w-10 h-10 rounded-full bg-[#F5F7FA] flex items-center justify-center flex-shrink-0">
                    <Send className="w-[18px] h-[18px] text-[#1F2937]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[#111C3D] leading-none">{stats.reactions_sent}</p>
                    <p className="text-[12px] text-[#1F2937] mt-1 leading-tight">{t("profile.stats.reactionsSent")}</p>
                  </div>
                </div>
              </div>
              ) : (
              <div className="p-4 text-center" data-testid="kpi-no-sub">
                <p className="text-[14px] text-[#1F2937]">
                  {t("profile.activateSubStats")}
                </p>
              </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <button
                onClick={() => navigate("/profile/details")}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[#F5F7FA] transition-colors"
                data-testid="button-edit-details"
              >
                <p className="text-[15px] font-semibold text-[#0D6EFD]">{t("profile.editDetails")}</p>
                <ChevronRight className="w-[18px] h-[18px] text-[#1F2937] flex-shrink-0" />
              </button>
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <button
                onClick={() => setShowPhotoSheet(true)}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[#F5F7FA] transition-colors"
                data-testid="button-edit-photo"
              >
                <p className="text-[15px] font-semibold text-[#0D6EFD]">{t("profile.editPhoto")}</p>
                <ChevronRight className="w-[18px] h-[18px] text-[#1F2937] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[#111C3D] mb-4" data-testid="section-verified">{t("profile.verified")}</h2>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#0D6EFD] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-[15px] text-[#1F2937]">{user.email}</p>
                </div>
                <div className="h-px bg-[#E5E7EB]" />
                <div className="flex items-center gap-3 py-3">
                  {phone ? (
                    <div className="w-6 h-6 rounded-full bg-[#0D6EFD] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                  )}
                  <p className={`text-[15px] ${phone ? "text-[#1F2937]" : "text-[#6B7280]"}`}>
                    {phone || t("profile.addPhone")}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[#111C3D] mb-3">{t("profile.reactionLetter")}</h2>
              {letterPreview ? (
                <div>
                  <p className="text-[15px] text-[#1F2937] leading-relaxed line-clamp-4">{letterPreview}...</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[#0D6EFD] active:opacity-70 transition-opacity"
                    data-testid="button-letter-preview"
                  >
                    {t("common.edit")}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[15px] text-[#1F2937] leading-relaxed">{t("profile.noReactionLetterYet")}</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[#0D6EFD] active:opacity-70 transition-opacity"
                    data-testid="button-letter-empty"
                  >
                    {t("profile.writeReactionLetter")}
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[#111C3D] tracking-wide mb-3">{t("profile.support")}</p>
              <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
                <AccountSettingsRow
                  label={t("profile.privacy")}
                  onClick={() => navigate("/datenschutz")}
                />
                <div className="h-px bg-[#E5E7EB] mx-5" />
                <AccountSettingsRow
                  label={t("profile.helpSupport")}
                  onClick={() => {
                    window.location.href = "mailto:support@housalert.de";
                  }}
                />
                <div className="h-px bg-[#E5E7EB] mx-5" />
                <AccountSettingsRow
                  label={t("profile.terms")}
                  onClick={() => navigate("/terms")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <AccountSettingsRow
                label={t("profile.notifications")}
                subtext={t("profile.notificationsDesc")}
                onClick={() => navigate("/settings/notifications")}
              />
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <AccountSettingsRow
                label={t("profile.accountDetails")}
                subtext={t("profile.accountDetailsDesc")}
                onClick={() => navigate("/profile/details")}
              />
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <AccountSettingsRow
                label={t("profile.passwordSecurity")}
                subtext={t("profile.passwordChange")}
                onClick={() => navigate("/account/change-password")}
              />
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <AccountSettingsRow
                label={t("profile.subscription")}
                subtext={subscription.isActive && !subscription.isTrial
                  ? t("profile.subscriptionMonthly")
                  : subscription.isTrial
                  ? t("profile.subscriptionTrial")
                  : t("profile.subscriptionExpired")}
                onClick={() => navigate("/account/subscription")}
                trailing={
                  subscription.isActive && !subscription.isTrial ? (
                    <span
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-white bg-[#0D6EFD]"
                      data-testid="text-subscription-status"
                    >
                      {t("common.active")}
                    </span>
                  ) : subscription.isTrial ? (
                    <span
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-white bg-[#0D6EFD]"
                      data-testid="text-subscription-status"
                    >
                      {t("profile.trial")}
                    </span>
                  ) : undefined
                }
              />
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <button
                onClick={() => setShowLogoutConfirm(true)}
                disabled={signingOut}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[#F5F7FA] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
                data-testid="button-logout"
              >
                <p className="text-[15px] font-[500] text-[#0D6EFD] flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
              </button>
              <div className="h-px bg-[#E5E7EB] mx-5" />
              <button
                onClick={() => navigate("/account/delete")}
                className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[#F5F7FA] transition-colors"
                data-testid="button-delete-account"
              >
                <p className="text-[15px] font-[500] text-[#0D6EFD] flex-1">{t("profile.deleteAccount")}</p>
              </button>
              {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && (
                <>
                  <div className="h-px bg-[#E5E7EB] mx-5" />
                  <button
                    onClick={() => navigate("/admin/match-audit")}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[#F5F7FA] transition-colors"
                    data-testid="button-admin-audit"
                  >
                    <p className="text-[15px] font-[500] text-[#6B7280] flex-1">Match Audit (Admin)</p>
                  </button>
                </>
              )}
            </div>

            {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
              <button
                onClick={() => navigate("/paywall")}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
                data-testid="button-upgrade-subscription"
              >
                <Crown className="w-4 h-4" />
                {t("profile.chooseSubscription")}
              </button>
            )}
          </div>
        )}
      </div>

      {showPhotoSheet && (
        <ProfilePhotoSheet
          photoUrl={photoUrl}
          onClose={() => setShowPhotoSheet(false)}
          onUpload={handlePhotoUpload}
          onRemove={handlePhotoRemove}
        />
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
                <ArrowLeft className="w-4 h-4 text-[#1F2937]" />
              </button>
              <h1 className="text-[17px] font-bold text-[#111C3D] flex-1 tracking-wide">{t("profile.logout")}</h1>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F5F7FA] flex items-center justify-center mb-6">
              <LogOut className="w-8 h-8 text-[#1F2937]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#111C3D] mb-3 text-center" data-testid="text-logout-title">
              {t("profile.logoutConfirm")}
            </h2>
            <p className="text-[15px] text-[#1F2937] text-center max-w-[320px] mb-10 leading-relaxed">
              {t("profile.logoutDesc")}
            </p>
            <div className="w-full max-w-[320px] flex flex-col gap-3">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[16px] font-bold transition-colors hover:opacity-90 disabled:opacity-50"
                data-testid="button-logout-confirm"
              >
                {signingOut ? t("profile.signingOut") : t("profile.logoutYes")}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full h-[52px] rounded-full border border-[#E5E7EB] text-[#1F2937] text-[16px] font-bold hover:bg-[#F5F7FA] transition-colors"
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
  { key: "matches", labelKey: "nav.matches", Icon: Heart },
  { key: "tips", labelKey: "nav.tips", Icon: Zap },
  { key: "filters", labelKey: "nav.filters", Icon: SlidersHorizontal },
  { key: "profiel", labelKey: "nav.profile", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [initialSubTab] = useState<ProfileSubTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("sub");
    return s === "account" ? "account" : "over";
  });
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") || params.get("sub")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-24">
        {activeTab === "home" && (
          <HomeTab
            user={user}
            profiles={profiles}
            matchCount={matchCount}
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
            initialSubTab={initialSubTab}
            matchCount={matchCount}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-xl mx-auto flex h-[56px]">
          {TAB_CONFIG.map(({ key, labelKey, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors text-[#1F2937]"
                data-testid={`tab-${key}`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-[#0D6EFD]" />
                )}
                <Icon className="w-[22px] h-[22px]" />
                <span className={`text-[11px] ${isActive ? "font-semibold" : "font-medium"}`}>
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
