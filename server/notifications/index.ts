import { sendMatchAlert as sendEmailViaResend } from "../email";
import { log } from "../log";
import { pool as pgPool } from "../pg-pool";
import type { ServerLocale } from "../i18n";

interface ListingInfo {
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
}

export interface NotificationSettings {
  phone_e164: string | null;
  email_enabled: boolean;
}

export function areAlertsEnabled(): boolean {
  return process.env.ALERTS_ENABLED === "true";
}

async function fetchUserLanguage(userId: string): Promise<ServerLocale> {
  try {
    const { rows } = await pgPool.query(
      "SELECT language FROM user_profile_data WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    const lang = rows[0]?.language;
    if (lang === "de" || lang === "en" || lang === "nl") return lang;
  } catch (err: any) {
    log(`[NOTIF] Failed to fetch language for ${userId.substring(0, 8)}...: ${err.message}`);
  }
  return "de";
}

export async function sendEmailMatchAlert(
  userEmail: string,
  listing: ListingInfo,
  userId?: string
): Promise<boolean> {
  let lang: ServerLocale = "de";
  if (userId) {
    lang = await fetchUserLanguage(userId);
  }
  log(`[NOTIF] sendEmailMatchAlert to=${userEmail} userId=${userId?.substring(0, 8) || "N/A"} dbLang=${lang} path=match-alert`);
  return sendEmailViaResend(userEmail, listing, lang);
}

export async function sendMatchAlerts(
  userId: string,
  userEmail: string | undefined,
  listing: ListingInfo,
  supabase: any
): Promise<void> {
  if (!areAlertsEnabled()) {
    log(`[ALERTS DISABLED] Skipping notification for user ${userId.substring(0, 8)}... (ALERTS_ENABLED=${process.env.ALERTS_ENABLED})`);
    return;
  }
  log(`[ALERTS] Attempting notification for user ${userId.substring(0, 8)}... listing="${listing.title}"`);

  const { data: settings, error: settingsErr } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsErr) {
    log(`Failed to read notification settings for user ${userId}: ${settingsErr.message} — skipping all notifications`);
    return;
  }

  const emailEnabled = settings?.email_enabled ?? true;

  const promises: Promise<boolean>[] = [];

  if (emailEnabled && userEmail) {
    promises.push(sendEmailMatchAlert(userEmail, listing, userId));
  }

  if (promises.length > 0) {
    const results = await Promise.allSettled(promises);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        log(`[ALERT FAILED] email for user ${userId}: ${r.reason}`);
      } else if (r.value === false) {
        log(`[ALERT FAILED] email for user ${userId}: returned false`);
      }
    });
  }
}
