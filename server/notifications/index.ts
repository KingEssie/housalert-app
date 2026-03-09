import { sendMatchAlert as sendEmailViaResend } from "../email";
import { log } from "../log";

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

export async function sendEmailMatchAlert(
  userEmail: string,
  listing: ListingInfo
): Promise<boolean> {
  return sendEmailViaResend(userEmail, listing);
}

export async function sendMatchAlerts(
  userId: string,
  userEmail: string | undefined,
  listing: ListingInfo,
  supabase: any
): Promise<void> {
  if (!areAlertsEnabled()) {
    log("[ALERTS DISABLED] Skipping notification send");
    return;
  }

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
    promises.push(sendEmailMatchAlert(userEmail, listing));
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
