import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { Check, Bell, Mail, Globe, Sun, Moon, Monitor } from "lucide-react";
import { isPushSupported, getPushPermissionState, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { PageHeader } from "@/components/ui/page-header";
import { useTheme } from "@/lib/theme-provider";

type ThemeOption = "light" | "dark" | "system";

export default function PreferencesPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();

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

  const THEME_OPTIONS: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("settings.themeLight"), icon: Sun },
    { value: "dark", label: t("settings.themeDark"), icon: Moon },
    { value: "system", label: t("settings.themeSystem"), icon: Monitor },
  ];

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
      <PageHeader title={t("settings.preferences")} onBack={() => navigate("/settings")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[12px] font-medium text-ha-text-secondary uppercase tracking-wider px-1 mb-2">
              {t("settings.sectionTheme")}
            </p>
            <div className="rounded-[6px] bg-ha-card px-2 py-2">
              <div className="grid grid-cols-3 gap-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const isActive = theme === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-[6px] transition-all active:scale-[0.97] ${
                        isActive ? "bg-ha-primary text-white" : "text-ha-text-secondary hover:bg-ha-surface"
                      }`}
                      data-testid={`theme-${opt.value}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[12px] font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium text-ha-text-secondary uppercase tracking-wider px-1 mb-2">
              {t("settings.sectionLanguage")}
            </p>
            <div className="rounded-[6px] bg-ha-card px-5 py-1">
              <button
                onClick={() => setShowLangSheet(true)}
                className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
                data-testid="button-pref-language"
              >
                <Globe className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
                <p className="text-[15px] text-ha-text flex-1">{t("profile.language")}</p>
                <span className="text-[13px] text-ha-text-secondary mr-1">{currentLangLabel}</span>
              </button>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium text-ha-text-secondary uppercase tracking-wider px-1 mb-2">
              {t("settings.sectionNotifications")}
            </p>
            <div className="rounded-[6px] bg-ha-card px-5 py-1">
              <div className="flex items-center gap-3 py-3.5">
                <Bell className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
                <span className="text-[15px] text-ha-text flex-1">{t("profile.pushNotifications")}</span>
                <button
                  onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
                  disabled={loading || notifUpdating === "push_enabled"}
                  className={`w-[48px] h-[28px] rounded-full relative transition-colors ${notifSettings?.push_enabled ? "bg-ha-primary" : "bg-ha-input-border"} ${(loading || notifUpdating === "push_enabled") ? "opacity-50" : ""}`}
                  data-testid="toggle-push"
                >
                  <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-ha-card shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[23px]" : "left-[3px]"}`} />
                </button>
              </div>
              <div className="h-px bg-ha-surface" />
              <div className="flex items-center gap-3 py-3.5">
                <Mail className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
                <span className="text-[15px] text-ha-text flex-1">{t("profile.emailNotifications")}</span>
                <button
                  onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
                  disabled={loading || notifUpdating === "email_enabled"}
                  className={`w-[48px] h-[28px] rounded-full relative transition-colors ${notifSettings?.email_enabled ? "bg-ha-primary" : "bg-ha-input-border"} ${(loading || notifUpdating === "email_enabled") ? "opacity-50" : ""}`}
                  data-testid="toggle-email"
                >
                  <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-ha-card shadow-sm transition-transform ${notifSettings?.email_enabled ? "left-[23px]" : "left-[3px]"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLangSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLangSheet(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] text-title text-ha-text text-center mb-4">{t("profile.language")}</p>
            {LANG_OPTIONS.map(lang => (
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
