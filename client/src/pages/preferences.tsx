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
        const subscribeOk = await subscribeToPush(session.access_token);
        if (!subscribeOk) {
          toast({ title: t("notifications.pushFailedTitle"), description: t("notifications.pushFailedDesc"), variant: "destructive" });
          setNotifUpdating(null);
          return;
        }
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
    <div className="min-h-screen" style={{ backgroundColor: "#f9f7f8" }}>
      <AppHeader title={t("settings.preferences")} onBack={() => navigate("/dashboard?tab=profile")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">

        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px_8px_rgba(0,0,0,0.04)" }}
        >

          {/* TAAL section */}
          <p className="text-[18px] font-bold text-[#111111] px-5 pt-6 pb-3">
            {t("settings.sectionLanguage")}
          </p>

          <div className="px-5 pb-5">
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full flex items-center justify-between px-4 text-left bg-white rounded-[18px] active:opacity-70 transition-opacity"
              style={{ height: "60px", border: "1px solid #d9d3e3" }}
              data-testid="button-pref-language"
            >
              <span className="text-[15px] font-semibold text-[#111111]">{t("profile.language")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[15px] text-[#666666]">{currentLangLabel}</span>
                <ChevronRight className="w-[16px] h-[16px] flex-shrink-0" style={{ color: "#6b6677" }} />
              </div>
            </button>
          </div>

          <div className="h-px mx-5" style={{ backgroundColor: "#ece7ef" }} />

          {/* NOTIFICATIES section */}
          <p className="text-[18px] font-bold text-[#111111] px-5 pt-6 pb-3">
            {t("settings.sectionNotifications")}
          </p>

          {/* Push row */}
          <div className="flex items-center px-5 h-[56px]">
            <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.pushNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("push_enabled", !!notifSettings?.push_enabled)}
              disabled={loading || notifUpdating === "push_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${(loading || notifUpdating === "push_enabled") ? "opacity-50" : ""}`}
              style={{ backgroundColor: notifSettings?.push_enabled ? "#b9a7ff" : "#d9d3e3" }}
              data-testid="toggle-push"
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.push_enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          <div className="h-px mx-5" style={{ backgroundColor: "#ece7ef" }} />

          {/* Email row */}
          <div className="flex items-center px-5 h-[56px]">
            <span className="text-[15px] font-semibold text-[#111111] flex-1">{t("profile.emailNotifications")}</span>
            <button
              onClick={() => handleToggleNotif("email_enabled", !!notifSettings?.email_enabled)}
              disabled={loading || notifUpdating === "email_enabled"}
              className={`w-[48px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ${(loading || notifUpdating === "email_enabled") ? "opacity-50" : ""}`}
              style={{ backgroundColor: notifSettings?.email_enabled ? "#b9a7ff" : "#d9d3e3" }}
              data-testid="toggle-email"
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${notifSettings?.email_enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          <div className="h-5" />
        </div>
      </div>

      {/* Language bottom sheet */}
      {showLangSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setShowLangSheet(false)}
        >
          <div
            className="bg-white w-full rounded-t-[24px] px-5 pt-5 pb-8 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {LANG_OPTIONS.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className="w-full flex items-center justify-between py-4 px-2 text-left border-b last:border-0 transition-colors active:opacity-70"
                style={{ borderColor: "#ece7ef" }}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className={`text-[16px] font-semibold ${locale === lang.code ? "text-[#b9a7ff]" : "text-[#111111]"}`}>{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-[#b9a7ff]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
