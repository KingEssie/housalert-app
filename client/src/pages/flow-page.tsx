import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { FlowLayout } from "@/components/flow-layout";
import { isPushSupported, getPushPermissionState, subscribeToPush } from "@/lib/push";
import { isExpoWebView, isCapacitorNative, registerNativePush, getPlatform } from "@/lib/capacitor";
import {
  getFlowById,
  getStepIndex,
  getTaskSourceForFlow,
  getFlowStepRoute,
  buildCompletionMap,
  type ProfileStrengthResponse,
  type TaskFlow,
  type TaskFlowStep,
} from "@/lib/task-flows";
import type { LucideProps } from "lucide-react";
import {
  Bell,
  Search,
  Phone,
  Users,
  UserCircle,
  FileText,
  FolderOpen,
  PlusCircle,
  Share2,
  Eye,
  Check,
  ArrowRight,
  Loader2,
  Mail,
  Calendar,
  Briefcase,
  Building,
  Wallet,
  ChevronDown,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Bell, Search, Phone, Users, UserCircle, FileText, FolderOpen, PlusCircle, Share2, Eye, Building, Wallet, Mail,
};

function getStepIcon(iconName: string) {
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon className="w-11 h-11 text-ha-primary" strokeWidth={1.5} />;
}

function InlineProfileDetails({ accessToken, userEmail }: { accessToken: string; userEmail: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [occupation, setOccupation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        setFirstName(d?.first_name || "");
        setLastName(d?.last_name || "");
        setPhone(d?.phone || "");
        setBirthDate(d?.birth_date || "");
        setOccupation(d?.occupation || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accessToken]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          birth_date: birthDate.trim() || null,
          occupation: occupation.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      toast({ title: t("profileEdit.saved") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-ha-text-secondary" /></div>;

  const inputClass = "w-full h-[56px] px-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all";
  const readonlyClass = "w-full h-[56px] px-4 rounded-[8px] border border-ha-border-input bg-ha-surface text-[16px] text-ha-text-secondary cursor-not-allowed";
  const canSave = firstName.trim() && lastName.trim() && phone.trim();

  return (
    <div className="bg-white rounded-2xl border border-ha-card-border p-5 flex flex-col gap-4" data-testid="inline-profile-details">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileDetails.firstName")}</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t("profileEdit.firstNamePlaceholder")} className={inputClass} data-testid="input-first-name" />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileDetails.lastName")}</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t("profileEdit.lastNamePlaceholder")} className={inputClass} data-testid="input-last-name" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileDetails.email")}</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-secondary" />
          <input type="email" value={userEmail} readOnly className={`${readonlyClass} pl-10`} data-testid="input-email-readonly" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileDetails.phone")}</label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-secondary" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("profileEdit.phonePlaceholder")} className={`${inputClass} pl-10`} data-testid="input-phone" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileDetails.birthDate")}</label>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-secondary" />
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={`${inputClass} pl-10`} data-testid="input-birth-date" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileEdit.occupation")}</label>
        <div className="relative">
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-secondary" />
          <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder={t("profileEdit.occupationPlaceholder")} className={`${inputClass} pl-10`} data-testid="input-occupation" />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        className="w-full h-[50px] rounded-full bg-ha-text text-white text-[15px] font-semibold hover:bg-ha-text disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mt-1"
        data-testid="button-save-profile"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {t("taskFlow.ui.saveAndContinue")}
      </button>
    </div>
  );
}

