import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, X, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";

export const FLOW_TIP_IDS = [
  "dokumente",
  "finanzen",
  "reaktion",
  "plattformen",
  "neubau",
  "netzwerk",
  "besichtigung",
  "followup",
] as const;

export type FlowTipId = (typeof FLOW_TIP_IDS)[number];

const LOCAL_TO_SERVER_ID: Record<FlowTipId, string> = {
  dokumente: "tip_documents",
  finanzen: "tip_finances",
  reaktion: "tip_landlord_accounts",
  plattformen: "tip_facebook_groups",
  neubau: "tip_new_build",
  netzwerk: "tip_network",
  besichtigung: "tip_viewings",
  followup: "tip_followup",
};

const SERVER_TO_LOCAL: Record<string, FlowTipId> = Object.fromEntries(
  Object.entries(LOCAL_TO_SERVER_ID).map(([k, v]) => [v, k as FlowTipId])
) as Record<string, FlowTipId>;

interface TipStepContent {
  id: FlowTipId;
  title: string;
  body: string;
  sections?: { heading: string; items: string[] }[];
}

export function getFlowTipSteps(t?: (key: string) => any): { id: string; title: string }[] {
  return FLOW_TIP_IDS.map((id) => ({
    id,
    title: t ? t(`tipsFlow.${id}.title`) : id,
  }));
}

export default function TipsFlowPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { t } = useTranslation();
  const accessToken = session?.access_token;
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());

  const STEPS: TipStepContent[] = FLOW_TIP_IDS.map((id) => {
    const base: TipStepContent = {
      id,
      title: t(`tipsFlow.${id}.title`),
      body: t(`tipsFlow.${id}.body`),
    };
    if (id === "dokumente") {
      base.sections = [
        {
          heading: t("tipsFlow.dokumente.s0Heading"),
          items: t("tipsFlow.dokumente.s0Items") as unknown as string[],
        },
        {
          heading: t("tipsFlow.dokumente.s1Heading"),
          items: t("tipsFlow.dokumente.s1Items") as unknown as string[],
        },
      ];
    }
    return base;
  });

  const strengthQuery = useQuery<{ prepTasks: { id: string; completed: boolean }[] }>({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (strengthQuery.data?.prepTasks) {
      const serverCompleted = new Set<string>();
      for (const task of strengthQuery.data.prepTasks) {
        if (task.completed) {
          const localId = SERVER_TO_LOCAL[task.id];
          if (localId) serverCompleted.add(localId);
        }
      }
      setCheckedSteps(serverCompleted);
    }
  }, [strengthQuery.data]);

  const markCompleteMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const serverId = LOCAL_TO_SERVER_ID[stepId as FlowTipId];
      if (!serverId || !accessToken) return;
      const res = await apiFetch("/api/flow/complete-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ flowId: "search", stepId: serverId }),
      });
      if (!res.ok) throw new Error("Failed to mark complete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    },
  });

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isChecked = checkedSteps.has(step.id);
  const completedCount = Array.from(FLOW_TIP_IDS).filter((id) => checkedSteps.has(id)).length;
  const progressPercent = Math.round((completedCount / STEPS.length) * 100);

  function handleToggleCheck() {
    const next = new Set(checkedSteps);
    if (next.has(step.id)) {
      next.delete(step.id);
    } else {
      next.add(step.id);
      markCompleteMutation.mutate(step.id);
    }
    setCheckedSteps(next);
  }

  function handleNext() {
    if (!isChecked) {
      const next = new Set(checkedSteps);
      next.add(step.id);
      setCheckedSteps(next);
      markCompleteMutation.mutate(step.id);
    }
    if (isLastStep) {
      navigate("/dashboard?tab=home");
    } else {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    } else {
      navigate("/dashboard?tab=home");
    }
  }

  function handleClose() {
    navigate("/dashboard?tab=home");
  }

  const stepOfLabel = t("tipsFlow.stepOf")
    .replace("{current}", String(currentStep + 1))
    .replace("{total}", String(STEPS.length));

  const completedLabel = t("tipsFlow.completed")
    .replace("{percent}", String(progressPercent));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
      <header className="sticky top-0 z-10 bg-white border-b border-ha-card-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-[480px] mx-auto flex items-center h-12 px-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input flex items-center justify-center transition-colors"
            data-testid="button-tips-back"
          >
            <ArrowLeft className="w-5 h-5 text-ha-text-secondary" />
          </button>
          <h1 className="flex-1 ml-1 text-[16px] font-semibold text-ha-text">
            {t("tipsFlow.pageTitle")}
          </h1>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input flex items-center justify-center transition-colors"
            data-testid="button-tips-close"
          >
            <X className="w-5 h-5 text-ha-text-secondary" />
          </button>
        </div>

        <div className="max-w-[480px] mx-auto px-4 pb-3">
          <div className="w-full h-[6px] rounded-full bg-ha-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-ha-success transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
              data-testid="progress-bar-fill"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px] text-ha-text-muted">
              {stepOfLabel}
            </span>
            <span className="text-[12px] font-semibold text-ha-success">
              {completedLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-[200px]">
        <div
          className="ha-card !p-0 overflow-hidden"
          data-testid={`card-step-${step.id}`}
        >
          <div className="px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-ha-text flex items-center justify-center flex-shrink-0">
                <span className="text-[14px] font-semibold text-white">{currentStep + 1}</span>
              </div>
              <h2 className="text-[18px] font-semibold text-ha-text leading-tight" data-testid="text-step-title">
                {step.title}
              </h2>
            </div>

            <div className="text-[15px] text-ha-text leading-relaxed whitespace-pre-line" data-testid="text-step-body">
              {step.body}
            </div>

            {step.sections?.map((section, sIdx) => (
              <div key={sIdx} className="mt-5">
                <p className="text-[14px] font-semibold text-ha-text mb-2">{section.heading}</p>
                <ul className="space-y-1.5">
                  {section.items.map((item, iIdx) => (
                    <li key={iIdx} className="flex items-start gap-2 text-[14px] text-ha-text leading-relaxed">
                      <span className="text-ha-success mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ha-card-border z-10">
        <div className="max-w-[480px] mx-auto px-4 py-4 pb-5 space-y-3">
          <button
            onClick={handleToggleCheck}
            className="w-full h-[48px] rounded-[--ha-btn-radius] flex items-center justify-center gap-2 text-[15px] font-medium transition-colors active:scale-[0.98]"
            style={{
              background: isChecked ? "rgb(var(--ha-success) / 0.08)" : "rgb(var(--ha-surface))",
              color: isChecked ? "rgb(var(--ha-success))" : "rgb(var(--ha-text))",
              border: isChecked ? "1px solid rgb(var(--ha-success) / 0.3)" : "1px solid transparent",
            }}
            data-testid="button-mark-complete"
          >
            {isChecked && <Check className="w-4 h-4" />}
            {isChecked ? t("tipsFlow.markedComplete") : t("tipsFlow.markComplete")}
          </button>

          <button
            onClick={handleNext}
            className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98]"
            data-testid="button-tips-next"
          >
            {isLastStep ? t("tipsFlow.finish") : t("tipsFlow.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
