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
  Sparkles,
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

function TipCta({ label, href }: { label: string; href: string }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className="w-full h-[48px] rounded-full bg-ha-primary text-white text-[15px] font-semibold hover:brightness-95 active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(217,26,104,0.18)]"
      data-testid="button-tip-cta"
    >
      <Sparkles className="w-5 h-5" />
      {label}
    </button>
  );
}

type RegionData = { name: string; platforms: string[] };

function RegionAccordion({ regions }: { regions: RegionData[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-[#E5E7EB] overflow-hidden bg-white">
      {regions.map((r, i) => (
        <div key={r.name} className={i > 0 ? "border-t border-[#F3F4F6]" : ""}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            data-testid={`region-toggle-${i}`}
          >
            <span className="text-[15px] font-semibold text-[#111111]">{r.name}</span>
            <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
          </button>
          {openIdx === i && (
            <ul className="px-5 pb-4 flex flex-col gap-1.5">
              {r.platforms.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[14px] text-[#6B7280] leading-snug">
                  <span className="text-[#D1D5DB] mt-1.5 text-[8px]">●</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const TIP_CONTENT: Record<string, () => React.ReactNode> = {
  tip_documents: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280]">Verhuurders in Duitsland hechten veel waarde aan documenten waarmee jij laat zien dat je een betrouwbare huurder bent. Zorg dat je alles alvast klaar hebt, zodat je direct kunt reageren.</p>
      <TipSection title="Als je in loondienst werkt" items={[
        "Kopie ID / paspoort",
        "Laatste 3 loonstroken",
        "Arbeidscontract (indien beschikbaar)",
        "Werkgeversverklaring (optioneel, maar sterk)",
        "SCHUFA-rapport (zeer belangrijk in Duitsland)",
        "Bankafschriften van de laatste 3 maanden",
      ]} />
      <TipSection title="Als je al een huurwoning hebt" items={[
        "Verhuurdersverklaring (Mietschuldenfreiheitsbescheinigung)",
        "Bewijs van huurbetalingen (laatste 3 maanden)",
      ]} />
      <TipSection title="Als je zelfstandig ondernemer bent" items={[
        "Kopie ID / paspoort",
        "Uittreksel Kamer van Koophandel (Handelsregisterauszug)",
        "Winst- en verliesrekening (laatste 2–3 jaar)",
        "Belastingaangiften / inkomstenoverzicht",
        "SCHUFA-rapport",
        "Bankafschriften",
      ]} />
    </TipBody>
  ),
  tip_finances: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">De inkomenseis in Duitsland ligt meestal tussen 3x en 3,5x de kale huurprijs. In populaire steden kan dit zelfs oplopen tot 4x.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Met andere woorden: voor een woning van €1.000 moet je inkomen meestal minimaal €3.000 – €4.000 bruto per maand zijn.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Bij de meeste advertenties staat de inkomenseis vermeld, zodat je snel kunt zien of een woning haalbaar is.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Reageren op woningen boven jouw budget heeft vaak geen zin. Verhuurders selecteren streng en kiezen kandidaten die direct aan de eisen voldoen.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Bepaal daarom vooraf tot welke huurprijs jij realistisch kunt reageren.</p>
    </TipBody>
  ),
  tip_landlord_accounts: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Veel woningen in Duitsland worden via platforms aangeboden waar je een account nodig hebt om te reageren. Zonder account ben je vaak te laat. Zorg daarom dat je vooraf accounts aanmaakt en je profiel compleet invult, zodat je direct kunt reageren.</p>
      <RegionAccordion regions={[
        { name: "Berlijn", platforms: [
          "ImmoScout24 (€ premium aanbevolen voor sneller reageren)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis, veel particulier aanbod)",
          "WG-Gesucht (gratis, vooral kamers & gedeeld wonen)",
          "Berlinovo (semi-overheid, betaalbare woningen)",
        ]},
        { name: "München", platforms: [
          "ImmoScout24 (€ premium vaak nodig)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis)",
          "WG-Gesucht (gratis)",
          "Mr. Lodge (expats / gemeubileerd)",
        ]},
        { name: "Hamburg", platforms: [
          "ImmoScout24 (€ premium)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis)",
          "WG-Gesucht (gratis)",
          "SAGA Hamburg (woningcorporatie)",
        ]},
        { name: "Frankfurt", platforms: [
          "ImmoScout24 (€ premium)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis)",
          "WG-Gesucht (gratis)",
          "Vonovia (grote verhuurder)",
        ]},
        { name: "Keulen / Düsseldorf", platforms: [
          "ImmoScout24 (€ premium)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis)",
          "WG-Gesucht (gratis)",
          "LEG Immobilien (grote verhuurder)",
        ]},
        { name: "Overig Duitsland", platforms: [
          "ImmoScout24 (€ premium)",
          "Immowelt (gratis)",
          "eBay Kleinanzeigen (gratis)",
          "WG-Gesucht (gratis)",
          "Vonovia (grote verhuurder)",
        ]},
      ]} />
    </TipBody>
  ),
  tip_facebook_groups: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Veel particuliere verhuurders en huurders gebruiken in Duitsland Facebook-groepen om woningen of kamers te delen. Vooral in grote steden en bij gedeeld wonen (WG) komt hier veel aanbod voorbij.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Zoek en word lid van actieve groepen in jouw regio, zodat je snel kunt reageren op nieuwe woningen.</p>
      <a
        href="https://www.facebook.com/search/groups/?q=wohnung%20mieten"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-semibold text-ha-primary hover:underline"
        data-testid="link-facebook-groups"
      >
        » Rooms &amp; Apartments in Berlin, Munich, Hamburg, Frankfurt, Cologne
      </a>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Speur ook zelf naar Facebook-groepen die woningen delen in jouw stad of regio.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Gebruik in Facebook zoekopdrachten zoals:</p>
      <ul className="flex flex-col gap-1.5 pl-1">
        <li className="flex items-start gap-2 text-[14px] text-[#6B7280] leading-snug"><span className="text-[#D1D5DB] mt-1.5 text-[8px]">●</span><span>Wohnung + stad</span></li>
        <li className="flex items-start gap-2 text-[14px] text-[#6B7280] leading-snug"><span className="text-[#D1D5DB] mt-1.5 text-[8px]">●</span><span>WG Zimmer + stad</span></li>
        <li className="flex items-start gap-2 text-[14px] text-[#6B7280] leading-snug"><span className="text-[#D1D5DB] mt-1.5 text-[8px]">●</span><span>Wohnung mieten + stad</span></li>
      </ul>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Word lid van meerdere groepen en zet meldingen aan, zodat je direct op de hoogte bent van nieuw aanbod.</p>
    </TipBody>
  ),
  tip_new_build: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Wil je het liefst in een nieuw appartement wonen of kansen vroeg ontdekken? Houd dan nieuwbouwprojecten in jouw regio goed in de gaten.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">In Duitsland worden veel woningen al toegewezen vóór oplevering. Wie er vroeg bij is, heeft vaak een groot voordeel.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Projecten worden soms maanden of zelfs jaren vooraf aangekondigd. Vaak kun je je inschrijven voordat de woningen beschikbaar zijn.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Door dit actief te volgen, vergroot je je kansen aanzienlijk.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Bekijk actuele en toekomstige nieuwbouwprojecten op:</p>
      <a
        href="https://www.neubaukompass.de"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-semibold text-ha-primary hover:underline"
        data-testid="link-neubaukompass"
      >
        » neubaukompass.de
      </a>
    </TipBody>
  ),
  tip_network: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Hoe meer mensen weten dat jij een woning zoekt, hoe groter je kans. In Duitsland gaat veel aanbod via via, nog vóór het online komt.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Laat daarom op je social media weten dat je op zoek bent naar een woning. Deel het met vrienden, familie, collega's en kennissen.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Vraag ook actief rond op werk of bij lokale contacten. Misschien kent iemand iemand die binnenkort iets verhuurt.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Soms komt de beste kans uit onverwachte hoek. Zorg dat mensen aan jou denken zodra er iets vrijkomt.</p>
    </TipBody>
  ),
  tip_viewings: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Een bezichtiging draait niet alleen om de woning. In Duitsland wordt er vaak ook gekeken of jij een betrouwbare huurder bent. Maak daarom een sterke eerste indruk.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Vier manieren om een positieve indruk te maken:</p>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[#111111]">1. Wees op tijd</p>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-1">In Duitsland wordt punctualiteit serieus genomen. Kom liever iets te vroeg dan te laat.</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111111]">2. Kom verzorgd en rustig over</p>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-1">Verhuurders zoeken iemand die netjes en stabiel oogt. Houd het simpel en professioneel.</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111111]">3. Stel een paar gerichte vragen</p>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-1">Laat zien dat je echt interesse hebt. Vraag bijvoorbeeld naar het gebouw, de buren of de huurvoorwaarden.</p>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111111]">4. Laat direct je interesse zien</p>
          <p className="text-[14px] text-[#6B7280] leading-relaxed mt-1">Ben je enthousiast? Geef dit meteen aan. In Duitsland wordt vaak snel gekozen uit meerdere kandidaten.</p>
        </div>
      </div>
    </TipBody>
  ),
  tip_followup: () => (
    <TipBody>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Na een bezichtiging ben je er nog niet. In Duitsland is het gebruikelijk om een Mietbewerbung (huurpitch) te sturen. Dit is vaak het moment waarop verhuurders hun keuze maken — en het verschil tussen wel of niet uitgekozen worden.</p>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Een huurpitch is een kort, persoonlijk bericht aan de verhuurder. Je laat zien wie je bent, waarom je betrouwbaar bent en waarom juist deze woning bij je past. Verhuurders ontvangen soms tientallen reacties — een goede pitch helpt je om eruit te springen.</p>
      <TipSection title="Wat moet erin" items={[
        "Kort iets over jezelf (naam, leeftijd, situatie)",
        "Je werk en inkomen",
        "Waarom juist deze woning",
        "Dat je een rustige, betrouwbare huurder bent",
        "Eventueel: samenstelling van je huishouden",
      ]} />
      <TipSection title="Praktische tips" items={[
        "Houd het kort en persoonlijk — geen standaardtekst",
        "Maak het echt: schrijf het alsof je iemand aanspreekt",
        "Stuur het dezelfde dag als de bezichtiging",
        "Combineer het met je documenten (SCHUFA, inkomen)",
      ]} />
      <p className="text-[14px] text-[#6B7280] leading-relaxed">Ben je zeker? Stuur je pitch direct na de bezichtiging. Twijfel je? Slaap er één nacht over — maar wacht niet te lang. Snelheid telt.</p>
      <TipCta label="Genereer mijn huurpitch" href="/tools/rental-pitch" />
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
