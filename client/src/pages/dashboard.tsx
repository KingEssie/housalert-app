import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, type ApiMatch } from "@/lib/listings";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { dateLocale } from "../../../config/market";
import { useSubscription } from "@/lib/subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ApplySheet } from "@/components/apply-sheet";
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
  Bookmark,
  BookmarkCheck,
  Eye,
  Send,
  ImageIcon,
  Zap,
  Camera,
} from "lucide-react";
import { PopulairVandaagSection } from "@/components/populair-vandaag";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import BoostPage from "@/pages/boost";

const MAX_PROFILES = 4;

function bedroomLabel(min: number) {
  if (min === 0) return "Studio+";
  return `${min}+`;
}

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "zojuist";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
}

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-[var(--yo-teal)]", text: "text-white" },
  nieuw: { bg: "bg-[var(--yo-teal-dark)]", text: "text-white" },
  vandaag: { bg: "bg-[var(--yo-dark)]", text: "text-white" },
  ouder: { bg: "bg-[var(--yo-surface)]", text: "text-[var(--yo-muted)]" },
};

const FRESH_LABEL_TEXT: Record<string, string> = {
  net_binnen: "Net binnen",
  nieuw: "Nieuw",
  vandaag: "Vandaag",
  ouder: "Ouder",
};

type TabKey = "home" | "matches" | "filters" | "boost" | "profiel";
type MatchSubTab = "nieuw" | "bekeken" | "opgeslagen" | "gereageerd";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#2DD4BF] to-[#1A8A7D]",
  münchen: "from-[#2DD4BF] to-[#25BBA8]",
  hamburg: "from-[#1A8A7D] to-[#2DD4BF]",
  frankfurt: "from-[#25BBA8] to-[#1A8A7D]",
  köln: "from-[#2DD4BF] to-[#1A8A7D]",
  düsseldorf: "from-[#1A8A7D] to-[#25BBA8]",
  stuttgart: "from-[#25BBA8] to-[#2DD4BF]",
  default: "from-[#2DD4BF] to-[#1A8A7D]",
};