function InlineNotifications({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<{ push_enabled: boolean; email_enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/notifications/settings", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));

    if (isExpoWebView() || isCapacitorNative()) {
      apiFetch("/api/push/status", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(r => r.json())
        .then(d => setActiveTokenCount(d?.devices ?? 0))
        .catch(() => {});
    }
  }, [accessToken]);

  async function handleToggle(key: "push_enabled" | "email_enabled", current: boolean) {
    setUpdating(key);
    try {
      if (key === "push_enabled") {
        const _expo = isExpoWebView();
        const _cap  = isCapacitorNative();
        if (_expo) {
          // ── Expo WebView: native layer (App.tsx) already holds the token.
          // Just flip push_enabled on the backend.
          const res = await apiFetch("/api/notifications/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ push_enabled: !current }),
          });
          if (!res.ok) throw new Error("Failed");
          setSettings(prev => prev ? { ...prev, push_enabled: !current } : prev);
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
          queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
          toast({ title: !current ? "Push-meldingen ingeschakeld" : "Push-meldingen uitgeschakeld" });
          setUpdating(null);
          return;
        }

        if (_cap) {
          // ── Capacitor native: register via PushNotifications plugin.
          if (!current) {
            const token = await registerNativePush();
            if (!token) {
              toast({ title: t("settings.pushDenied"), description: "Verleen toestemming in Android-instellingen → HousAlert.", variant: "destructive" });
              setUpdating(null);
              return;
            }
            const regRes = await apiFetch("/api/expo-push-token", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ expo_push_token: token, platform: getPlatform() }),
            });
            if (!regRes.ok) throw new Error("Token registration failed");
            setSettings(prev => prev ? { ...prev, push_enabled: true } : prev);
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
            queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
            toast({ title: "Push-meldingen ingeschakeld" });
          } else {
            const res = await apiFetch("/api/notifications/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ push_enabled: false }),
            });
            if (!res.ok) throw new Error("Failed");
            setSettings(prev => prev ? { ...prev, push_enabled: false } : prev);
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
          }
          setUpdating(null);
          return;
        }

        // ── Web browser: use VAPID / serviceWorker push.
        if (!current) {
          if (!isPushSupported()) { toast({ title: t("settings.pushNotSupported"), variant: "destructive" }); setUpdating(null); return; }
          const perm = await getPushPermissionState();
          if (perm === "denied") { toast({ title: t("settings.pushDenied"), variant: "destructive" }); setUpdating(null); return; }
          await subscribeToPush(accessToken);
        }
      }

      const res = await apiFetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ [key]: !current }),
      });
      if (!res.ok) throw new Error("Failed");
      setSettings(prev => prev ? { ...prev, [key]: !current } : prev);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-ha-text-secondary" /></div>;
  if (!settings) return null;

  const anyEnabled = settings.push_enabled || settings.email_enabled;
  return (
    <div data-testid="inline-notifications">
      <div className="bg-white rounded-2xl border border-ha-card-border overflow-hidden">
        <NotifToggleRow
          icon={<Bell className="w-5 h-5 text-ha-primary" />}
          label={t("taskFlow.notif.pushLabel")}
          subtitle={t("taskFlow.notif.pushDesc")}
          badge={t("taskFlow.notif.pushBadge")}
          enabled={settings.push_enabled}
          loading={updating === "push_enabled"}
          onToggle={() => handleToggle("push_enabled", settings.push_enabled)}
          testId="toggle-push"
        />
        <div className="h-px bg-ha-divider mx-5" />
        <NotifToggleRow
          icon={<Mail className="w-5 h-5 text-ha-primary" />}
          label={t("taskFlow.notif.emailLabel")}
          subtitle={t("taskFlow.notif.emailDesc")}
          enabled={settings.email_enabled}
          loading={updating === "email_enabled"}
          onToggle={() => handleToggle("email_enabled", settings.email_enabled)}
          testId="toggle-email"
        />
      </div>

      {anyEnabled && (
        <div className="flex items-center gap-2.5 mt-4 py-3 px-4 bg-ha-success/10 border border-ha-success/25 rounded-2xl" data-testid="notif-active-confirm">
          <div className="w-[22px] h-[22px] rounded-full bg-ha-success flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
          <span className="text-[14px] font-medium text-ha-success">{t("taskFlow.notif.activeConfirm")}</span>
        </div>
      )}
    </div>
  );
}

