import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, X, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { getTipContent } from "@/pages/flow-page";

const STEP_SERVER_IDS = [
  "tip_documents",
  "tip_finances",
  "tip_landlord_accounts",
  "tip_facebook_groups",
  "tip_new_build",
  "tip_network",
  "tip_viewings",
  "tip_followup",
] as const;

type ServerStepId = typeof STEP_SERVER_IDS[number];

const STEP_TITLES: Record<ServerStepId, string> = {
  tip_documents: "Verzamel vereiste documenten",
  tip_finances: "Check je financiële situatie",
  tip_landlord_accounts: "Maak accounts aan bij grote verhuurders",
  tip_facebook_groups: "Meld je aan voor Facebook-groepen",
  tip_new_build: "Houd nieuwbouwprojecten in de gaten",
  tip_network: "Zet je netwerk in",
  tip_viewings: "Kom goed voor de dag bij bezichtigingen",
  tip_followup: "Stuur een sterke huurpitch",
};

function getInitialStep(): number {
  const param = new URLSearchParams(window.location.search).get("step");
  const n = parseInt(param ?? "0", 10);
  return isNaN(n) || n < 0 || n >= STEP_SERVER_IDS.length ? 0 : n;
}

export const FLOW_TIP_IDS = STEP_SERVER_IDS;
export type FlowTipId = ServerStepId;
export function getFlowTipSteps(_t?: unknown): { id: string; title: string }[] {
  return STEP_SERVER_IDS.map(id => ({ id, title: STEP_TITLES[id] }));
}

export default function TipsFlowPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { t } = useTranslation();
  const accessToken = session?.access_token;

  const [currentStep, setCurrentStep] = useState(() => getInitialStep());
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());

  const totalSteps = STEP_SERVER_IDS.length;
  const serverId = STEP_SERVER_IDS[currentStep];
  const stepTitle = STEP_TITLES[serverId];
  const isLastStep = currentStep === totalSteps - 1;
  const isChecked = checkedSteps.has(serverId);
  const completedCount = STEP_SERVER_IDS.filter(id => checkedSteps.has(id)).length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

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
        if (task.completed) serverCompleted.add(task.id);
      }
      setCheckedSteps(serverCompleted);
    }
  }, [strengthQuery.data]);

  const markCompleteMutation = useMutation({
    mutationFn: async (stepId: string) => {
      if (!accessToken) return;
      const res = await apiFetch("/api/flow/complete-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ flowId: "search", stepId }),
      });
      if (!res.ok) throw new Error("Failed to mark complete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    },
  });

  function handleToggleCheck() {
    const next = new Set(checkedSteps);
    if (next.has(serverId)) {
      next.delete(serverId);
    } else {
      next.add(serverId);
      markCompleteMutation.mutate(serverId);
    }
    setCheckedSteps(next);
  }

  function handleNext() {
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

  const tipContent = getTipContent(t as unknown as (key: string) => string);
  const contentRenderer = tipContent[serverId];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f9f7f8" }}>
      <header
        className="sticky top-0 z-10"
        style={{ backgroundColor: "#223546", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-2">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-70"
            style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            data-testid="button-tips-back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="flex-1 text-[15px] font-semibold text-white truncate">
            Vergroot je kansen met deze tips!
          </h1>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-70"
            style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            data-testid="button-tips-close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="max-w-[480px] mx-auto px-4 pb-3.5">
          <div
            className="w-full h-[5px] rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: "#bbadfb" }}
              data-testid="progress-bar-fill"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.65)" }}>
              Stap {currentStep + 1} van {totalSteps}
            </span>
            <span className="text-[12px] font-semibold" style={{ color: "#bbadfb" }}>
              {progressPercent}% voltooid
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-[200px]">
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: "#223546",
            borderRadius: 28,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          }}
          data-testid={`card-step-${serverId}`}
        >
          <div className="px-5 py-6">
            <div className="flex items-start gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: "#bbadfb" }}
              >
                <span className="text-[14px] font-bold" style={{ color: "#111111" }}>
                  {currentStep + 1}
                </span>
              </div>
              <h2
                className="text-[18px] font-bold leading-tight text-white"
                data-testid="text-step-title"
              >
                {stepTitle}
              </h2>
            </div>

            <div
              className="[&_p]:text-white [&_p]:opacity-90 [&_li]:text-white [&_li]:opacity-90 [&_span]:text-white [&_a]:text-[#bbadfb] [&_a]:font-semibold [&_a]:no-underline hover:[&_a]:underline [&_.text-ha-text]:text-white [&_.text-ha-text-secondary]:text-white/60 [&_.text-ha-text-muted]:text-white/50 [&_p.font-semibold]:opacity-100 [&_p.font-semibold]:text-white [&_.rounded-2xl]:border-white/10"
              data-testid="text-step-body"
            >
              {contentRenderer ? contentRenderer() : null}
            </div>
          </div>
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t z-10"
        style={{
          borderColor: "#ece7ef",
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 8px), 14px)",
        }}
      >
        <div className="max-w-[480px] mx-auto px-4 pt-3 space-y-2.5">
          <button
            onClick={handleToggleCheck}
            className="w-full h-[50px] rounded-full flex items-center justify-center gap-2 text-[15px] font-semibold transition-all active:scale-[0.98]"
            style={
              isChecked
                ? { backgroundColor: "#bbadfb", color: "#111111", border: "1.5px solid #bbadfb" }
                : { backgroundColor: "transparent", color: "#444444", border: "1.5px solid #d9d3e3" }
            }
            data-testid="button-mark-complete"
          >
            {isChecked && <Check className="w-4 h-4" />}
            {isChecked ? "Voltooid" : "Markeer als voltooid"}
          </button>

          <button
            onClick={handleNext}
            className="w-full h-[56px] rounded-full text-[16px] font-bold transition-colors active:scale-[0.98]"
            style={{ backgroundColor: "#85fb8c", color: "#111111" }}
            data-testid="button-tips-next"
          >
            {isLastStep ? "Afronden" : "Volgende →"}
          </button>
        </div>
      </div>
    </div>
  );
}
