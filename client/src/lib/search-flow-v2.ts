import type { TaskFlow } from "./task-flows";

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

export function isFlowV2Enabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("flow") === "v2") {
    try { localStorage.setItem("flow_version", "v2"); } catch {}
    return true;
  }
  try { return localStorage.getItem("flow_version") === "v2"; } catch {}
  return false;
}

export function disableFlowV2(): void {
  try { localStorage.removeItem("flow_version"); } catch {}
}
