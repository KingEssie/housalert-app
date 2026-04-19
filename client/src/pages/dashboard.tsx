import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { fetchApiMatches, fetchBuddySharedMatches, type ApiMatch, type ApiMatchesResponse, type CanonicalStats } from "@/lib/listings";
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
  AlertCircle,
  AlertTriangle,
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
  Mail,
  Loader2,
  RotateCcw,
  Users,
  UserCheck,
  ExternalLink,
  Link2Off,
} from "lucide-react";
import { ExpandableCompletionCard, type CompletionStep } from "@/components/expandable-completion-card";
import { EmptyState, EMPTY_STATE_IMAGES } from "@/components/empty-state";
import { HighlightCard } from "@/components/highlight-card";
import { useReferralShare } from "@/lib/referral-share";
import { getTipsReadSet } from "@/pages/tips";
import { getFlowTipSteps } from "@/pages/tips-flow";
import { ACCOUNT_FLOW, SEARCH_PREP_FLOW, resolveFlowSteps, buildCompletionMap, type StepOverride } from "@/lib/task-flows";
import { isPushSupported, getPushPermissionState, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { generateOnboardingLetter, type OnboardingLetterData } from "@/lib/application-letter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListingCardFull, ListingCardMini } from "@/components/listing-card";
import {
  useBuddyConnections, useInviteBuddy, useRevokeBuddy,
  useUpdateBuddyPreferences, isBuddyMode, getActiveBuddyRelation,
  isOwnerSubActive, type BuddyConnections, type BuddyRelation,
} from "@/lib/buddy";
import { LogoutBottomSheet } from "@/components/ui/logout-bottom-sheet";
import { BuddyDisconnectSheet } from "@/components/ui/buddy-disconnect-sheet";

const MAX_PROFILES = 4;

type TabKey = "home" | "matches" | "profiel" | "favorieten";
type MatchesTopTab = "matches" | "gereageerd";

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
  if (p.search_name) return p.search_name;
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
          <img src={EMPTY_STATE_IMAGES.createSearch} alt="" className="w-[72px] max-h-[72px] h-auto mb-5 object-contain" draggable={false} />
          <p className="text-[16px] font-bold text-[#000000] mb-1" data-testid="text-empty-title">{t("searchProfiles.emptyTitle")}</p>
          <p className="text-[14px] text-[#334855] mb-5 leading-relaxed max-w-[260px]" data-testid="text-empty-subtitle">{t("searchProfiles.emptySubtitle")}</p>
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-full h-[48px] rounded-full bg-ha-primary text-white font-semibold text-[16px] hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
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
                      <p className="text-[12px] text-[#334855] mt-0.5" data-testid={`text-profile-summary-${p.id}`}>
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
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[#334855] hover:bg-ha-surface-hover transition-colors flex-shrink-0"
                      data-testid={`button-menu-${p.id}`}
                    >
                      <MoreVertical className="w-[18px] h-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/searches/edit/${p.id}`); }}
                      className="flex items-center gap-2.5 cursor-pointer"
                      data-testid={`menu-edit-${p.id}`}
                    >
                      <Pencil className="w-4 h-4 text-[#334855]" />
                      {t("common.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
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
              className="w-full mt-2.5 h-[44px] rounded-full bg-ha-primary/10 text-[14px] font-semibold text-ha-primary hover:bg-ha-primary/15 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
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

function NotificationsInline({ accessToken }: { accessToken: string | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<{ push_enabled: boolean; email_enabled: boolean } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/notifications/settings", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {});
  }, [accessToken]);

  async function toggle(key: "push_enabled" | "email_enabled") {
    if (!accessToken || !settings) return;
    const current = settings[key];
    setUpdating(key);
    try {
      if (key === "push_enabled" && !current) {
        if (!isPushSupported()) { toast({ title: t("settings.pushNotSupported"), variant: "destructive" }); setUpdating(null); return; }
        const perm = await getPushPermissionState();
        if (perm === "denied") { toast({ title: t("settings.pushDenied"), variant: "destructive" }); setUpdating(null); return; }
        await subscribeToPush(accessToken);
      } else if (key === "push_enabled" && current) {
        await unsubscribeFromPush(accessToken);
      }
      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ [key]: !current }),
      });
      if (!res.ok) throw new Error("fail");
      setSettings((p) => p ? { ...p, [key]: !current } : p);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  if (!settings) return <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-[#334855]" /></div>;

  return (
    <div className="flex flex-col gap-2" data-testid="inline-notif-toggles">
      <div className="flex items-center gap-3 bg-white rounded-[12px] px-4 py-3 border border-[#F0F0F0]">
        <Bell className="w-[18px] h-[18px] text-[#334855] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[#111111]">{t("taskFlow.notif.pushLabel")}</p>
          <p className="text-[12px] text-[#334855]">{t("taskFlow.notif.pushDesc")}</p>
        </div>
        <button
          onClick={() => toggle("push_enabled")}
          disabled={updating === "push_enabled"}
          className={`w-[44px] h-[26px] rounded-full relative transition-colors flex-shrink-0 ${settings.push_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${updating === "push_enabled" ? "opacity-50" : ""}`}
          data-testid="inline-toggle-push"
        >
          <span className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-sm transition-transform ${settings.push_enabled ? "left-[21px]" : "left-[3px]"}`} />
        </button>
      </div>
      <div className="flex items-center gap-3 bg-white rounded-[12px] px-4 py-3 border border-[#F0F0F0]">
        <Mail className="w-[18px] h-[18px] text-[#334855] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[#111111]">{t("taskFlow.notif.emailLabel")}</p>
          <p className="text-[12px] text-[#334855]">{t("taskFlow.notif.emailDesc")}</p>
        </div>
        <button
          onClick={() => toggle("email_enabled")}
          disabled={updating === "email_enabled"}
          className={`w-[44px] h-[26px] rounded-full relative transition-colors flex-shrink-0 ${settings.email_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${updating === "email_enabled" ? "opacity-50" : ""}`}
          data-testid="inline-toggle-email"
        >
          <span className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-sm transition-transform ${settings.email_enabled ? "left-[21px]" : "left-[3px]"}`} />
        </button>
      </div>
    </div>
  );
}

function BuddyInline({ accessToken }: { accessToken: string | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.search_buddy_email && d?.search_buddy_status !== "revoked_by_buddy") {
          setExisting(d.search_buddy_email);
          setEmail(d.search_buddy_email);
        }
      })
      .catch(() => {});
  }, [accessToken]);

  async function handleSave() {
    if (!accessToken || !email.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ search_buddy_email: email.trim() }),
      });
      if (!res.ok) throw new Error("fail");
      setExisting(email.trim());
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("profileEdit.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="inline-buddy">
      <p className="text-[13px] text-[#334855] leading-relaxed">{t("taskFlow.desc.searchBuddy")}</p>
      <div className="relative">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("profileEdit.searchBuddyPlaceholder")}
          className="w-full h-[56px] rounded-[8px] border border-[#D1D5DB] bg-white px-4 text-[16px] text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all pr-10"
          data-testid="inline-buddy-email"
        />
        {email && (
          <button onClick={() => setEmail("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F3F4F6] flex items-center justify-center" data-testid="inline-buddy-clear">
            <X className="w-3 h-3 text-[#334855]" />
          </button>
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !email.trim() || email.trim() === existing}
        className="w-full h-[42px] rounded-[12px] bg-ha-primary text-white text-[14px] font-semibold hover:bg-ha-primary-hover transition-colors disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-2"
        data-testid="inline-buddy-save"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? t("common.save") : t("profile.addBuddy")}
      </button>
    </div>
  );
}

