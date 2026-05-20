import { log } from "../log";

export interface SlaEvent {
  listingId: string;
  source: string;
  city: string;
  sourcePublishedAt: string | null;
  firstSeenAt: string;
  insertedAt: string | null;
  matchedAt: string | null;
  pushSentAt: string | null;
  emailSentAt: string | null;
  isFastLane: boolean;
  recordedAt: string;
}

const MAX_EVENTS = 2000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const _events: SlaEvent[] = [];
const _indexById = new Map<string, number>();

let _lastFlushAt: string | null = null;
let _flushStuckSince: string | null = null;
const FLUSH_STUCK_THRESHOLD_MS = 2 * 60 * 1000;

export function recordFlushStart(): void {
  _flushStuckSince = new Date().toISOString();
}

export function recordFlushEnd(): void {
  _lastFlushAt = new Date().toISOString();
  _flushStuckSince = null;
}

export function getFlushStaleness(): { lastFlushAt: string | null; stuckSinceMs: number | null } {
  const stuckSinceMs = _flushStuckSince
    ? Date.now() - new Date(_flushStuckSince).getTime()
    : null;
  return { lastFlushAt: _lastFlushAt, stuckSinceMs };
}

export function recordSlaEvent(event: {
  listingId: string;
  source: string;
  city: string;
  sourcePublishedAt: string | null;
  firstSeenAt: string;
  isFastLane: boolean;
}): void {
  const full: SlaEvent = {
    ...event,
    insertedAt: null,
    matchedAt: null,
    pushSentAt: null,
    emailSentAt: null,
    recordedAt: new Date().toISOString(),
  };
  const idx = _events.push(full) - 1;
  _indexById.set(event.listingId, idx);
  _prune();
}

function _findEvent(listingId: string): SlaEvent | null {
  const idx = _indexById.get(listingId);
  if (idx !== undefined && idx < _events.length && _events[idx]?.listingId === listingId) {
    return _events[idx];
  }
  for (let i = _events.length - 1; i >= 0; i--) {
    if (_events[i].listingId === listingId) return _events[i];
  }
  return null;
}

function _prune(): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  while (_events.length > MAX_EVENTS) {
    const removed = _events.shift();
    if (removed) _indexById.delete(removed.listingId);
  }
  while (_events.length > 0 && new Date(_events[0].recordedAt).getTime() < cutoff) {
    const removed = _events.shift();
    if (removed) _indexById.delete(removed.listingId);
  }
}

export function updateInsertedAt(listingId: string, insertedAt: string): void {
  const e = _findEvent(listingId);
  if (e && !e.insertedAt) e.insertedAt = insertedAt;
}

export function updateMatchedAt(listingId: string, matchedAt: string): void {
  const e = _findEvent(listingId);
  if (e && !e.matchedAt) e.matchedAt = matchedAt;
}

export function updatePushSent(listingId: string, sentAt: string): void {
  const e = _findEvent(listingId);
  if (e && !e.pushSentAt) e.pushSentAt = sentAt;
}

export function updateEmailSent(listingId: string, sentAt: string): void {
  const e = _findEvent(listingId);
  if (e && !e.emailSentAt) e.emailSentAt = sentAt;
}

