import type { ReactNode } from "react";
import type { CompletionStep, StepType } from "@/components/expandable-completion-card";

export type CompletionType = "auto" | "manual";

export interface TaskFlowStep {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  route: string;
  completionType: CompletionType;
  inline?: boolean;
}

export interface TaskFlow {
  id: string;
  titleKey: string;
  subtitleKey: string;
  flowPrefix: string;
  steps: TaskFlowStep[];
}

export const ACCOUNT_FLOW: TaskFlow = {
  id: "account",
  titleKey: "taskFlow.accountTitle",
  subtitleKey: "taskFlow.accountSubtitle",
  flowPrefix: "/flow/account",
  steps: [
    { id: "profile_details", labelKey: "taskFlow.profileDetails", descriptionKey: "taskFlow.desc.profileDetails", icon: "UserCircle", route: "/profile/details", completionType: "auto", inline: true },
    { id: "search_profile", labelKey: "taskFlow.searchProfile", descriptionKey: "taskFlow.desc.searchProfile", icon: "Search", route: "/dashboard/searches/new", completionType: "auto" },
    { id: "notifications", labelKey: "taskFlow.notifications", descriptionKey: "taskFlow.desc.notifications", icon: "Bell", route: "/settings/preferences", completionType: "auto", inline: true },
    { id: "search_buddy", labelKey: "taskFlow.searchBuddy", descriptionKey: "taskFlow.desc.searchBuddy", icon: "Users", route: "/profile/edit/search_buddy_email", completionType: "auto", inline: true },
    { id: "documents", labelKey: "taskFlow.documents", descriptionKey: "taskFlow.desc.documents", icon: "FolderOpen", route: "/documents", completionType: "auto" },
  ],
};

export const SEARCH_PREP_FLOW: TaskFlow = {
  id: "search",
  titleKey: "taskFlow.searchTitle",
  subtitleKey: "taskFlow.searchSubtitle",
  flowPrefix: "/flow/search",
  steps: [
    { id: "extra_search_profile", labelKey: "taskFlow.extraSearchProfile", descriptionKey: "taskFlow.desc.extraSearchProfile", icon: "PlusCircle", route: "/dashboard/searches/new", completionType: "auto" },
    { id: "application_letter", labelKey: "taskFlow.applicationLetter", descriptionKey: "taskFlow.desc.applicationLetter", icon: "FileText", route: "/application-letter", completionType: "auto" },
    { id: "viewing_tips", labelKey: "taskFlow.viewingTips", descriptionKey: "taskFlow.desc.viewingTips", icon: "Eye", route: "/tips/bezichtiging", completionType: "manual" },
    { id: "network", labelKey: "taskFlow.network", descriptionKey: "taskFlow.desc.network", icon: "Share2", route: "/profile/details", completionType: "manual" },
  ],
};

export const ALL_FLOWS: TaskFlow[] = [ACCOUNT_FLOW, SEARCH_PREP_FLOW];

export function getFlowById(flowId: string): TaskFlow | undefined {
  return ALL_FLOWS.find(f => f.id === flowId);
}

export function getTaskSourceForFlow(flow: TaskFlow): "tasks" | "prepTasks" {
  return flow.id === "account" ? "tasks" : "prepTasks";
}

export function getStepIndex(flow: TaskFlow, stepId: string): number {
  return flow.steps.findIndex(s => s.id === stepId);
}

export function getFlowStepRoute(flow: TaskFlow, stepId: string): string {
  return `${flow.flowPrefix}/${stepId}`;
}

export interface ProfileStrengthResponse {
  score: number;
  tasks: { id: string; completed: boolean; score: number }[];
  completedCount: number;
  totalCount: number;
  prepTasks: { id: string; completed: boolean; score: number }[];
  prepCompletedCount: number;
  prepTotalCount: number;
  maxScore: number;
  channels: { email: boolean; push: boolean };
  speedSteps: { id: string; done: boolean }[];
  speedDone: number;
  speedTotal: number;
  recommendedChannel: string | null;
}

export interface StepOverride {
  stepType?: StepType;
  inlineContent?: ReactNode;
  action?: () => void;
}

export function resolveFlowSteps(
  flow: TaskFlow,
  completionMap: Record<string, boolean>,
  t: (key: string) => string,
  navigate: (path: string) => void,
  overrides?: Record<string, StepOverride>,
): CompletionStep[] {
  return flow.steps.map((step) => {
    const override = overrides?.[step.id];
    return {
      id: step.id,
      label: t(step.labelKey),
      completed: completionMap[step.id] ?? false,
      action: override?.action ?? (() => navigate(getFlowStepRoute(flow, step.id))),
      stepType: override?.stepType,
      inlineContent: override?.inlineContent,
    };
  });
}

export function buildCompletionMap(
  tasks: { id: string; completed: boolean }[],
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const t of tasks) {
    map[t.id] = t.completed;
  }
  return map;
}
