import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { Mail, Bell, Loader2, AlertTriangle, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListSection, ListRow, ListDivider } from "@/components/list-section";
import { isPushSupported, getPushPermissionState, getPushUnsupportedReason, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

interface NotificationSettings {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
}

export default function NotificationSettingsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ success: boolean; tokens_found: number; error?: string } | null>(null);

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  const pushSupported = isPushSupported();
  const pushPermission = getPushPermissionState();
  const pushReason = getPushUnsupportedReason();

  function getPushSubtitle(): string {
    if (pushSupported) {
      return pushPermission === "denied"
        ? t("notifications.pushBrowserDenied")
        : t("notifications.pushSubtitle");
    }
    switch (pushReason) {
      case "ios-not-standalone":
        return t("notifications.pushIosHomescreen");
      case "iframe":
        return t("notifications.pushIframe");
      case "insecure-context":
        return t("notifications.pushInsecure");
      default:
        return t("notifications.pushUnsupported");
    }
  }

  useEffect(() => {
    if (!session?.access_token) return;
    setLoadingSettings(true);
    apiFetch("/api/notifications/settings", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data: NotificationSettings) => {
        setEmailEnabled(data.email_enabled);
        setPushEnabled(data.push_enabled ?? false);
      })
      .catch(() => {
        toast({
          title: t("notifications.loadFailed"),
          description: t("notifications.loadFailedDesc"),
          variant: "destructive",
        });
      })
      .finally(() => setLoadingSettings(false));
  }, [session?.access_token]);

  async function handlePushToggle(enabled: boolean) {
    if (!session?.access_token) return;

    setPushLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPush(session.access_token);
        if (!success) {
          const perm = getPushPermissionState();
          if (perm === "denied") {
            toast({
              title: t("notifications.pushDeniedTitle"),
              description: t("notifications.pushDeniedDesc"),
              variant: "destructive",
            });
          } else {
            toast({
              title: t("notifications.pushFailedTitle"),
              description: t("notifications.pushFailedDesc"),
              variant: "destructive",
            });
          }
          return;
        }
      } else {
        await unsubscribeFromPush(session.access_token);
      }

      const settingsRes = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ push_enabled: enabled }),
      });

      if (!settingsRes.ok) {
        if (enabled) await unsubscribeFromPush(session.access_token);
        throw new Error(t("notifications.saveFailedDesc"));
      }

      setPushEnabled(enabled);

      toast({
        title: enabled ? t("notifications.pushEnabledTitle") : t("notifications.pushDisabledTitle"),
        description: enabled ? t("notifications.pushEnabledDesc") : t("notifications.pushDisabledDesc"),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message || t("notifications.pushFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTestPush() {
    if (!session?.access_token) return;
    setTestPushLoading(true);
    setTestPushResult(null);
    try {
      const res = await apiFetch("/api/push/test-self", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTestPushResult(data);
      toast({
        title: data.success ? "Test push verzonden!" : "Test push mislukt",
        description: data.success
          ? `${data.tokens_targeted} token(s) bereikt`
          : data.error || "Onbekende fout",
        variant: data.success ? "default" : "destructive",
      });
    } catch (err: any) {
      setTestPushResult({ success: false, tokens_found: 0, error: err.message });
      toast({ title: "Fout", description: err.message, variant: "destructive" });
    } finally {
      setTestPushLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_enabled: emailEnabled,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("notifications.saveFailed"));
      }

      toast({
        title: t("notifications.saved"),
        description: t("notifications.savedDesc"),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message || t("notifications.saveFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader title={t("notifications.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-6 flex flex-col gap-6">
        <div>
          <p className="text-subtitle">
            {t("notifications.subtitle")}
          </p>
        </div>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-settings">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ListSection title={t("notifications.channels")}>
              <ListRow
                title={t("notifications.emailTitle")}
                subtitle={t("notifications.emailDesc")}
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F5F7FA" }}><Mail className="w-[18px] h-[18px]" style={{ color: "#1F2937" }} /></div>}
                trailing={
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                    data-testid="toggle-email"
                  />
                }
                testId="setting-email"
              />
              <ListDivider />
              <ListRow
                title={t("notifications.pushTitle")}
                subtitle={getPushSubtitle()}
                icon={<div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F5F7FA" }}><Bell className="w-[18px] h-[18px]" style={{ color: "#1F2937" }} /></div>}
                trailing={
                  pushLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={pushEnabled}
                      onCheckedChange={handlePushToggle}
                      disabled={!pushSupported || pushPermission === "denied"}
                      data-testid="toggle-push"
                    />
                  )
                }
                testId="setting-push"
              />
              {pushPermission === "denied" && (
                <div className="flex items-start gap-2 px-4 pb-3 text-xs text-amber-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{t("notifications.pushDeniedHint")}</span>
                </div>
              )}
            </ListSection>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Push Test</p>
              <button
                onClick={handleTestPush}
                disabled={testPushLoading}
                className="w-full h-[44px] rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                data-testid="button-test-push"
              >
                {testPushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Stuur test push
              </button>
              {testPushResult && (
                <div className={`mt-3 text-xs rounded-lg p-3 font-mono ${testPushResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`} data-testid="test-push-result">
                  <p>{testPushResult.success ? "Verzonden" : "Mislukt"} — {testPushResult.tokens_found} token(s)</p>
                  {testPushResult.error && <p className="mt-1 break-all">{testPushResult.error}</p>}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-white via-white to-white/0">
              <div className="max-w-xl mx-auto px-5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-[52px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[16px] font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
                  data-testid="button-save"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
