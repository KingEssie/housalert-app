import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
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

function MatchCard({ match }: { match: ApiMatch }) {
  const [, navigate] = useLocation();
  const style = FRESH_BADGE_STYLES[match.fresh_label] ?? FRESH_BADGE_STYLES.ouder;
  return (
    <div
      className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-3 cursor-pointer hover:shadow-[0_6px_24px_rgba(0,0,0,0.1)] transition-shadow active:scale-[0.99]"
      onClick={() => navigate(`/listing/${match.listing_id}`)}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {FRESH_LABEL_TEXT[match.fresh_label] ?? match.fresh_label}
            </span>
          </div>
          <h3 className="font-semibold text-[#0B1F44] text-[15px] leading-snug line-clamp-2" data-testid={`text-match-title-${match.listing_id}`}>
            {match.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#6B7280]">
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          {match.city}
        </span>
        {match.price > 0 && (
          <span className="flex items-center gap-1">
            <Euro className="w-3.5 h-3.5" />
            €{match.price}/mnd
          </span>
        )}
        {match.bedrooms > 0 && (
          <span className="flex items-center gap-1">
            <BedDouble className="w-3.5 h-3.5" />
            {match.bedrooms} slk
          </span>
        )}
        {match.size_m2 > 0 && (
          <span className="flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5" />
            {match.size_m2}m²
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-[#F2F4F7]">
        <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
          <span className="capitalize">{match.source}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(match.matched_at || match.first_seen_at)}
          </span>
        </div>
        <span
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#2D6CDF]"
          data-testid={`link-match-${match.listing_id}`}
        >
          Bekijk match
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
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
      className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-3"
      data-testid={`card-profile-${profile.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#EBF2FD] flex items-center justify-center">
            <MapPin className="w-4 h-4 text-[#2D6CDF]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-[#0B1F44] text-[15px]" data-testid={`text-profile-city-${profile.id}`}>
                {profile.city}
              </h3>
              <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full" data-testid={`badge-status-${profile.id}`}>
                Actief
              </span>
            </div>
            <p className="text-[12px] text-[#9CA3AF]">
              Aangemaakt {new Date(profile.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
          data-testid={`button-delete-${profile.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(profile.price_min > 0 || profile.price_max > 0) && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F4F7] text-[#374151] px-2.5 py-1 rounded-full">
            <Euro className="w-3 h-3" />
            {profile.price_min > 0 && profile.price_max > 0
              ? `€${profile.price_min} – €${profile.price_max}`
              : profile.price_min > 0
              ? `Vanaf €${profile.price_min}`
              : `Tot €${profile.price_max}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F4F7] text-[#374151] px-2.5 py-1 rounded-full">
          <BedDouble className="w-3 h-3" />
          {bedroomLabel(profile.bedrooms_min)}
        </span>
        {profile.size_min > 0 && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#F2F4F7] text-[#374151] px-2.5 py-1 rounded-full">
            <Ruler className="w-3 h-3" />
            {profile.size_min}+ m²
          </span>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full h-10 rounded-xl border border-[#E8EDF2] text-[13px] font-semibold text-[#0B1F44] hover:bg-[#F8F9FB] transition-colors flex items-center justify-center gap-1.5"
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
    <div className="flex flex-col gap-4 pb-4">
      <div className="pt-1">
        <h1 className="text-[22px] font-bold text-[#0B1F44]" data-testid="text-greeting">
          Hallo, {firstName}
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-0.5">Welkom terug bij Stekkies</p>
      </div>

      {subscription.isTrial && subscription.trialEndsAt && (
        <div className="bg-[#EBF2FD] rounded-[16px] p-4 flex items-center gap-3" data-testid="banner-trial">
          <div className="w-9 h-9 rounded-full bg-[#2D6CDF]/10 flex items-center justify-center flex-shrink-0">
            <Crown className="w-4 h-4 text-[#2D6CDF]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#0B1F44]">Proefperiode</p>
            <p className="text-[12px] text-[#6B7280]">
              Je proefperiode loopt tot{" "}
              <span className="font-semibold text-[#0B1F44]">
                {new Date(subscription.trialEndsAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
              </span>
            </p>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#2D6CDF] hover:underline flex-shrink-0"
            data-testid="button-trial-upgrade"
          >
            Upgrade
          </button>
        </div>
      )}

      {subscription.isExpired && (
        <div className="bg-red-50 rounded-[16px] p-4 flex items-center gap-3" data-testid="banner-expired">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#0B1F44]">Je proefperiode is afgelopen</p>
            <p className="text-[12px] text-[#6B7280]">Activeer een abonnement om matches te blijven ontvangen.</p>
          </div>
          <button
            onClick={() => navigate("/paywall")}
            className="text-[12px] font-semibold text-[#2D6CDF] bg-white px-3 py-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors flex-shrink-0"
            data-testid="button-expired-upgrade"
          >
            Kies abonnement
          </button>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#2D6CDF] to-[#1E54B7] rounded-[16px] p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-white/80" />
          <span className="text-[13px] font-medium text-white/80">Wekelijks overzicht</span>
        </div>
        <p className="text-[20px] font-bold leading-tight" data-testid="text-weekly-estimate">
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
        <h2 className="text-[14px] font-semibold text-[#0B1F44]">Status</h2>

        <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] divide-y divide-[#F2F4F7]">
          <div className="flex items-center gap-3 p-4" data-testid="status-account">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-[#0B1F44]">Account actief</p>
              <p className="text-[12px] text-[#9CA3AF]">{user.email}</p>
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
              <p className="text-[14px] font-medium text-[#0B1F44]">
                {hasProfiles ? `${profileCount} ${profileCount === 1 ? "zoekprofiel" : "zoekprofielen"} actief` : "Geen zoekprofielen"}
              </p>
              <p className="text-[12px] text-[#9CA3AF]">
                {hasProfiles ? "Je ontvangt automatisch matches" : "Stel je eerste zoekopdracht in"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <button
          onClick={() => setActiveTab("matches")}
          className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
          data-testid="button-view-matches"
        >
          <Heart className="w-4 h-4" />
          Bekijk matches
        </button>
        <button
          onClick={() => setActiveTab("filters")}
          className="w-full h-[48px] rounded-xl border border-[#E8EDF2] bg-white text-[#0B1F44] text-[15px] font-semibold hover:bg-[#F8F9FB] transition-colors flex items-center justify-center gap-2"
          data-testid="button-manage-filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Beheer filters
        </button>
      </div>
    </div>
  );
}

function MatchesTab({ accessToken, setActiveTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void }) {
  const apiMatchesQuery = useQuery<ApiMatch[]>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken,
  });

  const matches = apiMatchesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-[#0B1F44]">Matches</h1>
        {matches.length > 0 && (
          <span className="text-[13px] font-medium text-[#2D6CDF] bg-[#EBF2FD] px-2.5 py-1 rounded-full" data-testid="badge-match-count">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {apiMatchesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 animate-pulse">
              <div className="h-3 bg-[#F2F4F7] rounded w-16 mb-3" />
              <div className="h-4 bg-[#F2F4F7] rounded w-3/4 mb-2" />
              <div className="flex gap-3">
                <div className="h-3 bg-[#F2F4F7] rounded w-20" />
                <div className="h-3 bg-[#F2F4F7] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : apiMatchesQuery.isError ? (
        <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-[14px] font-medium text-[#0B1F44]">Kon matches niet laden</p>
          <p className="text-[13px] text-[#6B7280]">Controleer je verbinding en probeer het opnieuw.</p>
          <button
            onClick={() => apiMatchesQuery.refetch()}
            className="text-[13px] font-semibold text-[#2D6CDF]"
            data-testid="button-retry-matches"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3" data-testid="empty-matches">
          <div className="w-14 h-14 rounded-full bg-[#EBF2FD] flex items-center justify-center">
            <Heart className="w-6 h-6 text-[#2D6CDF]" />
          </div>
          <p className="text-[16px] font-semibold text-[#0B1F44]">Nog geen matches</p>
          <p className="text-[13px] text-[#6B7280] max-w-[250px]">
            Zodra we woningen vinden die passen bij jouw filters, verschijnen ze hier.
          </p>
          <button
            onClick={() => setActiveTab("filters")}
            className="mt-2 h-[44px] px-6 rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[14px] font-semibold transition-colors flex items-center gap-2"
            data-testid="button-adjust-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Pas je filters aan
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <MatchCard key={m.listing_id} match={m} />
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
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#0B1F44]">Zoekprofielen</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">{profileCount} van {MAX_PROFILES} actief</p>
        </div>
        {!atLimit && (
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-9 h-9 rounded-full bg-[#2D6CDF] hover:bg-[#2560C8] flex items-center justify-center text-white transition-colors"
            data-testid="button-add-search"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {profilesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 animate-pulse">
              <div className="h-4 bg-[#F2F4F7] rounded w-1/3 mb-3" />
              <div className="flex gap-2">
                <div className="h-6 bg-[#F2F4F7] rounded-full w-24" />
                <div className="h-6 bg-[#F2F4F7] rounded-full w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-8 flex flex-col items-center text-center gap-3" data-testid="empty-profiles">
          <div className="w-14 h-14 rounded-full bg-[#EBF2FD] flex items-center justify-center">
            <Search className="w-6 h-6 text-[#2D6CDF]" />
          </div>
          <p className="text-[16px] font-semibold text-[#0B1F44]">Geen zoekprofielen</p>
          <p className="text-[13px] text-[#6B7280] max-w-[250px]">
            Voeg een zoekopdracht toe om automatisch woningen te ontvangen.
          </p>
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="mt-2 h-[44px] px-6 rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[14px] font-semibold transition-colors flex items-center gap-2"
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
              className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-4 flex items-center justify-center gap-2 text-[14px] font-semibold text-[#2D6CDF] hover:bg-[#F8FAFF] transition-colors border-2 border-dashed border-[#D4E0F5]"
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
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-[20px] font-bold text-[#0B1F44]">Profiel</h1>

      <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#EBF2FD] flex items-center justify-center">
            <span className="text-[18px] font-bold text-[#2D6CDF]">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#0B1F44]" data-testid="text-user-email">{user.email}</p>
            <p className="text-[12px] text-[#9CA3AF]">Persoonlijk account</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] divide-y divide-[#F2F4F7]">
        <button
          onClick={() => navigate("/settings/notifications")}
          className="w-full flex items-center gap-3 p-4 hover:bg-[#F8F9FB] transition-colors rounded-t-[16px]"
          data-testid="button-notification-settings"
        >
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
            <Bell className="w-4 h-4 text-[#2D6CDF]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-medium text-[#0B1F44]">Meldingsinstellingen</p>
            <p className="text-[12px] text-[#9CA3AF]">E-mail, SMS, WhatsApp</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
        </button>

        <div className="flex items-center gap-3 p-4 w-full">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${subscription.isActive ? "bg-green-50" : subscription.isTrial ? "bg-blue-50" : "bg-red-50"}`}>
            {subscription.isActive ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : subscription.isTrial ? (
              <Crown className="w-4 h-4 text-[#2D6CDF]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#0B1F44]">Abonnement</p>
            <p className="text-[12px] text-[#9CA3AF]">
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
                ? "text-[#2D6CDF] bg-blue-50"
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
          className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
          data-testid="button-upgrade-subscription"
        >
          <Crown className="w-4 h-4" />
          Kies een abonnement
        </button>
      )}

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full h-[48px] rounded-xl border border-[#E8EDF2] bg-white text-[15px] font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

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
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2D6CDF] animate-pulse" />
          <p className="text-[#6B7280] text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = profilesQuery.data ?? [];
  const matchCount = apiMatchesQuery.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E8EDF2]">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2D6CDF] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#0B1F44] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-5 pb-24">
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EDF2] z-20 safe-area-bottom">
        <div className="max-w-xl mx-auto flex">
          {TAB_CONFIG.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  isActive ? "text-[#2D6CDF]" : "text-[#9CA3AF]"
                }`}
                data-testid={`tab-${key}`}
              >
                <Icon className="w-5 h-5" />
                <span className={`text-[11px] ${isActive ? "font-semibold" : "font-medium"}`}>
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
