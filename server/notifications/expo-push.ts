import { getSupabaseAdmin } from "../supabase-admin";
import { log } from "../log";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

export interface ExpoMatchListing {
  listing_id: string;
  title: string;
  city: string;
  price: number;
  url?: string | null;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

export interface PushProvider {
  sendPush(messages: any[]): Promise<{ data: ExpoPushTicket[] }>;
  getReceipts(ticketIds: string[]): Promise<{ data: Record<string, ExpoPushReceipt> }>;
}

const realProvider: PushProvider = {
  async sendPush(messages) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      throw Object.assign(new Error(`Expo API ${response.status}`), { retryable: true, status: response.status });
    }
    if (!response.ok) {
      const errText = await response.text();
      throw Object.assign(new Error(`Expo API ${response.status}: ${errText}`), { retryable: false });
    }
    return response.json();
  },
  async getReceipts(ticketIds) {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: ticketIds }),
    });
    if (!response.ok) throw new Error(`Expo receipts API ${response.status}`);
    return response.json();
  },
};

let _provider: PushProvider = realProvider;

export function setPushProvider(provider: PushProvider) {
  _provider = provider;
}

export function resetPushProvider() {
  _provider = realProvider;
}

export function getActivePushProvider(): PushProvider {
  return _provider;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.substring(0, max - 1) + "…";
}

function tokenSnippet(token: string): string {
  return token.length > 30 ? token.substring(0, 30) + "..." : token;
}

export function buildMatchPayload(listings: ExpoMatchListing[]): {
  title: string;
  body: string;
  deepLink: string;
  listingIds: string[];
} {
  let title: string;
  let body: string;
  let deepLink = "/dashboard?tab=matches";

  if (listings.length === 1) {
    const l = listings[0];
    const city = l.city || "je stad";
    title = `Nieuwe match in ${city}`;
    const label = truncate(l.title || "Nieuwe woning", 60);
    body = l.price > 0 ? `${label} · €${l.price}` : label;
    if (l.listing_id) deepLink = `/listing/${l.listing_id}`;
  } else {
    const cities = [...new Set(listings.map((l) => l.city).filter(Boolean))];
    const cityText = cities.length > 0 ? cities.slice(0, 2).join(", ") : "je stad";
    title = `${listings.length} nieuwe matches in ${cityText}`;
    body = `Er zijn ${listings.length} nieuwe woningen gevonden die bij je zoekopdracht passen.`;
  }

  return { title, body, deepLink, listingIds: listings.map((l) => l.listing_id) };
}

async function logDelivery(params: {
  userId: string;
  channel: string;
  tokenSnippet?: string;
  fullToken?: string;
  listingIds: string[];
  title: string;
  body: string;
  status: string;
  expoTicketId?: string;
  errorType?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("push_delivery_log").insert({
      user_id: params.userId,
      channel: params.channel,
      token_snippet: params.tokenSnippet || null,
      full_token: params.fullToken || null,
      listing_ids: params.listingIds,
      listing_count: params.listingIds.length,
      title: params.title,
      body: params.body,
      status: params.status,
      expo_ticket_id: params.expoTicketId || null,
      error_type: params.errorType || null,
      error_message: params.errorMessage || null,
    });
  } catch (err: any) {
    log(`[EXPO-PUSH] Failed to write delivery log: ${err.message}`);
  }
}

