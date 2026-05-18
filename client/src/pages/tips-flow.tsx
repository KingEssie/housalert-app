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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
      <header
        className="sticky top-0 z-10 bg-white"
        style={{ borderBottom: "1px solid #ece7ef", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-[480px] mx-auto flex items-center h-14 px-4 gap-2">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-70"
            style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
            data-testid="button-tips-back"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: "#223546" }} />
          </button>
          <h1 className="flex-1 text-[15px] font-semibold truncate" style={{ color: "#111111" }}>
            Vergroot je kansen met deze tips!
          </h1>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity active:opacity-70"
            style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
            data-testid="button-tips-close"
          >
            <X className="w-5 h-5" style={{ color: "#223546" }} />
          </button>
        </div>

        <div className="max-w-[480px] mx-auto px-4 pb-3.5">
          <div
            className="w-full h-[5px] rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: "#bbadfb" }}
              data-testid="progress-bar-fill"
            />
          </div>
          <div className="flex items-center justify-end mt-1.5">
            <span className="text-[12px] font-semibold" style={{ color: "#b9a7ff" }}>
              {progressPercent}% voltooid
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-[200px]">
        <div
          className="overflow-hidden bg-white"
          style={{
            borderRadius: 28,
            border: "1px solid #ece7ef",
            boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
          }}
          data-testid={`card-step-${serverId}`}
        >
          <div className="px-5 py-6">
            <div className="flex items-start gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: "#bbadfb",
                  boxShadow: "0 2px 8px rgba(187,173,251,0.45)",
                }}
              >
                <span className="text-[14px] font-extrabold" style={{ color: "#111111" }}>
                  {currentStep + 1}
                </span>
              </div>
              <h2
                className="text-[20px] font-extrabold leading-snug"
                style={{ color: "#111111" }}
                data-testid="text-step-title"
              >
                {stepTitle}
              </h2>
            </div>

            <div
              className="[&_p]:text-[#222222] [&_p]:text-[15px] [&_p]:font-medium [&_p]:leading-relaxed [&_li]:text-[#222222] [&_li]:text-[15px] [&_li]:font-medium [&_li]:leading-relaxed [&_a]:text-[#7c5cbf] [&_a]:font-semibold [&_a]:no-underline hover:[&_a]:underline [&_.text-ha-text]:text-[#222222] [&_.text-ha-text-secondary]:text-[#555555] [&_.text-ha-text-muted]:text-[#777777] [&_span]:text-[#222222]"
              data-testid="text-step-body"
            >
              {contentRenderer ? contentRenderer() : null}
            </div>
          </div>
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-10 bg-white"
        style={{
          borderTop: "1px solid #ece7ef",
          boxShadow: "0 -1px 6px rgba(0,0,0,0.05)",
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 8px), 14px)",
        }}
      >
        <div className="max-w-[480px] mx-auto px-4 pt-4 space-y-4">
          <button
            onClick={handleToggleCheck}
            className="flex items-center gap-3 active:opacity-70 transition-opacity"
            data-testid="button-mark-complete"
          >
            <div
              className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-all"
              style={
                isChecked
                  ? { backgroundColor: "#bbadfb", border: "2px solid #bbadfb" }
                  : { backgroundColor: "white", border: "2px solid #bbadfb" }
              }
            >
              {isChecked && <Check className="w-3 h-3" style={{ color: "#111111" }} strokeWidth={3} />}
            </div>
            <span className="text-[15px] font-medium" style={{ color: "#111111" }}>
              Markeer als voltooid
            </span>
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
