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
  ],
};

export const SEARCH_PREP_FLOW: TaskFlow = {
  id: "search",
  titleKey: "taskFlow.searchTitle",
  subtitleKey: "taskFlow.searchSubtitle",
  flowPrefix: "/flow/search",
  steps: [
    { id: "tip_documents", labelKey: "taskFlow.tipDocuments", descriptionKey: "taskFlow.desc.tipDocuments", icon: "FileText", route: "/tips/documenten", completionType: "manual" },
    { id: "tip_finances", labelKey: "taskFlow.tipFinances", descriptionKey: "taskFlow.desc.tipFinances", icon: "Wallet", route: "/tips/financien", completionType: "manual" },
    { id: "tip_landlord_accounts", labelKey: "taskFlow.tipLandlordAccounts", descriptionKey: "taskFlow.desc.tipLandlordAccounts", icon: "Building", route: "/tips/verhuurders", completionType: "manual" },
    { id: "tip_facebook_groups", labelKey: "taskFlow.tipFacebookGroups", descriptionKey: "taskFlow.desc.tipFacebookGroups", icon: "Users", route: "/tips/facebook", completionType: "manual" },
    { id: "tip_new_build", labelKey: "taskFlow.tipNewBuild", descriptionKey: "taskFlow.desc.tipNewBuild", icon: "Building", route: "/tips/nieuwbouw", completionType: "manual" },
    { id: "tip_network", labelKey: "taskFlow.tipNetwork", descriptionKey: "taskFlow.desc.tipNetwork", icon: "Share2", route: "/tips/netwerk", completionType: "manual" },
    { id: "tip_viewings", labelKey: "taskFlow.tipViewings", descriptionKey: "taskFlow.desc.tipViewings", icon: "Eye", route: "/tips/bezichtiging", completionType: "manual" },
    { id: "tip_followup", labelKey: "taskFlow.tipFollowup", descriptionKey: "taskFlow.desc.tipFollowup", icon: "Mail", route: "/tips/opvolging", completionType: "manual" },
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
  labelOverride?: string;
  completedOverride?: boolean;
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
      label: override?.labelOverride ?? t(step.labelKey),
      completed: override?.completedOverride ?? completionMap[step.id] ?? false,
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
