import { SEARCH_PREP_FLOW, type TaskFlow, type ProfileStrengthResponse } from "./task-flows";

export const SEARCH_FLOW_V2: TaskFlow = {
  id: "search-v2",
  titleKey: "flowV2.title",
  subtitleKey: "flowV2.subtitle",
  flowPrefix: "/flow-v2/search",
  steps: [
    {
      id: "create",
      labelKey: "flowV2.steps.create",
      descriptionKey: "flowV2.desc.create",
      icon: "Search",
      route: "/dashboard/searches/new",
      completionType: "auto",
    },
    {
      id: "optimize",
      labelKey: "flowV2.steps.optimize",
      descriptionKey: "flowV2.desc.optimize",
      icon: "SlidersHorizontal",
      route: "/dashboard/searches/new",
      completionType: "auto",
      inline: true,
    },
    {
      id: "ready",
      labelKey: "flowV2.steps.ready",
      descriptionKey: "flowV2.desc.ready",
      icon: "FolderOpen",
      route: "/documents",
      completionType: "auto",
      inline: true,
    },
    {
      id: "tips",
      labelKey: "flowV2.steps.tips",
      descriptionKey: "flowV2.desc.tips",
      icon: "Eye",
      route: "/tips/bezichtiging",
      completionType: "manual",
    },
    {
      id: "boost",
      labelKey: "flowV2.steps.boost",
      descriptionKey: "flowV2.desc.boost",
      icon: "Zap",
      route: "/profile/details",
      completionType: "auto",
      inline: true,
    },
  ],
};

export type FlowVersion = "v1" | "v2";

export function getFlowVersion(): FlowVersion {
  if (typeof window === "undefined") return "v1";
  try {
    const stored = localStorage.getItem("flow_version");
    if (stored === "v1" || stored === "v2") return stored;
  } catch {}
  const params = new URLSearchParams(window.location.search);
  if (params.get("flow") === "v2") return "v2";
  return "v1";
}

export function setFlowVersion(version: FlowVersion): void {
  try {
    if (version === "v1") {
      localStorage.removeItem("flow_version");
    } else {
      localStorage.setItem("flow_version", version);
    }
  } catch {}
}

export function isFlowV2Enabled(): boolean {
  return getFlowVersion() === "v2";
}

export function getSearchFlowEntryRoute(): string {
  return isFlowV2Enabled() ? "/flow-v2/search/create" : "/flow/search/extra_search_profile";
}

export function getActiveSearchPrepFlow(): TaskFlow {
  return isFlowV2Enabled() ? SEARCH_FLOW_V2 : SEARCH_PREP_FLOW;
}

export function buildV2CompletionMap(data: ProfileStrengthResponse | undefined): Record<string, boolean> {
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
