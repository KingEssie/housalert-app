import { sendMatchAlert as sendEmailViaResend } from "../email";
import { log } from "../log";
import type { ServerLocale } from "../i18n";
import { getUserLanguage, areAlertsEnabled } from "./buffer";

export { areAlertsEnabled };

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

export async function sendEmailMatchAlert(
  userEmail: string,
  listing: ListingInfo,
  userId?: string
): Promise<boolean> {
  let lang: ServerLocale = "en";
  if (userId) {
    lang = await getUserLanguage(userId);
  }
  log(`[NOTIF] sendEmailMatchAlert to=${userEmail} userId=${userId?.substring(0, 8) || "N/A"} lang=${lang} path=match-alert`);
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
