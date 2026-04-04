import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { Check, Bell, Mail, Globe } from "lucide-react";
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
    <div className="min-h-screen" style={{ backgroundColor: "#F7F7F7" }}>
      <AppHeader title={t("settings.preferences")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-row-section-title px-1 mb-2">
              {t("settings.sectionLanguage")}
            </p>
            <div className="app-card !p-0">
              <button
                onClick={() => setShowLangSheet(true)}
                className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-[#F7F7F7] transition-colors"
                data-testid="button-pref-language"
              >
                <Globe className="w-5 h-5 text-ha-text-muted flex-shrink-0" />
                <p className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.language")}</p>
                <span className="text-[14px] text-ha-text-secondary mr-1">{currentLangLabel}</span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-row-section-title px-1 mb-2">
              {t("settings.sectionNotifications")}
            </p>
            <div className="app-card !p-0">
              <div className="flex items-center gap-3 py-4 px-5">
                <Bell className="w-5 h-5 text-ha-text-muted flex-shrink-0" />
                <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.pushNotifications")}</span>
                <button
                  onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
                  disabled={loading || notifUpdating === "push_enabled"}
                  className={`w-[48px] h-[28px] rounded-full relative transition-colors ${notifSettings?.push_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${(loading || notifUpdating === "push_enabled") ? "opacity-50" : ""}`}
                  data-testid="toggle-push"
                >
                  <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[23px]" : "left-[3px]"}`} />
                </button>
              </div>
              <div className="h-px bg-ha-divider mx-5" />
              <div className="flex items-center gap-3 py-4 px-5">
                <Mail className="w-5 h-5 text-ha-text-muted flex-shrink-0" />
                <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.emailNotifications")}</span>
                <button
                  onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
                  disabled={loading || notifUpdating === "email_enabled"}
                  className={`w-[48px] h-[28px] rounded-full relative transition-colors ${notifSettings?.email_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${(loading || notifUpdating === "email_enabled") ? "opacity-50" : ""}`}
                  data-testid="toggle-email"
                >
                  <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.email_enabled ? "left-[23px]" : "left-[3px]"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLangSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLangSheet(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-bold text-[#111111] text-center mb-4">{t("profile.language")}</p>
            {LANG_OPTIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between py-3.5 px-2 rounded-[6px] text-left active:bg-[#F7F7F7] transition-colors ${locale === lang.code ? "bg-ha-primary/10" : ""}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px] text-[#111111] font-medium">{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-ha-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