function getCityGradient(city: string): string {
  const key = city.toLowerCase().trim();
  for (const [name, gradient] of Object.entries(CITY_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return CITY_GRADIENTS.default;
}

const MATCH_VIEWED_KEY = "stekkies_match_viewed";
const MATCH_SAVED_KEY = "stekkies_match_saved";
const MATCH_APPLIED_KEY = "stekkies_match_applied";

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

function getMatchTab(listingId: string): MatchSubTab {
  if (safeGetSet(MATCH_APPLIED_KEY).has(listingId)) return "gereageerd";
  if (safeGetSet(MATCH_SAVED_KEY).has(listingId)) return "opgeslagen";
  if (safeGetSet(MATCH_VIEWED_KEY).has(listingId)) return "bekeken";
  return "nieuw";
}

const MATCH_REASON_CHIPS: Record<string, string> = {
  locatie: "Gewenste wijk",
  prijs: "Binnen budget",
  kamers: "Past bij jouw voorkeuren",
  grootte: "Goede grootte",
  nieuw: "Nieuw geplaatst",
  goede_prijs: "Goede prijs",
};

function displayMatchLabel(score: number, serverLabel: string): string {
  if (score >= 95) return "Perfecte match";
  if (score >= 80) return "Goede match";
  if (score >= 65) return "Interessant";
  return serverLabel;
}

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
      className="bg-white rounded-[16px] border border-[var(--yo-divider)] overflow-hidden cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
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

        <div className="absolute top-3 left-3">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`}>
            {FRESH_LABEL_TEXT[match.fresh_label] ?? match.fresh_label}
          </span>
        </div>

        <button
          onClick={handleSave}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          data-testid={`button-save-match-${match.listing_id}`}
        >
          {isSaved ? (
            <BookmarkCheck className="w-[18px] h-[18px] text-[var(--yo-teal)]" />
          ) : (
            <Bookmark className="w-[18px] h-[18px] text-[var(--yo-muted)]" />
          )}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {match.match_score != null && match.match_label && (
          <div data-testid={`score-badge-${match.listing_id}`}>
            <span className={`inline-flex text-[12px] font-bold px-3 py-1 rounded-full ${
              match.match_score >= 95 ? "bg-[var(--yo-teal)] text-white" :
              match.match_score >= 80 ? "bg-[var(--yo-teal-dark)] text-white" :
              match.match_score >= 65 ? "bg-[var(--yo-dark)] text-white" :
              "bg-[var(--yo-surface)] text-[var(--yo-muted)]"
            }`}>
              {displayMatchLabel(match.match_score, match.match_label)} · {match.match_score}%
            </span>
          </div>
        )}

        <div>
          <div className="flex items-start justify-between gap-3">
            <h3
              className="font-[700] text-[var(--yo-dark)] text-[18px] leading-[1.3] line-clamp-2 flex-1"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
            {match.price > 0 && (
              <span className="text-[17px] font-bold text-[var(--yo-dark)] whitespace-nowrap flex-shrink-0 mt-0.5">
                €{match.price}
                <span className="text-[12px] font-normal text-[var(--yo-muted)]"> /mnd</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-[var(--yo-muted)]">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {match.city}
          </span>
          <span className="text-[var(--yo-divider)]">·</span>
          {match.bedrooms > 0 && (
            <>
              <span className="flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" />
                {match.bedrooms} {match.bedrooms === 1 ? "slaapkamer" : "slaapkamers"}
              </span>
              <span className="text-[var(--yo-divider)]">·</span>
            </>
          )}
          {match.size_m2 > 0 && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              {match.size_m2} m²
            </span>
          )}
        </div>

        {(() => {
          const chips = (match.match_reasons ?? []).slice(0, 3).map((r) => MATCH_REASON_CHIPS[r] ?? r);
          if ((match.fresh_label === "net_binnen" || match.fresh_label === "nieuw") && chips.length < 3 && !chips.includes("Nieuw geplaatst")) {
            chips.push("Nieuw geplaatst");
          }
          return chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" data-testid={`chips-match-reasons-${match.listing_id}`}>
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--yo-teal-light)] text-[var(--yo-teal-dark)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        <div className="flex items-center gap-2 text-[11px] text-[var(--yo-muted)]">
          <span className="capitalize">{match.source}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(match.matched_at || match.first_seen_at)}
          </span>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleApply}
            className="flex-1 h-[56px] rounded-[14px] bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white text-[14px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid={`button-apply-${match.listing_id}`}
          >
            <Zap className="w-4 h-4" />
            Reageer direct
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              markViewed(match.listing_id);
              onStatusChange();
              navigate(`/listing/${match.listing_id}`);
            }}
            className="h-[56px] px-5 rounded-[14px] border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] text-[14px] font-bold hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-1.5"
            data-testid={`button-view-listing-${match.listing_id}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Bekijk
          </button>
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
  return (
    <div
      className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3.5"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[var(--yo-teal)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[var(--yo-dark)] text-[15px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city_name || profile.city}
              </h3>
              <span className="text-[10px] font-medium text-[var(--yo-dark)] bg-[var(--yo-teal)] text-white px-1.5 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                Actief
              </span>
            </div>
            <p className="text-[13px] font-[500] text-[var(--yo-muted)]">
              Aangemaakt {new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--yo-muted)] hover:text-[var(--yo-teal)] hover:bg-[var(--yo-teal-light)] transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {profile.location_mode === "districts" && profile.districts && profile.districts.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-teal-light)] text-[var(--yo-teal)] px-2.5 py-1 rounded-full" data-testid={`badge-districts-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.districts.length === 1 ? profile.districts[0] : `${profile.districts.length} wijken`}
          </span>
        )}
        {profile.location_mode === "radius" && profile.radius_km && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-teal-light)] text-[var(--yo-teal)] px-2.5 py-1 rounded-full" data-testid={`badge-radius-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.radius_km} km radius
          </span>
        )}
        {profile.location_mode === "commute" && profile.commute_destination && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-teal-light)] text-[var(--yo-teal)] px-2.5 py-1 rounded-full" data-testid={`badge-commute-${profile.id}`}>
            <Clock className="w-3 h-3" />
            {profile.commute_minutes ? `${profile.commute_minutes} min` : ""} {profile.commute_mode === "ov" ? "OV" : profile.commute_mode === "fiets" ? "fiets" : "auto"}
          </span>
        )}
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-surface)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf €${profile.price_min}`
              : `Tot €${profile.price_max}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-surface)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-surface)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full h-10 rounded-[14px] border border-[var(--yo-divider)] text-[13px] font-semibold text-[var(--yo-dark)] hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-1.5"
        data-testid={`button-edit-${profile.id}`}
      >
        Bewerken
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BoostTeaserCard({ setActiveTab }: { setActiveTab: (tab: TabKey) => void }) {
  const { session } = useAuth();
  const { data, isLoading } = useQuery<{ boostScore: number; completedCount: number; totalCount: number }>({
    queryKey: ["/api/boost"],
    queryFn: async () => {
      const res = await fetch("/api/boost", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch boost data");
      return res.json();
    },
    enabled: !!session?.access_token,
    select: (d) => ({
      boostScore: d.boostScore,
      completedCount: d.completedCount,
      totalCount: d.totalCount,
    }),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse" data-testid="card-boost-teaser-loading">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-36 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-52 mb-4" />
        <div className="h-9 bg-[var(--yo-surface)] rounded w-32" />
      </div>
    );
  }

  if (!data) return null;

  const { boostScore: rawScore, completedCount, totalCount } = data;
  const boostScore = Math.max(0, Math.min(100, rawScore));
  const remaining = totalCount - completedCount;

  const statusText =
    completedCount === totalCount
      ? "Je profiel is volledig"
      : remaining <= 3
        ? `Nog ${remaining} ${remaining === 1 ? "stap" : "stappen"} om sneller te reageren`
        : `Je profiel is ${boostScore}% compleet`;

  return (
    <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-boost-teaser">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-[var(--yo-teal)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--yo-dark)]">Boost je kansen</p>
          <p className="text-[13px] text-[var(--yo-muted)] mt-0.5">{statusText}</p>

          <div className="mt-3 h-1.5 bg-[var(--yo-divider)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--yo-teal)] rounded-full transition-all duration-500"
              style={{ width: `${boostScore}%` }}
            />
          </div>

          <Button
            variant="link"
            onClick={() => setActiveTab("boost")}
            className="mt-2 p-0 h-auto text-[13px] font-semibold text-[var(--yo-teal)]"
            data-testid="button-boost-teaser"
          >
            Bekijk Boost
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
      </div>
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
}: {
  user: any;
  profiles: SearchProfile[];
  matchCount: number;
  navigate: (path: string) => void;
  setActiveTab: (tab: TabKey) => void;
  subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null };
}) {
  const firstName = user.email?.split("@")[0] ?? "daar";
  const profileCount = profiles.length;
  const hasProfiles = profileCount > 0;
  const hasMatches = matchCount > 0;

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-10 bg-white pt-5 pb-4 px-6">
        <h1 className="text-page-title" data-testid="text-greeting">
          Hallo, {firstName}
        </h1>
      </div>
      <div className="flex flex-col gap-6 px-6">

      {subscription.isExpired && (
        <div className="bg-[var(--yo-teal-light)] rounded-[16px] p-5 flex items-center gap-3" data-testid="banner-expired">
          <div className="w-9 h-9 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-[var(--yo-teal)]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[var(--yo-dark)]">Je proefperiode is afgelopen</p>
            <p className="text-[13px] font-[500] text-[var(--yo-muted)]">Activeer een abonnement om matches te blijven ontvangen.</p>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[var(--yo-teal)] bg-white px-3 py-1.5 rounded-lg hover:bg-[var(--yo-surface)] transition-colors flex-shrink-0"
            data-testid="button-expired-upgrade"
          >
            Kies abonnement
          </button>
        </div>
      )}

      {hasMatches ? (
        <div className="rounded-[16px] bg-[var(--yo-teal-light)] p-6" data-testid="hero-matches">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-[var(--yo-teal)] flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-bold text-[var(--yo-dark)] leading-tight" data-testid="text-match-count">
                {matchCount} {matchCount === 1 ? "match" : "matches"} gevonden
              </p>
              <p className="text-[14px] font-[500] text-[var(--yo-muted)] mt-0.5">
                {hasProfiles
                  ? `Op basis van ${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"}`
                  : "Op basis van je zoekopdracht"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="w-full h-[56px] rounded-[14px] bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid="button-view-matches"
          >
            Bekijk je matches
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title="Nog geen matches gevonden"
          description={hasProfiles
            ? "We hebben nog geen woningen gevonden die goed aansluiten op jouw voorkeuren. Pas je filters aan of kijk later opnieuw."
            : "Maak een zoekprofiel aan en ontvang automatisch matches."}
          ctaLabel={hasProfiles ? "Filters aanpassen" : "Zoekprofiel aanmaken"}
          onCtaClick={() => hasProfiles ? setActiveTab("filters") : navigate("/new-search")}
          testId="hero-empty"
        />
      )}

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="bg-[var(--yo-teal-light)] rounded-[16px] px-5 py-3.5 flex items-center gap-3" data-testid="banner-trial">
          <Crown className="w-4 h-4 text-[var(--yo-teal)] flex-shrink-0" />
          <p className="text-[13px] font-[500] text-[var(--yo-muted)] flex-1">
            Proefperiode tot{" "}
            <span className="font-semibold text-[var(--yo-dark)]">
              {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
            </span>
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[var(--yo-teal)] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            Upgrade
          </button>
        </div>
      )}

      <BoostTeaserCard setActiveTab={setActiveTab} />

      <PopulairVandaagSection />

      {hasMatches && (
        <button
          onClick={() => setActiveTab("filters")}
          className="w-full h-[56px] rounded-[14px] border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] text-[15px] font-bold hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-2"
          data-testid="button-manage-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Beheer filters
        </button>
      )}
      </div>
    </div>
  );
}

