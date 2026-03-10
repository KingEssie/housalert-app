import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, type ApiMatch, type ApiMatchesResponse } from "@/lib/listings";
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
  net_binnen: { bg: "bg-[var(--yo-chip-bg)]", text: "text-[var(--yo-dark)]" },
  nieuw: { bg: "bg-[var(--yo-dark)]", text: "text-white" },
  vandaag: { bg: "bg-[var(--yo-dark)]", text: "text-white" },
  ouder: { bg: "bg-[var(--yo-surface)]", text: "text-[var(--yo-dark)]" },
};

const FRESH_LABEL_TEXT: Record<string, string> = {
  net_binnen: "Net binnen",
  nieuw: "Nieuw",
  vandaag: "Vandaag",
  ouder: "Ouder",
};

type TabKey = "home" | "matches" | "filters" | "tips" | "profiel";
type MatchSubTab = "nieuw" | "bekeken" | "opgeslagen" | "gereageerd";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#1A1A1A] to-[#333333]",
  münchen: "from-[#1A1A1A] to-[#333333]",
  hamburg: "from-[#333333] to-[#1A1A1A]",
  frankfurt: "from-[#1A1A1A] to-[#333333]",
  köln: "from-[#333333] to-[#1A1A1A]",
  düsseldorf: "from-[#1A1A1A] to-[#333333]",
  stuttgart: "from-[#333333] to-[#1A1A1A]",
  default: "from-[#1A1A1A] to-[#333333]",
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
  if (score >= 90) return "Perfecte match";
  if (score >= 75) return "Goede match";
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
      className="bg-white rounded-lg border border-[var(--yo-divider)] overflow-hidden cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
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
            <BookmarkCheck className="w-[18px] h-[18px] text-[var(--yo-dark)]" />
          ) : (
            <Bookmark className="w-[18px] h-[18px] text-[var(--yo-dark)]" />
          )}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {match.match_score != null && match.match_label && (
          <div data-testid={`score-badge-${match.listing_id}`}>
            <span className={`inline-flex text-[12px] font-bold px-3 py-1 rounded-full ${
              match.match_score >= 90 ? "bg-[var(--yo-pink)] text-[var(--yo-dark)]" :
              match.match_score >= 75 ? "bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]" :
              "bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]"
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
                <span className="text-[12px] font-normal text-[var(--yo-dark)]"> /mnd</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-[var(--yo-dark)]">
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
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        <div className="flex items-center gap-2 text-[11px] text-[var(--yo-dark)]">
          <span className="capitalize font-bold" style={{ color: "var(--yo-pink)" }}>{match.source}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(match.matched_at || match.first_seen_at)}
          </span>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleApply}
            className="flex-1 h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[14px] font-bold transition-colors flex items-center justify-center gap-2"
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
            className="h-[56px] px-5 rounded-lg border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] text-[14px] font-bold hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-1.5"
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
      className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3.5"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[var(--yo-dark)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[var(--yo-dark)] text-[15px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city_name || profile.city}
              </h3>
              <span className="text-[10px] font-medium text-white bg-[#ff2f7d] px-1.5 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                Actief
              </span>
            </div>
            <p className="text-[13px] font-[500] text-[var(--yo-dark)]">
              Aangemaakt {new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--yo-dark)] hover:text-[var(--yo-dark)] hover:bg-[var(--yo-chip-bg)] transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {profile.location_mode === "districts" && profile.districts && profile.districts.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]" data-testid={`badge-districts-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.districts.length === 1 ? profile.districts[0] : `${profile.districts.length} wijken`}
          </span>
        )}
        {profile.location_mode === "radius" && profile.radius_km && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]" data-testid={`badge-radius-${profile.id}`}>
            <MapPin className="w-3 h-3" />
            {profile.radius_km} km radius
          </span>
        )}
        {profile.location_mode === "commute" && profile.commute_destination && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]" data-testid={`badge-commute-${profile.id}`}>
            <Clock className="w-3 h-3" />
            {profile.commute_minutes ? `${profile.commute_minutes} min` : ""} {profile.commute_mode === "ov" ? "OV" : profile.commute_mode === "fiets" ? "fiets" : "auto"}
          </span>
        )}
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf €${profile.price_min}`
              : `Tot €${profile.price_max}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[var(--yo-chip-bg)] text-[var(--yo-dark)] px-2.5 py-1 rounded-full border border-[var(--yo-divider)]">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full h-10 rounded-lg border border-[var(--yo-divider)] text-[13px] font-semibold text-[var(--yo-dark)] hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-1.5"
        data-testid={`button-edit-${profile.id}`}
      >
        Bewerken
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RecenteMatchesSection({ accessToken, setActiveTab, subscription, navigate }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void; subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null }; navigate: (path: string) => void }) {
  const hasActiveSub = subscription.isActive || subscription.isTrial;

  const { data: matches, isLoading } = useQuery<ApiMatch[]>({
    queryKey: ["/api/matches", "recent-5"],
    queryFn: async () => {
      const res = await fetch("/api/matches", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch matches");
      const body = await res.json();
      const all: ApiMatch[] = Array.isArray(body) ? body : body.matches ?? [];
      const valid = all.filter(m => m.title && m.url && m.listing_id);
      return valid.slice(0, 5);
    },
    enabled: !!accessToken && hasActiveSub,
  });

  if (!hasActiveSub) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[var(--yo-dark)]" />
          <h2 className="text-section-title">Recente matches</h2>
        </div>
        <div className="bg-[var(--yo-surface)] rounded-lg p-5 text-center">
          <p className="text-[14px] text-[var(--yo-dark)] mb-3">
            Matches worden zichtbaar zodra je een abonnement activeert.
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="h-[44px] px-6 rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[14px] font-semibold transition-colors"
            data-testid="button-activate-sub-matches"
          >
            Bekijk abonnementen
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-section-title">Recente matches</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-[var(--yo-surface)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="section-recente-matches-empty">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[var(--yo-dark)]" />
          <h2 className="text-section-title">Recente matches</h2>
        </div>
        <div className="bg-[var(--yo-surface)] rounded-lg p-5 text-center">
          <p className="text-[14px] text-[var(--yo-dark)]">
            Zodra je eerste matches binnenkomen, zie je ze hier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="section-recente-matches">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-[var(--yo-dark)]" />
          <h2 className="text-section-title">Recente matches</h2>
        </div>
        <button
          onClick={() => setActiveTab("matches")}
          className="text-[13px] font-semibold text-[var(--yo-pink)]"
          data-testid="button-view-all-matches"
        >
          Bekijk alles
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
      className="bg-white rounded-lg border border-[var(--yo-divider)] overflow-hidden cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 active:scale-[0.985] flex"
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
        <h3 className="text-[14px] font-[700] text-[var(--yo-dark)] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </h3>
        <div className="flex items-center gap-2 text-[12px] text-[var(--yo-dark)]">
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
          <span className="text-[15px] font-bold text-[var(--yo-dark)]">€{match.price}</span>
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

  const handleAccountTaskClick = (taskId: string) => {
    setActiveTaskModal(taskId);
  };

  const handlePrepTaskClick = (taskId: string) => {
    setActivePrepModal(taskId);
  };

  const profileDataQuery = useQuery<{ first_name?: string }>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return {};
      const res = await fetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
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
      const res = await fetch(`/api/estimate?${params}`);
      if (!res.ok) throw new Error("estimate failed");
      return res.json();
    },
    enabled: hasProfiles,
    staleTime: 5 * 60 * 1000,
  });
  const perWeekEstimate = estimateQuery.data?.perWeekEstimate ?? 0;

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-10 bg-white pt-5 pb-4 px-6">
        <h1 className="text-page-title" data-testid="text-greeting">
          {firstName ? `Hallo, ${firstName}` : "Hallo"}
        </h1>
      </div>
      <div className="flex flex-col gap-8 px-6">

      {hasActiveSub && hasMatches ? (
        <div className="rounded-xl bg-[#0F172A] p-6" data-testid="hero-matches">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-bold text-white leading-tight" data-testid="text-match-count">
                Je hebt {matchCount > 999 ? "999+" : matchCount} nieuwe {matchCount === 1 ? "match" : "matches"} ontvangen
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                {hasProfiles
                  ? `Op basis van ${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"}`
                  : "Op basis van je zoekopdracht"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] hover:opacity-90 text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid="button-view-matches"
          >
            Bekijk je matches
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : hasActiveSub && hasProfiles ? (
        <div className="rounded-xl bg-[#0F172A] p-6" data-testid="hero-active-no-matches">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white leading-tight" data-testid="text-active-searching">
                We zoeken actief naar woningen voor je
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                Je ontvangt matches op basis van {profileCount} {profileCount === 1 ? "zoekprofiel" : "zoekprofielen"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("filters")}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] hover:opacity-90 text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid="button-adjust-filters"
          >
            Filters aanpassen
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : hasProfiles ? (
        <div className="rounded-xl bg-[#0F172A] p-6" data-testid="hero-estimate">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white leading-tight" data-testid="text-estimate-count">
                {perWeekEstimate > 0
                  ? `Met jouw zoekopdrachten verwachten we ongeveer ${perWeekEstimate} nieuwe woningen per week`
                  : "Je zoekprofiel is klaar"}
              </p>
              <p className="text-[14px] font-[500] text-white/70 mt-0.5">
                {perWeekEstimate > 0
                  ? `Op basis van ${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"}`
                  : "Activeer je abonnement om matches te ontvangen"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] hover:opacity-90 text-white text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
            data-testid="button-activate-sub"
          >
            Abonnement activeren
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <EmptyState
          illustration={EMPTY_STATE_IMAGES.noMatches}
          title="Nog geen zoekprofiel"
          description="Maak een zoekprofiel aan en ontvang automatisch matches."
          ctaLabel="Zoekprofiel aanmaken"
          onCtaClick={() => navigate("/dashboard/searches/new")}
          testId="hero-empty"
        />
      )}

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="bg-[var(--yo-chip-bg)] rounded-lg px-5 py-3.5 flex items-center gap-3" data-testid="banner-trial">
          <Crown className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
          <p className="text-[13px] font-[500] text-[var(--yo-dark)] flex-1">
            Proefperiode tot{" "}
            <span className="font-semibold text-[var(--yo-dark)]">
              {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
            </span>
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[var(--yo-pink)] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            Upgrade
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
          className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] text-[15px] font-bold hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-2"
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

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/matches/applied", {
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
    refreshStatuses();
  }, [refreshStatuses]);

  const handleApplyClick = useCallback((match: ApiMatch) => {
    setApplyMatch(match);
  }, []);

  const handleSheetApplied = useCallback(() => {
    if (applyMatch) {
      markApplied(applyMatch.listing_id);
      if (accessToken) {
        fetch(`/api/matches/${applyMatch.listing_id}/applied`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ applied: true }),
        }).catch(() => {});
      }
      refreshStatuses();
      setApplyMatch(null);
    }
  }, [applyMatch, refreshStatuses, accessToken]);

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
        {totalCount > 0 && (
          <span className="text-[13px] font-medium text-[var(--yo-dark)] bg-[var(--yo-chip-bg)] px-2.5 py-1 rounded-full" data-testid="badge-match-count">
            {totalCount > 999 ? "999+" : totalCount} {totalCount === 1 ? "woning" : "woningen"}
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
                  : "text-[var(--yo-dark)] hover:text-[var(--yo-dark)] hover:bg-white/50"
              }`}
              data-testid={`tab-matches-${key}`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full ${
                  isActive ? "bg-[var(--yo-dark)] text-white" : "bg-[var(--yo-divider)] text-[var(--yo-dark)]"
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
            <div key={i} className="bg-white rounded-lg border border-[var(--yo-divider)] overflow-hidden animate-pulse">
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
                  <div className="h-[44px] bg-[var(--yo-surface)] rounded-lg flex-1" />
                  <div className="h-[44px] bg-[var(--yo-surface)] rounded-lg w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-[var(--yo-dark)]" />
          </div>
          <p className="text-[18px] font-[700] text-[var(--yo-dark)]">Kon matches niet laden</p>
          <p className="text-[13px] text-[var(--yo-dark)]">Controleer je verbinding en probeer het opnieuw.</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-semibold text-[var(--yo-pink)]"
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

function DeleteConfirmScreen({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-delete-back"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
          <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">Verwijder zoekopdracht</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--yo-pink-light)] flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-[var(--yo-pink)]" />
        </div>
        <h2 className="text-[22px] font-bold text-[var(--yo-dark)] mb-3 text-center" data-testid="text-delete-title">
          Zoekopdracht verwijderen?
        </h2>
        <p className="text-[15px] text-[var(--yo-dark)] text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
          Weet je zeker dat je je zoekopdracht wilt verwijderen? Je kunt altijd een nieuwe toevoegen.
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] text-white text-[16px] font-bold transition-colors hover:opacity-90"
            data-testid="button-delete-confirm"
          >
            Ja, verwijderen
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] text-[var(--yo-dark)] text-[16px] font-bold hover:bg-[var(--yo-surface)] transition-colors"
            data-testid="button-delete-cancel"
          >
            Nee, behouden
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
            className="w-9 h-9 rounded-full bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] flex items-center justify-center text-black transition-colors"
            data-testid="button-add-search"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 animate-pulse">
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
          {!atLimit && (
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex items-center justify-center gap-2 text-[14px] font-semibold text-[var(--yo-dark)] hover:bg-[var(--yo-surface)] transition-colors border-2 border-dashed border-[var(--yo-divider)]"
              data-testid="button-add-search-card"
            >
              <Plus className="w-4 h-4" />
              Zoekopdracht toevoegen
            </button>
          )}
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-lg pb-8 pt-2 animate-in slide-in-from-bottom duration-300"
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
            <label className="w-full h-[56px] flex items-center justify-center gap-2 rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold cursor-pointer active:bg-[var(--yo-teal-hover)] transition-colors">
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
                className="mt-3 w-full h-[56px] flex items-center justify-center gap-2 rounded-lg border border-[var(--yo-divider)] text-[var(--yo-dark)] text-[15px] font-bold active:bg-[var(--yo-chip-bg)] transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                Foto verwijderen
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[56px] flex items-center justify-center rounded-lg text-[var(--yo-dark)] text-[15px] font-bold active:bg-[var(--yo-surface)] transition-colors"
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
        {subtext && <p className="text-[13px] text-[var(--yo-dark)] mt-0.5">{subtext}</p>}
      </div>
      {trailing || <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-dark)] flex-shrink-0" />}
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
                profileSubTab === t.key ? "text-[var(--yo-dark)]" : "text-[var(--yo-muted)]"
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
            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <button
                onClick={() => navigate("/profile/details")}
                className="flex items-center gap-4 active:opacity-80 transition-opacity text-left w-full"
                data-testid="button-profile-header"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" data-testid="img-profile-avatar" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[22px] font-bold text-[var(--yo-dark)]">{initials}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[22px] font-[700] text-[var(--yo-dark)] truncate leading-tight" data-testid="text-user-name">{displayName || "Woningzoeker"}</p>
                  <p className="text-[14px] text-[var(--yo-dark)] mt-0.5">Woningzoeker</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--yo-dark)] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              {(subscription.isActive || subscription.isTrial) ? (
              <div className="flex">
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-matches">
                  <div className="w-10 h-10 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
                    <Heart className="w-[18px] h-[18px] text-[var(--yo-dark)]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[var(--yo-dark)] leading-none">{matchCount > 999 ? "999+" : matchCount}</p>
                    <p className="text-[12px] text-[var(--yo-dark)] mt-1 leading-tight">Ontvangen matches</p>
                  </div>
                </div>
                <div className="w-px bg-[var(--yo-divider)] my-3" />
                <div className="flex-1 flex items-center gap-3 p-4" data-testid="kpi-reactions">
                  <div className="w-10 h-10 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
                    <Send className="w-[18px] h-[18px] text-[var(--yo-dark)]" />
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-[var(--yo-dark)] leading-none">{stats.reactions_sent}</p>
                    <p className="text-[12px] text-[var(--yo-dark)] mt-1 leading-tight">Verstuurde reacties</p>
                  </div>
                </div>
              </div>
              ) : (
              <div className="p-4 text-center" data-testid="kpi-no-sub">
                <p className="text-[14px] text-[var(--yo-dark)]">
                  Activeer een abonnement om je matchstatistieken te zien.
                </p>
              </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <button
                onClick={() => navigate("/profile/details")}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-edit-details"
              >
                <p className="text-[15px] font-semibold text-[var(--yo-pink)]">Persoonlijke gegevens bewerken</p>
                <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-dark)] flex-shrink-0" />
              </button>
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <button
                onClick={() => setShowPhotoSheet(true)}
                className="w-full h-[56px] flex items-center justify-between px-5 text-left active:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-edit-photo"
              >
                <p className="text-[15px] font-semibold text-[var(--yo-pink)]">Profielfoto bewerken</p>
                <ChevronRight className="w-[18px] h-[18px] text-[var(--yo-dark)] flex-shrink-0" />
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[var(--yo-dark)] mb-4" data-testid="section-verified">Je hebt een Geverifieerd Profiel</h2>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#3ED6C6] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-black" />
                  </div>
                  <p className="text-[15px] text-[var(--yo-dark)]">{user.email}</p>
                </div>
                <div className="h-px bg-[var(--yo-divider)]" />
                <div className="flex items-center gap-3 py-3">
                  {phone ? (
                    <div className="w-6 h-6 rounded-full bg-[#3ED6C6] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-black" />
                    </div>
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[var(--yo-dark)] flex-shrink-0" />
                  )}
                  <p className={`text-[15px] ${phone ? "text-[var(--yo-dark)]" : "text-[var(--yo-muted)]"}`}>
                    {phone || "Telefoonnummer toevoegen"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5">
              <h2 className="text-[20px] font-bold text-[var(--yo-dark)] mb-3">Reactiebrief</h2>
              {letterPreview ? (
                <div>
                  <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed line-clamp-4">{letterPreview}...</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[var(--yo-pink)] active:opacity-70 transition-opacity"
                    data-testid="button-letter-preview"
                  >
                    Bewerken
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">Je hebt nog geen reactiebrief geschreven.</p>
                  <button
                    onClick={() => navigate("/application-letter")}
                    className="mt-3 text-[15px] font-semibold text-[var(--yo-pink)] active:opacity-70 transition-opacity"
                    data-testid="button-letter-empty"
                  >
                    Schrijf je brief
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[var(--yo-dark)] uppercase tracking-wide mb-3">Ondersteuning</p>
              <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
                <AccountSettingsRow
                  label="Privacy"
                  onClick={() => navigate("/datenschutz")}
                />
                <div className="h-px bg-[var(--yo-divider)] mx-5" />
                <AccountSettingsRow
                  label="Hulp & support"
                  onClick={() => {
                    window.location.href = "mailto:support@housalert.de";
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
            <div className="bg-white rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <AccountSettingsRow
                label="Meldingsinstellingen"
                subtext="E-mail, pushmeldingen"
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
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-[var(--yo-dark)] bg-[var(--yo-chip-bg)]"
                      data-testid="text-subscription-status"
                    >
                      Actief
                    </span>
                  ) : subscription.isTrial ? (
                    <span
                      className="text-[12px] font-[600] px-2.5 py-1 rounded-full flex-shrink-0 text-[var(--yo-dark)] bg-[var(--yo-chip-bg)]"
                      data-testid="text-subscription-status"
                    >
                      Proef
                    </span>
                  ) : null
                }
              />
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <button
                onClick={() => setShowLogoutConfirm(true)}
                disabled={signingOut}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[var(--yo-surface)] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
                data-testid="button-logout"
              >
                <p className="text-[15px] font-[500] text-[var(--yo-pink)] flex-1">{signingOut ? "Uitloggen..." : "Uitloggen"}</p>
              </button>
              <div className="h-px bg-[var(--yo-divider)] mx-5" />
              <button
                onClick={() => navigate("/account/delete")}
                className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-delete-account"
              >
                <p className="text-[15px] font-[500] text-[var(--yo-pink)] flex-1">Account verwijderen</p>
              </button>
            </div>

            {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
              <button
                onClick={() => navigate("/paywall")}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[15px] font-bold transition-colors flex items-center justify-center gap-2"
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

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
            <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
                data-testid="button-logout-back"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
              </button>
              <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">Uitloggen</h1>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--yo-chip-bg)] flex items-center justify-center mb-6">
              <LogOut className="w-8 h-8 text-[var(--yo-dark)]" />
            </div>
            <h2 className="text-[22px] font-bold text-[var(--yo-dark)] mb-3 text-center" data-testid="text-logout-title">
              Wil je uitloggen?
            </h2>
            <p className="text-[15px] text-[var(--yo-dark)] text-center max-w-[320px] mb-10 leading-relaxed">
              Je kunt op elk moment weer inloggen met je e-mailadres en wachtwoord.
            </p>
            <div className="w-full max-w-[320px] flex flex-col gap-3">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] text-white text-[16px] font-bold transition-colors hover:opacity-90 disabled:opacity-50"
                data-testid="button-logout-confirm"
              >
                {signingOut ? "Uitloggen..." : "Ja, uitloggen"}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] text-[var(--yo-dark)] text-[16px] font-bold hover:bg-[var(--yo-surface)] transition-colors"
                data-testid="button-logout-cancel"
              >
                Annuleren
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; label: string; Icon: any }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "matches", label: "Matches", Icon: Heart },
  { key: "tips", label: "Tips", Icon: Zap },
  { key: "filters", label: "Filters", Icon: SlidersHorizontal },
  { key: "profiel", label: "Profiel", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
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
      toast({ title: "Betaling gelukt!", description: "Je abonnement is nu actief." });
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
          <div className="w-8 h-8 rounded-lg bg-[var(--yo-chip-bg)] animate-pulse" />
          <p className="text-[var(--yo-dark)] text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.totalCount ?? 0;

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

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[var(--yo-divider)] safe-area-bottom">
        <div className="max-w-xl mx-auto flex">
          {TAB_CONFIG.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 pt-2 pb-2 relative transition-colors ${
                  isActive ? "text-[var(--yo-dark)]" : "text-[var(--yo-dark)]"
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
