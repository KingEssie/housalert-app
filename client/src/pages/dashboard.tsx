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
import { ProfileStrengthSection } from "@/components/profile-strength";
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
  Settings,
  Mail,
  Crown,
  AlertTriangle,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Eye,
  Send,
  ImageIcon,
} from "lucide-react";

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

type TabKey = "home" | "matches" | "filters" | "profiel";
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
  onMarkApplied,
  isSaved,
  onStatusChange,
}: {
  match: ApiMatch;
  onSaveToggle: (listingId: string) => void;
  onMarkApplied: (listingId: string) => void;
  isSaved: boolean;
  onStatusChange: () => void;
}) {
  const [, navigate] = useLocation();
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
    if (match.url) {
      markApplied(match.listing_id);
      onMarkApplied(match.listing_id);
      onStatusChange();
      window.open(match.url, "_blank", "noopener");
    }
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
      onClick={handleCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full h-[180px] object-cover"
            loading="lazy"
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
            <Bookmark className="w-4 h-4 text-[#72839A]" />
          )}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {match.match_score != null && match.match_label && (
          <div className="flex items-center gap-2" data-testid={`score-badge-${match.listing_id}`}>
            <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${
              match.match_score >= 90 ? "bg-orange-100 text-orange-700" :
              match.match_score >= 75 ? "bg-green-100 text-green-700" :
              match.match_score >= 60 ? "bg-blue-100 text-blue-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {match.match_label} · {match.match_score}%
            </span>
          </div>
        )}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-[700] text-[#1B2A4A] text-[20px] leading-[1.3] line-clamp-2 flex-1"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
            {match.price > 0 && (
              <span className="text-[16px] font-bold text-[#1B2A4A] whitespace-nowrap flex-shrink-0">
                €{match.price}
                <span className="text-[12px] font-normal text-[#72839A]">/mnd</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[13px] text-[#72839A]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{match.city}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[13px] text-[#72839A]">
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
          <span className="inline-flex items-center text-[11px] font-medium bg-[#F3F4F8] text-[#72839A] px-2 py-0.5 rounded-full capitalize">
            {match.source}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#9BA5B7]">
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
          {match.url && (
            <button
              onClick={handleApply}
              className="h-[44px] px-4 rounded-xl border border-[#EAEFF5] bg-white text-[#1B2A4A] text-[14px] font-semibold hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-1.5"
              data-testid={`button-apply-${match.listing_id}`}
            >
              <Send className="w-3.5 h-3.5" />
              Reageer
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
              <h3 className="font-semibold text-[#1B2A4A] text-[15px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city}
              </h3>
              <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                Actief
              </span>
            </div>
            <p className="text-[12px] text-[#9BA5B7]">
              Aangemaakt {new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#1B2A4A] px-2.5 py-1 rounded-full">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf €${profile.price_min}`
              : `Tot €${profile.price_max}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#1B2A4A] px-2.5 py-1 rounded-full">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F5F8] text-[#1B2A4A] px-2.5 py-1 rounded-full">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full h-10 rounded-xl border border-[#EAEFF5] text-[13px] font-semibold text-[#1B2A4A] hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-1.5"
        data-testid={`button-edit-${profile.id}`}
      >
        Bewerken
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
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

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="pt-1">
        <h1 className="text-[32px] font-[800] text-[#1B2A4A] tracking-[-0.03em] leading-[1.1]" data-testid="text-greeting">
          Hallo, {firstName}
        </h1>
        <p className="text-[15px] text-[#72839A] mt-1">Welkom terug bij Stekkies</p>
      </div>

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="bg-[#EDF2FF] rounded-2xl p-5 flex items-center gap-3" data-testid="banner-trial">
          <div className="w-9 h-9 rounded-full bg-[#0066FF]/10 flex items-center justify-center flex-shrink-0">
            <Crown className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#1B2A4A]">Proefperiode</p>
            <p className="text-[12px] text-[#72839A]">
              Je proefperiode loopt tot{" "}
              <span className="font-semibold text-[#1B2A4A]">
                {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
              </span>
            </p>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#0066FF] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            Upgrade
          </button>
        </div>
      )}

      {subscription.isExpired && (
        <div className="bg-red-50 rounded-2xl p-5 flex items-center gap-3" data-testid="banner-expired">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#1B2A4A]">Je proefperiode is afgelopen</p>
            <p className="text-[12px] text-[#72839A]">Activeer een abonnement om matches te blijven ontvangen.</p>
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

      <div className="bg-gradient-to-br from-[#0066FF] to-[#0052CC] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-white/80" />
          <span className="text-[13px] font-medium text-white/80">Wekelijks overzicht</span>
        </div>
        <p className="text-[22px] font-bold leading-tight" data-testid="text-weekly-estimate">
          {matchCount > 0
            ? `${matchCount} ${matchCount === 1 ? "match" : "matches"} gevonden`
            : "Nog geen matches"}
        </p>
        <p className="text-[13px] text-white/70 mt-1">
          {hasProfiles
            ? `Met ${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"} actief`
            : "Maak je eerste zoekprofiel aan"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-[700] text-[#1B2A4A]">Status</h2>

        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] divide-y divide-[#F2F5F8]">
          <div className="flex items-center gap-3 p-4" data-testid="status-account">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#1B2A4A]">Account actief</p>
              <p className="text-[12px] text-[#9BA5B7]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4" data-testid="status-profiles">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${hasProfiles ? "bg-green-100" : "bg-yellow-100"}`}>
              {hasProfiles ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#1B2A4A]">
                {hasProfiles ? `${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"} actief` : "Geen zoekprofielen"}
              </p>
              <p className="text-[12px] text-[#9BA5B7]">
                {hasProfiles ? "Je ontvangt automatisch matches" : "Stel je eerste zoekopdracht in"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ProfileStrengthSection navigate={navigate} />

      <div className="flex flex-col gap-3 mt-1">
        <button
          onClick={() => setActiveTab("matches")}
          className="w-full h-[56px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-semibold transition-colors flex items-center justify-center gap-2"
          data-testid="button-view-matches"
        >
          <Heart className="w-4 h-4" />
          Bekijk matches
        </button>
        <button
          onClick={() => setActiveTab("filters")}
          className="w-full h-[48px] rounded-xl border border-[#EAEFF5] bg-white text-[#1B2A4A] text-[16px] font-semibold hover:bg-[#F2F5F8] transition-colors flex items-center justify-center gap-2"
          data-testid="button-manage-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Beheer filters
        </button>
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

  const handleMarkApplied = useCallback((listingId: string) => {
    markApplied(listingId);
    refreshStatuses();
  }, [refreshStatuses]);

  const matchTabs = matches.map((m) => ({ ...m, _tab: getMatchTab(m.listing_id) }));
  const filteredMatches = matchTabs.filter((m) => m._tab === subTab);

  const tabCounts = matchTabs.reduce((acc, m) => {
    acc[m._tab] = (acc[m._tab] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-[700] text-[#1B2A4A] tracking-[-0.02em] leading-[1.15]">Matches</h1>
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
                  ? "bg-white text-[#1B2A4A] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  : "text-[#72839A] hover:text-[#1B2A4A] hover:bg-white/50"
              }`}
              data-testid={`tab-matches-${key}`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full ${
                  isActive ? "bg-[#0066FF] text-white" : "bg-[#E2E6ED] text-[#72839A]"
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
          <p className="text-[18px] font-[700] text-[#1B2A4A]">Kon matches niet laden</p>
          <p className="text-[13px] text-[#72839A]">Controleer je verbinding en probeer het opnieuw.</p>
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
          <p className="text-[20px] font-[700] text-[#1B2A4A]">Nog geen matches</p>
          <p className="text-[13px] text-[#72839A] max-w-[250px]">
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
              <Bookmark className="w-6 h-6 text-[#72839A]" />
            ) : subTab === "bekeken" ? (
              <Eye className="w-6 h-6 text-[#72839A]" />
            ) : subTab === "gereageerd" ? (
              <Send className="w-6 h-6 text-[#72839A]" />
            ) : (
              <Heart className="w-6 h-6 text-[#72839A]" />
            )}
          </div>
          <p className="text-[20px] font-[700] text-[#1B2A4A]">
            {subTab === "opgeslagen" && "Geen opgeslagen matches"}
            {subTab === "bekeken" && "Geen bekeken matches"}
            {subTab === "gereageerd" && "Geen gereageerde matches"}
            {subTab === "nieuw" && "Alle matches zijn bekeken"}
          </p>
          <p className="text-[13px] text-[#72839A] max-w-[250px]">
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
              onMarkApplied={handleMarkApplied}
              isSaved={safeGetSet(MATCH_SAVED_KEY).has(m.listing_id)}
              onStatusChange={refreshStatuses}
            />
          ))}
        </div>
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
          <h1 className="text-[26px] font-[700] text-[#1B2A4A] tracking-[-0.02em] leading-[1.15]">Zoekprofielen</h1>
          <p className="text-[13px] text-[#72839A] mt-0.5">{profileCount} van {MAX_PROFILES} actief</p>
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
          <p className="text-[16px] font-semibold text-[#1B2A4A]">Geen zoekprofielen</p>
          <p className="text-[13px] text-[#72839A] max-w-[250px]">
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

function ProfielTab({ user, signOut, navigate, subscription }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null } }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-[26px] font-[700] text-[#1B2A4A] tracking-[-0.02em] leading-[1.15]">Profiel</h1>

      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <span className="text-[18px] font-bold text-[#0066FF]">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1B2A4A]" data-testid="text-user-email">{user.email}</p>
            <p className="text-[12px] text-[#9BA5B7]">Persoonlijk account</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] divide-y divide-[#F2F5F8]">
        <button
          onClick={() => navigate("/settings/notifications")}
          className="w-full flex items-center gap-3 p-4 hover:bg-[#F3F4F8] transition-colors rounded-t-2xl"
          data-testid="button-notification-settings"
        >
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
            <Bell className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-medium text-[#1B2A4A]">Meldingsinstellingen</p>
            <p className="text-[12px] text-[#9BA5B7]">E-mail, SMS, WhatsApp</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#9BA5B7]" />
        </button>

        <div className="flex items-center gap-3 p-4 w-full">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${subscription.isActive ? "bg-green-50" : subscription.isTrial ? "bg-blue-50" : "bg-red-50"}`}>
            {subscription.isActive ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : subscription.isTrial ? (
              <Crown className="w-4 h-4 text-[#0066FF]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#1B2A4A]">Abonnement</p>
            <p className="text-[12px] text-[#9BA5B7]">
              {subscription.isActive && !subscription.isTrial
                ? `${subscription.plan === "monthly" ? "Maandelijks" : subscription.plan === "two_month" ? "2 maanden" : subscription.plan === "three_month" ? "3 maanden" : "Actief"}`
                : subscription.isTrial
                ? `Proefperiode tot ${subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : ""}`
                : "Verlopen"}
            </p>
          </div>
          <span
            className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
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
        </div>
      </div>

      {(subscription.isExpired || (!subscription.isActive && !subscription.isTrial)) && (
        <button
          onClick={() => navigate("/paywall")}
          className="w-full h-[56px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-semibold transition-colors flex items-center justify-center gap-2"
          data-testid="button-upgrade-subscription"
        >
          <Crown className="w-4 h-4" />
          Kies een abonnement
        </button>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full h-[48px] rounded-xl border border-[#EAEFF5] bg-white text-[16px] font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4" />
        {signingOut ? "Uitloggen..." : "Uitloggen"}
      </button>
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; label: string; Icon: any }[] = [
  { key: "home", label: "Home", Icon: Home },
  { key: "matches", label: "Matches", Icon: Heart },
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
          <p className="text-[#72839A] text-sm">Laden...</p>
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
            <span className="font-bold text-[#1B2A4A] text-[17px]">Stekkies</span>
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
        {activeTab === "filters" && <FiltersTab navigate={navigate} />}
        {activeTab === "profiel" && (
          <ProfielTab
            user={user}
            signOut={signOut}
            navigate={navigate}
            subscription={{ status: sub.status, isTrial: sub.isTrial, isActive: sub.isActive, isExpired: sub.isExpired, plan: sub.plan, trialEndsAt: sub.trialEndsAt }}
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
                  isActive ? "text-[#0066FF]" : "text-[#9BA5B7]"
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
