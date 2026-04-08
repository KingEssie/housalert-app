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
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Bell, Search, Phone, Users, UserCircle, FileText, FolderOpen, PlusCircle, Share2, Eye, Building, Wallet,
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;

  const inputClass = "w-full h-[50px] px-4 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-ha-primary/30 focus:border-ha-primary transition-colors";
  const readonlyClass = "w-full h-[50px] px-4 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-[15px] text-[#6B7280] cursor-not-allowed";
  const canSave = firstName.trim() && lastName.trim() && phone.trim();

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-4" data-testid="inline-profile-details">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.firstName")}</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t("profileEdit.firstNamePlaceholder")} className={inputClass} data-testid="input-first-name" />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.lastName")}</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t("profileEdit.lastNamePlaceholder")} className={inputClass} data-testid="input-last-name" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.email")}</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input type="email" value={userEmail} readOnly className={`${readonlyClass} pl-10`} data-testid="input-email-readonly" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.phone")}</label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("profileEdit.phonePlaceholder")} className={`${inputClass} pl-10`} data-testid="input-phone" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.birthDate")}</label>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={`${inputClass} pl-10`} data-testid="input-birth-date" />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileEdit.occupation")}</label>
        <div className="relative">
          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder={t("profileEdit.occupationPlaceholder")} className={`${inputClass} pl-10`} data-testid="input-occupation" />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        className="w-full h-[50px] rounded-full bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#333333] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mt-1"
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
  }, [accessToken]);

  async function handleToggle(key: "push_enabled" | "email_enabled", current: boolean) {
    setUpdating(key);
    try {
      if (key === "push_enabled" && !current) {
        if (!isPushSupported()) { toast({ title: t("settings.pushNotSupported"), variant: "destructive" }); setUpdating(null); return; }
        const perm = await getPushPermissionState();
        if (perm === "denied") { toast({ title: t("settings.pushDenied"), variant: "destructive" }); setUpdating(null); return; }
        await subscribeToPush(accessToken);
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;
  if (!settings) return null;

  const anyEnabled = settings.push_enabled || settings.email_enabled;

  return (
    <div data-testid="inline-notifications">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
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
        <div className="h-px bg-[#F0F0F0] mx-5" />
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
        <div className="flex items-center gap-2.5 mt-4 py-3 px-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl" data-testid="notif-active-confirm">
          <div className="w-[22px] h-[22px] rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
          <span className="text-[14px] font-medium text-[#16A34A]">{t("taskFlow.notif.activeConfirm")}</span>
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
    <button onClick={onToggle} disabled={loading} className="w-full px-5 py-4 flex items-start gap-4 hover:bg-[#FAFAFA] transition-colors text-left" data-testid={testId}>
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[#111111]">{label}</span>
          {badge && (
            <span className="text-[11px] font-semibold text-ha-primary bg-[#FDF1F6] px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <p className="text-[13px] text-[#6B7280] mt-0.5 leading-snug">{subtitle}</p>
      </div>
      <div className={`w-[46px] h-[26px] rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 mt-0.5 ${enabled ? "bg-[#111111]" : "bg-[#D1D5DB]"}`}>
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;

  const inputClass = "w-full h-[50px] px-4 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-ha-primary/30 focus:border-ha-primary transition-colors";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-4" data-testid="inline-search-buddy">
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileEdit.searchBuddyLabel")}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("profileEdit.searchBuddyPlaceholder")} className={inputClass} data-testid="input-buddy-email" />
        <p className="text-[13px] text-[#6B7280] mt-2 leading-snug">{t("profileEdit.searchBuddyDesc")}</p>
      </div>
      {existing && (
        <div className="flex items-center gap-2 py-2 px-3 bg-[#F0FDF4] rounded-xl">
          <Check className="w-4 h-4 text-[#16A34A]" />
          <span className="text-[13px] font-medium text-[#16A34A]">{existing}</span>
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !email.trim() || !email.includes("@") || email.trim() === existing}
        className="w-full h-[50px] rounded-full bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#333333] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
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
      className="w-full h-[52px] rounded-2xl bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#333333] transition-colors flex items-center justify-center gap-2.5"
      data-testid={`button-open-step-${step.id}`}
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </button>
  );
}

function TipBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-left text-[15px] text-[#374151] leading-relaxed flex flex-col gap-5" data-testid="tip-body">
      {children}
    </div>
  );
}

function TipSection({ title, items }: { title?: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      {title && (
        <div className="px-4 pt-3.5 pb-2">
          <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide">{title}</p>
        </div>
      )}
      <div className={`flex flex-col ${title ? "" : "pt-1"}`}>
        {items.map((item, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#F3F4F6]" : ""}`}>
            <div className="w-[22px] h-[22px] rounded-[7px] border-2 border-[#D1D5DB] flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-[#D1D5DB]" strokeWidth={2.5} />
            </div>
            <span className="text-[14px] text-[#111111]">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TipHighlight({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FDF8F0] border border-[#F5E6D3] px-5 py-4">
      <span className="text-[18px] flex-shrink-0">💡</span>
      <p className="text-[14px] font-semibold text-[#111111] leading-snug">{text}</p>
    </div>
  );
}

const TIP_CONTENT: Record<string, () => React.ReactNode> = {
  tip_documents: () => (
    <TipBody>
      <TipSection title="In loondienst" items={[
        "Kopie ID / paspoort",
        "Inkomensverklaring of werkgeversverklaring",
        "Laatste 3 loonstroken",
        "Arbeidscontract (indien mogelijk)",
        "Uittreksel BRP (gemeente)",
      ]} />
      <TipSection title="Zelfstandig" items={[
        "Laatste belastingaangifte",
        "Jaarcijfers / winst- en verliesrekening",
        "Bankafschriften laatste maanden",
      ]} />
      <TipSection title="Al een huurwoning" items={[
        "Verhuurdersverklaring",
        "Bewijs van huurbetalingen",
      ]} />
      <TipHighlight text="Hoe completer je bent, hoe groter je kans." />
    </TipBody>
  ),
  tip_finances: () => (
    <TipBody>
      <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Vuistregel</p>
          <p className="text-[22px] font-bold text-[#111111] mb-1">3× de kale huur</p>
          <p className="text-[14px] text-[#6B7280]">Minimaal bruto maandinkomen</p>
        </div>
        <div className="border-t border-[#F3F4F6] px-5 py-3.5 bg-[#FAFAFA]">
          <p className="text-[14px] text-[#374151]">
            <span className="text-[#6B7280]">Voorbeeld:</span> Huur €1.000 → inkomen €3.000+
          </p>
        </div>
      </div>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Soms zelfs hoger (3,5× – 4×), vooral in populaire steden.</p>
      <TipSection title="Belangrijk" items={[
        "Onder deze grens reageren = vaak kansloos",
        "Je verspilt tijd en positie",
      ]} />
      <TipHighlight text="Stem je zoekfilters hierop af." />
    </TipBody>
  ),
  tip_landlord_accounts: () => (
    <TipBody>
      <TipSection title="Maak accounts op" items={[
        "Funda",
        "Pararius",
        "Kamernet",
        "Facebook Marketplace",
        "Eventueel lokale verhuurders",
      ]} />
      <TipSection title="Direct doen" items={[
        "Zet meldingen aan",
        "Vul je profiel volledig in",
        "Upload alvast je documenten",
      ]} />
      <TipHighlight text="Snel reageren geeft je een groot voordeel." />
    </TipBody>
  ),
  tip_facebook_groups: () => (
    <TipBody>
      <TipSection title="Waar zoeken" items={[
        "Facebook-groepen",
        "Studentengroepen",
        "Lokale communities",
      ]} />
      <TipSection title="Zoektermen" items={[
        "\"Woning gezocht\" + stad",
        "\"Huurwoning\" + stad",
        "\"Kamer gezocht\" + stad",
      ]} />
      <TipSection title="Acties" items={[
        "Zet meldingen aan",
        "Reageer direct",
        "Plaats zelf ook een oproep",
      ]} />
      <TipHighlight text="Minder concurrentie betekent vaak meer kans." />
    </TipBody>
  ),
  tip_network: () => (
    <TipBody>
      <TipSection title="Waar kijken" items={[
        "Projectwebsites",
        "Woningcorporaties",
        "Nieuwbouwplatforms",
      ]} />
      <TipSection title="Acties" items={[
        "Schrijf je direct in",
        "Hou je mail goed in de gaten",
        "Soms wordt er geloot",
      ]} />
      <TipHighlight text="Goede optie voor de langere termijn." />
    </TipBody>
  ),
  tip_viewings: () => (
    <TipBody>
      <TipSection title="Vertel het aan" items={[
        "Vrienden",
        "Familie",
        "Collega's",
        "Kennissen",
      ]} />
      <TipSection title="Praktisch" items={[
        "Post op social media",
        "Vraag actief rond",
        "Laat mensen je naam doorgeven",
      ]} />
      <TipHighlight text="Eén connectie kan het verschil maken." />
    </TipBody>
  ),
};

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

  const tipRenderer = TIP_CONTENT[step.id];
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