function LetterModal({ accessToken, open, onClose }: { accessToken: string | undefined; open: boolean; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !accessToken || loaded) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.application_template && d.application_template.trim().length > 0) {
          setTemplate(d.application_template);
        } else {
          const data: OnboardingLetterData = {
            firstName: d?.first_name || undefined,
            lastName: d?.last_name || undefined,
            phone: d?.phone || undefined,
            email: user?.email || undefined,
            gender: d?.gender || undefined,
            livingWith: d?.living_with || undefined,
            workStatus: d?.work_status || undefined,
            moveReason: d?.move_reason || undefined,
            grossIncome: d?.monthly_income || undefined,
            petsCount: d?.pets_count ?? undefined,
          };
          setTemplate(generateOnboardingLetter(data, locale));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, accessToken, loaded]);

  async function handleSave() {
    if (!accessToken || template.trim().length < 20) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ application_template: template }),
      });
      if (!res.ok) throw new Error("fail");
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("applicationLetter.saved"), description: t("applicationLetter.savedDesc") });
      onClose();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleRegenerate() {
    if (!accessToken) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => {
        const data: OnboardingLetterData = {
          firstName: d?.first_name || undefined,
          lastName: d?.last_name || undefined,
          phone: d?.phone || undefined,
          email: user?.email || undefined,
          gender: d?.gender || undefined,
          livingWith: d?.living_with || undefined,
          workStatus: d?.work_status || undefined,
          moveReason: d?.move_reason || undefined,
          grossIncome: d?.monthly_income || undefined,
          petsCount: d?.pets_count ?? undefined,
        };
        setTemplate(generateOnboardingLetter(data, locale));
        toast({ title: t("applicationLetter.resetDone") });
      })
      .catch(() => {});
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[480px] max-h-[85vh] rounded-t-[12px] sm:rounded-[12px] flex flex-col animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[18px] font-bold text-[#111111]" data-testid="modal-letter-title">{t("taskFlow.applicationLetter")}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-90" data-testid="modal-letter-close">
            <X className="w-4 h-4 text-[#334855]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!loaded ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#334855]" /></div>
          ) : (
            <>
              <p className="text-[13px] text-[#334855] mb-3 leading-relaxed">{t("applicationLetter.helperText")}</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[#334855] uppercase tracking-wide">{t("applicationLetter.letterLabel")}</span>
                <button onClick={handleRegenerate} className="flex items-center gap-1 text-[13px] text-[#334855] active:text-[#111111]" data-testid="modal-letter-reset">
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("applicationLetter.resetDefault")}
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={t("applicationLetter.placeholderText")}
                className="w-full min-h-[220px] rounded-[8px] border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-[16px] text-[#111111] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all"
                data-testid="modal-letter-textarea"
              />
              {template.length > 0 && template.trim().length < 20 && (
                <p className="text-[12px] text-[#334855] mt-1">{t("applicationLetter.minChars")}</p>
              )}
            </>
          )}
        </div>
        <div className="px-5 pb-5 pt-2 border-t border-[#F0F0F0]">
          <button
            onClick={handleSave}
            disabled={saving || template.trim().length < 20}
            className="w-full h-[46px] rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-2"
            data-testid="modal-letter-save"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("applicationLetter.saveLetter")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskFlowCard({
  accessToken,
  flow,
  taskSource,
  navigate,
  testId,
  searchProfileCount,
}: {
  accessToken: string | undefined;
  flow: import("@/lib/task-flows").TaskFlow;
  taskSource: "tasks" | "prepTasks";
  navigate: (path: string) => void;
  testId: string;
  searchProfileCount?: number;
}) {
  const { t } = useTranslation();

  const strengthQuery = useQuery<import("@/lib/task-flows").ProfileStrengthResponse>({
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

  const data = strengthQuery.data;
  if (!data) return null;

  const serverTasks = taskSource === "tasks" ? data.tasks : data.prepTasks;
  const completionMap = buildCompletionMap(serverTasks);

  const overrides: Record<string, StepOverride> = {};

  if (flow.id === "account") {
    if (searchProfileCount != null) {
      const spLabel = searchProfileCount === 0
        ? t("taskFlow.searchProfileZero")
        : t("taskFlow.searchProfile");
      overrides["search_profile"] = {
        labelOverride: spLabel,
        completedOverride: searchProfileCount >= 2,
      };
    }
  }

  const steps = resolveFlowSteps(flow, completionMap, t, navigate, overrides);

  return (
    <ExpandableCompletionCard
      title={t(flow.titleKey)}
      steps={steps}
      completedLabel={t("activation.completed")}
      subtitleFormat={t(flow.subtitleKey)}
      testId={testId}
    />
  );
}



function ProfileTipsCompletionCard({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();

  const flowSteps = getFlowTipSteps(t);
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

function ZoekopdrachtenSection({ profiles, navigate, buddyMode }: { profiles: SearchProfile[]; navigate: (path: string) => void; buddyMode?: boolean }) {
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
    <div
      data-testid="section-zoekopdrachten"
      className="bg-white rounded-[12px] p-5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" }}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <Search className="w-[20px] h-[20px] text-ha-primary flex-shrink-0" />
        <h2 className="text-[21px] font-semibold text-[#111111] flex-1" data-testid="text-zoekopdrachten-title">
          {t("home.zoekopdrachtenTitle")}
        </h2>
        {profiles.length > 0 && (
          <span
            className="text-[12px] font-medium px-[10px] py-[4px] rounded-full"
            style={{ backgroundColor: "#e6f0f7", color: "#4b7b94" }}
          >
            {profiles.length}/4
          </span>
        )}
      </div>
      <p className="text-[15px] text-[#334855] mb-4" data-testid="text-filters-expected">
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
                className={`rounded-[10px] bg-[#f3f4f6] p-4 flex items-center ${buddyMode ? "cursor-default" : "cursor-pointer active:opacity-80"} transition-all`}
                onClick={buddyMode ? undefined : () => navigate(`/dashboard/searches/edit/${p.id}`)}
                data-testid={`row-zoekopdracht-${p.id}`}
              >
                <div className="w-[11px] h-[11px] rounded-full flex-shrink-0 mr-3.5" style={{ backgroundColor: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.15)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] font-semibold text-[#111111] truncate">{title}</p>
                  <p className="text-[14px] text-[#6B7280] mt-1 truncate">{priceLine}</p>
                  {locationLine && (
                    <p className="text-[14px] text-[#6B7280] mt-0.5 truncate">{locationLine}</p>
                  )}
                </div>
                {!buddyMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-white/70 active:bg-white transition-colors flex-shrink-0 ml-2"
                        data-testid={`button-menu-${p.id}`}
                      >
                        <MoreVertical className="w-[18px] h-[18px]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/searches/edit/${p.id}`); }}
                        className="flex items-center gap-2.5 cursor-pointer"
                        data-testid={`menu-edit-${p.id}`}
                      >
                        <Pencil className="w-4 h-4 text-[#334855]" />
                        {t("home.menuEdit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                        className="flex items-center gap-2.5 text-ha-danger focus:text-ha-danger cursor-pointer"
                        data-testid={`menu-delete-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t("home.menuDelete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[12px] bg-white border border-[#E5E7EB] p-7 flex flex-col items-center justify-center text-center min-h-[calc(100dvh-260px)]" data-testid="card-zoekopdrachten-empty">
          <img src={EMPTY_STATE_IMAGES.createSearch} alt="" className="w-[72px] max-h-[72px] h-auto mb-5 object-contain" draggable={false} />
          <p className="text-[20px] font-bold text-[#000000] mb-2">{t("home.emptyTitle")}</p>
          <p className="text-[16px] text-[#334855] mb-6 leading-relaxed max-w-[280px]">{t("home.emptySubtitle")}</p>
          {!buddyMode && (
            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="h-[48px] px-8 rounded-[12px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
              data-testid="button-create-first-profile"
            >
              {t("home.createProfile")}
            </button>
          )}
        </div>
      )}

      {!buddyMode && profiles.length > 0 && profiles.length < MAX_PROFILES && (
        <button
          onClick={() => navigate("/dashboard/searches/new")}
          className="w-full mt-4 py-[14px] rounded-[10px] bg-transparent border-2 border-ha-primary text-[16px] font-semibold text-ha-primary hover:bg-ha-primary/5 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
          data-testid="button-add-zoekopdracht"
        >
          + {t("home.addZoekopdracht")}
        </button>
      )}
      {!buddyMode && profiles.length >= MAX_PROFILES && (
        <p className="mt-3 text-[12px] text-[#C4C4C4] text-center" data-testid="text-zoek-max-reached">
          {t("searchProfiles.maxReached")}
        </p>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-[#eaeaeb] flex flex-col">
          <header className="sticky top-0 z-10">
            <div className="max-w-lg mx-auto flex items-center h-[48px] px-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="w-10 h-10 rounded-full bg-[#E5E7EB] hover:bg-[#D1D5DB] active:bg-[#D1D5DB] flex items-center justify-center transition-colors"
                data-testid="button-delete-back"
              >
                <ArrowLeft className="w-5 h-5 text-[#374151]" />
              </button>
              <h1 className="text-[17px] font-semibold text-[#111111] flex-1 text-center">{t("home.deleteTitle")}</h1>
              <div className="w-10 shrink-0" />
            </div>
          </header>
          <main className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-[10px] bg-ha-primary flex items-center justify-center mb-6">
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


function HomeTab({
  user,
  profiles,
  navigate,
  setActiveTab,
  subscription,
  accessToken,
  buddyMode,
  showBuddyUnlinked,
  onDismissBuddyUnlinked,
}: {
  user: any;
  profiles: SearchProfile[];
  navigate: (path: string) => void;
  setActiveTab: (tab: TabKey) => void;
  subscription: { isTrial: boolean; isExpired: boolean; isActive: boolean; trialEndsAt: string | null };
  accessToken: string | undefined;
  buddyMode?: boolean;
  showBuddyUnlinked?: boolean;
  onDismissBuddyUnlinked?: () => void;
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
  const firstName = profileDataQuery.data?.first_name?.trim() || null;
  const { handleReferralShare } = useReferralShare();

  const ownerLetterQuery = useQuery<{ application_template: string | null; first_name: string | null }>({
    queryKey: ["/api/buddy/owner-profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/buddy/owner-profile-data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { application_template: null, first_name: null };
      return res.json();
    },
    enabled: !!accessToken && !!buddyMode,
  });

  return (
    <div className="flex flex-col pb-8">
      {/* Former buddy transition modal */}
      {showBuddyUnlinked && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]" data-testid="modal-buddy-unlinked">
          <div className="bg-white rounded-[20px] w-full max-w-[420px] p-6 flex flex-col gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto">
              <Link2Off className="w-6 h-6 text-[#6B7280]" strokeWidth={1.8} />
            </div>
            <div className="text-center">
              <h2 className="text-[19px] font-bold text-[#111827] mb-2">{t("buddyUnlinked.title")}</h2>
              <p className="text-[15px] text-[#6B7280] leading-snug">{t("buddyUnlinked.body")}</p>
            </div>
            <button
              onClick={() => { onDismissBuddyUnlinked?.(); navigate("/onboarding/setup?from=buddy_unlinked"); }}
              className="w-full h-[52px] rounded-[12px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98]"
              data-testid="button-buddy-unlinked-cta"
            >
              {t("buddyUnlinked.cta")}
            </button>
          </div>
        </div>
      )}

      <div
        className="px-5 pb-10"
        style={{
          backgroundColor: "#22336b",
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          paddingTop: "max(env(safe-area-inset-top), 32px)",
        }}
        data-testid="section-welcome"
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-[16px] font-semibold tracking-[-0.01em]" style={{ color: "rgba(255,255,255,0.8)" }} data-testid="text-brand">HousAlert</span>
          <button
            onClick={() => navigate("/settings/preferences")}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.12)" }}
            data-testid="button-help"
          >
            <HelpCircle className="w-[22px] h-[22px] text-white" />
          </button>
        </div>
        <h1 className="text-[34px] font-semibold tracking-[-0.025em] leading-[1.15] text-white" data-testid="text-greeting">
          {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingDefault")} 👋
        </h1>
        <p className="text-[17px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }} data-testid="text-welcome-subtitle">
          {t("home.welcomeSubtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
        {!buddyMode && (
          <div className="flex flex-col gap-3.5" style={{ marginTop: 20 }} data-testid="section-gamification">
            <TaskFlowCard accessToken={accessToken} flow={ACCOUNT_FLOW} taskSource="tasks" navigate={navigate} testId="card-account-completion" searchProfileCount={profiles.length} />
            <TaskFlowCard accessToken={accessToken} flow={SEARCH_PREP_FLOW} taskSource="prepTasks" navigate={navigate} testId="card-prep-completion" />
          </div>
        )}

        {!buddyMode && (
          <HighlightCard
            icon={Send}
            title={t("tips.referralTitle")}
            subtitle={t("tips.referralSubtitle")}
            ctaLabel={t("tips.referralShareCta")}
            onClick={handleReferralShare}
            testId="card-home-referral"
            bgColor="#f2f6ff"
            layout="horizontal"
          />
        )}

        <ZoekopdrachtenSection profiles={profiles} navigate={navigate} buddyMode={buddyMode} />

        {/* Reactiebrief status card */}
        {(() => {
          const pd = buddyMode ? ownerLetterQuery.data : profileDataQuery.data;
          const hasLetter = !!(pd?.application_template?.trim());
          return (
            <button
              onClick={() => navigate("/application-letter")}
              className="w-full text-left bg-white rounded-[12px] p-5 flex flex-col gap-3 active:scale-[0.985] transition-transform"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" }}
              data-testid="card-reactiebrief-status"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-[20px] h-[20px] text-ha-primary flex-shrink-0" />
                <h2 className="text-[21px] font-semibold text-[#111111] flex-1">{t("profile.reactionLetter2")}</h2>
                {!buddyMode && (
                  <span className="text-[14px] font-medium" style={{ color: "#0891B2" }}>
                    {hasLetter ? t("common.manage") : t("common.generate")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 pl-[30px]">
                {hasLetter ? (
                  <>
                    <Check className="w-[15px] h-[15px] flex-shrink-0" style={{ color: "#16A34A" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#16A34A" }}>{t("home.reactionLetterConfigured")}</span>
                  </>
                ) : (
                  <>
                    <X className="w-[15px] h-[15px] flex-shrink-0" style={{ color: "#DC2626" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#DC2626" }}>{t("home.reactionLetterMissing")}</span>
                  </>
                )}
              </div>
            </button>
          );
        })()}

        {/* Zoekbuddy status card — hidden for buddy */}
        {!buddyMode && (() => {
          const pd = profileDataQuery.data;
          const hasBuddy = !!(pd?.search_buddy_email?.trim()) && pd?.search_buddy_status !== "revoked_by_buddy";
          return (
            <button
              onClick={() => navigate("/profile/search-buddy")}
              className="w-full text-left bg-white rounded-[12px] p-5 flex flex-col gap-3 active:scale-[0.985] transition-transform"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" }}
              data-testid="card-zoekbuddy-status"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-[20px] h-[20px] text-ha-primary flex-shrink-0" />
                <h2 className="text-[21px] font-semibold text-[#111111] flex-1">{t("profile.searchBuddy")}</h2>
                <span className="text-[14px] font-medium" style={{ color: "#0891B2" }}>{t("common.manage")}</span>
              </div>
              <div className="flex items-center gap-2 pl-[30px]">
                {hasBuddy ? (
                  <>
                    <Check className="w-[15px] h-[15px] flex-shrink-0" style={{ color: "#16A34A" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#16A34A" }}>{t("home.zoekbuddyConfigured")}</span>
                  </>
                ) : (
                  <>
                    <X className="w-[15px] h-[15px] flex-shrink-0" style={{ color: "#DC2626" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#DC2626" }}>{t("home.zoekbuddyMissing")}</span>
                  </>
                )}
              </div>
              {!hasBuddy && (
                <p className="text-[13px] leading-snug pl-[30px]" style={{ color: "#6B7280" }}>
                  {t("profile.buddyDescription")}
                </p>
              )}
            </button>
          );
        })()}
      </div>

    </div>
  );
}


function FavorietenTab({ accessToken, navigate }: { accessToken: string | undefined; navigate: (path: string) => void }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteListings, setFavoriteListings] = useState<ApiMatch[]>([]);
  const [favLoading, setFavLoading] = useState(true);
  const { t } = useTranslation();
  const sub = useSubscription();
  const hasAccess = sub.isActive || sub.isTrial;

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

  useEffect(() => {
    if (!accessToken || !hasAccess) return;
    fetchFavoriteListings();
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
  }, [accessToken, hasAccess, fetchFavoriteListings]);

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

  const cardStyle = { boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" };

  if (!hasAccess) {
    return (
      <div className="flex flex-col pb-8" data-testid="favorieten-locked">
        <div className="sticky top-0 z-10 bg-white px-5 pb-4 border-b border-[#E5E7EB]" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>
          <h1 className="text-[22px] font-bold text-[#111111]">{t("nav.favorites")}</h1>
        </div>
        <div className="px-5 pt-16">
          <div className="flex flex-col items-center text-center px-6 pb-4">
            <div className="w-16 h-16 rounded-full bg-[#F5F0EB] flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-[#111111]" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#111111] mb-2.5" data-testid="text-fav-locked-headline">
              {t("matches.locked.headline")}
            </h2>
            <p className="text-[15px] text-[#334855] leading-relaxed max-w-[280px] mb-8" data-testid="text-fav-locked-desc">
              {t("matches.locked.desc")}
            </p>
            <button
              onClick={() => navigate("/paywall")}
              className="h-[48px] px-10 rounded-[12px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
              data-testid="button-fav-locked-subscribe"
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
      <div className="sticky top-0 z-10 bg-white px-5 pb-4 border-b border-[#E5E7EB]" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-bold text-[#111111]">{t("nav.favorites")}</h1>
          {favoriteListings.length > 0 && (
            <span className="text-[12px] font-semibold text-white bg-[#FF385C] px-[9px] py-[3px] rounded-full" data-testid="badge-favorites-count">
              {favoriteListings.length}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-3">
        {favLoading ? (
          <div className="bg-white rounded-[12px] p-4 flex flex-col gap-4" style={cardStyle}>
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-[#F3F4F6] rounded-[10px]" style={{ aspectRatio: "16/9" }} />
                <div className="pt-3 flex flex-col gap-2">
                  <div className="h-4 bg-[#F3F4F6] rounded-full w-3/4" />
                  <div className="h-3 bg-[#F3F4F6] rounded-full w-1/2" />
                  <div className="flex gap-1.5 mt-1">
                    {[1, 2, 3].map((j) => <div key={j} className="h-[22px] bg-[#F3F4F6] rounded-[8px] w-14" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : favoriteListings.length === 0 ? (
          <div className="bg-white rounded-[12px]" style={cardStyle}>
            <EmptyState
              illustration={EMPTY_STATE_IMAGES.noFavorites}
              title={t("matches.emptyFavorites.title")}
              description={t("matches.emptyFavorites.desc")}
              testId="empty-favorieten-tab"
              compact
            />
          </div>
        ) : (
          <div className="bg-white rounded-[12px] p-4 flex flex-col gap-4" style={cardStyle}>
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
                locked={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchesTab({ accessToken, setActiveTab, initialTopTab, buddyMode, ownerSubActive }: { accessToken: string | undefined; setActiveTab: (tab: TabKey) => void; initialTopTab?: MatchesTopTab | null; buddyMode?: boolean; ownerSubActive?: boolean }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [topTab, setTopTab] = useState<MatchesTopTab>(initialTopTab || "matches");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedListings, setAppliedListings] = useState<ApiMatch[]>([]);
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const sub = useSubscription();
  const hasAccess = buddyMode ? (ownerSubActive ?? false) : (sub.isActive || sub.isTrial);

  const apiMatchesQuery = useQuery<ApiMatchesResponse>({
    queryKey: buddyMode ? ["/api/buddy/shared-matches"] : ["/api/matches"],
    queryFn: () => buddyMode ? fetchBuddySharedMatches(accessToken!) : fetchApiMatches(accessToken!),
    enabled: !!accessToken && hasAccess,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const fetchAppliedListings = useCallback(() => {
    if (!accessToken || buddyMode) return;
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
  }, [accessToken, buddyMode]);

  useEffect(() => {
    if (!accessToken || !hasAccess || buddyMode) return;
    fetchAppliedListings();
  }, [accessToken, hasAccess, fetchAppliedListings, buddyMode]);

  useEffect(() => {
    if (!accessToken || !hasAccess || buddyMode) return;
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

      try {
        const res = await apiFetch(`/api/favorites/${listingId}`, {
          method: wasFavorited ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) throw new Error("request failed");
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
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const filteredMatches = searchQuery.trim()
    ? allMatchesSorted.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.title?.toLowerCase().includes(q) ||
          m.city?.toLowerCase().includes(q) ||
          (m.district?.toLowerCase().includes(q) ?? false)
        );
      })
    : allMatchesSorted;

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
  ];

  if (!hasAccess) {
    return (
      <div className="flex flex-col pb-8" data-testid="matches-locked">
        <div className="sticky top-0 z-10 bg-white px-5 pb-4" style={{ paddingTop: "max(env(safe-area-inset-top), 32px)" }}>
          <h1 className="text-page-title">{t("matches.title")}</h1>
        </div>

        <div className="px-5 pt-16">
          <div className="flex flex-col items-center text-center px-6 pb-4">
            <div className="w-16 h-16 rounded-full bg-[#F5F0EB] flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-[#111111]" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#111111] mb-2.5" data-testid="text-locked-headline">
              {t("matches.locked.headline")}
            </h2>
            <p className="text-[15px] text-[#334855] leading-relaxed max-w-[280px] mb-8" data-testid="text-locked-desc">
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

  const cardStyle = { boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E5E7EB" };

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white pb-0 border-b border-[#E5E7EB]" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>
        <div className="flex w-full" data-testid="matches-top-tabs">
          {topTabs.map(({ key, label }) => {
            const isActive = topTab === key;
            return (
              <button
                key={key}
                onClick={() => setTopTab(key)}
                className={`flex-1 text-center pb-3 text-[15px] transition-all duration-200 border-b-2 ${
                  isActive
                    ? "text-[#111111] font-semibold border-[#111111]"
                    : "text-[#9CA3AF] font-medium border-transparent"
                }`}
                style={{ marginBottom: "-1px" }}
                data-testid={`tab-matches-${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-3">
        {topTab === "matches" && (
          <div className="bg-white rounded-[12px] p-4 flex flex-col gap-4" style={cardStyle}>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#9CA3AF] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("matches.searchPlaceholder")}
                className="w-full h-[44px] pl-10 pr-4 rounded-[14px] bg-[#F3F4F6] border border-transparent text-[15px] text-[#111111] placeholder-[#9CA3AF] outline-none focus:bg-white focus:border-[#E5E7EB] transition-all"
                data-testid="input-search-matches"
              />
            </div>

            {apiMatchesQuery.isLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-[10px] overflow-hidden bg-[#def2e9]">
                    <div className="bg-[#cee8da]" style={{ aspectRatio: "16/9" }} />
                    <div className="p-4 flex flex-col gap-2">
                      <div className="h-4 bg-[#cee8da] rounded-full w-3/4" />
                      <div className="h-3 bg-[#cee8da] rounded-full w-1/2" />
                      <div className="h-3 bg-[#cee8da] rounded-full w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : apiMatchesQuery.isError ? (
              <div className="flex flex-col items-center text-center gap-4 py-6">
                <AlertCircle className="w-[24px] h-[24px] text-[#111111]" />
                <p className="text-[18px] font-semibold text-[#111111]">{t("matches.loadError")}</p>
                <p className="text-[15px] text-[#334855] leading-relaxed max-w-[280px]">{t("matches.loadErrorDesc")}</p>
                <button
                  onClick={() => apiMatchesQuery.refetch()}
                  className="text-[15px] font-semibold text-ha-primary active:opacity-70 transition-opacity"
                  data-testid="button-retry-matches"
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : matches.length === 0 ? (
              <EmptyState
                illustration={EMPTY_STATE_IMAGES.noMatches}
                title={t("home.noMatchesYetTitle")}
                description={t("matches.searchingForYouDesc")}
                ctaLabel={t("matches.adjustFilters")}
                onCtaClick={() => setActiveTab("home")}
                testId="empty-matches"
                compact
              />
            ) : filteredMatches.length === 0 ? (
              <p className="text-center text-[15px] text-[#6B7280] py-8" data-testid="text-no-search-results">
                {t("matches.noSearchResults").replace("{query}", searchQuery)}
              </p>
            ) : (
              filteredMatches.map((m) => (
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
              ))
            )}
          </div>
        )}

        {topTab === "gereageerd" && (
          <>
            {appliedListings.length === 0 ? (
              <div className="bg-white rounded-[12px]" style={cardStyle}>
                <EmptyState
                  illustration={EMPTY_STATE_IMAGES.noApplications}
                  title={t("matches.emptyApplied.title")}
                  description={t("matches.emptyApplied.desc")}
                  testId="empty-gereageerd-tab"
                  compact
                />
              </div>
            ) : (
              <div className="bg-white rounded-[12px] p-4 flex flex-col gap-4" style={cardStyle}>
                {appliedListings.map((m) => (
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
                    respondedLabel={formatRespondedDate(m)}
                    onRemoveResponse={() => removeApplied(m.listing_id)}
                    removeResponseLabel={t("matches.removeResponse")}
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
    <div className="fixed inset-0 z-50 bg-[#eaeaeb] flex flex-col">
      <header className="sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center h-[48px] px-4">
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-[#E5E7EB] hover:bg-[#D1D5DB] active:bg-[#D1D5DB] flex items-center justify-center transition-colors"
            data-testid="button-delete-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#374151]" />
          </button>
          <h1 className="text-[17px] text-title text-[#111111] flex-1 text-center">{t("filters.deleteTitle")}</h1>
          <div className="w-10 shrink-0" />
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

const SectionTitle = ({ children }: { children: string }) => (
  <p className="text-[13px] font-semibold text-[#334855] uppercase tracking-wide px-1 mb-2.5">{children}</p>
);

const ToggleRow = ({ label, subtitle, checked, onToggle, testId, last }: { label: string; subtitle?: string; checked: boolean; onToggle: (v: boolean) => void; testId?: string; last?: boolean }) => (
  <>
    <div className="flex items-center justify-between min-h-[64px] px-5 py-4" data-testid={testId}>
      <div className="flex-1 min-w-0">
        <span className="text-[15px] font-medium text-[#111111]">{label}</span>
        {subtitle && <p className="text-[13px] text-[#334855] mt-0.5 leading-tight">{subtitle}</p>}
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

function BuddyNotifPrefsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const buddyConns = useBuddyConnections();
  const updatePrefs = useUpdateBuddyPreferences();

  const activeRel = getActiveBuddyRelation(buddyConns.data);
  const [emailOn, setEmailOn] = useState(false);
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    if (activeRel) {
      setEmailOn(activeRel.email_notifications_enabled);
      setPushOn(activeRel.push_notifications_enabled);
    }
  }, [activeRel?.email_notifications_enabled, activeRel?.push_notifications_enabled]);

  if (!activeRel) return null;

  async function toggle(field: "email" | "push", value: boolean) {
    if (field === "email") setEmailOn(value);
    else setPushOn(value);

    try {
      await updatePrefs.mutateAsync({
        relationId: activeRel.id,
        email_notifications_enabled: field === "email" ? value : emailOn,
        push_notifications_enabled: field === "push" ? value : pushOn,
      });
      toast({ title: t("buddyV2.prefsSaved") });
    } catch {
      if (field === "email") setEmailOn(!value);
      else setPushOn(!value);
    }
  }

  return (
    <div>
      <SectionTitle>{t("buddyV2.prefsTitle")}</SectionTitle>
      <p className="text-[13px] text-[#334855] mb-3 px-1">{t("buddyV2.prefsSubtitle")}</p>
      <div className="rounded-[12px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <ToggleRow
          label={t("buddyV2.prefsPush")}
          checked={pushOn}
          onToggle={(v) => toggle("push", v)}
          testId="row-buddy-notif-push"
        />
        <ToggleRow
          label={t("buddyV2.prefsEmail")}
          checked={emailOn}
          onToggle={(v) => toggle("email", v)}
          testId="row-buddy-notif-email"
          last
        />
      </div>
    </div>
  );
}

function BuddyV2Section({ subscription }: { subscription: { isActive: boolean; isTrial: boolean } }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const buddyConns = useBuddyConnections();
  const inviteMutation = useInviteBuddy();
  const revokeMutation = useRevokeBuddy();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const hasActiveSub = subscription.isActive || subscription.isTrial;
  const ownerRel = buddyConns.data?.asOwner;
  const isConnected = ownerRel?.invite_status === "accepted";
  const isPending = ownerRel?.invite_status === "pending";
  const currentBuddy = (isConnected || isPending) ? ownerRel : null;

  async function handleInvite() {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const result = await inviteMutation.mutateAsync(trimmed);
      setInviteEmail("");
      if (result.emailSent === false) {
        toast({ title: t("buddyV2.inviteCreatedEmailFailed"), variant: "destructive" });
      } else {
        toast({ title: t("buddyV2.inviteSent") });
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("Invalid email")) toast({ title: t("buddyV2.inviteInvalidEmail"), variant: "destructive" });
      else if (msg.includes("yourself")) toast({ title: t("buddyV2.inviteSelf"), variant: "destructive" });
      else if (msg.includes("already") || msg.includes("one active") || msg.includes("only have one")) toast({ title: t("buddyV2.inviteMax"), variant: "destructive" });
      else if (msg.includes("subscription")) toast({ title: t("buddyV2.inviteSubRequired"), variant: "destructive" });
      else toast({ title: msg || t("buddyV2.inviteError"), variant: "destructive" });
    }
  }

  async function handleRevoke(buddyUserId: string) {
    try {
      await revokeMutation.mutateAsync(buddyUserId);
      setShowRevokeConfirm(false);
      toast({ title: t("buddyV2.revoked") });
    } catch {
      toast({ title: t("buddyV2.inviteError"), variant: "destructive" });
    }
  }

  return (
    <div>
      <SectionTitle>{t("buddyV2.ownerSection")}</SectionTitle>
      <div className="rounded-[12px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {currentBuddy ? (
          <div className="px-5 py-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#FFF0F5] flex items-center justify-center flex-shrink-0">
                {isConnected ? (
                  <UserCheck className="w-[20px] h-[20px] text-ha-primary" />
                ) : (
                  <Users className="w-[20px] h-[20px] text-ha-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[#111111] truncate" data-testid="text-buddy-email">
                  {currentBuddy.invite_email}
                </p>
                <p className="text-[13px] mt-0.5">
                  {isConnected ? (
                    <span className="text-green-600 font-medium">{t("buddyV2.statusConnected")}</span>
                  ) : (
                    <span className="text-amber-600 font-medium">{t("buddyV2.statusPending")}</span>
                  )}
                </p>
              </div>
            </div>
            {showRevokeConfirm ? (
              <div className="mt-4 pt-4 border-t border-[#F3F4F6]">
                <p className="text-[13px] font-semibold text-[#111827] mb-1">{t("buddyV2.revokeTitle")}</p>
                <p className="text-[13px] text-[#334855] mb-3">{t("buddyV2.revokeDesc")}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRevoke(currentBuddy.id)}
                    disabled={revokeMutation.isPending}
                    className="h-[36px] px-4 rounded-[10px] bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors active:scale-[0.97] disabled:opacity-50"
                    data-testid="button-buddy-revoke-confirm"
                  >
                    {revokeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("buddyV2.revokeConfirm")}
                  </button>
                  <button
                    onClick={() => setShowRevokeConfirm(false)}
                    className="h-[36px] px-4 rounded-[10px] border border-[#E5E7EB] text-[13px] font-semibold text-[#334855] active:scale-[0.97]"
                    data-testid="button-buddy-revoke-cancel"
                  >
                    {t("buddyV2.revokeCancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="mt-3 text-[13px] text-red-500 font-semibold active:opacity-70 transition-opacity"
                data-testid="button-buddy-revoke"
              >
                {t("buddyV2.revokeButton")}
              </button>
            )}
          </div>
        ) : (
          <div className="px-5 py-5">
            <p className="text-[14px] text-[#334855] leading-relaxed mb-4">{t("buddyV2.inviteSubtitle")}</p>
            {!hasActiveSub ? (
              <p className="text-[13px] text-amber-600 font-medium">{t("buddyV2.inviteSubRequired")}</p>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    placeholder={t("buddyV2.inviteEmailPlaceholder")}
                    className="w-full h-[44px] px-4 rounded-[12px] border border-[#E5E7EB] bg-white text-[14px] text-[#111111] placeholder:text-[#999] focus:outline-none focus:border-ha-primary transition-colors"
                    data-testid="input-buddy-invite-email"
                  />
                </div>
                <button
                  onClick={handleInvite}
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  className="h-[44px] px-5 rounded-[12px] bg-ha-primary text-white text-[14px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center gap-2"
                  data-testid="button-buddy-invite"
                >
                  {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Send className="w-4 h-4" />
                      {t("buddyV2.inviteCta")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfielTab({ user, signOut, navigate, subscription, setActiveTab, canonicalStats, computedAppliedCount, buddyMode, activeBuddyRel }: { user: any; signOut: () => Promise<void>; navigate: (path: string) => void; subscription: { status: string; isTrial: boolean; isActive: boolean; isExpired: boolean; plan: string | null; trialEndsAt: string | null; currentPeriodEndsAt: string | null; cancelAtPeriodEnd: boolean }; setActiveTab: (tab: TabKey) => void; canonicalStats?: CanonicalStats; computedAppliedCount: number; buddyMode?: boolean; activeBuddyRel?: BuddyRelation | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showBuddyDisconnectConfirm, setShowBuddyDisconnectConfirm] = useState(false);
  const { t, locale, setLocale } = useTranslation();
  const { toast } = useToast();
  const revokeBuddyMutation = useRevokeBuddy();

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
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

  useEffect(() => {
    if (pd?.language && (pd.language === "de" || pd.language === "en" || pd.language === "nl") && pd.language !== locale) {
      setLocale(pd.language);
    }
  }, [pd?.language]);

  const isAdmin = user?.email?.toLowerCase() === "martin.essie87@gmail.com";
  const firstName = pd?.first_name || "";
  const lastName = pd?.last_name || "";
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : firstName ? firstName[0].toUpperCase()
    : (user?.email?.[0] || "?").toUpperCase();
  const displayName = firstName || lastName
    ? [firstName, lastName].filter(Boolean).join(" ")
    : user?.email || "";
  const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-GB" : "nl-NL";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(intlLocale, { month: "long", year: "numeric" })
    : "";
  const memberSinceLabel = memberSince ? `${t("profile.memberSincePrefix")} ${memberSince}` : "";

  const MenuItem = ({ label, onClick, external = false, last = false }: { label: string; onClick: () => void; external?: boolean; last?: boolean }) => (
    <>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 h-[42px] text-left active:bg-[#F9FAFB] transition-colors"
        data-testid={`menu-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="text-[15px] font-semibold text-[#111111]">{label}</span>
        {external
          ? <ExternalLink className="w-[16px] h-[16px] text-[#9CA3AF] flex-shrink-0" />
          : <ChevronRight className="w-[16px] h-[16px] text-[#D1D5DB] flex-shrink-0" />
        }
      </button>
      {!last && <div className="h-px bg-[#F3F4F6] mx-4" />}
    </>
  );

  const SectionInline = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div className="h-px bg-[#F3F4F6]" />
      <p className="text-[11px] font-semibold text-[#9CA3AF] px-4 pt-4 pb-1">{title}</p>
      {children}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#eaeaeb]">

      {/* ── MAIN PANEL ── */}
      <div className="px-4 pb-8 max-w-[480px] mx-auto" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}>

        {/* Single white container */}
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden mb-4">

          {/* Profile row */}
          <div className="flex items-center gap-3 px-4 py-4" data-testid="row-account-profile">
            <div className="w-[44px] h-[44px] rounded-full bg-ha-primary flex items-center justify-center flex-shrink-0">
              <span className="text-[16px] font-bold text-white" data-testid="text-account-initials">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#111111] truncate" data-testid="text-account-name">{displayName}</p>
              <p className="text-[13px] text-[#000000] truncate" data-testid="text-account-email">{user.email}</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#E5E7EB] active:bg-[#D1D5DB] transition-colors shrink-0"
              aria-label={t("profile.logout")}
              data-testid="button-logout-icon"
            >
              <LogOut className="w-[20px] h-[20px] text-[#111111]" strokeWidth={2} />
            </button>
          </div>

          {/* ACCOUNT */}
          <SectionInline title={t("settings.sectionAccount")}>
            <MenuItem label={t("settings.preferences")} onClick={() => navigate("/settings/preferences")} />
            <MenuItem label={t("settings.password")} onClick={() => navigate("/account/change-password")} />
            {!buddyMode && <MenuItem label={t("settings.subscription")} onClick={() => navigate("/account/subscription")} last />}
          </SectionInline>

          {/* PERSOONLIJKE GEGEVENS */}
          <SectionInline title={t("settings.sectionPersonal")}>
            <MenuItem label={t("settings.myDetails")} onClick={() => navigate("/profile/details")} />
            {!buddyMode && <MenuItem label={t("settings.housingSituation")} onClick={() => navigate("/settings/housing")} last />}
          </SectionInline>

          {/* ZOEKEN EN REAGEREN */}
          <SectionInline title={t("settings.sectionSearchReact")}>
            {!buddyMode && <MenuItem label={t("settings.zoekbuddy")} onClick={() => navigate("/profile/search-buddy")} />}
            <MenuItem label={t("settings.reactionLetter")} onClick={() => navigate("/application-letter")} last />
          </SectionInline>

          {/* ZOEKBUDDY DISCONNECT (buddy mode only) */}
          {buddyMode && activeBuddyRel && (
            <div>
              <div className="h-px bg-[#F3F4F6]" />
              <p className="text-[11px] font-semibold text-[#9CA3AF] px-4 pt-4 pb-1">{t("buddyV2.modeBadge")}</p>
              <button
                type="button"
                onClick={() => setShowBuddyDisconnectConfirm(true)}
                className="w-full flex items-center justify-between px-4 h-[42px] text-left active:bg-[#F9FAFB] transition-colors"
                data-testid="button-buddy-disconnect"
              >
                <span className="text-[15px] font-semibold text-red-600">{t("buddyV2.buddyDisconnectLabel")}</span>
                <Link2Off className="w-[16px] h-[16px] text-red-400 flex-shrink-0" />
              </button>
            </div>
          )}

          {/* BUDDY DISCONNECT BOTTOM SHEET */}
          {activeBuddyRel && (
            <BuddyDisconnectSheet
              open={showBuddyDisconnectConfirm}
              onClose={() => setShowBuddyDisconnectConfirm(false)}
              onConfirm={async () => {
                try {
                  await revokeBuddyMutation.mutateAsync(activeBuddyRel.id);
                  setShowBuddyDisconnectConfirm(false);
                } catch {
                  toast({ title: t("buddyV2.inviteError"), variant: "destructive" });
                  setShowBuddyDisconnectConfirm(false);
                }
              }}
              loading={revokeBuddyMutation.isPending}
            />
          )}

          {/* HELP */}
          <SectionInline title={t("settings.sectionHelp")}>
            <MenuItem label={t("settings.faq")} onClick={() => window.open("https://www.housalert.com/faq", "_blank")} external />
            <MenuItem label={t("settings.contactUs")} onClick={() => { window.location.href = "mailto:support@housalert.com"; }} external last />
          </SectionInline>

          {/* VOORWAARDEN */}
          <SectionInline title={t("settings.sectionLegal")}>
            <MenuItem label={t("settings.termsConditions")} onClick={() => navigate("/terms")} />
            <MenuItem label={t("settings.privacyPolicy")} onClick={() => navigate("/datenschutz")} last />
          </SectionInline>

          {/* bottom padding */}
          <div className="h-3" />
        </div>

        <div className="flex flex-col items-center gap-3 pt-4 pb-4">
          <p className="text-[13px] text-[#D1D5DB]">HousAlert v1.0.0</p>
        </div>

        {isAdmin && <div className="h-16" />}
      </div>

      {/* Admin floating button */}
      {isAdmin && (
        <button
          onClick={() => navigate("/admin/portal")}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] left-1/2 -translate-x-1/2 z-40 bg-ha-profile-header text-white text-[14px] font-medium px-4 py-2.5 rounded-[--ha-btn-radius] shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-95 transition-transform"
          data-testid="button-admin-portal"
        >
          {t("profile.adminMode")}
        </button>
      )}

      <LogoutBottomSheet
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={signingOut}
      />

    </div>
  );
}

function ZoekTab({ profiles, navigate }: { profiles: SearchProfile[]; navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const canAdd = profiles.length < MAX_PROFILES;
  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pb-5 flex items-center" style={{ paddingTop: "max(env(safe-area-inset-top), 32px)" }}>
        <h1 className="text-page-title flex-1">{t("nav.search")}</h1>
        {canAdd && profiles.length > 0 && (
          <button
            onClick={() => navigate("/dashboard/searches/new")}
            className="w-9 h-9 rounded-full bg-ha-primary flex items-center justify-center text-white active:scale-90 transition-transform shadow-sm"
            data-testid="button-zoek-add-profile"
          >
            <span className="text-[20px] font-medium leading-none">+</span>
          </button>
        )}
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
  { key: "favorieten", labelKey: "nav.favorites", Icon: Heart },
  { key: "profiel", labelKey: "nav.profile", Icon: User },
];

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [initialMatchesTopTab] = useState<MatchesTopTab | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "gereageerd") return "gereageerd";
    return null;
  });
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "gereageerd") return "matches";
    if (tab && ["home", "matches", "favorieten", "profiel"].includes(tab)) {
      return tab as TabKey;
    }
    return "home";
  });
  const sub = useSubscription();
  const { toast } = useToast();

  const accessToken = session?.access_token;
  const buddyConns = useBuddyConnections();
  const inBuddyMode = isBuddyMode(buddyConns.data);
  const activeBuddyRel = getActiveBuddyRelation(buddyConns.data);
  const ownerSubActive = isOwnerSubActive(buddyConns.data);

  // Detect when former buddy transitions to standalone user
  const [showBuddyUnlinkedModal, setShowBuddyUnlinkedModal] = useState(false);
  useEffect(() => {
    if (buddyConns.isLoading || !buddyConns.data) return;
    if (inBuddyMode) {
      localStorage.setItem("ha_buddy_was_active", "1");
    } else {
      const wasBuddy = localStorage.getItem("ha_buddy_was_active") === "1";
      if (wasBuddy) {
        localStorage.removeItem("ha_buddy_was_active");
        setShowBuddyUnlinkedModal(true);
      }
    }
  }, [buddyConns.data, buddyConns.isLoading, inBuddyMode]);

  // Detect when the owner's connected buddy disconnects themselves → show toast
  const prevOwnerStatusRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (buddyConns.isLoading || !buddyConns.data) return;
    const currentStatus = buddyConns.data.asOwner?.invite_status ?? null;
    const prev = prevOwnerStatusRef.current;
    if (prev === undefined) {
      prevOwnerStatusRef.current = currentStatus;
      return;
    }
    if (prev === "accepted" && currentStatus !== "accepted") {
      toast({ title: t("buddyV2.ownerBuddyLeft") });
    }
    prevOwnerStatusRef.current = currentStatus;
  }, [buddyConns.data, buddyConns.isLoading]);

  const profilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user && !inBuddyMode,
  });

  const ownerProfilesQuery = useQuery<SearchProfile[]>({
    queryKey: ["/api/buddy/owner-profiles"],
    queryFn: async () => {
      const res = await apiFetch("/api/buddy/owner-profiles", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && !!accessToken && inBuddyMode,
  });

  const hasActiveSub = sub.isActive || sub.isTrial;

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [activeTab]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
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
      <div className="min-h-screen bg-[#eaeaeb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-white animate-pulse" />
          <p className="text-[#111111]/70 text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const profiles = inBuddyMode ? (ownerProfilesQuery.data ?? []) : (profilesQuery.data ?? []);
  const matchCount = apiMatchesQuery.data?.totalCount ?? 0;
  const newCount = apiMatchesQuery.data?.newCount ?? 0;

  const allMatches = apiMatchesQuery.data?.matches ?? [];
  const computedAppliedCount = allMatches.length > 0
    ? allMatches.filter(m => getMatchTab(m) === "gereageerd").length
    : (apiMatchesQuery.data?.canonicalStats?.applied ?? 0);

  return (
    <div className="min-h-screen bg-[#eaeaeb] flex flex-col">
      {inBuddyMode && activeBuddyRel && (
        <div className="bg-[#2D3748] px-4 py-3 flex items-center gap-3 max-w-xl mx-auto w-full" data-testid="banner-buddy-mode">
          <Users className="w-5 h-5 text-white/80 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">{t("buddyV2.modeBadge")}</p>
            <p className="text-[12px] text-white/70">{t("buddyV2.modeBanner").replace("{name}", activeBuddyRel.owner_name || "")}</p>
          </div>
        </div>
      )}
      {inBuddyMode && activeBuddyRel && !ownerSubActive && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3 max-w-xl mx-auto w-full" data-testid="banner-buddy-sub-paused">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-[13px] text-amber-800">{t("buddyV2.subPaused").replace("{name}", activeBuddyRel.owner_name || "")}</p>
        </div>
      )}
      {sub.isPastDue && !inBuddyMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3 max-w-xl mx-auto w-full" data-testid="banner-past-due">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800">{t("subscription.pastDue.title")}</p>
            <p className="text-[12px] text-amber-700">{t("subscription.pastDue.desc")}</p>
          </div>
          <button
            onClick={() => navigate("/account/subscription")}
            className="px-3 py-1.5 rounded-full bg-amber-600 text-white text-[12px] font-semibold flex-shrink-0 active:scale-[0.97] transition-transform"
            data-testid="button-fix-payment"
          >
            {t("subscription.pastDue.action")}
          </button>
        </div>
      )}
      <main className="flex-1 max-w-xl mx-auto w-full pb-[100px]">
        {activeTab === "home" && (
          <HomeTab
            user={user}
            profiles={profiles}
            navigate={navigate}
            setActiveTab={setActiveTab}
            subscription={{ isTrial: sub.isTrial, isExpired: sub.isExpired, isActive: sub.isActive, trialEndsAt: sub.trialEndsAt }}
            accessToken={accessToken}
            buddyMode={inBuddyMode}
            showBuddyUnlinked={showBuddyUnlinkedModal}
            onDismissBuddyUnlinked={() => setShowBuddyUnlinkedModal(false)}
          />
        )}
        {activeTab === "matches" && (
          <MatchesTab accessToken={accessToken} setActiveTab={setActiveTab} initialTopTab={initialMatchesTopTab} buddyMode={inBuddyMode} ownerSubActive={ownerSubActive} />
        )}
        {activeTab === "favorieten" && (
          <FavorietenTab accessToken={accessToken} navigate={navigate} />
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
            buddyMode={inBuddyMode}
            activeBuddyRel={activeBuddyRel}
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
                  <Icon className={`w-[26px] h-[26px] transition-colors ${isActive ? "text-ha-primary" : "text-[#334855]"}`} strokeWidth={isActive ? 2.2 : 1.6} />
                )}
                <span className={`text-[11px] leading-tight transition-colors ${isActive ? "font-semibold text-ha-primary" : "font-medium text-[#334855]"}`}>
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
