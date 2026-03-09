import { log } from "../log";
import { sendBatchMatchAlert } from "../email";
import { areAlertsEnabled } from "./index";

export interface BufferedMatch {
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
}

interface UserBuffer {
  email: string;
  seenKeys: Set<string>;
  listings: BufferedMatch[];
}

const buffer = new Map<string, UserBuffer>();
let _flushing = false;

function listingKey(l: BufferedMatch): string {
  return l.url || `${l.title}|${l.city}|${l.price}`;
}

export function bufferMatchAlert(
  userId: string,
  userEmail: string,
  listing: BufferedMatch
): void {
  if (!areAlertsEnabled()) return;

  const key = listingKey(listing);
  const existing = buffer.get(userId);
  if (existing) {
    if (existing.seenKeys.has(key)) return;
    existing.seenKeys.add(key);
    existing.listings.push(listing);
  } else {
    const seenKeys = new Set<string>([key]);
    buffer.set(userId, { email: userEmail, seenKeys, listings: [listing] });
  }
}

export async function flushMatchAlertBuffer(supabase: any): Promise<{ sent: number; failed: number }> {
  if (!areAlertsEnabled()) {
    buffer.clear();
    return { sent: 0, failed: 0 };
  }

  if (_flushing) {
    log(`[ALERTS] Flush already in progress — skipping`);
    return { sent: 0, failed: 0 };
  }

  if (buffer.size === 0) {
    return { sent: 0, failed: 0 };
  }

  _flushing = true;

  const snapshot = new Map(buffer);
  buffer.clear();

  log(`[ALERTS] Flushing match alert buffer: ${snapshot.size} users, ${Array.from(snapshot.values()).reduce((s, u) => s + u.listings.length, 0)} total listings`);

  let sent = 0;
  let failed = 0;

  for (const [userId, { email, listings }] of snapshot.entries()) {
    if (!email) continue;

    const { data: settings, error: settingsErr } = await supabase
      .from("user_notification_settings")
      .select("email_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsErr) {
      log(`[ALERTS] Settings read error for user ${userId.substring(0, 8)}... — skipping (safe default)`);
      continue;
    }

    const emailEnabled = settings?.email_enabled ?? true;
    if (!emailEnabled) {
      log(`[ALERTS] Skipping user ${userId.substring(0, 8)}... (email_enabled=false)`);
      continue;
    }

    try {
      const success = await sendBatchMatchAlert(email, listings);
      if (success) {
        sent++;
        log(`[ALERTS] Sent digest to ${email} with ${listings.length} listings`);
      } else {
        failed++;
        log(`[ALERTS] Failed digest to ${email}`);
      }
    } catch (err: any) {
      failed++;
      log(`[ALERTS] Error sending digest to ${email}: ${err.message}`);
    }
  }

  _flushing = false;
  log(`[ALERTS] Flush complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

export async function flushUserAlerts(userId: string, supabase: any): Promise<void> {
  if (!areAlertsEnabled()) {
    buffer.delete(userId);
    return;
  }

  const userBuf = buffer.get(userId);
  if (!userBuf || userBuf.listings.length === 0) return;

  buffer.delete(userId);

  if (!userBuf.email) return;

  const { data: settings, error: settingsErr } = await supabase
    .from("user_notification_settings")
    .select("email_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsErr || !(settings?.email_enabled ?? true)) return;

  try {
    await sendBatchMatchAlert(userBuf.email, userBuf.listings);
    log(`[ALERTS] Sent backfill digest to ${userBuf.email} with ${userBuf.listings.length} listings`);
  } catch (err: any) {
    log(`[ALERTS] Error sending backfill digest: ${err.message}`);
  }
}

export function getBufferSize(): { users: number; listings: number } {
  let listings = 0;
  for (const u of buffer.values()) listings += u.listings.length;
  return { users: buffer.size, listings };
}

export function clearBuffer(): void {
  buffer.clear();
}
