import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { Check, ChevronRight } from "lucide-react";
import { isPushSupported, getPushPermissionState, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { AppHeader } from "@/components/ui/app-header";

export default function PreferencesPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();

  const [showLangSheet, setShowLangSheet] = useState(false);
  const [notifSettings, setNotifSettings] = useState<{ push_enabled: boolean; email_enabled: boolean } | null>(null);
  const [notifUpdating, setNotifUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const LANG_OPTIONS = [
    { code: "de" as const, label: "Deutsch" },
    { code: "en" as const, label: "English" },
    { code: "nl" as const, label: "Nederlands" },
  ];
  const currentLangLabel = LANG_OPTIONS.find(o => o.code === locale)?.label || "Deutsch";

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch("/api/notifications/settings", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setNotifSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  async function handleToggleNotif(key: "email_enabled" | "push_enabled", currentVal: boolean) {
    setNotifUpdating(key);
    try {
      if (!session?.access_token) return;

      if (key === "push_enabled" && !currentVal) {
        const supported = isPushSupported();
        if (!supported) {
          toast({ title: t("settings.pushNotSupported"), variant: "destructive" });
          setNotifUpdating(null);
          return;
        }
        const perm = await getPushPermissionState();
        if (perm === "denied") {
          toast({ title: t("settings.pushDenied"), variant: "destructive" });
          setNotifUpdating(null);
          return;
        }
        await subscribeToPush(session.access_token);
      } else if (key === "push_enabled" && currentVal) {
        await unsubscribeFromPush(session.access_token);
      }

      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [key]: !currentVal }),
      });
      if (!res.ok) throw new Error("Update failed");
      setNotifSettings((prev) => prev ? { ...prev, [key]: !currentVal } : prev);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setNotifUpdating(null);
    }
  }

  async function handleLanguageChange(code: "de" | "en" | "nl") {
    setShowLangSheet(false);
    setLocale(code);
    try {
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

  return (
    <div className="min-h-screen bg-ha-bg">
      <AppHeader title={t("settings.preferences")} onBack={() => navigate("/dashboard?tab=profile")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">

        {/* ONE white panel */}
        <div className="bg-white rounded-[12px] border border-ha-card-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* TAAL section */}
          <p className="text-[18px] font-bold text-ha-text px-4 pt-5 pb-3">
            {t("settings.sectionLanguage")}
          </p>

          <div className="px-4 pb-4">
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full flex items-center justify-between px-4 h-[60px] text-left bg-white border border-ha-border-input rounded-[8px] active:bg-ha-surface transition-colors"
              data-testid="button-pref-language"
            >
              <span className="text-[15px] font-medium text-ha-text-secondary">{t("profile.language")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-normal text-ha-text-muted">{currentLangLabel}</span>
                <ChevronRight className="w-[16px] h-[16px] text-ha-text-placeholder flex-shrink-0" />
              </div>
            </button>
          </div>

          {/* Divider before notifications */}
          <div className="h-px bg-ha-surface" />

          {/* NOTIFICATIES section */}
          <p className="text-[18px] font-bold text-ha-text px-4 pt-5 pb-3">
            {t("settings.sectionNotifications")}
          </p>

          {/* Push row */}
          <div className="flex items-center px-4 h-[52px]">
            <span className="text-[15px] font-medium text-ha-text-secondary flex-1">{t("profile.pushNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
              disabled={loading || notifUpdating === "push_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${notifSettings?.push_enabled ? "bg-ha-primary" : "bg-ha-card-border"} ${(loading || notifUpdating === "push_enabled") ? "opacity-50" : ""}`}
              data-testid="toggle-push"
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          <div className="h-px bg-ha-surface mx-4" />

          {/* Email row */}
          <div className="flex items-center px-4 h-[52px]">
            <span className="text-[15px] font-medium text-ha-text-secondary flex-1">{t("profile.emailNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
              disabled={loading || notifUpdating === "email_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${notifSettings?.email_enabled ? "bg-ha-primary" : "bg-ha-card-border"} ${(loading || notifUpdating === "email_enabled") ? "opacity-50" : ""}`}
              data-testid="toggle-email"
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.email_enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          <div className="h-3" />
        </div>
      </div>

      {/* Language bottom sheet */}
      {showLangSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setShowLangSheet(false)}
        >
          <div
            className="bg-white w-full rounded-t-[14px] px-5 pt-5 pb-8 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {LANG_OPTIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className="w-full flex items-center justify-between py-4 px-2 text-left border-b border-ha-surface last:border-0 transition-colors active:bg-ha-surface"
                data-testid={`button-lang-${lang.code}`}
              >
                <span className={`text-[16px] font-semibold ${locale === lang.code ? "text-ha-primary" : "text-ha-text"}`}>{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-ha-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