function NotifToggleRow({ icon, label, subtitle, badge, enabled, loading, onToggle, testId }: {
  icon: React.ReactNode; label: string; subtitle: string; badge?: string; enabled: boolean; loading: boolean;
  onToggle: () => void; testId: string;
}) {
  return (
    <button onClick={onToggle} disabled={loading} className="w-full px-5 py-4 flex items-start gap-4 hover:bg-ha-surface transition-colors text-left" data-testid={testId}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-ha-text">{label}</span>
          {badge && (
            <span className="text-[11px] font-semibold text-ha-primary bg-ha-primary/5 px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <p className="text-[13px] text-ha-text-secondary mt-0.5 leading-snug">{subtitle}</p>
      </div>
      <div className={`w-[46px] h-[26px] rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 mt-0.5 ${enabled ? "bg-[#bbadfb]" : "bg-ha-border-input"}`}>
        <div className={`w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-[20px]" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

function InlineSearchBuddy({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState("");

  useEffect(() => {
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        const val = d?.search_buddy_email || "";
        setEmail(val);
        setExisting(val);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accessToken]);

  async function handleSave() {
    if (!email.trim() || !email.includes("@")) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ search_buddy_email: email.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-ha-text-secondary" /></div>;

  const inputClass = "w-full h-[56px] px-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all";

  return (
    <div className="bg-white rounded-2xl border border-ha-card-border p-5 flex flex-col gap-4" data-testid="inline-search-buddy">
      <div>
        <label className="text-[13px] font-semibold text-ha-text-secondary mb-1.5 block">{t("profileEdit.searchBuddyLabel")}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("profileEdit.searchBuddyPlaceholder")} className={inputClass} data-testid="input-buddy-email" />
        <p className="text-[13px] text-ha-text-secondary mt-2 leading-snug">{t("profileEdit.searchBuddyDesc")}</p>
      </div>
      {existing && (
        <div className="flex items-center gap-2 py-2 px-3 bg-ha-success/10 rounded-xl">
          <Check className="w-4 h-4 text-ha-success" />
          <span className="text-[13px] font-medium text-ha-success">{existing}</span>
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !email.trim() || !email.includes("@") || email.trim() === existing}
        className="w-full h-[50px] rounded-full bg-ha-text text-white text-[15px] font-semibold hover:bg-ha-text disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        data-testid="button-save-buddy"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {existing ? t("taskFlow.ui.update") : t("taskFlow.ui.saveAndContinue")}
      </button>
    </div>
  );
}

function OpenPageButton({ step, label }: { step: TaskFlowStep; label: string }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(step.route)}
      className="w-full h-[52px] rounded-full bg-ha-text text-white text-[15px] font-semibold hover:bg-ha-text transition-colors flex items-center justify-center gap-2.5"
      data-testid={`button-open-step-${step.id}`}
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </button>
  );
}

export function TipBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-left text-[15px] text-ha-text leading-relaxed flex flex-col gap-5" data-testid="tip-body">
      {children}
    </div>
  );
}

export function TipSection({ title, items }: { title?: string; items: string[] }) {
  return (
    <div>
      {title && (
        <p className="text-[15px] font-semibold text-ha-text mb-2">{title}</p>
      )}
      <ul className="flex flex-col gap-1.5 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] text-ha-text leading-snug">
            <span className="text-ha-text-secondary mt-1.5 text-[7px]">●</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TipHighlight({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-ha-accent-yellow-light border border-ha-accent-yellow/25 px-4 py-3.5">
      <span className="text-[16px] flex-shrink-0">💡</span>
      <p className="text-[14px] font-medium text-ha-text leading-snug">{text}</p>
    </div>
  );
}


export type RegionItem = { label: string; url?: string };
export type RegionData = { name: string; platforms: (string | RegionItem)[] };

export function RegionAccordion({ regions }: { regions: RegionData[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-ha-card-border overflow-hidden bg-white">
      {regions.map((r, i) => (
        <div key={r.name} className={i > 0 ? "border-t border-ha-surface" : ""}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            data-testid={`region-toggle-${i}`}
          >
            <span className="text-[15px] font-semibold text-ha-text">{r.name}</span>
            <ChevronDown className={`w-4 h-4 text-ha-text-secondary transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
          </button>
          {openIdx === i && (
            <ul className="px-5 pb-4 flex flex-col gap-2.5">
              {r.platforms.map((p, j) => {
                const item = typeof p === "string" ? { label: p } : p;
                return (
                  <li key={j} className="flex items-start gap-2 text-[14px] leading-snug">
                    <span className="text-ha-border-input mt-1.5 text-[8px]">●</span>
                    <div className="flex flex-col">
                      <span className="text-ha-text">{item.label}</span>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-ha-primary hover:underline truncate" data-testid={`link-region-${i}-${j}`}>{item.url.replace(/^https?:\/\//, "")}</a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export type TFn = (key: string, params?: Record<string, string | number>) => string;

export function getTipContent(t: TFn): Record<string, () => React.ReactNode> {
  const tArr = (key: string): string[] => (t as any)(key) as string[];
  type Region = { name: string; platforms: { label: string; url: string }[] };
  const tRegions = (key: string): Region[] => (t as any)(key) as Region[];
  return {
  tip_documents: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_documents.intro")}</p>
      <TipSection title={t("flowPage.tips.tip_documents.section1Title")} items={tArr("flowPage.tips.tip_documents.section1Items")} />
      <TipSection title={t("flowPage.tips.tip_documents.section2Title")} items={tArr("flowPage.tips.tip_documents.section2Items")} />
      <TipSection title={t("flowPage.tips.tip_documents.section3Title")} items={tArr("flowPage.tips.tip_documents.section3Items")} />
    </TipBody>
  ),
  tip_finances: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_finances.para1")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_finances.para2")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_finances.para3")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_finances.para4")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_finances.para5")}</p>
    </TipBody>
  ),
  tip_landlord_accounts: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_landlord_accounts.intro")}</p>
      <RegionAccordion regions={tRegions("flowPage.tips.tip_landlord_accounts.regions")} />
    </TipBody>
  ),
  tip_facebook_groups: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_facebook_groups.para1")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_facebook_groups.para2")}</p>
      <a
        href="https://www.facebook.com/search/groups/?q=rooms+to+rent+dublin"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-semibold text-ha-primary hover:underline"
        data-testid="link-facebook-groups"
      >
        » Rooms &amp; Apartments in Dublin, Cork and Galway
      </a>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_facebook_groups.para3")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_facebook_groups.searchIntro")}</p>
      <ul className="flex flex-col gap-1.5 pl-1">
        {tArr("flowPage.tips.tip_facebook_groups.searchItems").map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[14px] text-ha-text leading-snug"><span className="text-ha-text-secondary mt-1.5 text-[7px]">●</span><span>{item}</span></li>
        ))}
      </ul>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_facebook_groups.para4")}</p>
    </TipBody>
  ),
  tip_new_build: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_new_build.para1")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_new_build.para2")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_new_build.para3")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_new_build.para4")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_new_build.para5")}</p>
      <a
        href="https://www.daft.ie/new-homes"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-semibold text-ha-primary hover:underline"
        data-testid="link-new-homes"
      >
        » daft.ie/new-homes
      </a>
    </TipBody>
  ),
  tip_network: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_network.para1")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_network.para2")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_network.para3")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_network.para4")}</p>
    </TipBody>
  ),
  tip_viewings: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_viewings.intro")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_viewings.intro2")}</p>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[14px] font-semibold text-ha-text">{t("flowPage.tips.tip_viewings.item1Title")}</p>
          <p className="text-[14px] text-ha-text leading-relaxed mt-1">{t("flowPage.tips.tip_viewings.item1Body")}</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-ha-text">{t("flowPage.tips.tip_viewings.item2Title")}</p>
          <p className="text-[14px] text-ha-text leading-relaxed mt-1">{t("flowPage.tips.tip_viewings.item2Body")}</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-ha-text">{t("flowPage.tips.tip_viewings.item3Title")}</p>
          <p className="text-[14px] text-ha-text leading-relaxed mt-1">{t("flowPage.tips.tip_viewings.item3Body")}</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-ha-text">{t("flowPage.tips.tip_viewings.item4Title")}</p>
          <p className="text-[14px] text-ha-text leading-relaxed mt-1">{t("flowPage.tips.tip_viewings.item4Body")}</p>
        </div>
      </div>
    </TipBody>
  ),
  tip_followup: () => (
    <TipBody>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_followup.para1")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_followup.para2")}</p>
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_followup.para3")}</p>
      <TipHighlight text={t("flowPage.tips.tip_followup.highlight")} />
      <p className="text-[14px] text-ha-text leading-relaxed">{t("flowPage.tips.tip_followup.para4")}</p>
    </TipBody>
  ),
  };
}

