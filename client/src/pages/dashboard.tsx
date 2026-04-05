import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, type ApiMatch, type ApiMatchesResponse, type CanonicalStats } from "@/lib/listings";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/lib/subscription";
import { SubscriptionGate } from "@/components/subscription-gate";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import {
  Home,
  User,
  Trash2,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Crown,
  Send,
  ArrowLeft,
  Camera,
  Pencil,
  FileText,
  MoreVertical,
  Shield,
  ShieldBan,
  HelpCircle,
  Heart,
  Lock,
  MapPin,
  X,
  Check,
  Image,
} from "lucide-react";
import { ExpandableCompletionCard, type CompletionStep } from "@/components/expandable-completion-card";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import TipsPage, { getTipConfig, getTipsReadSet } from "@/pages/tips";
import { getFlowTipSteps } from "@/pages/tips-flow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListingCardFull, ListingCardMini } from "@/components/listing-card";

const MAX_PROFILES = 4;

type TabKey = "home" | "matches" | "zoek" | "profiel" | "tips";
type MatchesTopTab = "matches" | "gereageerd" | "favorieten";

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

function getMatchTab(match: ApiMatch): "gereageerd" | "bekeken" | "nieuw" {
  if (match.canonical_applied || safeGetSet(MATCH_APPLIED_KEY).has(match.listing_id)) return "gereageerd";
  if (match.canonical_viewed || safeGetSet(MATCH_VIEWED_KEY).has(match.listing_id)) return "bekeken";
  return "nieuw";
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
          <ListingCardMini
            key={match.listing_id}
            match={match}
            onCardClick={() => navigate(`/apply/${match.listing_id}`)}
          />
        ))}
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

