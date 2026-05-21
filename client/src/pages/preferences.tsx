import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { Check, ChevronRight, Bell, Loader2 } from "lucide-react";
import { isPushSupported, getPushPermissionState, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { isNativePlatform, registerNativePush, getPlatform } from "@/lib/capacitor";
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
  const [activeTokenCount, setActiveTokenCount] = useState<number | null>(null);
  const [sendingTestPush, setSendingTestPush] = useState(false);

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

    if (isNativePlatform()) {
      apiFetch("/api/push/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => setActiveTokenCount(data?.devices ?? 0))
        .catch(() => {});
    }
  }, [session?.access_token]);

  async function handleToggleNotif(key: "email_enabled" | "push_enabled", currentVal: boolean) {
    setNotifUpdating(key);
    try {
      if (!session?.access_token) return;

      if (key === "push_enabled") {
        if (isNativePlatform()) {
          if (!currentVal) {
            const token = await registerNativePush();
            if (!token) {
              toast({ title: t("settings.pushDenied"), description: "Verleen toestemming voor meldingen via Android-instellingen → HousAlert.", variant: "destructive" });
              setNotifUpdating(null);
              return;
            }
            const regRes = await apiFetch("/api/expo-push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ expo_push_token: token, platform: getPlatform() }),
            });
            if (!regRes.ok) {
              toast({ title: t("common.error"), description: "Token registratie mislukt. Probeer opnieuw.", variant: "destructive" });
              setNotifUpdating(null);
              return;
            }
            const regData = await regRes.json();
            setActiveTokenCount(regData.active_token_count ?? 1);
            setNotifSettings((prev) => prev ? { ...prev, push_enabled: true } : prev);
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
            toast({ title: "Push-meldingen ingeschakeld" });
          } else {
            const res = await apiFetch("/api/notifications/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ push_enabled: false }),
            });
            if (!res.ok) throw new Error("Update failed");
            setNotifSettings((prev) => prev ? { ...prev, push_enabled: false } : prev);
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
          }
          setNotifUpdating(null);
          return;
        }

        if (!currentVal) {
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
        } else {
          await unsubscribeFromPush(session.access_token);
        }
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

  async function sendTestPush() {
    if (!session?.access_token || sendingTestPush) return;
    setSendingTestPush(true);
    try {
      const res = await apiFetch("/api/push/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Test melding verstuurd", description: `${data.sent} melding(en) verzonden.` });
      } else {
        toast({ title: "Test mislukt", description: data.error || "Geen actieve tokens gevonden.", variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSendingTestPush(false);
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

  const isAndroidNative = isNativePlatform();
  const pushActive = notifSettings?.push_enabled && (activeTokenCount === null || activeTokenCount > 0);

  return (
    <div className="min-h-screen bg-ha-bg">
      <AppHeader title={t("settings.preferences")} onBack={() => navigate("/dashboard?tab=profile")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">

        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
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
          <div className="px-5">
            <div className="flex items-center h-[56px]">
              <div className="flex-1 min-w-0">
                <span className="text-[15px] font-semibold text-[#111111]">{t("profile.pushNotifications")}</span>
                {isAndroidNative && notifSettings?.push_enabled && (
                  <p className="text-[11px] mt-0.5" style={{ color: activeTokenCount === 0 ? "#e11d48" : "#15803d" }}>
                    {activeTokenCount === 0 ? "⚠ Geen actief token" : `✓ Actief (${activeTokenCount} apparaat${activeTokenCount !== 1 ? "en" : ""})`}
                  </p>
                )}
              </div>
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

            {/* Native push: test button + Samsung hint */}
            {isAndroidNative && notifSettings?.push_enabled && (
              <div className="pb-4 space-y-3">
                <button
                  onClick={sendTestPush}
                  disabled={sendingTestPush}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all active:opacity-70 disabled:opacity-50"
                  style={{ backgroundColor: "#f0eaff", color: "#7c3aed", border: "1px solid #ddd6fe" }}
                  data-testid="button-test-push"
                >
                  {sendingTestPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  {sendingTestPush ? "Verzenden…" : "Stuur testmelding"}
                </button>
                <div className="rounded-[12px] px-3 py-2.5" style={{ backgroundColor: "#fef9ee", border: "1px solid #fde68a" }}>
                  <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#92400e" }}>Samsung / Xiaomi tip</p>
                  <p className="text-[11px] leading-snug" style={{ color: "#78350f" }}>
                    Als je geen meldingen ontvangt: open Instellingen → Apps → HousAlert → Batterij → Sta achtergrondactiviteit toe. Schakel ook "Slaapstand" uit.
                  </p>
                </div>
              </div>
            )}
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
