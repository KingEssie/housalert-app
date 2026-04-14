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
    <div className="min-h-screen bg-[#eaeaeb]">
      <AppHeader title={t("settings.preferences")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">

        {/* ONE white panel */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* TAAL section */}
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-4 pt-4 pb-1">
            {t("settings.sectionLanguage")}
          </p>

          <button
            onClick={() => setShowLangSheet(true)}
            className="w-full flex items-center justify-between px-4 h-[52px] text-left active:bg-[#F9FAFB] transition-colors"
            data-testid="button-pref-language"
          >
            <span className="text-[15px] font-semibold text-[#111111]">{t("profile.language")}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] text-[#6B7280]">{currentLangLabel}</span>
              <ChevronRight className="w-[15px] h-[15px] text-[#D1D5DB] flex-shrink-0" />
            </div>
          </button>

          {/* Divider before notifications */}
          <div className="h-px bg-[#F3F4F6]" />

          {/* NOTIFICATIES section */}
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-4 pt-4 pb-1">
            {t("settings.sectionNotifications")}
          </p>

          {/* Push row */}
          <div className="flex items-center px-4 h-[52px]">
            <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.pushNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
              disabled={loading || notifUpdating === "push_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${notifSettings?.push_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${(loading || notifUpdating === "push_enabled") ? "opacity-50" : ""}`}
              data-testid="toggle-push"
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          <div className="h-px bg-[#F3F4F6] mx-4" />

          {/* Email row */}
          <div className="flex items-center px-4 h-[52px]">
            <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.emailNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
              disabled={loading || notifUpdating === "email_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${notifSettings?.email_enabled ? "bg-ha-primary" : "bg-[#E5E7EB]"} ${(loading || notifUpdating === "email_enabled") ? "opacity-50" : ""}`}
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
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowLangSheet(false)}
        >
          <div
            className="bg-white w-full max-w-[400px] rounded-t-[14px] sm:rounded-[14px] px-5 pt-6 pb-6 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[17px] font-semibold text-[#111111] text-center mb-4">{t("profile.language")}</p>
            {LANG_OPTIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between py-3.5 px-3 rounded-[10px] text-left transition-colors ${locale === lang.code ? "bg-ha-primary/10" : "active:bg-[#F9FAFB]"}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px] font-semibold text-[#111111]">{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-ha-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
