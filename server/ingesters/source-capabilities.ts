export interface SourceCapability {
  source: string;
  supportsSourcePublishedAt: boolean;
  supportsFastLane: boolean;
  fastLaneIntervalSeconds: number;
  recommendedIntervalSeconds: number;
  antiBotRisk: "low" | "medium" | "high";
  priorityLevel: number;
  fastLaneCities: string[];
}

export const SOURCE_CAPABILITIES: Record<string, SourceCapability> = {
  "kleinanzeigen": {
    source: "kleinanzeigen",
    supportsSourcePublishedAt: true,
    supportsFastLane: true,
    fastLaneIntervalSeconds: 15,
    recommendedIntervalSeconds: 15,
    antiBotRisk: "medium",
    priorityLevel: 1,
    fastLaneCities: ["Berlin"],
  },
  "wg-gesucht": {
    source: "wg-gesucht",
    supportsSourcePublishedAt: false,
    supportsFastLane: true,
    fastLaneIntervalSeconds: 15,
    recommendedIntervalSeconds: 15,
    antiBotRisk: "low",
    priorityLevel: 1,
    fastLaneCities: ["Berlin"],
  },
  "vonovia": {
    source: "vonovia",
    supportsSourcePublishedAt: false,
    supportsFastLane: true,
    fastLaneIntervalSeconds: 30,
    recommendedIntervalSeconds: 30,
    antiBotRisk: "low",
    priorityLevel: 2,
    fastLaneCities: ["Berlin"],
  },
  "wohnungsboerse": {
    source: "wohnungsboerse",
    supportsSourcePublishedAt: false,
    supportsFastLane: true,
    fastLaneIntervalSeconds: 30,
    recommendedIntervalSeconds: 30,
    antiBotRisk: "medium",
    priorityLevel: 2,
    fastLaneCities: ["Berlin"],
  },
  "immowelt": {
    source: "immowelt",
    supportsSourcePublishedAt: false,
    supportsFastLane: false,
    fastLaneIntervalSeconds: 300,
    recommendedIntervalSeconds: 300,
    antiBotRisk: "medium",
    priorityLevel: 3,
    fastLaneCities: [],
  },
  "immoscout24": {
    source: "immoscout24",
    supportsSourcePublishedAt: false,
    supportsFastLane: false,
    fastLaneIntervalSeconds: 300,
    recommendedIntervalSeconds: 300,
    antiBotRisk: "high",
    priorityLevel: 3,
    fastLaneCities: [],
  },
};

export function getSourceCapability(source: string): SourceCapability | null {
  return SOURCE_CAPABILITIES[source] ?? null;
}

/** Returns priority-sorted list of (source, city) pairs that should run on the fast lane. */
export function getFastLanePairs(): Array<{ source: string; city: string; intervalSeconds: number }> {
  const pairs: Array<{ source: string; city: string; intervalSeconds: number }> = [];
  for (const cap of Object.values(SOURCE_CAPABILITIES)) {
    if (!cap.supportsFastLane) continue;
    for (const city of cap.fastLaneCities) {
      pairs.push({ source: cap.source, city, intervalSeconds: cap.fastLaneIntervalSeconds });
    }
  }
  pairs.sort((a, b) => {
    const pa = SOURCE_CAPABILITIES[a.source]?.priorityLevel ?? 99;
    const pb = SOURCE_CAPABILITIES[b.source]?.priorityLevel ?? 99;
    return pa - pb;
  });
  return pairs;
}
