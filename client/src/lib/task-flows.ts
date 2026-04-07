export interface TaskFlowStep {
  id: string;
  labelKey: string;
  route: string;
}

export interface TaskFlow {
  id: string;
  titleKey: string;
  subtitleKey: string;
  steps: TaskFlowStep[];
}

export const ACCOUNT_FLOW: TaskFlow = {
  id: "account",
  titleKey: "taskFlow.accountTitle",
  subtitleKey: "taskFlow.accountSubtitle",
  steps: [
    { id: "notifications", labelKey: "taskFlow.notifications", route: "/settings/preferences" },
    { id: "search_profile", labelKey: "taskFlow.searchProfile", route: "/dashboard/searches/new" },
    { id: "phone", labelKey: "taskFlow.phone", route: "/profile/edit/phone" },
    { id: "search_buddy", labelKey: "taskFlow.searchBuddy", route: "/profile/edit/search_buddy_email" },
    { id: "profile_details", labelKey: "taskFlow.profileDetails", route: "/profile/details" },
  ],
};

export const SEARCH_PREP_FLOW: TaskFlow = {
  id: "search",
  titleKey: "taskFlow.searchTitle",
  subtitleKey: "taskFlow.searchSubtitle",
  steps: [
    { id: "application_letter", labelKey: "taskFlow.applicationLetter", route: "/application-letter" },
    { id: "documents", labelKey: "taskFlow.documents", route: "/documents" },
    { id: "extra_search_profile", labelKey: "taskFlow.extraSearchProfile", route: "/dashboard/searches/new" },
    { id: "network", labelKey: "taskFlow.network", route: "/profile/details" },
    { id: "viewing_tips", labelKey: "taskFlow.viewingTips", route: "/tips/bezichtiging" },
  ],
};

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

export function resolveFlowSteps(
  flow: TaskFlow,
  completionMap: Record<string, boolean>,
  t: (key: string) => string,
  navigate: (path: string) => void,
) {
  return flow.steps.map((step, index) => ({
    id: step.id,
    label: t(step.labelKey),
    completed: completionMap[step.id] ?? false,
    action: () => navigate(step.route),
    stepIndex: index,
    totalSteps: flow.steps.length,
  }));
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