export function updateNotificationSent(listingId: string, sentAt: string): void {
  updatePushSent(listingId, sentAt);
  updateEmailSent(listingId, sentAt);
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

function pctUnder(arr: number[], threshold: number): number | null {
  if (arr.length === 0) return null;
  return Math.round((arr.filter(v => v <= threshold).length / arr.length) * 100);
}

export interface SlaStageMetrics {
  p50: number | null;
  p90: number | null;
  p95: number | null;
  worst: number | null;
  pctUnder60: number | null;
  count: number;
}

export interface SlaMetrics {
  source: string;
  city: string;
  eventCount: number;
  withPublishedAt: number;
  fastLaneCount: number;
  lastEventAt: string | null;
  detection: SlaStageMetrics;
  insertion: SlaStageMetrics;
  matching: SlaStageMetrics;
  endToEnd: SlaStageMetrics;
  matchToNotif: SlaStageMetrics;
  pushLatency: SlaStageMetrics;
  emailLatency: SlaStageMetrics;
}

function buildStageMetrics(delays: number[]): SlaStageMetrics {
  return {
    p50: percentile(delays, 50),
    p90: percentile(delays, 90),
    p95: percentile(delays, 95),
    worst: delays.length > 0 ? Math.max(...delays) : null,
    pctUnder60: pctUnder(delays, 60),
    count: delays.length,
  };
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
  for (const [key, events] of Array.from(groups.entries())) {
    const [source, city] = key.split(":::");
    const withPub = events.filter((e: SlaEvent) => e.sourcePublishedAt);

    const detectionDelays: number[] = [];
    const insertionDelays: number[] = [];
    const matchingDelays: number[] = [];
    const endToEndDelays: number[] = [];
    const matchToNotifDelays: number[] = [];
    const pushDelays: number[] = [];
    const emailDelays: number[] = [];

    for (const e of (withPub as SlaEvent[])) {
      const pub = new Date(e.sourcePublishedAt!).getTime();
      const seen = new Date(e.firstSeenAt).getTime();
      if (seen > pub) detectionDelays.push((seen - pub) / 1000);
      if (e.insertedAt) {
        const ins = new Date(e.insertedAt).getTime();
        if (ins > pub) insertionDelays.push((ins - pub) / 1000);
      }
      if (e.matchedAt) {
        const mat = new Date(e.matchedAt).getTime();
        if (mat > pub) matchingDelays.push((mat - pub) / 1000);
      }
      const notifAt = e.pushSentAt ?? e.emailSentAt;
      if (notifAt) {
        const n = new Date(notifAt).getTime();
        if (n > pub) endToEndDelays.push((n - pub) / 1000);
      }
      if (e.pushSentAt) {
        const p = new Date(e.pushSentAt).getTime();
        if (p > pub) pushDelays.push((p - pub) / 1000);
      }
      if (e.emailSentAt) {
        const em = new Date(e.emailSentAt).getTime();
        if (em > pub) emailDelays.push((em - pub) / 1000);
      }
    }

    for (const e of (events as SlaEvent[])) {
      if (e.matchedAt && (e.pushSentAt ?? e.emailSentAt)) {
        const mat = new Date(e.matchedAt).getTime();
        const notif = new Date((e.pushSentAt ?? e.emailSentAt)!).getTime();
        if (notif > mat) matchToNotifDelays.push((notif - mat) / 1000);
      }
    }

    result.push({
      source,
      city,
      eventCount: events.length,
      withPublishedAt: withPub.length,
      fastLaneCount: events.filter(e => e.isFastLane).length,
      lastEventAt: events[events.length - 1]?.recordedAt ?? null,
      detection: buildStageMetrics(detectionDelays),
      insertion: buildStageMetrics(insertionDelays),
      matching: buildStageMetrics(matchingDelays),
      endToEnd: buildStageMetrics(endToEndDelays),
      matchToNotif: buildStageMetrics(matchToNotifDelays),
      pushLatency: buildStageMetrics(pushDelays),
      emailLatency: buildStageMetrics(emailDelays),
    });
  }

  return result.sort((a, b) => (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? ""));
}

export function getRecentEvents(limit = 100): SlaEvent[] {
  return [..._events].slice(-limit).reverse();
}

export function getTotalEventCount(): number {
  return _events.length;
}

export interface SlaAlert {
  type: "sla_p95_exceeded" | "match_to_notif_p95_exceeded" | "fast_lane_stale" | "flush_stuck";
  source?: string;
  city?: string;
  valueS?: number;
  thresholdS: number;
  message: string;
}

export function evaluateSlaAlertConditions(): SlaAlert[] {
  const alerts: SlaAlert[] = [];
  const metrics = computeSlaMetrics(1);

  for (const m of metrics) {
    if (m.endToEnd.p95 !== null && m.endToEnd.p95 > 60) {
      alerts.push({
        type: "sla_p95_exceeded",
        source: m.source,
        city: m.city,
        valueS: m.endToEnd.p95,
        thresholdS: 60,
        message: `${m.source}/${m.city}: source→notification p95=${m.endToEnd.p95}s (threshold: 60s)`,
      });
    }
    if (m.matchToNotif.p95 !== null && m.matchToNotif.p95 > 30) {
      alerts.push({
        type: "match_to_notif_p95_exceeded",
        source: m.source,
        city: m.city,
        valueS: m.matchToNotif.p95,
        thresholdS: 30,
        message: `${m.source}/${m.city}: match→notification p95=${m.matchToNotif.p95}s (threshold: 30s)`,
      });
    }
  }

  const { stuckSinceMs } = getFlushStaleness();
  if (stuckSinceMs !== null && stuckSinceMs > FLUSH_STUCK_THRESHOLD_MS) {
    alerts.push({
      type: "flush_stuck",
      thresholdS: FLUSH_STUCK_THRESHOLD_MS / 1000,
      message: `Notification flush has been running for ${Math.round(stuckSinceMs / 1000)}s — possible hang`,
    });
  }

  return alerts;
}
