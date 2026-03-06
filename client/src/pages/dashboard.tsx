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
import { ReactieklaarCard } from "@/components/reactieklaar-card";
import { ReactiesnelheidCard } from "@/components/reactiesnelheid-card";
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
} from "lucide-react";
import { PopulairVandaagSection } from "@/components/populair-vandaag";
import { ListSection, ListRow, ListDivider } from "@/components/list-section";
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
  net_binnen: { bg: "bg-green-100", text: "text-green-700" },
  nieuw: { bg: "bg-blue-100", text: "text-blue-700" },
  vandaag: { bg: "bg-yellow-100", text: "text-yellow-700" },
  ouder: { bg: "bg-gray-100", text: "text-gray-500" },
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
  berlin: "from-[#667eea] to-[#764ba2]",
  münchen: "from-[#f093fb] to-[#f5576c]",
  hamburg: "from-[#4facfe] to-[#00f2fe]",
  frankfurt: "from-[#43e97b] to-[#38f9d7]",
  köln: "from-[#fa709a] to-[#fee140]",
  düsseldorf: "from-[#a18cd1] to-[#fbc2eb]",
  stuttgart: "from-[#ffecd2] to-[#fcb69f]",
  default: "from-[#667eea] to-[#764ba2]",
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
    if (match.url) {
      window.open(match.url, "_blank", "noopener");
    } else {
      navigate(`/listing/${match.listing_id}`);
    }
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
      className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
      onClick={handleCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full h-[180px] object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-[180px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[12px] font-medium">{match.source}</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`}>
            {FRESH_LABEL_TEXT[match.fresh_label] ?? match.fresh_label}
          </span>
        </div>

        <button
          onClick={handleSave}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          data-testid={`button-save-match-${match.listing_id}`}
        >
          {isSaved ? (
            <BookmarkCheck className="w-4 h-4 text-[#0066FF]" />
          ) : (
            <Bookmark className="w-4 h-4 text-[#6B7280]" />
          )}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {match.match_score != null && match.match_label && (
          <div className="flex flex-col gap-1" data-testid={`score-badge-${match.listing_id}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${
                match.match_score >= 90 ? "bg-orange-100 text-orange-700" :
                match.match_score >= 75 ? "bg-green-100 text-green-700" :
                match.match_score >= 60 ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {match.match_label} · {match.match_score}%
              </span>
            </div>
            {match.match_reasons && match.match_reasons.length > 0 && (
              <p className="text-[12px] font-[500] text-[#6B7280]" data-testid={`text-match-reasons-${match.listing_id}`}>
                Match op: {match.match_reasons.join(", ")}
              </p>
            )}
          </div>
        )}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-[700] text-[#0F172A] text-[20px] leading-[1.3] line-clamp-2 flex-1"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
            {match.price > 0 && (
              <span className="text-[16px] font-bold text-[#0F172A] whitespace-nowrap flex-shrink-0">
                €{match.price}
                <span className="text-[12px] font-normal text-[#6B7280]">/mnd</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[13px] text-[#6B7280]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{match.city}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[13px] text-[#6B7280]">
          {match.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {match.bedrooms} {match.bedrooms === 1 ? "slaapkamer" : "slaapkamers"}
            </span>
          )}
          {match.size_m2 > 0 && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              {match.size_m2} m²
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center text-[11px] font-medium bg-[#F3F4F8] text-[#6B7280] px-2 py-0.5 rounded-full capitalize">
            {match.source}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
            <Clock className="w-3 h-3" />
            {relativeTime(match.matched_at || match.first_seen_at)}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              markViewed(match.listing_id);
              onStatusChange();
              if (match.url) {
                window.open(match.url, "_blank", "noopener");
              } else {
                navigate(`/listing/${match.listing_id}`);
              }
            }}
            className="flex-1 h-[44px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
            data-testid={`button-view-listing-${match.listing_id}`}
          >
            <ExternalLink className="w-4 h-4" />
            Bekijk woning
          </button>
          <button
            onClick={handleApply}
            className="h-[44px] px-4 rounded-xl border border-[#EAEFF5] bg-white text-[#0F172A] text-[14px] font-semibold hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-1.5"
            data-testid={`button-apply-${match.listing_id}`}
          >
            <Send className="w-3.5 h-3.5" />
            Reageer
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
      className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-3.5"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[#0F172A] text-[15px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city}
              </h3>
              <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                Actief
              </span>
            </div>
            <p className="text-[13px] font-[500] text-[#6B7280]">
              Aangemaakt {new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-red-500 hover:bg-red-50 transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#0F172A] px-2.5 py-1 rounded-full">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf €${profile.price_min}`
              : `Tot €${profile.price_max}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#0F172A] px-2.5 py-1 rounded-full">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#0F172A] px-2.5 py-1 rounded-full">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full h-10 rounded-xl border border-[#EAEFF5] text-[13px] font-semibold text-[#0F172A] hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-1.5"
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
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse" data-testid="card-boost-teaser-loading">
        <div className="h-4 bg-[#F2F5F8] rounded w-36 mb-3" />
        <div className="h-3 bg-[#F2F5F8] rounded w-52 mb-4" />
        <div className="h-9 bg-[#F2F5F8] rounded w-32" />
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
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-boost-teaser">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-[#0066FF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#0F172A]">Boost je kansen</p>
          <p className="text-[13px] text-[#6B7280] mt-0.5">{statusText}</p>

          <div className="mt-3 h-1.5 bg-[#F2F5F8] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0066FF] rounded-full transition-all duration-500"
              style={{ width: `${boostScore}%` }}
            />
          </div>

          <Button
            variant="link"
            onClick={() => setActiveTab("boost")}
            className="mt-2 p-0 h-auto text-[13px] font-semibold text-[#0066FF]"
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
    <div className="flex flex-col gap-6 pb-6">
      <div className="pt-1">
        <h1 className="text-page-title" data-testid="text-greeting">
          Hallo, {firstName}
        </h1>
      </div>

      {subscription.isExpired && (
        <div className="bg-red-50 rounded-2xl p-5 flex items-center gap-3" data-testid="banner-expired">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#0F172A]">Je proefperiode is afgelopen</p>
            <p className="text-[13px] font-[500] text-[#6B7280]">Activeer een abonnement om matches te blijven ontvangen.</p>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#0066FF] bg-white px-3 py-1.5 rounded-lg hover:bg-[#F2F5F8] transition-colors flex-shrink-0"
            data-testid="button-expired-upgrade"
          >
            Kies abonnement
          </button>
        </div>
      )}

      {hasMatches ? (
        <div className="rounded-2xl bg-[#F0F7FF] p-6" data-testid="hero-matches">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-[#0066FF] flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[22px] font-bold text-[#0F172A] leading-tight" data-testid="text-match-count">
                {matchCount} {matchCount === 1 ? "match" : "matches"} gevonden
              </p>
              <p className="text-[14px] font-[500] text-[#6B7280] mt-0.5">
                {hasProfiles
                  ? `Op basis van ${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"}`
                  : "Op basis van je zoekopdracht"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
            data-testid="button-view-matches"
          >
            Bekijk je matches
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#F9FAFB] p-6 text-center" data-testid="hero-empty">
          <div className="w-12 h-12 rounded-full bg-[#EDF2FF] flex items-center justify-center mx-auto mb-4">
            <Search className="w-5 h-5 text-[#0066FF]" />
          </div>
          <p className="text-[18px] font-semibold text-[#0F172A] leading-snug" data-testid="text-empty-title">
            We zoeken nu woningen voor je
          </p>
          <p className="text-[14px] font-[500] text-[#6B7280] mt-1.5 leading-relaxed max-w-[280px] mx-auto">
            {hasProfiles
              ? "Nieuwe matches verschijnen hier automatisch zodra er een woning bij je zoekopdracht past."
              : "Maak een zoekprofiel aan en ontvang automatisch matches."}
          </p>
          <button
            onClick={() => hasProfiles ? setActiveTab("filters") : navigate("/new-search")}
            className="mt-4 h-[44px] px-6 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-semibold transition-colors inline-flex items-center gap-2"
            data-testid="button-empty-cta"
          >
            {hasProfiles ? (
              <>
                <SlidersHorizontal className="w-4 h-4" />
                Zoekprofielen bekijken
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Zoekprofiel aanmaken
              </>
            )}
          </button>
        </div>
      )}

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="bg-[#EDF2FF] rounded-2xl px-5 py-3.5 flex items-center gap-3" data-testid="banner-trial">
          <Crown className="w-4 h-4 text-[#0066FF] flex-shrink-0" />
          <p className="text-[13px] font-[500] text-[#6B7280] flex-1">
            Proefperiode tot{" "}
            <span className="font-semibold text-[#0F172A]">
              {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
            </span>
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#0066FF] hover:underline flex-shrink-0"
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
          className="w-full h-[48px] rounded-xl border border-[#E5E7EB] bg-white text-[#0F172A] text-[15px] font-semibold hover:bg-[#F9FAFB] transition-colors flex items-center justify-center gap-2"
          data-testid="button-manage-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Beheer filters
        </button>
      )}
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
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title">Matches</h1>
        {matches.length > 0 && (
          <span className="text-[13px] font-medium text-[#0066FF] bg-[#EDF2FF] px-2.5 py-1 rounded-full" data-testid="badge-match-count">
            {matches.length} totaal
          </span>
        )}
      </div>

      <div className="flex gap-2 bg-[#F3F4F8] p-1.5 rounded-full" data-testid="match-sub-tabs">
        {MATCH_SUB_TABS.map(({ key, label, Icon }) => {
          const count = tabCounts[key] || 0;
          const isActive = subTab === key;
          return (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white text-[#0F172A] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  : "text-[#6B7280] hover:text-[#0F172A] hover:bg-white/50"
              }`}
              data-testid={`tab-matches-${key}`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full ${
                  isActive ? "bg-[#0066FF] text-white" : "bg-[#E2E6ED] text-[#6B7280]"
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
            <div key={i} className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden animate-pulse">
              <div className="h-[180px] bg-[#F2F5F8]" />
              <div className="p-4 flex flex-col gap-3">
                <div className="h-5 bg-[#F2F5F8] rounded w-3/4" />
                <div className="h-4 bg-[#F2F5F8] rounded w-1/2" />
                <div className="flex gap-3">
                  <div className="h-4 bg-[#F2F5F8] rounded w-24" />
                  <div className="h-4 bg-[#F2F5F8] rounded w-16" />
                </div>
                <div className="h-[44px] bg-[#F2F5F8] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-[18px] font-[700] text-[#0F172A]">Kon matches niet laden</p>
          <p className="text-[13px] text-[#6B7280]">Controleer je verbinding en probeer het opnieuw.</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-semibold text-[#0066FF]"
            data-testid="button-retry-matches"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3" data-testid="empty-matches">
          <div className="w-14 h-14 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <Heart className="w-6 h-6 text-[#0066FF]" />
          </div>
          <p className="text-[20px] font-[700] text-[#0F172A]">Nog geen matches</p>
          <p className="text-[13px] text-[#6B7280] max-w-[250px]">
            Zodra we woningen vinden die passen bij jouw filters, verschijnen ze hier.
          </p>
          <button
            onClick={() => setActiveTab("filters")}
            className="mt-2 h-[44px] px-6 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-semibold transition-colors flex items-center gap-2"
            data-testid="button-adjust-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Pas je filters aan
          </button>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3" data-testid="empty-filtered-matches">
          <div className="w-14 h-14 rounded-full bg-[#F3F4F8] flex items-center justify-center">
            {subTab === "opgeslagen" ? (
              <Bookmark className="w-6 h-6 text-[#6B7280]" />
            ) : subTab === "bekeken" ? (
              <Eye className="w-6 h-6 text-[#6B7280]" />
            ) : subTab === "gereageerd" ? (
              <Send className="w-6 h-6 text-[#6B7280]" />
            ) : (
              <Heart className="w-6 h-6 text-[#6B7280]" />
            )}
          </div>
          <p className="text-[20px] font-[700] text-[#0F172A]">
            {subTab === "opgeslagen" && "Geen opgeslagen matches"}
            {subTab === "bekeken" && "Geen bekeken matches"}
            {subTab === "gereageerd" && "Geen gereageerde matches"}
            {subTab === "nieuw" && "Alle matches zijn bekeken"}
          </p>
          <p className="text-[13px] text-[#6B7280] max-w-[250px]">
            {subTab === "opgeslagen" && "Tik op het bladwijzer-icoon om een match op te slaan."}
            {subTab === "bekeken" && "Woningen die je hebt geopend verschijnen hier."}
            {subTab === "gereageerd" && "Woningen waar je op hebt gereageerd verschijnen hier."}
            {subTab === "nieuw" && "Bekijk je andere tabs of pas je filters aan."}
          </p>
        </div>
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
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">Zoekprofielen</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">{profileCount} van {MAX_PROFILES} actief</p>
        </div>
        {!atLimit && (
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-9 h-9 rounded-full bg-[#0066FF] hover:bg-[#0052CC] flex items-center justify-center text-white transition-colors"
            data-testid="button-add-search"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 animate-pulse">
              <div className="h-4 bg-[#F2F5F8] rounded w-1/3 mb-3" />
              <div className="flex gap-2">
                <div className="h-6 bg-[#F2F5F8] rounded-full w-24" />
                <div className="h-6 bg-[#F2F5F8] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center text-center gap-3" data-testid="empty-profiles">
          <div className="w-14 h-14 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <Search className="w-6 h-6 text-[#0066FF]" />
          </div>
          <p className="text-[16px] font-semibold text-[#0F172A]">Geen zoekprofielen</p>
          <p className="text-[13px] text-[#6B7280] max-w-[250px]">
            Voeg een zoekopdracht toe om automatisch woningen te ontvangen.
          </p>
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="mt-2 h-[44px] px-6 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-semibold transition-colors flex items-center gap-2"
            data-testid="button-add-search-empty"
          >
            <Plus className="w-4 h-4" />
            Eerste zoekopdracht aanmaken
          </button>
        </div>
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
              className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 flex items-center justify-center gap-2 text-[14px] font-semibold text-[#0066FF] hover:bg-[#F3F4F8] transition-colors border-2 border-dashed border-[#EAEFF5]"
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

function ProfielTab({ user, signOut, navigate, subscription, setActiveTab }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null }; setActiveTab: (tab: TabKey) => void }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate("/login");
  }

  const subscriptionSubtitle = subscription.isActive && !subscription.isTrial
    ? `${subscription.plan === "monthly" ? "Maandelijks" : subscription.plan === "two_month" ? "2 maanden" : subscription.plan === "three_month" ? "3 maanden" : "Actief"}`
    : subscription.isTrial
    ? `Proefperiode tot ${subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : ""}`
    : "Verlopen";

  const subscriptionBadge = (
    <span
      className={`text-[12px] font-[500] px-2.5 py-1 rounded-full flex-shrink-0 ${
        subscription.isActive && !subscription.isTrial
          ? "text-green-600 bg-green-50"
          : subscription.isTrial
          ? "text-[#0066FF] bg-blue-50"
          : "text-red-500 bg-red-50"
      }`}
      data-testid="text-subscription-status"
    >
      {subscription.isActive && !subscription.isTrial ? "Actief" : subscription.isTrial ? "Proef" : "Verlopen"}
    </span>
  );

  return (
    <div className="flex flex-col gap-7 pb-6">
      <div className="flex items-center gap-3.5 pt-1">
        <div className="w-14 h-14 rounded-full bg-[#EDF2FF] flex items-center justify-center flex-shrink-0">
          <span className="text-[20px] font-bold text-[#0066FF]">
            {user.email?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[18px] font-[600] text-[#0F172A] truncate" data-testid="text-user-email">{user.email}</p>
          <p className="text-row-subtitle">Persoonlijk account</p>
        </div>
      </div>

      <ReactiesnelheidCard onTap={() => setActiveTab("boost")} />

      <ReactieklaarCard navigate={navigate} onStepClick={() => setActiveTab("boost")} />

      <ListSection title="Instellingen">
        <ListRow
          title="Meldingsinstellingen"
          subtitle="E-mail, SMS, WhatsApp"
          icon={<div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center"><Bell className="w-4 h-4 text-[#0066FF]" /></div>}
          onClick={() => navigate("/settings/notifications")}
          testId="button-notification-settings"
        />
        <ListDivider />
        <ListRow
          title="Abonnement"
          subtitle={subscriptionSubtitle}
          icon={<div className={`w-9 h-9 rounded-full flex items-center justify-center ${subscription.isActive ? "bg-green-50" : subscription.isTrial ? "bg-blue-50" : "bg-red-50"}`}>{subscription.isActive ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : subscription.isTrial ? <Crown className="w-4 h-4 text-[#0066FF]" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}</div>}
          trailing={subscriptionBadge}
          testId="item-subscription"
        />
      </ListSection>

      {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
        <button
          onClick={() => navigate("/paywall")}
          className="w-full h-[52px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-[600] transition-colors flex items-center justify-center gap-2"
          data-testid="button-upgrade-subscription"
        >
          <Crown className="w-4 h-4" />
          Kies een abonnement
        </button>
      )}

      <ListSection title="Account">
        <ListRow
          title={signingOut ? "Uitloggen..." : "Uitloggen"}
          onClick={handleSignOut}
          disabled={signingOut}
          titleClassName="text-[16px] font-[600] text-red-500 leading-[1.3]"
          trailing={<LogOut className="w-[18px] h-[18px] text-red-400 flex-shrink-0" />}
          testId="button-logout"
        />
      </ListSection>
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
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const sub = useSubscription();

  const { toast } = useToast();

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
          <div className="w-8 h-8 rounded-lg bg-[#0066FF] animate-pulse" />
          <p className="text-[#6B7280] text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0066FF] flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#0F172A] text-[17px]">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-24">
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EAEFF5] z-20 safe-area-bottom">
        <div className="max-w-xl mx-auto flex">
          {TAB_CONFIG.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
                  isActive ? "text-[#0066FF]" : "text-[#6B7280]"
                }`}
                data-testid={`tab-${key}`}
              >
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
