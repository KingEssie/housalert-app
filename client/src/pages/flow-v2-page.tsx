import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { FlowLayout } from "@/components/flow-layout";
import { SEARCH_FLOW_V2 } from "@/lib/search-flow-v2";
import {
  getStepIndex,
  getFlowStepRoute,
  type ProfileStrengthResponse,
  type TaskFlowStep,
} from "@/lib/task-flows";
import {
  Bell,
  Search,
  Check,
  ArrowRight,
  Loader2,
  FolderOpen,
  FileText,
  Users,
  Eye,
  Zap,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Search, Eye, FolderOpen, FileText, Users, Zap, SlidersHorizontal, Bell,
};

function getStepIcon(iconName: string) {
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon className="w-8 h-8 text-ha-primary" />;
}

function InlineOptimize({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const searchesQuery = useQuery<{ id: number; city: string; price_max: number }[]>({
    queryKey: ["/api/search-profiles"],
    queryFn: async () => {
      const res = await apiFetch("/api/search-profiles", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!accessToken,
  });

  const profiles = searchesQuery.data ?? [];

  if (searchesQuery.isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 text-center" data-testid="v2-no-searches">
        <p className="text-[15px] text-[#6B7280] mb-4">{t("flowV2.optimize.noSearches")}</p>
        <button
          onClick={() => navigate("/dashboard/searches/new")}
          className="w-full h-[50px] rounded-full bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#333333] transition-colors flex items-center justify-center gap-2"
          data-testid="button-create-first-search"
        >
          <Search className="w-4 h-4" />
          {t("flowV2.optimize.createFirst")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-3" data-testid="v2-optimize">
      <p className="text-[14px] text-[#374151] font-medium mb-1">{t("flowV2.optimize.yourSearches")}</p>
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/dashboard/searches/edit/${p.id}`)}
          className="w-full px-4 py-3.5 rounded-xl border border-[#E5E7EB] hover:border-ha-primary/30 hover:bg-[#FAFAFA] transition-colors flex items-center gap-3 text-left"
          data-testid={`button-edit-search-${p.id}`}
        >
          <SlidersHorizontal className="w-4 h-4 text-ha-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[15px] font-medium text-[#111111] block truncate">{p.city}</span>
            {p.price_max > 0 && (
              <span className="text-[13px] text-[#6B7280]">max. {p.price_max.toLocaleString("de-DE")}/m</span>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
        </button>
      ))}
      <button
        onClick={() => navigate("/dashboard/searches/new")}
        className="w-full h-[48px] rounded-full border border-[#E5E7EB] text-[14px] font-semibold text-[#374151] hover:bg-[#F4F4F5] transition-colors flex items-center justify-center gap-2 mt-1"
        data-testid="button-add-another-search"
      >
        <Search className="w-4 h-4" />
        {t("flowV2.optimize.addAnother")}
      </button>
    </div>
  );
}

function InlineReady({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const profileQuery = useQuery({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ProfileStrengthResponse>;
    },
    enabled: !!accessToken,
  });

  const data = profileQuery.data;
  const docsTask = data?.tasks.find(t => t.id === "documents");
  const letterTask = data?.prepTasks.find(t => t.id === "application_letter");
  const hasDocs = docsTask?.completed ?? false;
  const hasLetter = letterTask?.completed ?? false;

  if (profileQuery.isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="v2-ready">
      <ReadyItem
        icon={<FolderOpen className="w-5 h-5 text-ha-primary" />}
        label={t("flowV2.ready.documents")}
        done={hasDocs}
        onAction={() => navigate("/documents")}
        testId="ready-documents"
      />
      <ReadyItem
        icon={<FileText className="w-5 h-5 text-ha-primary" />}
        label={t("flowV2.ready.letter")}
        done={hasLetter}
        onAction={() => navigate("/application-letter")}
        testId="ready-letter"
      />
    </div>
  );
}

function ReadyItem({ icon, label, done, onAction, testId }: {
  icon: React.ReactNode; label: string; done: boolean; onAction: () => void; testId: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onAction}
      className="w-full bg-white rounded-2xl border border-[#E5E7EB] px-5 py-4 flex items-center gap-4 hover:bg-[#FAFAFA] transition-colors text-left"
      data-testid={testId}
    >
      <div className="flex-shrink-0">{icon}</div>
      <span className="flex-1 text-[15px] font-medium text-[#111111]">{label}</span>
      {done ? (
        <div className="w-[26px] h-[26px] rounded-full bg-[#16A34A] flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </div>
      ) : (
        <span className="text-[13px] font-medium text-ha-primary">{t("flowV2.ready.start")}</span>
      )}
    </button>
  );
}

function InlineBoost({ accessToken }: { accessToken: string }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const profileQuery = useQuery({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ProfileStrengthResponse>;
    },
    enabled: !!accessToken,
  });

  const data = profileQuery.data;
  const hasNotifications = data?.channels.email || data?.channels.push;
  const hasBuddy = data?.tasks.find(t => t.id === "search_buddy")?.completed ?? false;
  const hasNetwork = data?.prepTasks.find(t => t.id === "network")?.completed ?? false;

  if (profileQuery.isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="v2-boost">
      <ReadyItem
        icon={<Bell className="w-5 h-5 text-ha-primary" />}
        label={t("flowV2.boost.notifications")}
        done={!!hasNotifications}
        onAction={() => navigate("/settings/preferences")}
        testId="boost-notifications"
      />
      <ReadyItem
        icon={<Users className="w-5 h-5 text-ha-primary" />}
        label={t("flowV2.boost.buddy")}
        done={hasBuddy}
        onAction={() => navigate("/profile/edit/search_buddy_email")}
        testId="boost-buddy"
      />
      <ReadyItem
        icon={<Sparkles className="w-5 h-5 text-ha-primary" />}
        label={t("flowV2.boost.network")}
        done={hasNetwork}
        onAction={() => navigate("/profile/details")}
        testId="boost-network"
      />
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

function V2StepContent({ step, accessToken }: { step: TaskFlowStep; accessToken: string }) {
  const { t } = useTranslation();

  if (step.inline) {
    switch (step.id) {
      case "optimize":
        return <InlineOptimize accessToken={accessToken} />;
      case "ready":
        return <InlineReady accessToken={accessToken} />;
      case "boost":
        return <InlineBoost accessToken={accessToken} />;
    }
  }

  const stepLabels: Record<string, string> = {
    create: t("flowV2.ui.createSearch"),
    tips: t("flowV2.ui.viewTips"),
  };

  return <OpenPageButton step={step} label={stepLabels[step.id] || t("taskFlow.ui.openStep")} />;
}

export default function FlowV2Page() {
  const [, params] = useRoute("/flow-v2/search/:stepId");
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { t } = useTranslation();
  const accessToken = session?.access_token;

  const flow = SEARCH_FLOW_V2;
  const stepId = params?.stepId;
  const stepIndex = stepId ? getStepIndex(flow, stepId) : -1;
  const step = stepIndex >= 0 ? flow.steps[stepIndex] : undefined;

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

  if (!step || stepIndex < 0) {
    navigate("/home");
    return null;
  }

  const data = strengthQuery.data;
  const completionMap = buildV2CompletionMap(data);
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
      <V2StepContent step={step} accessToken={accessToken || ""} />
    </FlowLayout>
  );
}

function buildV2CompletionMap(data: ProfileStrengthResponse | undefined): Record<string, boolean> {
  if (!data) return {};
  const hasSearch = (data.tasks.find(t => t.id === "search_profile")?.completed) ?? false;
  const hasMultipleSearches = (data.prepTasks.find(t => t.id === "extra_search_profile")?.completed) ?? false;
  const hasDocs = (data.tasks.find(t => t.id === "documents")?.completed) ?? false;
  const hasLetter = (data.prepTasks.find(t => t.id === "application_letter")?.completed) ?? false;
  const hasViewingTips = (data.prepTasks.find(t => t.id === "viewing_tips")?.completed) ?? false;
  const hasNotifications = data.channels.email || data.channels.push;
  const hasBuddy = (data.tasks.find(t => t.id === "search_buddy")?.completed) ?? false;
  const hasNetwork = (data.prepTasks.find(t => t.id === "network")?.completed) ?? false;

  return {
    create: hasSearch,
    optimize: hasSearch && hasMultipleSearches,
    ready: hasDocs && hasLetter,
    tips: hasViewingTips,
    boost: hasNotifications && hasBuddy && hasNetwork,
  };
}
