import { pool } from "../pg-pool";
import { log } from "../log";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoMatchListing {
  listing_id: string;
  title: string;
  city: string;
  price: number;
  url?: string | null;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 1) + "…";
}

export async function sendExpoMatchPush(
  userId: string,
  listings: ExpoMatchListing[]
): Promise<{ sent: number; skipped: number; failed: number }> {
  const uid = userId.substring(0, 8);

  if (listings.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const { rows: tokens } = await pool.query(
    `SELECT id, expo_push_token FROM expo_push_tokens
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  if (!tokens || tokens.length === 0) {
    log(`[EXPO-PUSH] User ${uid}...: no active Expo tokens — skipping`);
    return { sent: 0, skipped: listings.length, failed: 0 };
  }

  const newListings = listings;

  let title: string;
  let body: string;
  let deepLink = "/dashboard?tab=matches";

  if (newListings.length === 1) {
    const l = newListings[0];
    const city = l.city || "je stad";
    title = `Nieuwe match in ${city}`;
    const label = truncate(l.title || "Nieuwe woning", 60);
    body = l.price > 0 ? `${label} · €${l.price}` : label;
    if (l.listing_id) {
      deepLink = `/listing/${l.listing_id}`;
    }
  } else {
    const cities = [...new Set(newListings.map((l) => l.city).filter(Boolean))];
    const cityText = cities.length > 0 ? cities.slice(0, 2).join(", ") : "je stad";
    title = `${newListings.length} nieuwe matches in ${cityText}`;
    body = `Er zijn ${newListings.length} nieuwe woningen gevonden die bij je zoekopdracht passen.`;
  }

  const pushTokenStrings = tokens.map((t: any) => t.expo_push_token);

  const messages = pushTokenStrings.map((token: string) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: { url: deepLink },
    priority: "high" as const,
    channelId: "match-alerts",
  }));

  let sent = 0;
  let failed = 0;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errText = await response.text();
      log(`[EXPO-PUSH] User ${uid}...: Expo API error ${response.status}: ${errText}`);
      return { sent: 0, skipped: 0, failed: tokens.length };
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data || [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const tokenStr = pushTokenStrings[i];
      const tokenId = tokens[i]?.id;

      if (ticket.status === "ok") {
        sent++;
        log(`[EXPO-PUSH] User ${uid}...: sent to token=${tokenStr.substring(0, 30)}... ticket=${ticket.id}`);
      } else {
        failed++;
        const errType = ticket.details?.error || "unknown";
        log(`[EXPO-PUSH] User ${uid}...: failed token=${tokenStr.substring(0, 30)}... error=${errType} msg=${ticket.message}`);

        if (errType === "DeviceNotRegistered" && tokenId) {
          await pool.query(
            `UPDATE expo_push_tokens SET is_active = FALSE, updated_at = $1 WHERE id = $2`,
            [new Date().toISOString(), tokenId]
          );
          log(`[EXPO-PUSH] Deactivated stale token id=${tokenId}`);
        }
      }
    }
  } catch (err: any) {
    log(`[EXPO-PUSH] User ${uid}...: network error: ${err.message}`);
    return { sent: 0, skipped: 0, failed: tokens.length };
  }

  log(`[EXPO-PUSH] User ${uid}...: ${sent} sent, ${failed} failed (${newListings.length} listings, ${tokens.length} tokens)`);
  return { sent, skipped: 0, failed };
}

export async function sendExpoTestPush(
  userId: string
): Promise<{ sent: number; failed: number; tokens: number }> {
  const uid = userId.substring(0, 8);

  const { rows: tokens } = await pool.query(
    `SELECT expo_push_token FROM expo_push_tokens
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  if (!tokens || tokens.length === 0) {
    log(`[EXPO-PUSH-TEST] User ${uid}...: no active Expo tokens`);
    return { sent: 0, failed: 0, tokens: 0 };
  }

  const messages = tokens.map((t: any) => ({
    to: t.expo_push_token,
    sound: "default",
    title: "HousAlert Test",
    body: "Push notificaties werken! 🏠",
    data: { url: "/dashboard" },
    priority: "high" as const,
    channelId: "match-alerts",
  }));

  let sent = 0;
  let failed = 0;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      log(`[EXPO-PUSH-TEST] Expo API error: ${response.status}`);
      return { sent: 0, failed: tokens.length, tokens: tokens.length };
    }

    const result = await response.json();
    const tickets: ExpoPushTicket[] = result.data || [];

    for (const ticket of tickets) {
      if (ticket.status === "ok") sent++;
      else failed++;
    }
  } catch (err: any) {
    log(`[EXPO-PUSH-TEST] Error: ${err.message}`);
    return { sent: 0, failed: tokens.length, tokens: tokens.length };
  }

  log(`[EXPO-PUSH-TEST] User ${uid}...: ${sent} sent, ${failed} failed (${tokens.length} tokens)`);
  return { sent, failed, tokens: tokens.length };
}
