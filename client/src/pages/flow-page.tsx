import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { FlowLayout } from "@/components/flow-layout";
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
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bell, Search, Phone, Users, UserCircle, FileText, FolderOpen, PlusCircle, Share2, Eye,
};

function getStepIcon(iconName: string) {
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon className="w-7 h-7 text-ha-primary" />;
}

function FlowStepContent({ flow, step }: { flow: TaskFlow; step: TaskFlowStep }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate(step.route)}
        className="w-full h-[52px] rounded-2xl bg-white border border-[#E5E7EB] text-[15px] font-medium text-[#111111] hover:bg-[#F9FAFB] active:bg-[#F0F0F0] transition-colors flex items-center justify-center gap-2"
        data-testid={`button-open-step-${step.id}`}
      >
        {t("taskFlow.ui.openStep")}
      </button>
    </div>
  );
}

function StepChecklist({ flow, completionMap }: { flow: TaskFlow; completionMap: Record<string, boolean> }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="mt-6 border-t border-[#E5E7EB] pt-6">
      <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-3" data-testid="text-all-steps-label">
        {t("taskFlow.ui.allSteps")}
      </p>
      <div className="flex flex-col gap-1.5">
        {flow.steps.map((s, i) => {
          const done = completionMap[s.id] ?? false;
          return (
            <button
              key={s.id}
              onClick={() => navigate(getFlowStepRoute(flow, s.id))}
              className="w-full h-[44px] flex items-center gap-3 px-4 text-left rounded-xl hover:bg-white transition-colors"
              data-testid={`button-step-nav-${s.id}`}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                style={{
                  background: done ? "rgb(var(--ha-primary))" : "#F0F0F0",
                  color: done ? "white" : "#6B7280",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-[14px] leading-snug flex-1 ${done ? "text-[#6B7280]" : "text-[#111111] font-medium"}`}>
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
      <FlowStepContent flow={flow} step={step} />
      <StepChecklist flow={flow} completionMap={completionMap} />
    </FlowLayout>
  );
}
