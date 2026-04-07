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
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bell, Search, Phone, Users, UserCircle, FileText, FolderOpen, PlusCircle, Share2, Eye,
};

function getStepIcon(iconName: string) {
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon className="w-8 h-8 text-ha-primary" />;
}

function InlineProfileDetails({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        setFirstName(d?.first_name || "");
        setLastName(d?.last_name || "");
        setPhone(d?.phone || "");
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

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-4" data-testid="inline-profile-details">
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.firstName")}</label>
        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t("profileEdit.firstNamePlaceholder")} className={inputClass} data-testid="input-first-name" />
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.lastName")}</label>
        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t("profileEdit.lastNamePlaceholder")} className={inputClass} data-testid="input-last-name" />
      </div>
      <div>
        <label className="text-[13px] font-semibold text-[#374151] mb-1.5 block">{t("profileDetails.phone")}</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("profileEdit.phonePlaceholder")} className={inputClass} data-testid="input-phone" />
      </div>
      <button
        onClick={handleSave}
        disabled={saving || (!firstName.trim() && !lastName.trim())}
        className="w-full h-[50px] rounded-full bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#333333] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
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

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="inline-notifications">
      <ToggleRow
        icon={<Bell className="w-5 h-5 text-ha-primary" />}
        label={t("settings.pushNotifications")}
        enabled={settings.push_enabled}
        loading={updating === "push_enabled"}
        onToggle={() => handleToggle("push_enabled", settings.push_enabled)}
        testId="toggle-push"
      />
      <div className="h-px bg-[#F0F0F0] mx-4" />
      <ToggleRow
        icon={<FileText className="w-5 h-5 text-ha-primary" />}
        label={t("settings.emailNotifications")}
        enabled={settings.email_enabled}
        loading={updating === "email_enabled"}
        onToggle={() => handleToggle("email_enabled", settings.email_enabled)}
        testId="toggle-email"
      />
    </div>
  );
}

function ToggleRow({ icon, label, enabled, loading, onToggle, testId }: {
  icon: React.ReactNode; label: string; enabled: boolean; loading: boolean;
  onToggle: () => void; testId: string;
}) {
  return (
    <button onClick={onToggle} disabled={loading} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-[#FAFAFA] transition-colors" data-testid={testId}>
      <div className="flex-shrink-0">{icon}</div>
      <span className="flex-1 text-[15px] font-medium text-[#111111] text-left">{label}</span>
      <div className={`w-[46px] h-[26px] rounded-full transition-colors flex items-center px-0.5 ${enabled ? "bg-[#111111]" : "bg-[#D1D5DB]"}`}>
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

function FlowStepContent({ flow, step, accessToken }: { flow: TaskFlow; step: TaskFlowStep; accessToken: string }) {
  const { t } = useTranslation();

  if (step.inline) {
    switch (step.id) {
      case "profile_details":
        return <InlineProfileDetails accessToken={accessToken} />;
      case "notifications":
        return <InlineNotifications accessToken={accessToken} />;
      case "search_buddy":
        return <InlineSearchBuddy accessToken={accessToken} />;
    }
  }

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

function StepChecklist({ flow, completionMap, currentStepId }: { flow: TaskFlow; completionMap: Record<string, boolean>; currentStepId: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
      <p className="text-[13px] font-semibold text-[#374151] mb-3" data-testid="text-all-steps-label">
        {t("taskFlow.ui.allSteps")}
      </p>
      <div className="flex flex-col gap-1">
        {flow.steps.map((s, i) => {
          const done = completionMap[s.id] ?? false;
          const isCurrent = s.id === currentStepId;
          return (
            <button
              key={s.id}
              onClick={() => navigate(getFlowStepRoute(flow, s.id))}
              className={`w-full h-[46px] flex items-center gap-3 px-4 text-left rounded-xl transition-colors ${
                isCurrent ? "bg-[#FDF1F6] border border-ha-primary/20" : "hover:bg-[#F4F4F5]"
              }`}
              data-testid={`button-step-nav-${s.id}`}
            >
              <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                style={{
                  background: done ? "rgb(var(--ha-primary))" : isCurrent ? "#111111" : "#E5E7EB",
                  color: "white",
                }}
              >
                {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[14px] leading-snug flex-1 ${
                isCurrent ? "text-[#111111] font-semibold" : done ? "text-[#6B7280] font-medium" : "text-[#374151] font-medium"
              }`}>
                {t(s.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FlowPage() {
  const [, params] = useRoute("/flow/:flowId/:stepId");
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { t } = useTranslation();
  const accessToken = session?.access_token;

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
    ? () => navigate(getFlowStepRoute(flow, nextStep.id))
    : () => navigate("/home");
  const handleMarkComplete =
    step.completionType === "manual" && !isCompleted
      ? () => markCompleteMutation.mutate({ flowId: flow.id, stepId: step.id })
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
      <FlowStepContent flow={flow} step={step} accessToken={accessToken || ""} />
      <StepChecklist flow={flow} completionMap={completionMap} currentStepId={step.id} />
    </FlowLayout>
  );
}