function FlowStepContent({ flow, step, accessToken, userEmail }: { flow: TaskFlow; step: TaskFlowStep; accessToken: string; userEmail: string }) {
  const { t } = useTranslation();

  if (step.inline) {
    switch (step.id) {
      case "profile_details":
        return <InlineProfileDetails accessToken={accessToken} userEmail={userEmail} />;
      case "notifications":
        return <InlineNotifications accessToken={accessToken} />;
      case "search_buddy":
        return <InlineSearchBuddy accessToken={accessToken} />;
    }
  }

  const tipContent = getTipContent(t);
  const tipRenderer = tipContent[step.id];
  if (tipRenderer) return <>{tipRenderer()}</>;

  const stepLabels: Record<string, string> = {
    search_profile: t("taskFlow.ui.createSearch"),
    documents: t("taskFlow.ui.goToDocuments"),
    extra_search_profile: t("taskFlow.ui.addSearch"),
    application_letter: t("taskFlow.ui.writeLetter"),
    viewing_tips: t("taskFlow.ui.readTips"),
    network: t("taskFlow.ui.goToProfile"),
  };

  return <OpenPageButton step={step} label={stepLabels[step.id] || t("taskFlow.ui.openStep")} />;
}

export default function FlowPage() {
  const [, params] = useRoute("/flow/:flowId/:stepId");
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { t } = useTranslation();
  const accessToken = session?.access_token;
  const userEmail = session?.user?.email || "";

  const flowId = params?.flowId;
  const stepId = params?.stepId;

  const flow = flowId ? getFlowById(flowId) : undefined;
  const stepIndex = flow && stepId ? getStepIndex(flow, stepId) : -1;
  const step = flow && stepIndex >= 0 ? flow.steps[stepIndex] : undefined;

  const strengthQuery = useQuery<ProfileStrengthResponse>({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!accessToken,
    staleTime: 30_000,
  });

  const markCompleteMutation = useMutation({
    mutationFn: async ({ flowId, stepId }: { flowId: string; stepId: string }) => {
      const res = await apiFetch("/api/flow/complete-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ flowId, stepId }),
      });
      if (!res.ok) throw new Error("Failed to mark complete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      queryClient.refetchQueries({ queryKey: ["/api/profile-strength"] });
    },
  });

  if (!flow || !step || stepIndex < 0) {
    navigate("/home");
    return null;
  }

  const data = strengthQuery.data;
  const taskSource = getTaskSourceForFlow(flow);
  const serverTasks = data ? (taskSource === "tasks" ? data.tasks : data.prepTasks) : [];
  const completionMap = buildCompletionMap(serverTasks);
  const isCompleted = completionMap[step.id] ?? false;

  const prevStep = stepIndex > 0 ? flow.steps[stepIndex - 1] : null;
  const nextStep = stepIndex < flow.steps.length - 1 ? flow.steps[stepIndex + 1] : null;

  const handlePrev = prevStep ? () => navigate(getFlowStepRoute(flow, prevStep.id)) : null;
  const handleNext = nextStep
    ? () => {
        if (step.completionType === "manual" && !isCompleted) {
          markCompleteMutation.mutate({ flowId: flow.id, stepId: step.id });
        }
        navigate(getFlowStepRoute(flow, nextStep.id));
      }
    : () => {
        if (step.completionType === "manual" && !isCompleted) {
          markCompleteMutation.mutate({ flowId: flow.id, stepId: step.id });
        }
        navigate("/home");
      };
  const handleMarkComplete =
    step.completionType === "manual"
      ? () => {
          if (!isCompleted) {
            markCompleteMutation.mutate({ flowId: flow.id, stepId: step.id });
          }
        }
      : null;

  return (
    <FlowLayout
      flowTitle={t(flow.titleKey)}
      currentStep={stepIndex}
      totalSteps={flow.steps.length}
      stepTitle={t(step.labelKey)}
      stepDescription={t(step.descriptionKey)}
      stepIcon={getStepIcon(step.icon)}
      isCompleted={isCompleted}
      completionType={step.completionType}
      onPrev={handlePrev}
      onNext={handleNext}
      onMarkComplete={handleMarkComplete}
      onClose={() => navigate("/home")}
      isPending={markCompleteMutation.isPending}
    >
      <FlowStepContent flow={flow} step={step} accessToken={accessToken || ""} userEmail={userEmail} />
    </FlowLayout>
  );
}