const MATCH_SUB_TABS: { key: MatchSubTab; label: string; Icon: any }[] = [
  { key: "nieuw", label: "Nieuw", Icon: Sparkles },
  { key: "bekeken", label: "Bekeken", Icon: Eye },
  { key: "opgeslagen", label: "Opgeslagen", Icon: Bookmark },
  { key: "gereageerd", label: "Gereageerd", Icon: Send },
];

function MatchesTab({ accessToken, setActiveTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void }) {
  const [subTab, setSubTab] = useState<MatchSubTab>("nieuw");
  const [refreshKey, setRefreshKey] = useState(0);
  const [applyMatch, setApplyMatch] = useState<ApiMatch | null>(null);

  const apiMatchesQuery = useQuery<ApiMatch[]>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
  });

  const matches = apiMatchesQuery.data ?? [];

  const refreshStatuses = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSaveToggle = useCallback((listingId: string) => {
    toggleSaved(listingId);
    refreshStatuses();
  }, [refreshStatuses]);

  const handleApplyClick = useCallback((match: ApiMatch) => {
    setApplyMatch(match);
  }, []);

  const handleSheetApplied = useCallback(() => {
    if (applyMatch) {
      markApplied(applyMatch.listing_id);
      refreshStatuses();
      setApplyMatch(null);
    }
  }, [applyMatch, refreshStatuses]);

  const matchTabs = matches.map((m) => ({ ...m, _tab: getMatchTab(m.listing_id) }));
  const filteredMatches = matchTabs.filter((m) => m._tab === subTab);

  const tabCounts = matchTabs.reduce((acc, m) => {
    acc[m._tab] = (acc[m._tab] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-5 px-6 pt-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title">Matches</h1>
        {matches.length > 0 && (
          <span className="text-[13px] font-medium text-[var(--yo-teal)] bg-[var(--yo-teal-light)] px-2.5 py-1 rounded-full" data-testid="badge-match-count">
            {matches.length} totaal
          </span>
        )}
      </div>

      <div className="flex gap-2 bg-[var(--yo-surface)] p-1.5 rounded-full" data-testid="match-sub-tabs">
        {MATCH_SUB_TABS.map(({ key, label, Icon }) => {
          const count = tabCounts[key] || 0;
          const isActive = subTab === key;
          return (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white text-[var(--yo-dark)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  : "text-[var(--yo-muted)] hover:text-[var(--yo-dark)] hover:bg-white/50"
              }`}
              data-testid={`tab-matches-${key}`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full ${
                  isActive ? "bg-[var(--yo-teal)] text-white" : "bg-[var(--yo-divider)] text-[var(--yo-muted)]"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {apiMatchesQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[16px] border border-[var(--yo-divider)] overflow-hidden animate-pulse">
              <div className="h-[200px] bg-[var(--yo-surface)]" />
              <div className="p-4 flex flex-col gap-2.5">
                <div className="h-6 bg-[var(--yo-surface)] rounded-full w-28" />
                <div className="h-5 bg-[var(--yo-surface)] rounded w-3/4" />
                <div className="h-4 bg-[var(--yo-surface)] rounded w-1/2" />
                <div className="flex gap-1.5">
                  <div className="h-6 bg-[var(--yo-surface)] rounded-full w-24" />
                  <div className="h-6 bg-[var(--yo-surface)] rounded-full w-28" />
                </div>
                <div className="flex gap-2 mt-1">
                  <div className="h-[44px] bg-[var(--yo-surface)] rounded-[14px] flex-1" />
                  <div className="h-[44px] bg-[var(--yo-surface)] rounded-[14px] w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-[16px] shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[var(--yo-teal)]" />
          </div>
          <p className="text-[18px] font-[700] text-[var(--yo-dark)]">Kon matches niet laden</p>
          <p className="text-[13px] text-[var(--yo-muted)]">Controleer je verbinding en probeer het opnieuw.</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-semibold text-[var(--yo-teal)]"
            data-testid="button-retry-matches"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title="Nog geen matches gevonden"
          description="We hebben nog geen woningen gevonden die goed aansluiten op jouw voorkeuren. Pas je filters aan of kijk later opnieuw."
          ctaLabel="Filters aanpassen"
          onCtaClick={() => setActiveTab("filters")}
          testId="empty-matches"
        />
      
      ) : filteredMatches.length === 0 ? (
        subTab === "opgeslagen" ? (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noSaved}
            title="Je hebt nog geen woningen opgeslagen"
            description="Sla woningen op die je interessant vindt zodat je ze later makkelijk kunt terugvinden."
            ctaLabel="Woningen ontdekken"
            onCtaClick={() => setSubTab("nieuw")}
            testId="empty-saved"
          />
        ) : subTab === "gereageerd" ? (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noApplications}
            title="Je hebt nog niet gereageerd"
            description="Reageer op woningen die je interessant vindt om je kansen te vergroten."
            ctaLabel="Woningen ontdekken"
            onCtaClick={() => setSubTab("nieuw")}
            testId="empty-applications"
          />
        ) : (
          <EmptyState
            illustration={EMPTY_STATE_IMAGES.noFilters}
            title="Geen woningen gevonden"
            description="We konden geen woningen vinden die bij je huidige filters passen. Pas je filters aan en probeer opnieuw."
            ctaLabel="Filters aanpassen"
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
              isSaved={safeGetSet(MATCH_SAVED_KEY).has(m.listing_id)}
              onStatusChange={refreshStatuses}
            />
          ))}
        </div>
      )}

      {applyMatch && (
        <ApplySheet
          listing={{
            id: applyMatch.listing_id,
            title: applyMatch.title,
            city: applyMatch.city,
            price: applyMatch.price,
            url: applyMatch.url,
          }}
          open={!!applyMatch}
          onClose={() => setApplyMatch(null)}
          onMarkedApplied={handleSheetApplied}
        />
      )}
    </div>
  );
}

function FiltersTab({ navigate }: { navigate: (path: string) => void }) {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSearchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      toast({ title: "Zoekopdracht verwijderd" });
    },
    onError: (err: any) => {
      toast({
        title: "Verwijderen mislukt",
        description: err?.message ?? "Probeer het opnieuw.",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Zoekprofielen</h1>
          <p className="text-subtitle mt-1">
            {profileCount > 0
              ? `${profileCount} van ${MAX_PROFILES} actief \u00B7 nieuwe matches verschijnen automatisch`
              : "Maak een zoekprofiel aan en ontvang automatisch matches"}
          </p>
        </div>
        {!atLimit && (
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-9 h-9 rounded-full bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] flex items-center justify-center text-white transition-colors"
            data-testid="button-add-search"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 animate-pulse">
              <div className="h-4 bg-[var(--yo-surface)] rounded w-1/3 mb-3" />
              <div className="flex gap-2">
                <div className="h-6 bg-[var(--yo-surface)] rounded-full w-24" />
                <div className="h-6 bg-[var(--yo-surface)] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title="Nog geen matches gevonden"
          description="Voeg een zoekopdracht toe om automatisch woningen te ontvangen die bij jouw voorkeuren passen."
          ctaLabel="Zoekprofiel aanmaken"
          onCtaClick={() => navigate("/new-search")}
          testId="empty-profiles"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onDelete={() => {
                setDeletingId(p.id);
                deleteMutation.mutate(p.id);
              }}
              deleting={deletingId === p.id}
              onEdit={() => navigate("/dashboard/searches/new")}
            />
          ))}
          {!atLimit && (
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex items-center justify-center gap-2 text-[14px] font-semibold text-[var(--yo-teal)] hover:bg-[var(--yo-surface)] transition-colors border-2 border-dashed border-[var(--yo-divider)]"
              data-testid="button-add-search-card"
            >
              <Plus className="w-4 h-4" />
              Zoekopdracht toevoegen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type ProfileSubTab = "over" | "account";

function ProfilePhotoSheet({ photoUrl, onClose, onUpload, onRemove }: { photoUrl: string | null; onClose: () => void; onUpload: (file: File) => void; onRemove: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[24px] pb-8 pt-2 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--yo-divider)] rounded-full mx-auto mb-6" />
        <div className="px-5">
          <h3 className="text-[18px] font-bold text-[var(--yo-dark)] uppercase tracking-wide mb-5">Profielfoto</h3>

          {photoUrl && (
            <div className="flex justify-center mb-5">
              <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" data-testid="img-current-photo" />
            </div>
          )}

          <div className="flex flex-col">
            <label className="w-full h-[56px] flex items-center justify-center gap-2 rounded-[14px] bg-[var(--yo-teal)] text-white text-[15px] font-bold cursor-pointer active:bg-[var(--yo-teal-hover)] transition-colors">
              <Camera className="w-[18px] h-[18px]" />
              {photoUrl ? "Nieuwe foto kiezen" : "Foto uploaden"}
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
                className="mt-3 w-full h-[56px] flex items-center justify-center gap-2 rounded-[14px] border border-[var(--yo-divider)] text-[var(--yo-teal)] text-[15px] font-bold active:bg-[var(--yo-teal-light)] transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                Foto verwijderen
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[56px] flex items-center justify-center rounded-[14px] text-[var(--yo-muted)] text-[15px] font-bold active:bg-[var(--yo-surface)] transition-colors"
              data-testid="button-cancel-photo"
            >
              Annuleren
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
      className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[var(--yo-surface)] transition-colors"
      data-testid={`row-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-[500] text-[var(--yo-dark)]">{label}</p>
        {subtext && <p className="text-[13px] text-[var(--yo-muted)] mt-0.5">{subtext}</p>}
      </div>
      {trailing || <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-muted)] flex-shrink-0" />}
    </button>
  );
}

function ProfielTab({ user, signOut, navigate, subscription, setActiveTab }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null }; setActiveTab: (tab: TabKey) => void }) {
  const [signingOut, setSigningOut] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("over");
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const { toast } = useToast();

  const profileDataQuery = useQuery({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const notifQuery = useQuery({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch("/api/notifications/settings", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const statsQuery = useQuery({
    queryKey: ["/api/profile-stats"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { matches_received: 0, reactions_sent: 0 };
      const res = await fetch("/api/profile-stats", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const pd = profileDataQuery.data;
  const phone = notifQuery.data?.phone_e164;
  const stats = statsQuery.data ?? { matches_received: 0, reactions_sent: 0 };
  const photoUrl = pd?.profile_photo_url || null;

  const displayName = [pd?.first_name, pd?.last_name].filter(Boolean).join(" ") || user.user_metadata?.full_name || user.email?.split("@")[0] || "";
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
      if (!session?.access_token) throw new Error("Niet ingelogd");

      const res = await fetch("/api/profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload mislukt");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      toast({ title: "Foto opgeslagen" });
      setShowPhotoSheet(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoRemove() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/profile-photo", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Verwijderen mislukt");

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      toast({ title: "Foto verwijderd" });
      setShowPhotoSheet(false);
    } catch (err: any) {
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    }
  }

  const PROFILE_SUBTABS: { key: ProfileSubTab; label: string }[] = [
    { key: "over", label: "Over jou" },
    { key: "account", label: "Account" },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[var(--yo-surface)]">
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
        <div className="max-w-[480px] mx-auto flex relative">
          {PROFILE_SUBTABS.map(t => (
            <button
              key={t.key}
              onClick={() => setProfileSubTab(t.key)}
              className={`flex-1 text-center py-3.5 text-[15px] font-semibold transition-colors ${
                profileSubTab === t.key ? "text-[var(--yo-teal)]" : "text-[var(--yo-muted)]"
              }`}
              data-testid={`tab-profile-${t.key}`}
            >
              {t.label}
            </button>
          ))}
          <div
            className="absolute bottom-0 h-[3px] bg-[var(--yo-teal)] rounded-full transition-transform duration-300 ease-in-out"
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
            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <button
                onClick={() => navigate("/profile/details")}
                className="flex items-center gap-4 active:opacity-80 transition-opacity text-left w-full"
                data-testid="button-profile-header"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" data-testid="img-profile-avatar" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[22px] font-bold text-[var(--yo-teal)]">{initials}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[22px] font-[700] text-[var(--yo-dark)] truncate leading-tight" data-testid="text-user-name">{displayName}</p>
                  <p className="text-[14px] text-[var(--yo-muted)] mt-0.5">Woningzoeker</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--yo-muted)] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex">
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-matches">
                  <div className="w-10 h-10 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
                    <Heart className="w-[18px] h-[18px] text-[var(--yo-teal)]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[var(--yo-dark)] leading-none">{stats.matches_received}</p>
                    <p className="text-[12px] text-[var(--yo-muted)] mt-1 leading-tight">Ontvangen matches</p>
                  </div>
                </div>
                <div className="w-px bg-[var(--yo-divider)] my-3" />
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-reactions">
                  <div className="w-10 h-10 rounded-full bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
                    <Send className="w-[18px] h-[18px] text-[var(--yo-teal)]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[var(--yo-dark)] leading-none">{stats.reactions_sent}</p>
                    <p className="text-[12px] text-[var(--yo-muted)] mt-1 leading-tight">Verstuurde reacties</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <button
                onClick={() => navigate("/profile/details")}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-edit-details"
              >
                <p className="text-[15px] font-semibold text-[var(--yo-teal)]">Persoonlijke gegevens bewerken</p>
                <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-muted)] flex-shrink-0" />
              </button>
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <button
                onClick={() => setShowPhotoSheet(true)}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-edit-photo"
              >
                <p className="text-[15px] font-semibold text-[var(--yo-teal)]">Profielfoto bewerken</p>
                <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-muted)] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[var(--yo-dark)] mb-4" data-testid="section-verified">Je hebt een Geverifieerd Profiel</h2>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                  </div>
                  <p className="text-[15px] text-[var(--yo-dark)]">{user.email}</p>
                </div>
                <div className="h-px bg-[var(--yo-divider)]" />
                <div className="flex items-center gap-3 py-3">
                  {phone ? (
                    <div className="w-6 h-6 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                    </div>
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[var(--yo-muted)] flex-shrink-0" />
                  )}
                  <p className={`text-[15px] ${phone ? "text-[var(--yo-dark)]" : "text-[var(--yo-muted)]"}`}>
                    {phone || "Telefoonnummer toevoegen"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[var(--yo-dark)] mb-3">Reactiebrief</h2>
              {letterPreview ? (
                <div>
                  <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed line-clamp-4">{letterPreview}...</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[var(--yo-teal)] active:opacity-70 transition-opacity"
                    data-testid="button-letter-preview"
                  >
                    Bewerken
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[15px] text-[var(--yo-muted)] leading-relaxed">Je hebt nog geen reactiebrief geschreven.</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[var(--yo-teal)] active:opacity-70 transition-opacity"
                    data-testid="button-letter-empty"
                  >
                    Schrijf je brief
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--yo-muted)] uppercase tracking-wide mb-3">Ondersteuning</p>
              <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
                <AccountSettingsRow
                  label="Privacy"
                  onClick={() => navigate("/datenschutz")}
                />
                <div className="h-px bg-[var(--yo-divider)] mx-5" />
                <AccountSettingsRow
                  label="Hulp & support"
                  onClick={() => {
                    window.location.href = "mailto:support@stekkies.nl";
                  }}
                />
                <div className="h-px bg-[var(--yo-divider)] mx-5" />
                <AccountSettingsRow
                  label="Algemene voorwaarden"
                  onClick={() => navigate("/terms")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <AccountSettingsRow
                label="Meldingsinstellingen"
                subtext="E-mail, push, WhatsApp"
                onClick={() => navigate("/settings/notifications")}
              />
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <AccountSettingsRow
                label="Accountgegevens"
                subtext="E-mail en telefoonnummer"
                onClick={() => navigate("/profile/details")}
              />
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <AccountSettingsRow
                label="Wachtwoord en beveiliging"
                subtext="Wachtwoord wijzigen"
                onClick={() => navigate("/account/change-password")}
              />
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <AccountSettingsRow
                label="Abonnement"
                subtext={subscription.isActive && !subscription.isTrial
                  ? "Maandelijks • Actief"
                  : subscription.isTrial
                  ? "Proefperiode"
                  : "Verlopen"}
                onClick={() => navigate("/account/subscription")}
                trailing={
                  subscription.isActive && !subscription.isTrial ? (
                    <span
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-white bg-[var(--yo-success)]"
                      data-testid="text-subscription-status"
                    >
                      Actief
                    </span>
                  ) : subscription.isTrial ? (
                    <span
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-white bg-[var(--yo-teal)]"
                      data-testid="text-subscription-status"
                    >
                      Proef
                    </span>
                  ) : null
                }
              />
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[var(--yo-surface)] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
                data-testid="button-logout"
              >
                <p className="text-[15px] font-[500] text-[var(--yo-teal)] flex-1">{signingOut ? "Uitloggen..." : "Uitloggen"}</p>
              </button>
            </div>

            {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
              <button
                onClick={() => navigate("/paywall")}
                className="w-full h-[56px] rounded-[14px] bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
                data-testid="button-upgrade-subscription"
              >
                <Crown className="w-4 h-4" />
                Kies een abonnement
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
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; label: string; Icon: any }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "matches", label: "Matches", Icon: Heart },
  { key: "boost", label: "Boost", Icon: Zap },
  { key: "filters", label: "Filters", Icon: SlidersHorizontal },
  { key: "profiel", label: "Profiel", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["home", "matches", "boost", "filters", "profiel"].includes(tab)) {
      return tab as TabKey;
    }
    return "home";
  });
  const sub = useSubscription();

  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      toast({ title: "Betaling gelukt!", description: "Je abonnement is nu actief." });
      window.history.replaceState({}, "", "/dashboard");
      sub.refetch?.();
    }
  }, []);

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const accessToken = session?.access_token;
  const apiMatchesQuery = useQuery<ApiMatch[]>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!user && !!accessToken,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--yo-teal)] animate-pulse" />
          <p className="text-[var(--yo-muted)] text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-20">
        {activeTab === "home" && (
          <HomeTab
            user={user}
            profiles={profiles}
            matchCount={matchCount}
            navigate={navigate}
            setActiveTab={setActiveTab}
            subscription={{ isTrial: sub.isTrial, isExpired: sub.isExpired, isActive: sub.isActive, trialEndsAt: sub.trialEndsAt }}
          />
        )}
        {activeTab === "matches" && (
          <SubscriptionGate isActive={sub.isActive}>
            <MatchesTab accessToken={accessToken} setActiveTab={setActiveTab} />
          </SubscriptionGate>
        )}
        {activeTab === "boost" && <BoostPage navigate={navigate} />}
        {activeTab === "filters" && <FiltersTab navigate={navigate} />}
        {activeTab === "profiel" && (
          <ProfielTab
            user={user}
            signOut={signOut}
            navigate={navigate}
            subscription={{ status: sub.status, isTrial: sub.isTrial, isActive: sub.isActive, isExpired: sub.isExpired, plan: sub.plan, trialEndsAt: sub.trialEndsAt }}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[var(--yo-divider)] safe-area-bottom">
        <div className="max-w-xl mx-auto flex">
          {TAB_CONFIG.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-2 relative transition-colors ${
                  isActive ? "text-[var(--yo-teal)]" : "text-[var(--yo-muted)]"
                }`}
                data-testid={`tab-${key}`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-[var(--yo-teal)]" />
                )}
                <Icon className="w-[22px] h-[22px]" />
                <span className={`text-[11px] mt-0.5 ${isActive ? "font-semibold" : "font-medium"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