export async function sendWithRetry(
  messages: any[],
  attempt = 1
): Promise<{ tickets: ExpoPushTicket[]; error?: string }> {
  try {
    const result = await _provider.sendPush(messages);
    return { tickets: result.data || [] };
  } catch (err: any) {
    if (err.retryable !== false && attempt <= MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_DELAY_MS * attempt;
      log(`[EXPO-PUSH] Temporary error — retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(messages, attempt + 1);
    }
    return { tickets: [], error: `${err.message} after ${attempt} attempts` };
  }
}

export async function sendExpoMatchPush(
  userId: string,
  listings: ExpoMatchListing[]
): Promise<{ sent: number; skipped: number; failed: number }> {
  const uid = userId.substring(0, 8);

  if (listings.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const sb = getSupabaseAdmin();
  const { data: tokens, error: tokenErr } = await sb
    .from("expo_push_tokens")
    .select("id, expo_push_token")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (tokenErr || !tokens || tokens.length === 0) {
    log(`[EXPO-PUSH] User ${uid}...: no active Expo tokens — skipping`);
    return { sent: 0, skipped: listings.length, failed: 0 };
  }

  const { title, body, deepLink, listingIds } = buildMatchPayload(listings);
  const pushTokenStrings = tokens.map((t: any) => t.expo_push_token);

  const messages = pushTokenStrings.map((token: string) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: {
      url: deepLink,
      listingIds: listingIds.slice(0, 10),
      type: "match_alert",
    },
    priority: "high" as const,
    channelId: "match-alerts",
  }));

  const { tickets, error } = await sendWithRetry(messages);

  if (error) {
    log(`[EXPO-PUSH] User ${uid}...: ${error}`);
    await logDelivery({
      userId,
      channel: "expo",
      listingIds,
      title,
      body,
      status: "api_error",
      errorMessage: error,
    });
    return { sent: 0, skipped: 0, failed: tokens.length };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const tokenStr = pushTokenStrings[i];
    const tokenId = tokens[i]?.id;

    if (ticket.status === "ok") {
      sent++;
      log(`[EXPO-PUSH] User ${uid}...: sent to ${tokenSnippet(tokenStr)} ticket=${ticket.id}`);
      await logDelivery({
        userId,
        channel: "expo",
        tokenSnippet: tokenSnippet(tokenStr),
        fullToken: tokenStr,
        listingIds,
        title,
        body,
        status: "sent",
        expoTicketId: ticket.id,
      });
    } else {
      failed++;
      const errType = ticket.details?.error || "unknown";
      log(`[EXPO-PUSH] User ${uid}...: failed ${tokenSnippet(tokenStr)} error=${errType} msg=${ticket.message}`);

      await logDelivery({
        userId,
        channel: "expo",
        tokenSnippet: tokenSnippet(tokenStr),
        fullToken: tokenStr,
        listingIds,
        title,
        body,
        status: "failed",
        errorType: errType,
        errorMessage: ticket.message,
      });

      if (errType === "DeviceNotRegistered" && tokenId) {
        await sb
          .from("expo_push_tokens")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", tokenId);
        log(`[EXPO-PUSH] Deactivated stale token id=${tokenId}`);
      }
    }
  }

  log(`[EXPO-PUSH] User ${uid}...: ${sent} sent, ${failed} failed (${listings.length} listings, ${tokens.length} tokens)`);
  return { sent, skipped: 0, failed };
}

export async function sendExpoTestPush(
  userId: string
): Promise<{ sent: number; failed: number; tokens: number }> {
  const uid = userId.substring(0, 8);
  const sb = getSupabaseAdmin();

  const { data: tokens, error: tokenErr } = await sb
    .from("expo_push_tokens")
    .select("expo_push_token")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (tokenErr || !tokens || tokens.length === 0) {
    log(`[EXPO-PUSH-TEST] User ${uid}...: no active Expo tokens`);
    return { sent: 0, failed: 0, tokens: 0 };
  }

  const title = "HousAlert Test";
  const body = "Push notificaties werken!";

  const messages = tokens.map((t: any) => ({
    to: t.expo_push_token,
    sound: "default",
    title,
    body,
    data: { url: "/dashboard", type: "test" },
    priority: "high" as const,
    channelId: "match-alerts",
  }));

  const { tickets, error } = await sendWithRetry(messages);

  if (error) {
    log(`[EXPO-PUSH-TEST] ${error}`);
    await logDelivery({
      userId,
      channel: "expo",
      listingIds: [],
      title,
      body,
      status: "api_error",
      errorMessage: error,
    });
    return { sent: 0, failed: tokens.length, tokens: tokens.length };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const fullTok = tokens[i].expo_push_token;
    if (ticket.status === "ok") {
      sent++;
      await logDelivery({
        userId,
        channel: "expo",
        tokenSnippet: tokenSnippet(fullTok),
        fullToken: fullTok,
        listingIds: [],
        title,
        body,
        status: "sent",
        expoTicketId: ticket.id,
      });
    } else {
      failed++;
      await logDelivery({
        userId,
        channel: "expo",
        tokenSnippet: tokenSnippet(fullTok),
        fullToken: fullTok,
        listingIds: [],
        title,
        body,
        status: "failed",
        errorType: ticket.details?.error,
        errorMessage: ticket.message,
      });
    }
  }

  log(`[EXPO-PUSH-TEST] User ${uid}...: ${sent} sent, ${failed} failed (${tokens.length} tokens)`);
  return { sent, failed, tokens: tokens.length };
}

export async function checkExpoReceipts(): Promise<{ checked: number; ok: number; errors: number }> {
  const sb = getSupabaseAdmin();

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: qErr } = await sb
    .from("push_delivery_log")
    .select("id, expo_ticket_id, user_id, full_token")
    .not("expo_ticket_id", "is", null)
    .is("expo_receipt_status", null)
    .eq("status", "sent")
    .gt("created_at", oneDayAgo)
    .lt("created_at", fifteenMinAgo)
    .limit(100);

  if (qErr || !rows || rows.length === 0) return { checked: 0, ok: 0, errors: 0 };

  const ticketIds = rows.map((r: any) => r.expo_ticket_id).filter(Boolean);
  if (ticketIds.length === 0) return { checked: 0, ok: 0, errors: 0 };

  log(`[EXPO-RECEIPTS] Checking ${ticketIds.length} receipts`);

  try {
    const result = await _provider.getReceipts(ticketIds);
    const receipts: Record<string, ExpoPushReceipt> = result.data || {};

    let ok = 0;
    let errors = 0;

    for (const row of rows) {
      const receipt = receipts[row.expo_ticket_id];
      if (!receipt) continue;

      if (receipt.status === "ok") {
        ok++;
        await sb
          .from("push_delivery_log")
          .update({ expo_receipt_status: "ok" })
          .eq("id", row.id);
      } else {
        errors++;
        const errType = receipt.details?.error || "unknown";
        await sb
          .from("push_delivery_log")
          .update({
            expo_receipt_status: "error",
            error_type: errType,
            error_message: receipt.message || null,
          })
          .eq("id", row.id);

        if (errType === "DeviceNotRegistered") {
          if (row.full_token) {
            const { data: deactivated } = await sb
              .from("expo_push_tokens")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("user_id", row.user_id)
              .eq("expo_push_token", row.full_token)
              .eq("is_active", true)
              .select("id");
            const count = deactivated?.length || 0;
            log(`[EXPO-RECEIPTS] DeviceNotRegistered for user ${row.user_id.substring(0, 8)}... — deactivated ${count} token(s) (targeted)`);
          } else {
            const { data: deactivated } = await sb
              .from("expo_push_tokens")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("user_id", row.user_id)
              .eq("is_active", true)
              .select("id");
            const count = deactivated?.length || 0;
            log(`[EXPO-RECEIPTS] DeviceNotRegistered for user ${row.user_id.substring(0, 8)}... — deactivated ${count} token(s) (all)`);
          }
        }

        log(`[EXPO-RECEIPTS] Receipt error for ticket ${row.expo_ticket_id}: ${errType}`);
      }
    }

    log(`[EXPO-RECEIPTS] Checked ${Object.keys(receipts).length}: ${ok} ok, ${errors} errors`);
    return { checked: Object.keys(receipts).length, ok, errors };
  } catch (err: any) {
    log(`[EXPO-RECEIPTS] Network error: ${err.message}`);
    return { checked: 0, ok: 0, errors: 0 };
  }
}
