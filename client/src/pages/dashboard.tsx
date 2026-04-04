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
  Eye,
  Send,
  ArrowLeft,
  Camera,
  Pencil,
  Users,
  Rocket,
  FileText,
  Check,
  MoreVertical,
  Shield,
  HelpCircle,
  Heart,
  Lock,
} from "lucide-react";
import { ExpandableCompletionCard, type CompletionStep } from "@/components/expandable-completion-card";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import TipsPage, { getTipConfig, getTipsReadSet } from "@/pages/tips";
import { getFlowTipSteps } from "@/pages/tips-flow";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusCard, StatusCardInline } from "@/components/status-card";
import { ListingCardFull, ListingCardMini } from "@/components/listing-card";

const MAX_PROFILES = 4;

type TabKey = "home" | "matches" | "favorieten" | "profiel" | "tips";
type MatchSubTab = "nieuw" | "bekeken" | "gereageerd" | "favorieten";

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
        <div className="rounded-[--ha-card-radius] bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-ha-primary flex-shrink-0" />
            <p className="text-[17px] font-bold text-[#111111] flex-1">{t("searchProfiles.sectionTitle")}</p>
            <span className="text-[12px] font-semibold text-[#9CA3AF]">0/{MAX_PROFILES}</span>
          </div>
          <div className="flex flex-col items-center text-center py-6 px-4">
            <div className="w-12 h-12 rounded-full bg-[#F7F7F7] flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <p className="text-[16px] font-bold text-[#111111] mb-1" data-testid="text-empty-title">{t("searchProfiles.emptyTitle")}</p>
            <p className="text-[14px] text-[#4B5563] mb-4" data-testid="text-empty-subtitle">{t("searchProfiles.emptySubtitle")}</p>
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="px-5 py-2.5 rounded-full bg-ha-primary text-white font-bold text-[15px] hover:opacity-90 transition-opacity"
              data-testid="button-create-first-profile"
            >
              {t("searchProfiles.createFirst")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-testid="section-search-profiles">
        <div className="rounded-[--ha-card-radius] bg-white p-5">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-ha-primary flex-shrink-0" />
            <p className="text-[17px] font-bold text-[#111111] flex-1">{t("searchProfiles.sectionTitle")}</p>
            <span className="text-[12px] font-semibold text-[#9CA3AF]">{profiles.length}/{MAX_PROFILES}</span>
          </div>
          <div className="flex flex-col gap-2">
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-3.5 px-4 rounded-[--ha-card-inner-radius] bg-[#F7F7F7] cursor-pointer hover:bg-[#F0F0F0] transition-colors"
                onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
                data-testid={`card-search-profile-${p.id}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-ha-success flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-[#111111] line-clamp-1" data-testid={`text-profile-title-${p.id}`}>
                    {getProfileTitle(p, t, locale)}
                  </p>
                  <p className="text-[13px] text-[#4B5563] mt-0.5 line-clamp-1" data-testid={`text-profile-summary-${p.id}`}>
                    {getProfileSummary(p, t)}
                  </p>
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
              className="w-full mt-3 py-3 rounded-[--ha-card-inner-radius] bg-ha-primary/5 border border-ha-primary/20 text-[15px] font-semibold text-ha-primary hover:bg-ha-primary/10 transition-colors flex items-center justify-center gap-1.5"
              data-testid="button-add-search-profile"
            >
              {t("searchProfiles.addProfile")}
            </button>
          ) : (
            <p className="mt-3 text-[13px] text-[#9CA3AF] text-center" data-testid="text-max-profiles-reached">
              {t("searchProfiles.maxReached")}
            </p>
          )}
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
    { id: "push", label: t("activation.notificationsEnabled"), completed: status.notificationsEnabled, action: () => navigate("/settings/preferences") },
    { id: "letter", label: t("strengthTask.applicationTemplate"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/application-letter") },
    { id: "buddy", label: t("strengthTask.searchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/profile/edit/search_buddy_email") },
    { id: "search", label: t("activation.profileCreated"), completed: status.profileCreated, action: () => navigate("/dashboard/searches/new") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("profile.completeAccount")}
      icon={<CheckCircle2 className="w-6 h-6 text-[#FF385C]" />}
      steps={steps}
      completedLabel={t("activation.completed")}
      testId="card-account-completion"
    />
  );
}

function HomeTipsCompletionCard({ navigate }: { navigate: (path: string) => void }) {
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
      icon={<Rocket className="w-6 h-6 text-[#FF385C]" />}
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
    { id: "push", label: t("activation.notificationsEnabled"), completed: status?.notificationsEnabled ?? false, action: () => navigate("/settings/preferences") },
    { id: "letter", label: t("strengthTask.applicationTemplate"), completed: getStrengthTask("application_template")?.completed ?? false, action: () => navigate("/application-letter") },
    { id: "buddy", label: t("strengthTask.searchBuddy"), completed: getStrengthTask("search_buddy")?.completed ?? false, action: () => navigate("/profile/edit/search_buddy_email") },
    { id: "search", label: t("activation.profileCreated"), completed: status?.profileCreated ?? false, action: () => navigate("/dashboard/searches/new") },
  ];

  return (
    <ExpandableCompletionCard
      title={t("profile.completeAccount")}
      icon={<CheckCircle2 className="w-6 h-6 text-[#FF385C]" />}
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
      icon={<Rocket className="w-6 h-6 text-[#FF385C]" />}
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

  const profileDataQuery = useQuery<{ first_name?: string; application_template?: string; search_buddy_email?: string; search_buddy_status?: string }>({
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
  const hasReactieBrief = !!(profileDataQuery.data?.application_template && profileDataQuery.data.application_template.trim().length > 20);
  const hasZoekbuddy = !!(profileDataQuery.data?.search_buddy_email && profileDataQuery.data.search_buddy_email.trim().length > 0 && profileDataQuery.data.search_buddy_status !== "revoked_by_buddy");
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
      <div className="bg-white px-5 pt-6 pb-5">
        <h1 className="text-page-title" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")}
        </h1>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-5">
        <SearchProfilesSection profiles={profiles} navigate={navigate} />

        {(!subscription.isTrial && !subscription.isActive) && (
          <div className="rounded-[--ha-card-radius] bg-white p-5" data-testid="card-upgrade-warning">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F7F7F7] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock className="w-5 h-5 text-[#111111]" />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-[#111111]">Je loopt mogelijk je droomwoning mis...</p>
                <p className="text-[14px] text-[#4B5563] mt-1 leading-relaxed">
                  Met een gratis abonnement kan je niet reageren op woningen. Zo loop je mogelijk je droomwoning mis. Upgrade naar een betaald account en mis nooit meer een huurwoning!
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[50px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[15px] font-bold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
              data-testid="button-upgrade-warning-cta"
            >
              Upgraden
            </button>
          </div>
        )}

        <div className="rounded-[--ha-card-radius] bg-white overflow-hidden" data-testid="section-tools">
          <StatusCardInline
            icon={<Sparkles className="w-5 h-5 text-ha-primary" />}
            title={t("profile.reactionLetter2")}
            configured={hasReactieBrief}
            configuredText={t("home.reactionLetterConfigured") || "Reactiebrief ingesteld"}
            unconfiguredText={t("home.reactionLetterMissing") || "Nog geen reactiebrief"}
            actionLabel={hasReactieBrief ? (t("common.manage") || "Beheren") : (t("common.generate") || "Genereren")}
            onAction={() => navigate("/application-letter")}
            testId="card-home-reaction-letter"
          />
          <div className="h-px bg-[#E5E7EB]/60 mx-5" />
          <StatusCardInline
            icon={<Users className="w-5 h-5 text-ha-primary" />}
            title={t("profile.zoekbuddyTitle")}
            configured={hasZoekbuddy}
            configuredText={t("home.zoekbuddyConfigured") || "Zoekbuddy ingesteld"}
            unconfiguredText={t("home.zoekbuddyMissing") || "Nog geen zoekbuddy"}
            actionLabel={hasZoekbuddy ? (t("common.manage") || "Beheren") : (t("common.add") || "Toevoegen")}
            onAction={() => navigate("/profile/edit/search_buddy_email")}
            testId="card-home-zoekbuddy"
          />
        </div>

        <div data-testid="section-setup-progress" className="flex flex-col gap-2.5">
          <HomeAccountCompletionCard accessToken={accessToken} navigate={navigate} />
          <HomeTipsCompletionCard navigate={navigate} />
        </div>

        <RecentlyViewedSection accessToken={accessToken} />

        <div className="rounded-[--ha-card-radius] bg-[#111111] p-5" data-testid="card-home-referral">
          <p className="text-[11px] font-bold text-ha-primary tracking-wider uppercase mb-1" data-testid="text-referral-label">
            {t("referral.homeLabel")}
          </p>
          <p className="text-[17px] font-bold text-white leading-snug" data-testid="text-referral-body">
            {t("referral.homeBody")}
          </p>
          <p className="text-[14px] text-white/50 mt-1.5 leading-relaxed" data-testid="text-referral-helper">
            {t("referral.homeHelper")}
          </p>
          <button
            onClick={() => setReferralModalOpen(true)}
            className="mt-4 h-[46px] px-6 rounded-[--ha-btn-radius] bg-ha-primary text-white text-[14px] font-bold transition-all hover:bg-ha-primary-hover active:scale-[0.97] inline-flex items-center gap-2"
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
  const [, navigate] = useLocation();
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
    const dateA = a.first_seen_at || a.matched_at || "";
    const dateB = b.first_seen_at || b.matched_at || "";
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-6 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-page-title">{t("matches.title")}</h1>
          {totalCount > 0 && (
            <span className="text-[13px] font-medium text-[#9CA3AF]" data-testid="text-match-count">
              {totalCount} {totalCount === 1 ? "match" : "matches"}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 flex flex-col pt-3">
        {apiMatchesQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-[--ha-card-radius] bg-white overflow-hidden">
                <div className="p-3 pb-0">
                  <div className="rounded-[12px] bg-[#F7F7F7]" style={{ aspectRatio: "16/9" }} />
                </div>
                <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5">
                  <div className="h-5 bg-[#F7F7F7] rounded w-3/4" />
                  <div className="h-4 bg-[#F7F7F7] rounded w-1/3" />
                  <div className="h-3 bg-[#F7F7F7] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : apiMatchesQuery.isError ? (
          <div className="rounded-[--ha-card-radius] bg-white p-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-[--ha-card-inner-radius] bg-[#F7F7F7] flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <p className="text-[18px] font-bold text-[#111111]">{t("matches.loadError")}</p>
            <p className="text-[14px] text-[#4B5563] leading-relaxed">{t("matches.loadErrorDesc")}</p>
            <button
              onClick={() => apiMatchesQuery.refetch()}
              className="text-[14px] font-semibold text-ha-primary"
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
          <div className="flex flex-col gap-3">
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
      </div>
    </div>
  );
}

function DeleteConfirmScreen({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F7F7] flex flex-col">
      <header className="sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-4">
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
            className="w-full h-[56px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold transition-colors hover:bg-ha-primary-hover"
            data-testid="button-delete-confirm"
          >
            {t("filters.deleteYes")}
          </button>
          <button
            onClick={onCancel}
            className="w-full h-[56px] rounded-[--ha-btn-radius] border border-white/20 text-[#111111] text-[16px] font-medium hover:bg-white/5 transition-colors"
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
  const { t, locale } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
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

  const currentListings = favSubTab === "favorieten" ? favoriteListings : appliedListings;

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-6 pb-0">
        <h1 className="text-page-title mb-4">{t("nav.favorites")}</h1>
        <div className="flex" data-testid="fav-sub-tabs">
          {([
            { key: "favorieten" as FavSubTab, label: t("nav.favorites") },
            { key: "gereageerd" as FavSubTab, label: t("matches.subtabs.applied") },
          ]).map(({ key, label }) => {
            const isActive = favSubTab === key;
            return (
              <button
                key={key}
                onClick={() => setFavSubTab(key)}
                className={`px-5 py-2.5 text-[14px] font-semibold transition-all border-b-2 ${
                  isActive
                    ? "border-ha-primary text-ha-primary"
                    : "border-transparent text-[#9CA3AF] hover:text-[#6B7280]"
                }`}
                data-testid={`tab-fav-${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 flex flex-col pt-3">
        {isLoading && favSubTab === "favorieten" ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-[--ha-card-radius] bg-white overflow-hidden">
                <div className="p-3 pb-0">
                  <div className="rounded-[12px] bg-[#F7F7F7]" style={{ aspectRatio: "16/9" }} />
                </div>
                <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5">
                  <div className="h-5 bg-[#F7F7F7] rounded w-3/4" />
                  <div className="h-4 bg-[#F7F7F7] rounded w-1/3" />
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
        ) : favSubTab === "favorieten" ? (
          <div className="flex flex-col gap-3">
            {currentListings.map((m) => (
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
        ) : (
          <div className="flex flex-col gap-3">
            {currentListings.map((m) => (
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
            <label className="w-full h-[56px] flex items-center justify-center gap-2 rounded-[--ha-btn-radius] bg-ha-primary text-white text-[15px] font-semibold cursor-pointer active:bg-ha-primary-hover transition-colors">
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
                className="mt-3 w-full h-[56px] flex items-center justify-center gap-2 rounded-[--ha-btn-radius] border border-[#E5E7EB] text-[#111111] text-[15px] font-medium active:bg-ha-surface-hover transition-colors"
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                {t("profile.photo.remove")}
              </button>
            )}

            <button
              onClick={onClose}
              className="mt-3 w-full h-[56px] flex items-center justify-center rounded-[--ha-btn-radius] text-[#111111]/70 text-[15px] font-medium active:bg-ha-surface-hover transition-colors"
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
    <div className="min-h-[calc(100vh-80px)] bg-[#F7F7F7]">
      <div className="bg-white pb-6" data-testid="card-profile-summary">
        <div className="flex flex-col items-center pt-10">
          <button
            onClick={() => setShowPhotoSheet(true)}
            className="relative w-20 h-20 rounded-full bg-ha-avatar-purple flex items-center justify-center group"
            data-testid="button-profile-photo"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-[24px] font-bold text-white tracking-wide">{initials}</span>
            )}
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <Camera className="w-3 h-3 text-[#6B7280]" />
            </div>
          </button>
          <p className="text-[20px] font-bold text-[#111111] mt-3" data-testid="text-user-firstname">
            {displayName || t("profile.seeker")}
          </p>
          {lastName && (
            <span className="hidden" data-testid="text-user-lastname">{lastName}</span>
          )}
          <p className="text-[14px] text-[#6B7280] mt-0.5" data-testid="text-member-since">
            {memberSinceLabel}
          </p>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-4 pt-4 pb-8">
        <div className="flex flex-col gap-4">

          <div className="rounded-[--ha-card-radius] bg-white overflow-hidden">
            <p className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-5 pt-4 pb-1.5" data-testid="text-section-account">{t("settings.sectionAccount")}</p>
            {[
              { label: t("settings.myDetails"), action: () => navigate("/profile/details"), icon: <User className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-account-0" },
              { label: t("settings.password"), action: () => navigate("/account/change-password"), icon: <Lock className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-account-1" },
              { label: t("settings.preferences"), action: () => navigate("/settings/preferences"), icon: <Bell className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-preferences" },
              { label: t("settings.subscription"), action: () => navigate("/account/subscription"), icon: <Crown className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-subscription" },
            ].map((row, ri) => (
              <div key={ri}>
                {ri > 0 && <div className="h-px bg-[#E5E7EB]/50 mx-5" />}
                <button
                  onClick={row.action}
                  className="w-full flex items-center gap-3.5 h-[48px] px-5 text-left active:bg-[#F7F7F7] transition-colors"
                  data-testid={row.testId}
                >
                  {row.icon}
                  <p className="text-[15px] font-medium text-[#111111] flex-1">{row.label}</p>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
                </button>
              </div>
            ))}

            <div className="h-px bg-[#E5E7EB] mx-5 my-0.5" />
            <p className="text-[12px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-5 pt-3 pb-1.5" data-testid="text-section-other">{t("settings.sectionHelp")}</p>
            {[
              { label: t("settings.contactUs"), action: () => { window.location.href = "mailto:support@housalert.com"; }, icon: <HelpCircle className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-other-0" },
              { label: t("settings.privacyPolicy"), action: () => navigate("/datenschutz"), icon: <Shield className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-other-1" },
              { label: t("settings.termsConditions"), action: () => navigate("/terms"), icon: <FileText className="w-[18px] h-[18px] text-[#6B7280]" />, testId: "button-profile-other-2" },
            ].map((row, ri) => (
              <div key={ri}>
                {ri > 0 && <div className="h-px bg-[#E5E7EB]/50 mx-5" />}
                <button
                  onClick={row.action}
                  className="w-full flex items-center gap-3.5 h-[48px] px-5 text-left active:bg-[#F7F7F7] transition-colors"
                  data-testid={row.testId}
                >
                  {row.icon}
                  <p className="text-[15px] font-medium text-[#111111] flex-1">{row.label}</p>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
                </button>
              </div>
            ))}

            <div className="h-px bg-[#E5E7EB] mx-5 my-0.5" />
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={signingOut}
              className={`w-full flex items-center gap-3.5 h-[48px] px-5 text-left active:bg-[#F7F7F7] transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
              data-testid="button-profile-logout"
            >
              <LogOut className="w-[18px] h-[18px] text-ha-danger flex-shrink-0" />
              <p className="text-[15px] font-medium text-ha-danger flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
            </button>
          </div>

          <button
            onClick={() => navigate("/account/delete")}
            className="text-[13px] text-[#9CA3AF] text-center py-2"
            data-testid="button-profile-delete-account"
          >
            {t("profile.deleteAccount")}
          </button>

          <p className="text-[12px] text-[#D1D5DB] text-center pb-2">HousAlert v1.0.0</p>

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
          <div className="bg-white w-full max-w-[400px] rounded-t-[--ha-card-radius] sm:rounded-[--ha-card-radius] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-[#111111] text-center">{t("profile.logoutConfirm")}</p>
            <p className="text-[15px] text-ha-text-secondary text-center mt-2 mb-6">{t("profile.logoutDesc")}</p>
            <button
              onClick={handleLogout}
              className="w-full ha-btn bg-red-500 text-white font-semibold mb-3"
              data-testid="button-profile-logout-confirm"
            >
              {t("profile.logoutYes")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full ha-btn text-[#111111] font-medium active:bg-ha-surface-hover"
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
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col">
      <main className="flex-1 max-w-xl mx-auto w-full pb-[90px]">
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

      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E5E7EB]/60" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <nav className="max-w-xl mx-auto flex h-[52px]" data-testid="bottom-nav">
          {TAB_CONFIG.map(({ key, labelKey, Icon }) => {
            const isActive = activeTab === key;
            const isProfileWithPhoto = key === "profiel" && !!tabPhotoUrl;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center justify-center gap-[3px]"
                data-testid={`tab-${key}`}
              >
                {isProfileWithPhoto ? (
                  <div className={`w-[24px] h-[24px] rounded-full overflow-hidden ${isActive ? "ring-[2px] ring-ha-primary ring-offset-1 ring-offset-white" : ""}`}>
                    <img src={tabPhotoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Icon className={`w-[22px] h-[22px] transition-colors ${isActive ? "text-ha-primary" : "text-[#9CA3AF]"}`} strokeWidth={isActive ? 2.2 : 1.8} />
                )}
                <span className={`text-[10px] transition-colors ${isActive ? "font-bold text-ha-primary" : "font-medium text-[#9CA3AF]"}`}>
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