function getProfilePriceLine(p: SearchProfile, t: (key: string, params?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  if (p.price_min > 0 && p.price_max > 0) parts.push(`€${p.price_min} – €${p.price_max}`);
  else if (p.price_max > 0) parts.push(`${t("searchProfiles.max")} €${p.price_max}`);
  else if (p.price_min > 0) parts.push(`${t("searchProfiles.min")} €${p.price_min}`);
  else parts.push(t("searchProfiles.priceDefault"));
  if (p.bedrooms_min > 0) parts.push(`${p.bedrooms_min}+ ${t("searchProfiles.bedrooms")}`);
  if (p.size_min > 0) parts.push(`${p.size_min}+ m²`);
  return parts.join(" · ");
}

function getProfileLocationLine(p: SearchProfile, t: (key: string, params?: Record<string, string | number>) => string): string | null {
  if (p.location_mode === "districts" && p.districts && p.districts.length > 0) {
    return t("searchProfiles.districtsSelected", { count: p.districts.length });
  }
  if (p.location_mode === "radius" && p.radius_km) {
    return t("searchProfiles.radiusLabel", { km: p.radius_km });
  }
  if (p.location_mode === "commute" && p.commute_minutes) {
    return t("searchProfiles.travelTimeLabel", { mins: p.commute_minutes });
  }
  return null;
}

function SearchProfilesSection({ profiles, navigate }: { profiles: SearchProfile[]; navigate: (path: string) => void }) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const MAX_PROFILES = 4;
  const canAdd = profiles.length < MAX_PROFILES;

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

  if (profiles.length === 0) {
    return (
      <div data-testid="section-search-profiles-empty">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-ha-primary flex-shrink-0" />
          <p className="text-[15px] font-semibold text-[#111111]">{t("searchProfiles.sectionTitle")}</p>
        </div>
        <div className="flex flex-col items-center text-center py-6 px-2">
          <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
            <MapPin className="w-5 h-5 text-[#9CA3AF]" />
          </div>
          <p className="text-[15px] font-semibold text-[#111111] mb-1" data-testid="text-empty-title">{t("searchProfiles.emptyTitle")}</p>
          <p className="text-[13px] text-[#9CA3AF] mb-5 leading-relaxed max-w-[260px]" data-testid="text-empty-subtitle">{t("searchProfiles.emptySubtitle")}</p>
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-full h-[48px] rounded-full bg-ha-primary text-white font-semibold text-[15px] hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
            data-testid="button-create-first-profile"
          >
            {t("searchProfiles.createFirst")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-testid="section-search-profiles">
        <div className="flex items-center gap-2 mb-2.5">
          <Search className="w-4 h-4 text-ha-primary flex-shrink-0" />
          <p className="text-[15px] font-semibold text-[#111111] flex-1">{t("searchProfiles.sectionTitle")}</p>
          <span className="text-[12px] text-[#C4C4C4]">{profiles.length}/{MAX_PROFILES}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-3 px-3.5 rounded-[12px] bg-white cursor-pointer hover:bg-[#F9FAFB] transition-colors active:scale-[0.99]"
              onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
              data-testid={`card-search-profile-${p.id}`}
            >
              <span className="w-2 h-2 rounded-full bg-ha-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {(() => {
                  const locationLine = getProfileLocationLine(p, t);
                  return (
                    <>
                      <p className="text-[14px] font-semibold text-[#111111]" data-testid={`text-profile-title-${p.id}`}>
                        {getProfileTitle(p, t, locale)}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5" data-testid={`text-profile-summary-${p.id}`}>
                        {getProfilePriceLine(p, t)}
                      </p>
                      {locationLine && (
                        <p className="text-[11px] text-[#B0B5BE] mt-0.5" data-testid={`text-profile-location-${p.id}`}>
                          {locationLine}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-ha-surface-hover transition-colors flex-shrink-0"
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
                      <Pencil className="w-4 h-4 text-ha-text-muted" />
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
          {canAdd ? (
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="w-full mt-2 h-[42px] rounded-full border border-dashed border-[#D1D5DB] text-[13px] font-semibold text-[#9CA3AF] hover:border-ha-primary hover:text-ha-primary transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
              data-testid="button-add-search-profile"
            >
              {t("searchProfiles.addProfile")}
            </button>
          ) : (
            <p className="mt-2 text-[12px] text-[#C4C4C4] text-center" data-testid="text-max-profiles-reached">
              {t("searchProfiles.maxReached")}
            </p>
          )}
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
    { id: "push", label: t("home.taskNotifications"), completed: status.notificationsEnabled, action: () => navigate("/settings/preferences") },
    { id: "buddy", label: t("home.taskSearchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/profile/edit/search_buddy_email") },
    { id: "search", label: t("home.taskOptimizeSearch"), completed: status.profileCreated, action: () => navigate("/dashboard/searches/new") },
    { id: "letter", label: t("home.taskPrepLetter"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/application-letter") },
    { id: "documents", label: t("home.taskDocuments"), completed: false, action: () => navigate("/tips/flow") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("home.accountCardTitle")}
      steps={steps}
      completedLabel={t("activation.completed")}
      subtitleFormat={t("home.completionSubtitle")}
      testId="card-account-completion"
    />
  );
}

function HomePrepCompletionCard({ accessToken, navigate, onTellFriends }: { accessToken: string | undefined; navigate: (path: string) => void; onTellFriends: () => void }) {
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
  const flowSteps = getFlowTipSteps();
  const readSet = getTipsReadSet();
  if (!status) return null;

  const getStrengthTask = (id: string) => strength?.tasks?.find(t => t.id === id);

  const steps: CompletionStep[] = [
    { id: "intro_letter", label: t("home.taskWriteLetter"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/application-letter") },
    { id: "tell_friends", label: t("home.taskTellFriends"), completed: false, action: onTellFriends },
    { id: "add_search", label: t("home.taskAddSearch"), completed: status.profileCreated, action: () => navigate("/dashboard/searches/new") },
    { id: "create_account", label: t("home.taskCreateAccount"), completed: true, action: () => {} },
    { id: "online_presence", label: t("home.taskOnlinePresence"), completed: false, action: () => navigate("/profile/details") },
    { id: "viewing_tips", label: t("home.taskViewingTips"), completed: readSet.has("besichtigung"), action: () => navigate("/tips/flow") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("home.prepCardTitle")}
      steps={steps}
      completedLabel={t("activation.completed")}
      subtitleFormat={t("home.completionSubtitle")}
      testId="card-prep-completion"
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
    { id: "push", label: t("activation.notificationsEnabled"), completed: status?.notificationsEnabled ?? false, action: () => navigate("/settings/preferences") },
    { id: "letter", label: t("strengthTask.applicationTemplate"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/application-letter") },
    { id: "buddy", label: t("strengthTask.searchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/profile/edit/search_buddy_email") },
    { id: "search", label: t("activation.profileCreated"), completed: status?.profileCreated ?? false, action: () => navigate("/dashboard/searches/new") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("profile.completeAccount")}
      steps={steps}
      completedLabel={t("profile.completedLabel")}
      testId="card-profile-account-completion"
    />
  );
}

function ProfileTipsCompletionCard({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();

  const flowSteps = getFlowTipSteps();
  const readSet = getTipsReadSet();

  const steps: CompletionStep[] = flowSteps.map((tip) => ({
    id: tip.id,
    label: tip.title,
    completed: readSet.has(tip.id),
    action: () => navigate("/tips/flow"),
  }));

  return (
    <ExpandableCompletionCard
      title={t("profile.tipsTitle")}
      steps={steps}
      completedLabel={t("profile.completedLabel")}
      testId="card-profile-tips-completion"
    />
  );
}

function ZoekopdrachtenSection({ profiles, navigate }: { profiles: SearchProfile[]; navigate: (path: string) => void }) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteSearchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
      toast({ title: t("filters.deleted") });
    },
    onError: (err: any) => {
      toast({ title: t("filters.deleteFailed"), description: err?.message ?? t("filters.retryDesc"), variant: "destructive" });
    },
  });

  const estimatedCount = profiles.length > 0
    ? Math.max(3, Math.min(25, profiles.length * 8))
    : null;

  return (
    <div data-testid="section-zoekopdrachten">
      <h2 className="text-[18px] font-semibold text-[#111111] mb-1.5" data-testid="text-zoekopdrachten-title">
        {t("home.zoekopdrachtenTitle")}
      </h2>
      <p className="text-[15px] text-[#6B7280] mb-4" data-testid="text-filters-expected">
        {estimatedCount
          ? t("home.filtersExpected", { count: estimatedCount })
          : t("home.filtersExpectedFallback")}
      </p>

      {profiles.length > 0 ? (
        <div className="flex flex-col gap-3" data-testid="card-zoekopdrachten">
          {profiles.map((p) => {
            const title = getProfileTitle(p, t, locale);
            const priceLine = getProfilePriceLine(p, t);
            const locationLine = getProfileLocationLine(p, t);
            return (
              <div
                key={p.id}
                className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] py-4 px-5 flex items-center cursor-pointer hover:border-[#D1D5DB] active:bg-[#FAFAFA] transition-all"
                onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
                data-testid={`row-zoekopdracht-${p.id}`}
              >
                <div className="w-2 h-2 rounded-full bg-ha-success flex-shrink-0 mr-3.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111111] truncate">{title}</p>
                  <p className="text-[14px] text-[#6B7280] mt-0.5 truncate">{priceLine}</p>
                  {locationLine && (
                    <p className="text-[14px] text-[#9CA3AF] mt-0.5 truncate">{locationLine}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F4F6] active:bg-[#E5E7EB] transition-colors flex-shrink-0 ml-2"
                      data-testid={`button-menu-${p.id}`}
                    >
                      <MoreVertical className="w-[18px] h-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    <DropdownMenuItem
                      onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
                      className="flex items-center gap-2.5 cursor-pointer"
                      data-testid={`menu-edit-${p.id}`}
                    >
                      <Pencil className="w-4 h-4 text-[#6B7280]" />
                      {t("home.menuEdit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="flex items-center gap-2.5 text-ha-danger focus:text-ha-danger cursor-pointer"
                      data-testid={`menu-delete-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("home.menuDelete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[16px] bg-white border border-[#E5E7EB] p-7 flex flex-col items-center text-center" data-testid="card-zoekopdrachten-empty">
          <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-5">
            <MapPin className="w-7 h-7 text-[#9CA3AF]" />
          </div>
          <p className="text-[18px] font-semibold text-[#111111] mb-2">{t("searchProfiles.emptyTitle")}</p>
          <p className="text-[15px] text-[#6B7280] mb-6 leading-relaxed max-w-[280px]">{t("searchProfiles.emptySubtitle")}</p>
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="h-[48px] px-8 rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
            data-testid="button-create-first-profile"
          >
            {t("home.createProfile")}
          </button>
        </div>
      )}

      {profiles.length > 0 && profiles.length < MAX_PROFILES && (
        <button
          onClick={() => navigate("/dashboard/searches/new")}
          className="w-full mt-3 h-[48px] rounded-[12px] bg-[#F3F4F6] text-[14px] font-semibold text-[#111111] hover:bg-[#E5E7EB] transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
          data-testid="button-add-zoekopdracht"
        >
          + {t("home.addZoekopdracht")}
        </button>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-[#F9FAFB] flex flex-col">
          <header className="sticky top-0 z-10">
            <div className="max-w-lg mx-auto flex items-center h-[48px] px-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                data-testid="button-delete-back"
              >
                <ArrowLeft className="w-4 h-4 text-[#111111]/80" />
              </button>
              <h1 className="text-[17px] font-semibold text-[#111111] flex-1 text-center pr-9">{t("home.deleteTitle")}</h1>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-[16px] bg-ha-primary flex items-center justify-center mb-6">
              <Trash2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-[22px] font-semibold text-[#111111] mb-3 text-center" data-testid="text-delete-title">
              {t("home.deleteTitle")}
            </h2>
            <p className="text-[15px] text-[#111111]/70 text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
              {t("home.deleteDesc")}
            </p>
            <div className="w-full max-w-[320px] flex flex-col gap-3">
              <button
                onClick={() => {
                  deleteMutation.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="w-full h-[48px] rounded-full bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
                data-testid="button-delete-yes"
              >
                {t("home.deleteYes")}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="w-full h-[48px] rounded-full border border-[#E5E7EB] text-[#111111] text-[16px] font-medium hover:bg-white/5 transition-colors"
                data-testid="button-delete-no"
              >
                {t("home.deleteNo")}
              </button>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

function RecentMatchesSection({
  accessToken,
  subscription,
  navigate,
  setActiveTab,
}: {
  accessToken: string | undefined;
  subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean };
  navigate: (path: string) => void;
  setActiveTab: (tab: TabKey) => void;
}) {
  const { t } = useTranslation();
  const [, nav] = useLocation();
  const hasAccess = subscription.isActive || subscription.isTrial;

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken && hasAccess,
    staleTime: 30_000,
  });

  const recentMatches = (apiMatchesQuery.data?.matches ?? [])
    .filter(m => m.title && m.url && m.listing_id)
    .sort((a, b) => {
      const dateA = a.first_seen_at || a.matched_at || "";
      const dateB = b.first_seen_at || b.matched_at || "";
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 6);

  return (
    <div data-testid="section-recent-matches">
      <h2 className="text-[18px] font-semibold text-[#111111] mb-3" data-testid="text-recent-matches-title">
        {t("home.recentMatchesTitle")}
      </h2>

      {!hasAccess ? (
        <div className="rounded-[16px] bg-white border border-[#E5E7EB] p-7 flex flex-col items-center text-center" data-testid="card-paywall">
          <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-5">
            <Lock className="w-7 h-7 text-[#9CA3AF]" />
          </div>
          <p className="text-[18px] font-semibold text-[#111111] mb-2" data-testid="text-paywall-title">
            {t("home.paywallTitle")}
          </p>
          <p className="text-[15px] text-[#6B7280] mb-6 leading-relaxed max-w-[280px]" data-testid="text-paywall-desc">
            {t("home.paywallDesc")}
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="h-[48px] px-8 rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
            data-testid="button-paywall-cta"
          >
            {t("home.paywallCta")}
          </button>
        </div>
      ) : recentMatches.length > 0 ? (
        <div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollSnapType: "x proximity" }}>
            {recentMatches.map((match) => (
              <ListingCardMini
                key={match.listing_id}
                match={match}
                onCardClick={() => nav(`/apply/${match.listing_id}`)}
              />
            ))}
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="mt-3 w-full h-[48px] rounded-[12px] border border-[#E5E7EB] text-[14px] font-semibold text-[#111111] hover:bg-[#F9FAFB] transition-colors active:scale-[0.98]"
            data-testid="button-view-all-matches"
          >
            {t("home.viewAll")}
          </button>
        </div>
      ) : (
        <div className="rounded-[16px] bg-white border border-[#E5E7EB] py-8 px-7 flex flex-col items-center text-center" data-testid="card-no-matches">
          <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-5">
            <Search className="w-7 h-7 text-[#9CA3AF]" />
          </div>
          <p className="text-[18px] font-semibold text-[#111111] mb-2">{t("home.noMatchesYetTitle")}</p>
          <p className="text-[15px] text-[#6B7280] leading-relaxed max-w-[280px]">{t("home.firstMatchesWillAppear")}</p>
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
  const { toast } = useToast();

  const profileDataQuery = useQuery<{ first_name?: string; application_template?: string; search_buddy_email?: string; search_buddy_status?: string }>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return {};
      const data = await res.json();
      return data;
    },
    enabled: !!accessToken,
  });
  const rawFirstName = profileDataQuery.data?.first_name || null;
  const firstName = rawFirstName ? rawFirstName.split(" ")[0] : null;
  const { data: referralData } = useQuery<{
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

  function getReferralUrl(): string {
    const code = referralData?.code;
    if (!code) return "";
    const isProd = window.location.hostname === "app.housalert.com";
    const base = isProd ? "https://app.housalert.com" : window.location.origin;
    return `${base}/?ref=${code}`;
  }

  async function handleReferralTap() {
    const url = getReferralUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "HousAlert — Vind sneller een woning",
          text: "Gebruik mijn link en krijg 25% korting op je eerste betaling.",
          url,
        });
        toast({ title: "Link klaar om te delen", description: "Je vriend krijgt 25% korting op de eerste betaling" });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link gekopieerd", description: "Je vriend krijgt 25% korting op de eerste betaling" });
    } catch {
      toast({ title: "Kopiëren mislukt", description: "Probeer het opnieuw", variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-col pb-8">
      <div className="px-5 pt-8 pb-4" data-testid="section-welcome">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[16px] font-semibold text-[#6B7280] tracking-[-0.01em]" data-testid="text-brand">HousAlert</span>
          <button
            onClick={() => navigate("/settings/preferences")}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F3F4F6] transition-colors"
            data-testid="button-help"
          >
            <HelpCircle className="w-5 h-5 text-[#9CA3AF]" />
          </button>
        </div>
        <h1 className="text-[34px] font-bold text-[#111111] tracking-[-0.025em] leading-[1.1]" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")} 👋
        </h1>
        <p className="text-[17px] text-[#4B5563] mt-2 leading-relaxed" data-testid="text-welcome-subtitle">
          {t("home.welcomeSubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-8 px-5 pt-2">
        <div
          className="rounded-[16px] bg-[#FDF8FA] border border-[#F3E1EA] p-5 cursor-pointer active:bg-[#FBF0F4] transition-colors"
          onClick={handleReferralTap}
          data-testid="card-home-referral"
        >
          <div className="flex items-start gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-full bg-ha-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Send className="w-[18px] h-[18px] text-ha-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-semibold text-[#111111] leading-snug" data-testid="text-referral-body">
                Geef een vriend 25% korting
              </p>
              <p className="text-[15px] text-[#6B7280] mt-1.5 leading-relaxed" data-testid="text-referral-label">
                Deel je persoonlijke link. Jij en je vriend krijgen korting op de eerste betaling.
              </p>
            </div>
          </div>
          <button
            className="w-full h-[48px] rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
            data-testid="button-home-referral-cta"
          >
            Deel je link
          </button>
        </div>

        <div data-testid="section-gamification">
          <h2 className="text-[18px] font-semibold text-[#111111] mb-4" data-testid="text-gamification-title">
            {t("home.gamificationTitle")}
          </h2>
          <div className="flex flex-col gap-3.5">
            <HomeAccountCompletionCard accessToken={accessToken} navigate={navigate} />
            <HomePrepCompletionCard accessToken={accessToken} navigate={navigate} onTellFriends={handleReferralTap} />
          </div>
        </div>

        <ZoekopdrachtenSection profiles={profiles} navigate={navigate} />

        <RecentMatchesSection
          accessToken={accessToken}
          subscription={subscription}
          navigate={navigate}
          setActiveTab={setActiveTab}
        />
      </div>

    </div>
  );
}


function MatchesTab({ accessToken, setActiveTab, initialTopTab }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void; initialTopTab?: MatchesTopTab | null }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [topTab, setTopTab] = useState<MatchesTopTab>(initialTopTab || "matches");
  const [favoriteListings, setFavoriteListings] = useState<ApiMatch[]>([]);
  const [appliedListings, setAppliedListings] = useState<ApiMatch[]>([]);
  const [favLoading, setFavLoading] = useState(true);
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: ["/api/matches"],
    queryFn: () => fetchApiMatches(accessToken!),
    enabled: !!accessToken && hasAccess,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const fetchFavoriteListings = useCallback(() => {
    if (!accessToken) return;
    setFavLoading(true);
    apiFetch("/api/favorites/listings", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.listings) setFavoriteListings(data.listings);
      })
      .catch(() => {})
      .finally(() => setFavLoading(false));
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
    if (!accessToken || !hasAccess) return;
    fetchFavoriteListings();
    fetchAppliedListings();
  }, [accessToken, hasAccess, fetchFavoriteListings, fetchAppliedListings]);

  useEffect(() => {
    if (!accessToken || !hasAccess) return;
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
  }, [accessToken, hasAccess]);

  useEffect(() => {
    if (!accessToken) return;
    if (!hasAccess) return;
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
  }, [accessToken, hasAccess]);

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

  const matches = apiMatchesQuery.data?.matches ?? [];
  const totalCount = apiMatchesQuery.data?.totalCount ?? 0;

  const refreshStatuses = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const allMatchesSorted = [...matches].sort((a, b) => {
    const dateA = a.first_seen_at || a.matched_at || "";
    const dateB = b.first_seen_at || b.matched_at || "";
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const removeApplied = useCallback(async (listingId: string) => {
    if (!accessToken) return;
    const prevListings = appliedListings;
    setAppliedListings((prev) => prev.filter((l) => l.listing_id !== listingId));
    const localApplied = safeGetSet(MATCH_APPLIED_KEY);
    localApplied.delete(listingId);
    safeSetSet(MATCH_APPLIED_KEY, localApplied);
    try {
      const res = await apiFetch(`/api/matches/${listingId}/applied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ applied: false }),
      });
      if (!res.ok) throw new Error("request failed");
      toast({ title: t("matches.responseRemoved") });
    } catch {
      setAppliedListings(prevListings);
      localApplied.add(listingId);
      safeSetSet(MATCH_APPLIED_KEY, localApplied);
      fetchAppliedListings();
    }
  }, [accessToken, appliedListings, fetchAppliedListings, t, toast]);

  function formatRespondedDate(match: ApiMatch): string {
    const dateStr = match.matched_at || match.first_seen_at;
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-GB" : "nl-NL";
    const formatted = d.toLocaleDateString(intlLocale, { day: "numeric", month: "long", year: "numeric" });
    return t("matches.respondedOn", { date: formatted });
  }

  const topTabs: { key: MatchesTopTab; label: string }[] = [
    { key: "matches", label: t("matches.title") },
    { key: "gereageerd", label: t("matches.subtabs.applied") },
    { key: "favorieten", label: t("nav.favorites") },
  ];

  if (!hasAccess) {
    return (
      <div className="flex flex-col pb-8" data-testid="matches-locked">
        <div className="sticky top-0 z-10 bg-white px-5 pt-8 pb-4">
          <h1 className="text-page-title">{t("matches.title")}</h1>
        </div>

        <div className="px-5 pt-16">
          <div className="flex flex-col items-center text-center px-6 pb-4">
            <div className="w-16 h-16 rounded-full bg-[#FDF1F6] flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-ha-primary" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#111111] mb-2.5" data-testid="text-locked-headline">
              {t("matches.locked.headline")}
            </h2>
            <p className="text-[15px] text-[#6B7280] leading-relaxed max-w-[280px] mb-8" data-testid="text-locked-desc">
              {t("matches.locked.desc")}
            </p>
            <button
              onClick={() => navigate("/paywall")}
              className="h-[48px] px-10 rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
              data-testid="button-locked-subscribe"
            >
              {t("matches.locked.cta")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-8 pb-4">
        <h1 className="text-page-title mb-4">{t("matches.title")}</h1>
        <div className="flex items-center gap-2" data-testid="matches-top-tabs">
          {topTabs.map(({ key, label }) => {
            const isActive = topTab === key;
            return (
              <button
                key={key}
                onClick={() => setTopTab(key)}
                className={`px-3.5 py-[6px] text-[13px] rounded-full border transition-all duration-200 active:scale-[0.96] ${
                  isActive
                    ? "bg-[#111111] text-white font-semibold border-[#111111]"
                    : "bg-[#F3F4F6] text-[#111111] font-medium border-transparent"
                }`}
                data-testid={`tab-matches-${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 flex flex-col pt-1">
        {topTab === "matches" && (
          <>
            {apiMatchesQuery.isLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-[#F3F4F6] rounded-[16px]" style={{ aspectRatio: "4/3" }} />
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="h-4 bg-[#F3F4F6] rounded-full w-3/4" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-1/2" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-2/5" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : apiMatchesQuery.isError ? (
              <div className="py-16 flex flex-col items-center text-center gap-4 px-4">
                <div className="w-14 h-14 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-1">
                  <AlertCircle className="w-7 h-7 text-[#9CA3AF]" />
                </div>
                <p className="text-[18px] font-semibold text-[#111111]">{t("matches.loadError")}</p>
                <p className="text-[15px] text-[#6B7280] leading-relaxed max-w-[280px]">{t("matches.loadErrorDesc")}</p>
                <button
                  onClick={() => apiMatchesQuery.refetch()}
                  className="text-[15px] font-semibold text-ha-primary mt-2 active:opacity-70 transition-opacity"
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
                onCtaClick={() => setActiveTab("zoek")}
                testId="empty-matches"
              />
            ) : (
              <div className="flex flex-col gap-6">
                {allMatchesSorted.map((m) => (
                  <ListingCardFull
                    key={m.listing_id}
                    match={m}
                    isFavorited={favoriteIds.has(m.listing_id)}
                    onToggleFavorite={toggleFavorite}
                    onCardClick={() => {
                      markViewed(m.listing_id);
                      refreshStatuses();
                      navigate(`/apply/${m.listing_id}`);
                    }}
                    locked={!hasAccess}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {topTab === "gereageerd" && (
          <>
            {appliedListings.length === 0 ? (
              <EmptyState
                illustration={EMPTY_STATE_IMAGES.noApplications}
                title={t("matches.emptyApplied.title")}
                description={t("matches.emptyApplied.desc")}
                testId="empty-gereageerd-tab"
              />
            ) : (
              <div className="flex flex-col gap-6">
                {appliedListings.map((m) => (
                  <div key={m.listing_id} data-testid={`card-applied-${m.listing_id}`}>
                    <ListingCardFull
                      match={m}
                      isFavorited={favoriteIds.has(m.listing_id)}
                      onToggleFavorite={toggleFavorite}
                      onCardClick={() => {
                        markViewed(m.listing_id);
                        navigate(`/apply/${m.listing_id}`);
                      }}
                      locked={!hasAccess}
                      respondedLabel={formatRespondedDate(m)}
                      onRemoveResponse={() => removeApplied(m.listing_id)}
                      removeResponseLabel={t("matches.removeResponse")}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {topTab === "favorieten" && (
          <>
            {favLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-[#F3F4F6] rounded-[16px]" style={{ aspectRatio: "4/3" }} />
                    <div className="pt-3 flex flex-col gap-2">
                      <div className="h-4 bg-[#F3F4F6] rounded-full w-3/4" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-1/2" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-2/5" />
                      <div className="h-3 bg-[#F3F4F6] rounded-full w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : favoriteListings.length === 0 ? (
              <EmptyState
                illustration={EMPTY_STATE_IMAGES.noFilters}
                title={t("matches.emptyFavorites.title")}
                description={t("matches.emptyFavorites.desc")}
                testId="empty-favorieten-tab"
              />
            ) : (
              <div className="flex flex-col gap-6">
                {favoriteListings.map((m) => (
                  <ListingCardFull
                    key={m.listing_id}
                    match={m}
                    isFavorited={favoriteIds.has(m.listing_id)}
                    onToggleFavorite={toggleFavorite}
                    onCardClick={() => {
                      markViewed(m.listing_id);
                      navigate(`/apply/${m.listing_id}`);
                    }}
                    locked={!hasAccess}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmScreen({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-[#F9FAFB] flex flex-col">
      <header className="sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center h-[48px] px-4">
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-delete-back"
          >
            <ArrowLeft className="w-4 h-4 text-[#111111]/80" />
          </button>
          <h1 className="text-[17px] text-title text-[#111111] flex-1 tracking-wide">{t("filters.deleteTitle")}</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-[--ha-card-inner-radius] bg-ha-primary flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-[22px] text-title text-[#111111] mb-3 text-center" data-testid="text-delete-title">
          {t("filters.deleteQuestion")}
        </h2>
        <p className="text-[15px] text-[#111111]/70 text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-body">
          {t("filters.deleteConfirm")}
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold transition-colors hover:bg-ha-primary-hover"
            data-testid="button-delete-confirm"
          >
            {t("filters.deleteYes")}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[48px] rounded-[--ha-btn-radius] border border-white/20 text-[#111111] text-[16px] font-medium hover:bg-white/5 transition-colors"
            data-testid="button-delete-cancel"
          >
            {t("filters.deleteNo")}
          </button>
        </div>
      </main>
    </div>
  );
}


function ProfilePhotoSheet({ photoUrl, onClose, onUpload, onRemove }: { photoUrl: string | null; onClose: () => void; onUpload: (file: File) => void; onRemove: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-[--ha-card-radius] pb-10 pt-3 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-ha-surface-hover rounded-full mx-auto mb-6" />
        <div className="px-4">
          <h3 className="text-[18px] text-title text-[#111111] mb-6">{t("profile.photo.title")}</h3>

          {photoUrl && (
            <div className="flex justify-center mb-5">
              <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" data-testid="img-current-photo" />
            </div>
          )}

          <div className="flex flex-col">
            <label className="w-full h-[48px] flex items-center justify-center gap-2 rounded-[--ha-btn-radius] bg-ha-primary text-white text-[15px] font-semibold cursor-pointer active:bg-ha-primary-hover transition-colors">
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
                className="mt-3 w-full h-[48px] flex items-center justify-center gap-2 rounded-[--ha-btn-radius] border border-[#E5E7EB] text-[#111111] text-[15px] font-medium active:bg-ha-surface-hover transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                {t("profile.photo.remove")}
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[48px] flex items-center justify-center rounded-[--ha-btn-radius] text-[#111111]/70 text-[15px] font-medium active:bg-ha-surface-hover transition-colors"
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


const BLOCKED_SOURCE_DISPLAY: Record<string, string> = {
  immowelt: "immowelt.de",
  kleinanzeigen: "kleinanzeigen.de",
  "wg-gesucht": "wg-gesucht.de",
  wohnungsboerse: "wohnungsboerse.net",
  immoscout: "immobilienscout24.de",
  immonet: "immonet.de",
  rentola: "rentola.de",
  nestpick: "nestpick.com",
  pararius: "pararius.nl",
  funda: "funda.nl",
  kamernet: "kamernet.nl",
};

function formatBlockedSourceDisplay(source: string): string {
  return BLOCKED_SOURCE_DISPLAY[source] || source;
}

function ProfielTab({ user, signOut, navigate, subscription, setActiveTab, canonicalStats, computedAppliedCount }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null; currentPeriodEndsAt: string | null; cancelAtPeriodEnd: boolean }; setActiveTab: (tab: TabKey) => void; canonicalStats?: CanonicalStats; computedAppliedCount: number }) {
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.replace("/login");
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

  const notifQuery = useQuery<{ email_enabled: boolean; push_enabled: boolean }>({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { email_enabled: true, push_enabled: false };
      const res = await apiFetch("/api/notifications/settings", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const blockedSourcesQuery = useQuery<{ blockedSources: string[] }>({
    queryKey: ["/api/blocked-sources"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return { blockedSources: [] };
      const res = await apiFetch("/api/blocked-sources", { headers: { Authorization: `Bearer ${session.access_token}` } });
      return res.json();
    },
  });

  const blockedSources = blockedSourcesQuery.data?.blockedSources ?? [];

  async function handleUnblock(source: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    try {
      const res = await apiFetch(`/api/blocked-sources/${encodeURIComponent(source)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("unblock failed");
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: t("profile.blockedSources.unblocked") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleNotifToggle(key: "push_enabled" | "email_enabled", val: boolean) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    try {
      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [key]: val }),
      });
      if (!res.ok) throw new Error("save failed");
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
    }
  }

  const pd = profileDataQuery.data;

  useEffect(() => {
    if (pd?.language && (pd.language === "de" || pd.language === "en" || pd.language === "nl") && pd.language !== locale) {
      setLocale(pd.language);
    }
  }, [pd?.language]);

  useEffect(() => {
    if (!showLangDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLangDropdown]);

  async function handleLanguageChange(code: "de" | "en" | "nl") {
    setShowLangDropdown(false);
    setLocale(code);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ language: code }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  async function handleCopyLetter() {
    const letter = pd?.application_template;
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      toast({ title: t("profile.letterCopied") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }

  const LANG_OPTIONS: { code: "nl" | "de" | "en"; label: string; flag: string }[] = [
    { code: "nl", label: "Nederlands", flag: "🇳🇱" },
    { code: "en", label: "Engels", flag: "🇬🇧" },
    { code: "de", label: "Duits", flag: "🇩🇪" },
  ];
  const currentLangLabel = LANG_OPTIONS.find(o => o.code === locale)?.label || locale;

  const pushEnabled = notifQuery.data?.push_enabled ?? false;
  const emailEnabled = notifQuery.data?.email_enabled ?? true;
  const buddyEmail = pd?.search_buddy_email || "";
  const buddyStatus = pd?.search_buddy_status || "";
  const letterPreview = pd?.application_template || "";

  const isCanceled = subscription.status === "canceled" || subscription.cancelAtPeriodEnd;
  const renewalDate = subscription.currentPeriodEndsAt || subscription.trialEndsAt;
  function formatSubDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(locale === "nl" ? "nl-NL" : locale === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  function getPlanLabel(plan: string | null) {
    switch (plan) {
      case "monthly": return t("subscription.planLabel.monthly");
      case "two_month": return t("subscription.planLabel.twoMonth");
      case "three_month": return t("subscription.planLabel.threeMonth");
      default: return t("subscription.planLabel.default");
    }
  }

  const SectionTitle = ({ children }: { children: string }) => (
    <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide px-1 mb-2.5">{children}</p>
  );

  const CardRow = ({ label, value, onClick, trailing, testId, last }: { label: string; value?: string; onClick?: () => void; trailing?: any; testId?: string; last?: boolean }) => {
    const Wrapper = onClick ? "button" : "div";
    return (
      <>
        <Wrapper
          {...(onClick ? { type: "button" as const } : {})}
          onClick={onClick}
          className={`w-full flex items-center justify-between min-h-[64px] px-5 py-4 text-left ${onClick ? "active:bg-[#F9FAFB] transition-colors" : ""}`}
          data-testid={testId}
        >
          <span className="text-[15px] font-medium text-[#111111]">{label}</span>
          <div className="flex items-center gap-2">
            {value && <span className="text-[14px] text-[#6B7280]">{value}</span>}
            {trailing}
            {onClick && !trailing && <ChevronRight className="w-[18px] h-[18px] text-[#D1D5DB] flex-shrink-0" />}
          </div>
        </Wrapper>
        {!last && <div className="h-px bg-[#F3F4F6] mx-5" />}
      </>
    );
  };

  const ToggleRow = ({ label, subtitle, checked, onToggle, testId, last }: { label: string; subtitle?: string; checked: boolean; onToggle: (v: boolean) => void; testId?: string; last?: boolean }) => (
    <>
      <div className="flex items-center justify-between min-h-[64px] px-5 py-4" data-testid={testId}>
        <div className="flex-1 min-w-0">
          <span className="text-[15px] font-medium text-[#111111]">{label}</span>
          {subtitle && <p className="text-[13px] text-[#6B7280] mt-0.5 leading-tight">{subtitle}</p>}
        </div>
        <button
          onClick={() => onToggle(!checked)}
          className={`relative w-[48px] h-[28px] rounded-full transition-colors duration-200 flex-shrink-0 ml-3 ${checked ? "bg-ha-primary" : "bg-[#D1D5DB]"}`}
          role="switch"
          aria-checked={checked}
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          <span className={`absolute top-[2px] w-[24px] h-[24px] rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "left-[22px]" : "left-[2px]"}`} />
        </button>
      </div>
      {!last && <div className="h-px bg-[#F3F4F6] mx-5" />}
    </>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F9FAFB]">
      <div className="px-5 pt-8 pb-3">
        <h1 className="text-page-title" data-testid="text-profile-title">{t("profile.title")}</h1>
      </div>

      <div className="max-w-[480px] mx-auto px-5 pt-3 pb-8">
        <div className="flex flex-col gap-6">

          {/* 1. Account */}
          <div>
            <SectionTitle>{t("settings.sectionAccount")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <CardRow label="E-mail" value={user.email} testId="row-account-email" />
              <div className="h-px bg-[#F3F4F6] mx-5" />
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="w-full flex items-center justify-between min-h-[54px] px-5 py-3 text-left active:bg-[#F9FAFB] transition-colors rounded-b-[16px]"
                  data-testid="row-account-language"
                >
                  <span className="text-[15px] font-medium text-[#111111]">{t("profile.language")}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] text-[#6B7280]">{currentLangLabel}</span>
                    <ChevronRight className={`w-[18px] h-[18px] text-[#D1D5DB] flex-shrink-0 transition-transform duration-200 ${showLangDropdown ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {showLangDropdown && (
                  <div className="absolute right-3 top-[52px] z-50 w-[200px] bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                    {LANG_OPTIONS.map((lang, i) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full flex items-center gap-3 px-4 h-[46px] text-left transition-colors ${locale === lang.code ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB] active:bg-[#F3F4F6]"} ${i > 0 ? "border-t border-[#F3F4F6]" : ""}`}
                        data-testid={`button-lang-${lang.code}`}
                      >
                        <span className="text-[18px]">{lang.flag}</span>
                        <span className="text-[15px] font-medium text-[#111111] flex-1">{lang.label}</span>
                        {locale === lang.code && (
                          <div className="w-5 h-5 rounded-full bg-ha-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Notificaties */}
          <div>
            <SectionTitle>{t("profile.notifications")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              <ToggleRow
                label={t("profile.pushNotifications")}
                checked={pushEnabled}
                onToggle={(v) => handleNotifToggle("push_enabled", v)}
                testId="row-notif-push"
              />
              <ToggleRow
                label={t("profile.emailNotifications")}
                checked={emailEnabled}
                onToggle={(v) => handleNotifToggle("email_enabled", v)}
                testId="row-notif-email"
                last
              />
            </div>
          </div>

          {/* 3. Zoekbuddy */}
          <div>
            <SectionTitle>{t("profile.searchBuddy")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              {buddyEmail ? (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                      <User className="w-[20px] h-[20px] text-[#6B7280]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-[#111111] truncate" data-testid="text-buddy-email">{buddyEmail}</p>
                      <p className="text-[13px] text-[#6B7280] mt-0.5">
                        {buddyStatus === "active" ? t("profile.searchBuddyReceives")
                          : buddyStatus === "invited" ? t("profile.searchBuddyReceives")
                          : buddyStatus || t("profile.searchBuddyReceives")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/profile/edit/search_buddy_email")}
                    className="mt-3 text-[13px] text-ha-primary font-semibold active:opacity-70 transition-opacity"
                    data-testid="button-buddy-manage"
                  >
                    {t("profile.editButton")}
                  </button>
                </div>
              ) : (
                <div className="px-5 py-5">
                  <p className="text-[14px] text-[#6B7280] leading-relaxed mb-4">{t("profile.noBuddyYet")}</p>
                  <button
                    onClick={() => navigate("/profile/edit/search_buddy_email")}
                    className="h-[44px] px-6 rounded-[12px] bg-ha-primary text-white text-[14px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
                    data-testid="button-buddy-add"
                  >
                    {t("profile.addBuddy")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. Standaard reactiebrief */}
          <div>
            <SectionTitle>{t("profile.reactionLetter")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              {letterPreview ? (
                <div className="px-5 pt-5 pb-4">
                  <p className="text-[14px] text-[#4B5563] leading-[1.6] line-clamp-4 whitespace-pre-line" data-testid="text-letter-preview">{letterPreview}</p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#F3F4F6]">
                    <button
                      onClick={() => navigate("/application-letter")}
                      className="text-[13px] font-semibold text-ha-primary active:opacity-70 transition-opacity"
                      data-testid="button-letter-edit"
                    >
                      {t("profile.editButton")}
                    </button>
                    <button
                      onClick={handleCopyLetter}
                      className="text-[13px] font-semibold text-ha-primary active:opacity-70 transition-opacity"
                      data-testid="button-letter-copy"
                    >
                      {t("profile.copyButton")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => navigate("/application-letter")}
                  className="w-full flex items-center justify-between h-[50px] px-4 active:bg-[#F9FAFB] transition-colors"
                  data-testid="button-letter-write"
                >
                  <span className="text-[15px] font-medium text-[#111111]">{t("profile.writeLetter")}</span>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* 5. Uitgesloten websites */}
          <div>
            <SectionTitle>{t("profile.blockedSources.title")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden" data-testid="section-blocked-sources">
              {blockedSources.length === 0 ? (
                <div className="px-5 py-4">
                  <p className="text-[14px] text-[#6B7280]">{t("profile.blockedSources.empty")}</p>
                </div>
              ) : (
                blockedSources.map((source, i) => (
                  <div key={source}>
                    {i > 0 && <div className="h-px bg-[#F3F4F6] mx-4" />}
                    <div className="flex items-center justify-between h-[50px] px-4">
                      <span className="text-[15px] text-[#111111]">{formatBlockedSourceDisplay(source)}</span>
                      <button
                        onClick={() => handleUnblock(source)}
                        className="flex items-center gap-1 text-[13px] text-ha-primary font-medium active:opacity-70 transition-opacity"
                        data-testid={`button-unblock-${source}`}
                      >
                        <X className="w-3.5 h-3.5" />
                        {t("profile.blockedSources.unblock")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 6. Abonnementen — centered inline */}
          <div>
            <SectionTitle>{t("profile.subscription")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              {!(subscription.isActive || subscription.isTrial) ? (
                <div className="px-5 py-8 flex flex-col items-center text-center" data-testid="card-subscription-locked">
                  <div className="w-14 h-14 rounded-full bg-[#FDF1F6] flex items-center justify-center mb-5">
                    <Lock className="w-7 h-7 text-ha-primary" />
                  </div>
                  <p className="text-[18px] font-semibold text-[#111111]" data-testid="text-sub-locked-title">{t("profile.subLocked.title")}</p>
                  <p className="text-[15px] text-[#6B7280] mt-2 leading-relaxed max-w-[280px]">{t("profile.subLocked.desc")}</p>
                  <button
                    onClick={() => navigate("/paywall")}
                    className="mt-6 h-[48px] px-8 rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
                    data-testid="button-sub-locked-cta"
                  >
                    {t("profile.subLocked.cta")}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center" data-testid="card-subscription-active">
                  <div className="px-5 pt-8 pb-6 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-ha-primary/10 flex items-center justify-center mb-5">
                      <Crown className="w-7 h-7 text-ha-primary" />
                    </div>
                    <p className="text-[18px] font-semibold text-[#111111]" data-testid="text-plan-name">
                      {subscription.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription.plan)}
                    </p>
                    {renewalDate && (
                      <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed max-w-[300px]" data-testid="text-sub-renewal">
                        {subscription.isTrial
                          ? `${t("profile.subInline.trialEndsOn")} ${formatSubDate(renewalDate)}`
                          : isCanceled
                          ? `${t("profile.subInline.endsOn")} ${formatSubDate(renewalDate)}`
                          : `${t("profile.subInline.autoRenewal")} ${formatSubDate(renewalDate)}`}
                      </p>
                    )}
                  </div>
                  {!isCanceled && subscription.isActive && !subscription.isTrial && (
                    <>
                      <div className="h-px bg-[#F3F4F6] w-[calc(100%-32px)]" />
                      <button
                        onClick={() => navigate("/account/subscription/cancel")}
                        className="w-full py-3.5 flex items-center justify-center text-[14px] font-medium text-[#9CA3AF] active:bg-[#F9FAFB] transition-colors"
                        data-testid="button-cancel-subscription"
                      >
                        {t("profile.subInline.cancelCta")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 7. Meer info & hulp */}
          <div>
            <SectionTitle>{t("profile.helpTitle")}</SectionTitle>
            <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
              {[
                { label: t("profile.helpFeedback"), action: () => { window.location.href = "mailto:support@housalert.com?subject=Feedback"; }, icon: <Send className="w-6 h-6 text-[#111111]" strokeWidth={1.6} />, testId: "button-help-feedback" },
                { label: t("profile.helpFaq"), action: () => { window.location.href = "mailto:support@housalert.com"; }, icon: <HelpCircle className="w-6 h-6 text-[#111111]" strokeWidth={1.6} />, testId: "button-help-faq" },
                { label: t("profile.helpPrivacy"), action: () => navigate("/datenschutz"), icon: <Shield className="w-6 h-6 text-[#111111]" strokeWidth={1.6} />, testId: "button-help-privacy" },
                { label: t("settings.termsConditions"), action: () => navigate("/terms"), icon: <FileText className="w-6 h-6 text-[#111111]" strokeWidth={1.6} />, testId: "button-help-terms" },
              ].map((row, ri, arr) => (
                <div key={ri}>
                  {ri > 0 && <div className="h-px bg-[#F3F4F6] mx-5" />}
                  <button
                    onClick={row.action}
                    className="w-full flex items-center gap-[14px] min-h-[64px] px-5 py-4 text-left active:bg-[#F9FAFB] transition-colors"
                    data-testid={row.testId}
                  >
                    {row.icon}
                    <p className="text-[15px] font-medium text-[#111111] flex-1">{row.label}</p>
                    <ChevronRight className="w-[18px] h-[18px] text-[#D1D5DB] flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && (
            <div>
              <SectionTitle>Admin</SectionTitle>
              <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                <button
                  onClick={() => navigate("/admin/image-audit")}
                  className="w-full flex items-center gap-[14px] min-h-[64px] px-5 py-4 text-left active:bg-[#F9FAFB] transition-colors"
                  data-testid="button-admin-image-audit"
                >
                  <Image className="w-6 h-6 text-[#111111]" strokeWidth={1.6} />
                  <p className="text-[15px] font-medium text-[#111111] flex-1">Beeldkwaliteit listings</p>
                  <ChevronRight className="w-[18px] h-[18px] text-[#D1D5DB] flex-shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* 8. Uitloggen */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className={`w-full h-[48px] rounded-[12px] bg-[#F3F4F6] text-[#111111] text-[15px] font-semibold active:scale-[0.97] transition-transform hover:bg-[#E5E7EB] ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
            data-testid="button-profile-logout"
          >
            {signingOut ? t("profile.signingOut") : t("profile.logout")}
          </button>

          <div className="flex flex-col items-center gap-3 pt-2 pb-2">
            <button
              onClick={() => navigate("/account/delete")}
              className="text-[13px] text-[#9CA3AF] active:opacity-70 transition-opacity"
              data-testid="button-profile-delete-account"
            >
              {t("profile.deleteAccount")}
            </button>
            <p className="text-[13px] text-[#D1D5DB]">HousAlert v1.0.0</p>
          </div>

          {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && <div className="h-16" />}
        </div>
      </div>

      {(user?.email?.toLowerCase() === "martin.essie87@gmail.com") && (
        <button
          onClick={() => navigate("/admin/portal")}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] left-1/2 -translate-x-1/2 z-40 bg-ha-profile-header text-white text-[14px] font-medium px-4 py-2.5 rounded-[--ha-btn-radius] shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-95 transition-transform"
          data-testid="button-admin-portal"
        >
          {t("profile.adminMode")}
        </button>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-[#F9FAFB] flex flex-col">
          <header className="sticky top-0 z-10">
            <div className="max-w-lg mx-auto flex items-center h-[48px] px-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                data-testid="button-logout-back"
              >
                <ArrowLeft className="w-4 h-4 text-[#111111]/80" />
              </button>
              <h1 className="text-[17px] font-semibold text-[#111111] flex-1 text-center pr-9">{t("profile.logoutConfirm")}</h1>
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-[16px] bg-[#F3F4F6] flex items-center justify-center mb-6">
              <LogOut className="w-8 h-8 text-[#6B7280]" />
            </div>
            <h2 className="text-[22px] font-semibold text-[#111111] mb-3 text-center">{t("profile.logoutConfirm")}</h2>
            <p className="text-[15px] text-[#111111]/70 text-center max-w-[320px] mb-10 leading-relaxed">{t("profile.logoutDesc")}</p>
            <div className="w-full max-w-[320px] flex flex-col gap-3">
              <button
                onClick={handleLogout}
                className="w-full h-[48px] rounded-full bg-ha-danger text-white text-[16px] font-semibold transition-colors active:scale-[0.98]"
                data-testid="button-profile-logout-confirm"
              >
                {t("profile.logoutYes")}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full h-[48px] rounded-full border border-[#E5E7EB] text-[#111111] text-[16px] font-medium hover:bg-white/5 transition-colors"
                data-testid="button-profile-logout-cancel"
              >
                {t("profileDetails.cancel")}
              </button>
            </div>
          </main>
        </div>
      )}

    </div>
  );
}

function ZoekTab({ profiles, navigate }: { profiles: SearchProfile[]; navigate: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-8 pb-5">
        <h1 className="text-page-title">{t("nav.search")}</h1>
      </div>
      <div className="px-5 pt-1">
        <ZoekopdrachtenSection profiles={profiles} navigate={navigate} />
      </div>
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; labelKey: string; Icon: any }[] = [
  { key: "home", labelKey: "nav.home", Icon: Home },
  { key: "matches", labelKey: "nav.matches", Icon: Search },
  { key: "tips", labelKey: "nav.tips", Icon: Sparkles },
  { key: "zoek", labelKey: "nav.search", Icon: MapPin },
  { key: "profiel", labelKey: "nav.profile", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [initialMatchesTopTab] = useState<MatchesTopTab | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "favorieten") return "favorieten";
    if (tab === "gereageerd") return "gereageerd";
    return null;
  });
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "favorieten" || tab === "gereageerd") return "matches";
    if (tab && ["home", "matches", "tips", "zoek", "profiel"].includes(tab)) {
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-white animate-pulse" />
          <p className="text-[#111111]/70 text-sm">{t("common.loading")}</p>
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-[100px]">
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
          <MatchesTab accessToken={accessToken} setActiveTab={setActiveTab} initialTopTab={initialMatchesTopTab} />
        )}
        {activeTab === "tips" && <TipsPage navigate={navigate} />}
        {activeTab === "zoek" && (
          <ZoekTab profiles={profiles} navigate={navigate} />
        )}
        {activeTab === "profiel" && (
          <ProfielTab
            user={user}
            signOut={signOut}
            navigate={navigate}
            subscription={{ status: sub.status, isTrial: sub.isTrial, isActive: sub.isActive, isExpired: sub.isExpired, plan: sub.plan, trialEndsAt: sub.trialEndsAt, currentPeriodEndsAt: sub.currentPeriodEndsAt, cancelAtPeriodEnd: sub.cancelAtPeriodEnd }}
            setActiveTab={setActiveTab}
            canonicalStats={apiMatchesQuery.data?.canonicalStats}
            computedAppliedCount={computedAppliedCount}
          />
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <nav className="max-w-xl mx-auto flex h-[72px]" data-testid="bottom-nav">
          {TAB_CONFIG.map(({ key, labelKey, Icon }) => {
            const isActive = activeTab === key;
            const isProfileWithPhoto = key === "profiel" && !!tabPhotoUrl;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 active:opacity-70 transition-opacity"
                data-testid={`tab-${key}`}
              >
                {isProfileWithPhoto ? (
                  <div className={`w-[28px] h-[28px] rounded-full overflow-hidden ${isActive ? "ring-[2px] ring-ha-primary ring-offset-1 ring-offset-white" : ""}`}>
                    <img src={tabPhotoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Icon className={`w-[23px] h-[23px] transition-colors ${isActive ? "text-ha-primary" : "text-[#9CA3AF]"}`} strokeWidth={isActive ? 2.2 : 1.7} />
                )}
                <span className={`text-[12px] leading-tight transition-colors ${isActive ? "font-semibold text-ha-primary" : "font-medium text-[#9CA3AF]"}`}>
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
