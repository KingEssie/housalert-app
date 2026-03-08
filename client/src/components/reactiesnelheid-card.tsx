import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Gauge, ChevronRight } from "lucide-react";

interface SpeedStep {
  id: string;
  label: string;
  done: boolean;
}

interface BoostData {
  speedSteps: SpeedStep[];
  speedDone: number;
  speedTotal: number;
}

export type SpeedLevel = "fast" | "almost" | "building";

export interface ReactiesnelheidState {
  level: SpeedLevel;
  label: string;
  subtitle: string;
  done: number;
  total: number;
  fraction: number;
}

export function calculateReactiesnelheid(rawDone: number, rawTotal: number): ReactiesnelheidState {
  const total = Math.max(0, rawTotal);
  const done = Math.max(0, Math.min(rawDone, total));
  const fraction = total > 0 ? done / total : 0;

  if (fraction >= 1) {
    return {
      level: "fast",
      label: "Snelle reageerder",
      subtitle: "Je bent klaar om direct te reageren op nieuwe woningen.",
      done,
      total,
      fraction: 1,
    };
  }

  const remaining = total - done;

  if (fraction >= 0.6) {
    return {
      level: "almost",
      label: "Bijna klaar",
      subtitle: `Nog ${remaining} ${remaining === 1 ? "stap" : "stappen"} om sneller te reageren.`,
      done,
      total,
      fraction,
    };
  }

  return {
    level: "building",
    label: "Goed bezig",
    subtitle: `Rond nog ${remaining} ${remaining === 1 ? "stap" : "stappen"} af om sneller te kunnen reageren.`,
    done,
    total,
    fraction,
  };
}

const LEVEL_STYLES: Record<SpeedLevel, { dotColor: string; barColor: string; labelColor: string }> = {
  fast: { dotColor: "bg-[var(--yo-success)]", barColor: "bg-[var(--yo-success)]", labelColor: "text-[var(--yo-dark)] bg-[var(--yo-success)]/10" },
  almost: { dotColor: "bg-[var(--yo-success)]", barColor: "bg-[var(--yo-success)]", labelColor: "text-[var(--yo-dark)] bg-[var(--yo-success)]/10" },
  building: { dotColor: "bg-[var(--yo-divider)]", barColor: "bg-[var(--yo-divider)]", labelColor: "text-[var(--yo-muted)] bg-[var(--yo-surface)]" },
};

function useReactiesnelheidData() {
  const { session } = useAuth();
  return useQuery<BoostData>({
    queryKey: ["/api/boost"],
    queryFn: async () => {
      const res = await fetch("/api/boost", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch speed data");
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

export function ReactiesnelheidCard({
  onTap,
  done: propDone,
  total: propTotal,
}: {
  onTap?: () => void;
  done?: number;
  total?: number;
}) {
  const { data, isLoading } = useReactiesnelheidData();

  const done = propDone ?? data?.speedDone ?? 0;
  const total = propTotal ?? data?.speedTotal ?? 0;
  const loading = propDone === undefined && isLoading;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse" data-testid="card-reactiesnelheid-loading">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-32 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-48 mb-3" />
        <div className="h-1.5 bg-[var(--yo-surface)] rounded-full w-full" />
      </div>
    );
  }

  if (total === 0) return null;

  const state = calculateReactiesnelheid(done, total);
  const styles = LEVEL_STYLES[state.level];
  const pct = Math.round(state.fraction * 100);

  const Wrapper = onTap ? "button" : "div";

  return (
    <Wrapper
      onClick={onTap}
      className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 w-full text-left ${onTap ? "cursor-pointer" : ""}`}
      data-testid="card-reactiesnelheid"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--yo-teal-light)] flex items-center justify-center flex-shrink-0">
          <Gauge className="w-5 h-5 text-[var(--yo-teal)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[15px] font-semibold text-[var(--yo-dark)]">Reactiesnelheid</p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles.labelColor}`} data-testid="badge-speed-level">
              {state.label}
            </span>
          </div>
          <p className="text-[13px] text-[var(--yo-muted)] leading-relaxed">{state.subtitle}</p>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[var(--yo-surface)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${styles.barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[12px] font-medium text-[var(--yo-muted)] flex-shrink-0" data-testid="text-speed-ratio">
              {done}/{total}
            </span>
          </div>
        </div>
        {onTap && (
          <ChevronRight className="w-4 h-4 text-[var(--yo-muted)] flex-shrink-0 mt-1" />
        )}
      </div>
    </Wrapper>
  );
}
