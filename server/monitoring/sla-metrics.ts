import { log } from "../log";

export interface SlaEvent {
  listingId: string;
  source: string;
  city: string;
  sourcePublishedAt: string | null;
  firstSeenAt: string;
  matchedAt: string | null;
  notificationSentAt: string | null;
  isFastLane: boolean;
  recordedAt: string;
}

const MAX_EVENTS = 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const _events: SlaEvent[] = [];

export function recordSlaEvent(event: Omit<SlaEvent, "recordedAt">): void {
  _events.push({ ...event, recordedAt: new Date().toISOString() });
  // Prune old events
  const cutoff = Date.now() - MAX_AGE_MS;
  while (_events.length > MAX_EVENTS) _events.shift();
  while (_events.length > 0 && new Date(_events[0].recordedAt).getTime() < cutoff) {
    _events.shift();
  }
}

export function updateNotificationSent(listingId: string, sentAt: string): void {
  for (let i = _events.length - 1; i >= 0; i--) {
    if (_events[i].listingId === listingId && !_events[i].notificationSentAt) {
      _events[i].notificationSentAt = sentAt;
      break;
    }
  }
}

export interface SlaMetrics {
  source: string;
  city: string;
  count: number;
  withPublishedAt: number;
  p50DetectionS: number | null;
  p90DetectionS: number | null;
  p95DetectionS: number | null;
  p50TotalS: number | null;
  p90TotalS: number | null;
  p95TotalS: number | null;
  slaPassRate: number | null;
  fastLaneCount: number;
  lastEventAt: string | null;
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

export function computeSlaMetrics(windowHours = 24): SlaMetrics[] {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const recent = _events.filter(e => new Date(e.recordedAt).getTime() >= cutoff);

  const groups = new Map<string, SlaEvent[]>();
  for (const e of recent) {
    const key = `${e.source}:::${e.city}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const result: SlaMetrics[] = [];
  for (const [key, events] of groups) {
    const [source, city] = key.split(":::");
    const withPub = events.filter(e => e.sourcePublishedAt);
    const detectionDelays: number[] = [];
    const totalDelays: number[] = [];

    for (const e of withPub) {
      const pub = new Date(e.sourcePublishedAt!).getTime();
      const seen = new Date(e.firstSeenAt).getTime();
      if (seen > pub) detectionDelays.push((seen - pub) / 1000);
      if (e.notificationSentAt) {
        const notif = new Date(e.notificationSentAt).getTime();
        if (notif > pub) totalDelays.push((notif - pub) / 1000);
      }
    }

    const slaPassCount = totalDelays.filter(d => d <= 60).length;
    result.push({
      source,
      city,
      count: events.length,
      withPublishedAt: withPub.length,
      p50DetectionS: percentile(detectionDelays, 50),
      p90DetectionS: percentile(detectionDelays, 90),
      p95DetectionS: percentile(detectionDelays, 95),
      p50TotalS: percentile(totalDelays, 50),
      p90TotalS: percentile(totalDelays, 90),
      p95TotalS: percentile(totalDelays, 95),
      slaPassRate: totalDelays.length > 0 ? Math.round((slaPassCount / totalDelays.length) * 100) : null,
      fastLaneCount: events.filter(e => e.isFastLane).length,
      lastEventAt: events[events.length - 1]?.recordedAt ?? null,
    });
  }

  return result.sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
}

export function getRecentEvents(limit = 50): SlaEvent[] {
  return [..._events].slice(-limit).reverse();
}

export function getTotalEventCount(): number {
  return _events.length;
}
