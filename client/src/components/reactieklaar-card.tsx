import { apiFetch } from "@/lib/api-base";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import {
  CheckCircle2,
  ArrowRight,
  Zap,
  Bell,
  Users,
  FolderOpen,
  Phone,
  FileText,
} from "lucide-react";

interface SpeedStep {
  id: string;
  label?: string;
  done: boolean;
}

function getSpeedStepLabel(stepId: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    alerts_active: t("strengthTask.alerts"),
    search_buddy_added: t("strengthTask.searchBuddy"),
    letter_ready: t("strengthTask.applicationTemplate"),
    documents_ready: t("strengthTask.documents"),
    phone_added: t("strengthTask.phone"),
  };
  return map[stepId] || stepId;
}

interface BoostData {
  speedSteps: SpeedStep[];
  speedDone: number;
  speedTotal: number;
}

const STEP_ICONS: Record<string, typeof Bell> = {
  alerts_active: Bell,
  search_buddy_added: Users,
  documents_ready: FolderOpen,
  phone_added: Phone,
  letter_ready: FileText,
};

const STEP_ROUTES: Record<string, string> = {
  alerts_active: "/dashboard",
  search_buddy_added: "",
  documents_ready: "/documents",
  phone_added: "/profile/edit/phone",
  letter_ready: "/application-letter",
};

function useReactieklaarData() {
  const { session } = useAuth();
  return useQuery<BoostData>({
    queryKey: ["/api/boost"],
    queryFn: async () => {
      const res = await apiFetch("/api/boost", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch readiness data");
      return res.json();
    },
    enabled: !!session?.access_token,
    select: (data) => ({
      speedSteps: data.speedSteps,
      speedDone: data.speedDone,
      speedTotal: data.speedTotal,
    }),
  });
}

export function ReactieklaarCard({
  navigate,
  steps,
  done,
  total,
  onStepClick,
}: {
  navigate: (path: string) => void;
  steps?: SpeedStep[];
  done?: number;
  total?: number;
  onStepClick?: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useReactieklaarData();

  const speedSteps = steps ?? data?.speedSteps ?? [];
  const speedDone = done ?? data?.speedDone ?? 0;
  const speedTotal = total ?? data?.speedTotal ?? 0;
  const loading = !steps && isLoading;

  if (loading) {
    return (
      <div className="bg-ha-card rounded-[16px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 animate-pulse" data-testid="card-reactieklaar-loading">
        <div className="h-4 bg-ha-surface rounded w-36 mb-4" />
        <div className="flex flex-col gap-3">
          <div className="h-3 bg-ha-surface rounded w-32" />
          <div className="h-3 bg-ha-surface rounded w-40" />
          <div className="h-3 bg-ha-surface rounded w-28" />
        </div>
      </div>
    );
  }

  const allDone = speedDone === speedTotal && speedTotal > 0;

  return (
    <div className="bg-ha-card rounded-[16px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5" data-testid="card-reactieklaar">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center">
          <Zap className="w-[18px] h-[18px] text-ha-text-muted" />
        </div>
        <h3 className="text-[15px] font-medium text-ha-text flex-1">{t("reactieklaar.title")}</h3>
        <span
          className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${
            allDone ? "bg-ha-success/10 text-ha-text" : "bg-ha-surface text-ha-text"
          }`}
          data-testid="text-reactieklaar-progress"
        >
          {speedDone} / {speedTotal} {t("reactieklaar.steps")}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {speedSteps.map((step) => {
          const Icon = STEP_ICONS[step.id] || CheckCircle2;
          const route = STEP_ROUTES[step.id] ?? "";
          const hasAction = !step.done && (route.length > 0 || onStepClick);

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 py-2 ${
                hasAction ? "cursor-pointer hover:bg-ha-surface -mx-2 px-2 rounded-lg transition-colors" : ""
              }`}
              onClick={() => {
                if (!step.done) {
                  if (route.length > 0) navigate(route);
                  else if (onStepClick) onStepClick(step.id);
                }
              }}
              data-testid={`reactieklaar-${step.id}`}
            >
              {step.done ? (
                <div className="w-[18px] h-[18px] rounded-full bg-ha-success/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-ha-success" />
                </div>
              ) : (
                <div className="w-[18px] h-[18px] rounded-full border-2 border-ha-card-border flex-shrink-0" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${step.done ? "text-ha-card-border" : "text-ha-text-muted"}`} />
              <span className={`text-[14px] flex-1 ${step.done ? "text-ha-text" : "text-ha-text font-medium"}`}>
                {getSpeedStepLabel(step.id, t)}
              </span>
              {hasAction && (
                <ArrowRight className="w-3.5 h-3.5 text-ha-text flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-4 bg-ha-success/10 rounded-lg px-3.5 py-2.5">
          <p className="text-[12px] text-ha-success font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            {t("reactieklaar.readyMessage")}
          </p>
        </div>
      )}
    </div>
  );
}
