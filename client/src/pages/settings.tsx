import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSearchProfiles, deleteSearchProfile, type SearchProfile } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/lib/subscription";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import {
  ArrowLeft,
  Search,
  Plus,
  Pencil,
  Sparkles,
  Users,
  Crown,
  User,
  Globe,
  Shield,
  HelpCircle,
  FileText,
  Gift,
  LogOut,
  Trash2,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react";

const MAX_PROFILES = 4;

function getProfileTitle(profile: SearchProfile, t: (key: string) => string, locale: string): string {
  return profile.city_name || profile.city || t("profile.searchProfileDefault");
}

function getProfileSummary(profile: SearchProfile, t: (key: string) => string): string {
  const parts: string[] = [];
  if (profile.min_price || profile.max_price) {
    parts.push(`€${profile.min_price || 0}–€${profile.max_price || "∞"}`);
  }
  if (profile.min_bedrooms) {
    parts.push(`${profile.min_bedrooms}+ ${t("common.bedrooms")}`);
  }
  return parts.join(" · ") || "";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();
  const subscription = useSubscription();

  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const [buddyExpanded, setBuddyExpanded] = useState(false);
  const [buddyEmail, setBuddyEmail] = useState("");
  const [buddySaving, setBuddySaving] = useState(false);
  const [showBuddyDeleteConfirm, setShowBuddyDeleteConfirm] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["/api/profile-data"],
  });
  const pd = profileQuery.data as any;

  const spQuery = useQuery({
    queryKey: ["search-profiles"],
    queryFn: getSearchProfiles,
  });
  const spList = (spQuery.data || []) as SearchProfile[];
  const spCount = spList.length;

  const letterQuery = useQuery({
    queryKey: ["/api/application-letter"],
  });
  const letterPreview = (letterQuery.data as any)?.letter;

  const referralQuery = useQuery({
    queryKey: ["/api/referral/code"],
  });

  const currentLangLabel = locale === "de" ? "Deutsch" : locale === "en" ? "English" : "Nederlands";

  const handleBuddyInvite = useCallback(async () => {
    if (!buddyEmail.trim()) return;
    setBuddySaving(true);
    try {
      await apiFetch("/api/profile-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_buddy_email: buddyEmail.trim() }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      setBuddyExpanded(false);
      setBuddyEmail("");
      toast({ title: t("profile.buddyInviteSent") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setBuddySaving(false);
    }
  }, [buddyEmail, t, toast]);

  const handleBuddyDelete = useCallback(async () => {
    try {
      await apiFetch("/api/profile-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_buddy_email: null }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      setShowBuddyDeleteConfirm(false);
      toast({ title: t("profile.buddyRemoved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  }, [t, toast]);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/welcome");
    } catch {
      setSigningOut(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLocale(lang as "de" | "en" | "nl");
    setShowLangSheet(false);
    if (user) {
      apiFetch("/api/profile-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-ha-bg">
      <div className="sticky top-0 z-10 bg-ha-bg border-b border-ha-card-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center active:bg-ha-surface transition-colors"
          data-testid="button-settings-back"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text" />
        </button>
        <h1 className="text-[18px] font-bold text-ha-text" data-testid="text-settings-title">
          {t("settings.title")}
        </h1>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-3">

          <div className="rounded-[6px] bg-ha-card px-5 py-4" data-testid="card-search-profiles">
            <div className="flex items-center gap-3 mb-1">
              <Search className="w-5 h-5 text-ha-primary flex-shrink-0" />
              <p className="text-[16px] font-bold text-ha-text flex-1">{t("profile.searchProfiles")}</p>
              <span className="text-[13px] font-semibold text-ha-primary">{spCount}/{MAX_PROFILES}</span>
            </div>

            {spList.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {spList.map((sp: SearchProfile) => (
                  <button
                    key={sp.id}
                    onClick={() => navigate(`/dashboard/searches/edit/${sp.id}`)}
                    className="flex items-center gap-3 py-2 px-1 rounded-[6px] active:bg-ha-surface transition-colors text-left"
                    data-testid={`button-search-profile-${sp.id}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-ha-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-ha-text truncate">{getProfileTitle(sp, t, locale)}</p>
                      {sp.districts && sp.districts.length > 0 && (
                        <p className="text-[13px] text-ha-text-secondary mt-0.5 truncate">
                          {sp.districts.length <= 2
                            ? sp.districts.join(", ")
                            : `${sp.districts[0]} ${t("profile.andOtherNeighborhoods", { count: sp.districts.length - 1 })}`
                          }
                        </p>
                      )}
                    </div>
                    <Pencil className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate("/dashboard/searches/new")}
              className="w-full mt-3 h-[44px] rounded-[6px] border border-ha-primary text-ha-primary text-[14px] font-semibold flex items-center justify-center gap-1.5 active:bg-ha-primary-light transition-colors"
              data-testid="button-extra-profile"
            >
              {t("profile.newSearchProfile")} <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-4">
            <button
              onClick={() => navigate("/application-letter")}
              className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
              data-testid="button-reaction-letter"
            >
              <Sparkles className="w-5 h-5 text-ha-primary flex-shrink-0" />
              <p className="text-[16px] font-bold text-ha-text flex-1">{t("profile.reactionLetter2")}</p>
              <span className="text-[13px] font-semibold text-ha-primary">{letterPreview ? t("profile.editAction") : t("profile.generateAction")}</span>
            </button>
            {letterPreview ? (
              <p className="text-[13px] text-ha-success mt-2 flex items-center gap-1.5 pl-8"><Check className="w-4 h-4" /> {t("profile.letterSet")}</p>
            ) : (
              <p className="text-[13px] text-ha-danger mt-2 flex items-center gap-1.5 pl-8"><X className="w-4 h-4" /> {t("profile.noLetterYet")}</p>
            )}
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-4" id="zoekbuddy-section" data-testid="row-zoekbuddy">
            <button
              onClick={() => {
                if (!buddyExpanded) {
                  setBuddyEmail(pd?.search_buddy_email || "");
                  setBuddyExpanded(true);
                } else {
                  setBuddyExpanded(false);
                  setBuddyEmail("");
                }
              }}
              className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
              data-testid="button-buddy-toggle"
            >
              <Users className="w-5 h-5 text-ha-primary flex-shrink-0" />
              <p className="text-[16px] font-bold text-ha-text flex-1">{t("profile.zoekbuddyTitle")}</p>
              {!buddyExpanded && pd?.search_buddy_email ? (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); setShowBuddyDeleteConfirm(true); }}
                  className="text-[13px] font-semibold text-ha-primary"
                  data-testid="button-buddy-remove-x"
                >
                  {t("profile.manageAction")}
                </span>
              ) : !buddyExpanded ? (
                <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
              ) : null}
            </button>
            {!buddyExpanded && (
              <p className="text-[13px] text-ha-text-secondary mt-1.5 leading-relaxed pl-8">{t("profile.buddyDescription")}</p>
            )}
            {!buddyExpanded && pd?.search_buddy_email && (
              <p className="text-[13px] text-ha-success mt-2 flex items-center gap-1.5 pl-8"><Check className="w-4 h-4" /> {pd.search_buddy_email}</p>
            )}
            {!buddyExpanded && !pd?.search_buddy_email && (
              <p className="text-[13px] text-ha-danger mt-2 flex items-center gap-1.5 pl-8"><X className="w-4 h-4" /> {t("profile.noBuddyYet")}</p>
            )}
            {buddyExpanded && (
              <div className="pt-3 pb-1 animate-in slide-in-from-top-1 duration-200" data-testid="editor-zoekbuddy">
                <div className="relative mb-4">
                  <input
                    type="email"
                    value={buddyEmail}
                    onChange={e => setBuddyEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBuddyInvite(); }}
                    placeholder={t("profileEdit.searchBuddyPlaceholder")}
                    autoFocus
                    className="w-full bg-ha-bg rounded-[6px] px-5 py-4 text-[16px] text-ha-text placeholder:text-ha-text-muted border border-ha-card-border focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] focus:outline-none transition-all h-[52px]"
                    data-testid="input-buddy-email"
                  />
                  {buddyEmail && (
                    <button
                      type="button"
                      onClick={() => setBuddyEmail("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-ha-surface flex items-center justify-center active:scale-90 transition-transform"
                      data-testid="button-buddy-clear"
                    >
                      <X className="w-3.5 h-3.5 text-ha-text-secondary" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBuddyInvite}
                    disabled={buddySaving || !buddyEmail.trim()}
                    className="h-[48px] px-8 rounded-[6px] bg-ha-primary text-white text-[15px] font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                    data-testid="button-buddy-save"
                  >
                    {buddySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profileDetails.saveAndContinue")}
                  </button>
                  <button
                    onClick={() => { setBuddyExpanded(false); setBuddyEmail(""); }}
                    className="h-[48px] px-5 rounded-[6px] text-ha-text-secondary text-[14px] font-medium active:bg-ha-surface transition-colors"
                    data-testid="button-buddy-cancel"
                  >
                    {t("profileDetails.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-4" data-testid="card-subscription-plus">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full flex items-center gap-3 text-left active:opacity-80 transition-opacity"
              data-testid="button-subscription"
            >
              <Crown className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-[16px] font-bold text-ha-text flex-1">{t("profile.housAlertPlus")}</p>
              <span className="text-[13px] font-semibold text-ha-primary">{t("profile.viewAction")}</span>
            </button>
            <p className="text-[13px] text-ha-text-secondary mt-1.5 leading-relaxed pl-8">{t("profile.plusDescription")}</p>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={() => navigate("/profile/details")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-personal-info"
            >
              <User className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.personalInfo")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-language"
            >
              <Globe className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.language")}</p>
              <span className="text-[13px] text-ha-text-secondary mr-1">{currentLangLabel}</span>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={() => navigate("/datenschutz")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-privacy"
            >
              <Shield className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.privacy")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => { window.location.href = "mailto:support@housalert.com"; }}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-help-support"
            >
              <HelpCircle className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.helpSupport")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => navigate("/terms")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-terms"
            >
              <FileText className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.terms")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={async () => {
                const code = referralQuery.data?.code;
                if (!code) return;
                try {
                  await navigator.clipboard.writeText(code);
                  setReferralCopied(true);
                  toast({ title: t("referral.copied") });
                  setTimeout(() => setReferralCopied(false), 2000);
                } catch {
                  toast({ title: t("referral.copyFailed"), variant: "destructive" });
                }
              }}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-invite-friends"
            >
              <Gift className="w-5 h-5 text-ha-primary flex-shrink-0" />
              <p className="text-[15px] font-bold text-ha-text flex-1">{t("profile.inviteFriends")}</p>
              <span className="text-[13px] font-semibold text-ha-primary">{referralCopied ? t("referral.copiedShort") : t("profile.shareAction")}</span>
            </button>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={signingOut}
              className={`w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5 text-ha-danger flex-shrink-0" />
              <p className="text-[15px] text-ha-danger flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-delete-account"
            >
              <Trash2 className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text-secondary flex-1">{t("profile.deleteAccount")}</p>
            </button>
          </div>

        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-ha-text text-center">{t("profile.logoutConfirm")}</p>
            <p className="text-[14px] text-ha-text-secondary text-center mt-2 mb-6">{t("profile.logoutDesc")}</p>
            <button
              onClick={handleLogout}
              className="w-full h-[48px] rounded-[6px] bg-ha-danger text-white text-[15px] font-semibold mb-3 active:scale-[0.98] transition-transform"
              data-testid="button-logout-confirm"
            >
              {t("profile.logoutYes")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full h-[48px] rounded-[6px] text-ha-text text-[15px] font-medium active:bg-ha-surface transition-colors"
              data-testid="button-logout-cancel"
            >
              {t("profileDetails.cancel")}
            </button>
          </div>
        </div>
      )}

      {showBuddyDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBuddyDeleteConfirm(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-ha-text text-center">{t("profile.buddyDeleteTitle")}</p>
            <p className="text-[14px] text-ha-text-secondary text-center mt-2 mb-6">{t("profile.buddyDeleteDesc")}</p>
            <button
              onClick={handleBuddyDelete}
              className="w-full h-[48px] rounded-[6px] bg-ha-danger text-white text-[15px] font-semibold mb-3 active:scale-[0.98] transition-transform"
              data-testid="button-buddy-delete-confirm"
            >
              {t("profile.buddyRemoveLabel")}
            </button>
            <button
              onClick={() => setShowBuddyDeleteConfirm(false)}
              className="w-full h-[48px] rounded-[6px] text-ha-text text-[15px] font-medium active:bg-ha-surface transition-colors"
              data-testid="button-buddy-delete-cancel"
            >
              {t("profileDetails.cancel")}
            </button>
          </div>
        </div>
      )}

      {showLangSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLangSheet(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-ha-text text-center mb-4">{t("profile.language")}</p>
            {[
              { code: "de", label: "Deutsch" },
              { code: "en", label: "English" },
              { code: "nl", label: "Nederlands" },
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between py-3.5 px-2 rounded-[6px] text-left active:bg-ha-surface transition-colors ${locale === lang.code ? "bg-ha-primary-light" : ""}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px] text-ha-text">{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-ha-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
