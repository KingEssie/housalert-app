import type { Express } from "express";
import { createServer, type Server } from "http";
import { sendEmailMatchAlert } from "./notifications";
import {
  runAllIngesters,
  getEnabledSources,
  getSourceStatuses,
  getLastRunStatus,
  getLastActivityAt,
  isRunning,
  OverlapError,
} from "./ingesters";
import { getNextRun } from "./scheduler";
import { getListingFreshness, getMatchTimestamps, getNewestListingIds, batchedIn } from "./freshness";
import { supabase } from "./ingesters/matching";
import { backfillMatchesForSearchProfile, explainMatch, explainAllProfilesForListing } from "./matching/engine";
import { flushUserAlerts, getRecentEmailedIds } from "./notifications/buffer";
import {
  ensureTrialSubscription,
  getSubscriptionStatus,
  updateSubscriptionFromCheckout,
  updateSubscriptionStatus,
  findUserByStripeCustomerId,
} from "./subscriptions";
import { log } from "./log";
import { detectLanguage } from "./i18n";
import { computeMatchScore, getMatchReasons, computeHybridFilters } from "../shared/match-score";
import { normalizeCity } from "../shared/city-normalize";
import { pool as pgPool } from "./pg-pool";
import { isAdminEmail, getRecentRuns, getRunDetail, getLatestRunCities, getSourceAggregates } from "./admin";
import { trackEvent as trackActivationEvent, getUserActivationStatus, getActivationFunnel, hasEvent as hasActivationEvent } from "./activation-events";
import { saveCancellationFeedback, getCancellationStats } from "./cancellation-feedback";
import { getReferralSummary, applyReferralCode, validateReferralCode, ensureUserHasReferralCode } from "./referrals";
import { initWebPush, sendPushToUser } from "./notifications/push";
import { sendExpoTestPush } from "./notifications/expo-push";
import { getSupabaseAdmin } from "./supabase-admin";
import { markViewed, markApplied, markSaved, getUserMatchStats, getRecentUserMatches, getMatchCountForUser, getCanonicalMatchStates, getRecentFetchRuns, backfillFromSupabaseMatches, upsertUserMatch } from "./user-matches";

const TEN_MIN = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function detectLanguageFromHeader(acceptLang: string | string[] | undefined): import("./i18n").ServerLocale {
  const raw = Array.isArray(acceptLang) ? acceptLang.join(",") : acceptLang;
  return detectLanguage({ headers: { "accept-language": raw } });
}

function computeFreshLabel(firstSeenAt: string): string {
  const ageMs = Date.now() - new Date(firstSeenAt).getTime();
  if (ageMs < TEN_MIN) return "net_binnen";
  if (ageMs < ONE_HOUR) return "nieuw";
  if (ageMs < ONE_DAY) return "vandaag";
  return "ouder";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/housalert-logo.png", async (_req, res) => {
    try {
      const { LOGO_PNG_BASE64 } = await import("./logo-data");
      const buf = Buffer.from(LOGO_PNG_BASE64, "base64");
      res.set({
        "Content-Type": "image/png",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(buf);
    } catch (err: any) {
      log(`[LOGO] Error serving logo: ${err.message}`);
      res.status(404).end();
    }
  });


  const missingStripeVars: string[] = [];
  if (!process.env.STRIPE_PRICE_MONTHLY && !process.env.STRIPE_PRICE_1_MONTH) missingStripeVars.push("STRIPE_PRICE_MONTHLY");
  if (!process.env.STRIPE_PRICE_TWO_MONTH && !process.env.STRIPE_PRICE_2_MONTHS) missingStripeVars.push("STRIPE_PRICE_TWO_MONTH");
  if (!process.env.STRIPE_PRICE_THREE_MONTH && !process.env.STRIPE_PRICE_3_MONTHS) missingStripeVars.push("STRIPE_PRICE_THREE_MONTH");
  if (!process.env.STRIPE_WEBHOOK_SECRET) missingStripeVars.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.APP_PUBLIC_BASE_URL) missingStripeVars.push("APP_PUBLIC_BASE_URL");

  if (missingStripeVars.length > 0) {
    log(`[stripe-config] Missing env vars: ${missingStripeVars.join(", ")}. Payment features may be limited.`);
  }

  let stripeAvailable = true;
  try {
    const { getUncachableStripeClient } = await import("./stripe/stripeClient");
    const stripe = await getUncachableStripeClient();
    log("[stripe-config] Stripe initialized successfully.");

    try {
      const account = await stripe.accounts.retrieve();
      console.log("=== STRIPE DEBUG ===");
      console.log("Stripe account ID:", account.id);
      console.log("Stripe email:", account.email);
      console.log("Stripe country:", account.country);
      console.log("Stripe livemode:", account.charges_enabled ? "charges enabled" : "charges disabled");
      console.log("====================");
    } catch (acctErr: any) {
      console.log("=== STRIPE DEBUG ===");
      console.log("Could not retrieve account info:", acctErr.message);
      console.log("====================");
    }
  } catch (err: any) {
    stripeAvailable = false;
    log(`[stripe-config] Stripe not available: ${err.message}`);
  }

  initWebPush();

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint, p256dh, auth } = req.body;
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing subscription fields" });
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: user.id, endpoint, p256dh, auth, created_at: new Date().toISOString() },
          { onConflict: "endpoint" }
        );

      if (error) return res.status(500).json({ error: error.message });
      log(`[PUSH] Subscription stored for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/push/subscribe", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      log(`[PUSH] Subscription removed for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    const key = process.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: "Push not configured" });
    return res.json({ publicKey: key });
  });

  app.post("/api/push/test-self", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sb = getSupabaseAdmin();
      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("expo_push_token, platform")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const activeTokens = tokens || [];
      if (activeTokens.length === 0) {
        return res.json({ success: false, tokens_found: 0, tokens_targeted: 0, error: "No active Expo push tokens registered for your account" });
      }

      const { sendWithRetry } = await import("./notifications/expo-push");
      const now = new Date().toLocaleTimeString("nl-NL");
      const messages = activeTokens.map((t: any) => ({
        to: t.expo_push_token,
        sound: "default",
        title: "HousAlert Test",
        body: `Push test geslaagd @ ${now}`,
        data: { url: "/dashboard", type: "self_test" },
        priority: "high" as const,
        channelId: "match-alerts",
      }));

      const { tickets, error } = await sendWithRetry(messages);
      const ticketIds = (tickets || []).filter((t: any) => t?.id).map((t: any) => t.id);

      log(`[PUSH TEST-SELF] User ${user.id.substring(0, 8)}... sent self-test push to ${activeTokens.length} token(s)`);

      return res.json({
        success: !error && tickets.every((t: any) => t?.status === "ok"),
        tokens_found: activeTokens.length,
        tokens_targeted: messages.length,
        push_ticket_ids: ticketIds.length > 0 ? ticketIds : null,
        error: error || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/push/debug-self", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sb = getSupabaseAdmin();
      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("expo_push_token, platform, is_active, updated_at")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const activeTokens = tokens || [];
      const masked = activeTokens.map((t: any) => ({
        token: t.expo_push_token.substring(0, 25) + "...]",
        platform: t.platform,
        updated_at: t.updated_at,
      }));

      const { data: logs } = await sb
        .from("push_delivery_log")
        .select("id, channel, token_snippet, title, body, status, expo_ticket_id, expo_receipt_status, error_message, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: settings } = await sb
        .from("notification_settings")
        .select("push_enabled, email_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      return res.json({
        active_token_count: activeTokens.length,
        masked_tokens: masked,
        push_enabled: settings?.push_enabled ?? null,
        email_enabled: settings?.email_enabled ?? null,
        recent_delivery_logs: logs || [],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  const PUSH_REG_VERSION = "v2-2026-03-14";
  const PUSH_REG_BUILD_TIME = new Date().toISOString();

  app.get("/api/version/push-registration", (_req, res) => {
    return res.json({
      version: PUSH_REG_VERSION,
      build_time: PUSH_REG_BUILD_TIME,
      persisted_support: true,
      active_token_count_support: true,
    });
  });

  app.post("/api/expo-push-token", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        log(`[EXPO-PUSH ${PUSH_REG_VERSION}] Rejected: no auth token`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        log(`[EXPO-PUSH] Rejected: auth failed — ${authErr?.message || "no user"}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      log(`[EXPO-PUSH] Request from user ${user.id.substring(0, 8)}... body=${JSON.stringify(req.body)}`);

      const { expo_push_token, platform } = req.body;
      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        log(`[EXPO-PUSH] Rejected: invalid token format — got "${String(expo_push_token).substring(0, 30)}"`);
        return res.status(400).json({ error: "Invalid expo_push_token" });
      }

      const plat = platform === "android" ? "android" : "ios";
      const now = new Date().toISOString();
      const sb = getSupabaseAdmin();

      const { error: deactivateErr } = await sb
        .from("expo_push_tokens")
        .update({ is_active: false, updated_at: now })
        .eq("expo_push_token", expo_push_token)
        .neq("user_id", user.id);

      if (deactivateErr) {
        log(`[EXPO-PUSH] Deactivate other users warning: ${deactivateErr.message}`);
      }

      const { error: upsertErr } = await sb.from("expo_push_tokens").upsert(
        {
          user_id: user.id,
          expo_push_token,
          platform: plat,
          is_active: true,
          updated_at: now,
        },
        { onConflict: "user_id,expo_push_token" }
      );

      if (upsertErr) {
        log(`[EXPO-PUSH] UPSERT FAILED for user ${user.id.substring(0, 8)}...: ${upsertErr.message} (code=${upsertErr.code})`);
        return res.status(500).json({ ok: false, error: `Token persistence failed: ${upsertErr.message}` });
      }

      const { count } = await sb
        .from("expo_push_tokens")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      log(`[EXPO-PUSH] Token registered OK for user ${user.id.substring(0, 8)}... platform=${plat} active_count=${count}`);
      return res.json({ ok: true, persisted: true, active_token_count: count });
    } catch (err: any) {
      log(`[EXPO-PUSH] EXCEPTION registering token: ${err.message}`);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.delete("/api/expo-push-token", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { expo_push_token } = req.body;
      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid expo_push_token" });
      }

      const sb = getSupabaseAdmin();
      await sb
        .from("expo_push_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("expo_push_token", expo_push_token);

      log(`[EXPO-PUSH] Token deactivated for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/match-alert", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

    const subStatus = await getSubscriptionStatus(user.id);
    if (!subStatus.isActive && !subStatus.isTrial) {
      return res.json({ sent: false, reason: "no active subscription" });
    }

    const recipientEmail = user.email;
    if (!recipientEmail) {
      return res.status(400).json({ error: "No email on account" });
    }

    const { listing } = req.body;

    if (!listing || !listing.title || !listing.city) {
      return res.status(400).json({ error: "Missing listing data" });
    }

    const sent = await sendEmailMatchAlert(recipientEmail, listing, user.id);
    return res.json({ sent });
  });

  app.get("/api/notifications/settings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data: settings, error } = await supabase
        .from("user_notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });

      const cleaned = settings ?? {
          user_id: user.id,
          phone_e164: null,
          email_enabled: true,
          push_enabled: false,
        };
      if (cleaned.sms_enabled !== undefined) delete cleaned.sms_enabled;
      if (cleaned.whatsapp_enabled !== undefined) delete cleaned.whatsapp_enabled;
      if (cleaned.push_enabled === undefined) cleaned.push_enabled = false;
      return res.json(cleaned);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/notifications/settings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { phone_e164, email_enabled, push_enabled } = req.body;

      if (phone_e164 !== undefined && phone_e164 !== null) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (typeof phone_e164 !== "string" || !e164Regex.test(phone_e164)) {
          return res.status(400).json({ error: "Invalid phone number. Use E.164 format (e.g. +31612345678)" });
        }
      }

      const payload: Record<string, any> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (phone_e164 !== undefined) payload.phone_e164 = phone_e164;
      payload.whatsapp_enabled = false;
      payload.sms_enabled = false;
      if (typeof email_enabled === "boolean") payload.email_enabled = email_enabled;
      if (typeof push_enabled === "boolean") payload.push_enabled = push_enabled;

      const { data: existing } = await supabase
        .from("user_notification_settings")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let result;
      if (existing) {
        const { user_id: _uid, ...updatePayload } = payload;
        result = await supabase
          .from("user_notification_settings")
          .update(updatePayload)
          .eq("user_id", user.id)
          .select()
          .single();
      } else {
        if (!payload.phone_e164) payload.phone_e164 = null;
        payload.whatsapp_enabled = false;
        payload.sms_enabled = false;
        if (payload.email_enabled === undefined) payload.email_enabled = true;
        if (payload.push_enabled === undefined) payload.push_enabled = false;
        result = await supabase
          .from("user_notification_settings")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) return res.status(500).json({ error: result.error.message });

      if (payload.email_enabled === true || payload.push_enabled === true) {
        trackActivationEvent(user.id, "notifications_enabled", {
          email: !!payload.email_enabled,
          push: !!payload.push_enabled,
          source: "settings",
        });
      }

      return res.json(result.data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/alerts/status", (_req, res) => {
    return res.json({
      alertsEnabled: process.env.ALERTS_ENABLED === "true",
    });
  });

  app.get("/api/ingest/health", (_req, res) => {
    return res.json({
      ok: true,
      sourcesEnabled: getEnabledSources(),
      time: new Date().toISOString(),
    });
  });

  app.get("/api/ingest/status", (_req, res) => {
    return res.json(getLastRunStatus());
  });

  app.get("/api/ingest/next-run", (_req, res) => {
    return res.json(getNextRun());
  });

  app.get("/api/ingest/debug", async (_req, res) => {
    try {
      const status = getLastRunStatus();
      const nextRun = getNextRun();

      const { count: totalListings } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true });

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count: todayListings } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      const { count: totalProfiles } = await supabase
        .from("search_profiles")
        .select("*", { count: "exact", head: true });

      const { count: totalMatches } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true });

      const sourceStatuses = getSourceStatuses();
      const activeSources = sourceStatuses.filter(s => s.status === "active");
      const brokenSources = sourceStatuses.filter(s => s.status !== "active");

      const lastSourceErrors: Record<string, string> = {};
      if (status.lastResult?.sources) {
        for (const s of status.lastResult.sources) {
          if (s.errors > 0 && s.found === 0 && s.inserted === 0) {
            lastSourceErrors[s.name] = `${s.errors} error(s), 0 results`;
          }
        }
      }

      return res.json({
        time: new Date().toISOString(),
        scheduler: {
          nextRunAt: nextRun.nextRunAt,
          intervalMinutes: nextRun.intervalMinutes,
        },
        lastRun: {
          at: status.lastRunAt,
          successAt: status.lastSuccessfulRunAt,
          error: status.lastError,
          running: status.running,
        },
        today: {
          fetched: status.todayFetched,
          inserted: status.todayInserted,
        },
        database: {
          totalListings: totalListings ?? 0,
          todayListings: todayListings ?? 0,
          totalProfiles: totalProfiles ?? 0,
          totalMatches: totalMatches ?? 0,
        },
        sources: {
          active: activeSources.map(s => s.name),
          broken: brokenSources.map(s => ({ name: s.name, status: s.status, note: s.note })),
          lastErrors: lastSourceErrors,
        },
        lastReport: status.lastResult ? {
          cities: status.lastResult.cities,
          durationSec: status.lastResult.durationSec,
          total: status.lastResult.total,
          sources: status.lastResult.sources,
        } : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/match-debug/explain/:listingId/:profileId", async (req, res) => {
    try {
      const { listingId, profileId } = req.params;
      const result = await explainMatch(listingId, profileId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/match-debug/listing/:listingId", async (req, res) => {
    try {
      const { listingId } = req.params;
      const result = await explainAllProfilesForListing(listingId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/freshness", async (req, res) => {
    const { listingIds, matchIds } = req.body;
    const [listings, matches] = await Promise.all([
      getListingFreshness(listingIds || []),
      getMatchTimestamps(matchIds || []),
    ]);
    return res.json({ listings, matches });
  });

  // TODO: Improve popularity ranking with real engagement data (clicks, views, apply actions)
  // Currently ranks by match count across all users within the last 7 days
  app.get("/api/listings/popular", async (_req, res) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentMatches, error: mErr } = await supabase
        .from("matches")
        .select("listing_id")
        .gte("created_at", sevenDaysAgo);

      let rankedIds: { listing_id: string; match_count: number }[] = [];

      if (!mErr && recentMatches && recentMatches.length > 0) {
        const countMap: Record<string, number> = {};
        for (const m of recentMatches) {
          countMap[m.listing_id] = (countMap[m.listing_id] || 0) + 1;
        }
        rankedIds = Object.entries(countMap)
          .map(([listing_id, match_count]) => ({ listing_id, match_count }))
          .sort((a, b) => b.match_count - a.match_count)
          .slice(0, 6);
      }

      if (rankedIds.length === 0) {
        const { data: fallbackRows, error: fbErr } = await supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at")
          .order("created_at", { ascending: false })
          .limit(6);

        if (fbErr) return res.status(500).json({ error: fbErr.message });

        const ids = (fallbackRows ?? []).map((l: any) => l.id);
        const freshnessMap = ids.length > 0 ? await getListingFreshness(ids) : {};

        return res.json((fallbackRows ?? []).map((l: any) => ({
          listing_id: l.id,
          title: l.title,
          price: l.price,
          size_m2: l.size_m2,
          bedrooms: l.bedrooms,
          city: l.city,
          source: l.source,
          url: l.url,
          image_url: l.image_url ?? null,
          first_seen_at: freshnessMap[l.id]?.first_seen_at ?? l.created_at,
          fresh_label: computeFreshLabel(freshnessMap[l.id]?.first_seen_at ?? l.created_at),
          match_count: 0,
        })));
      }

      const listingIds = rankedIds.map((r) => r.listing_id);
      const [listingsRes, freshnessMap] = await Promise.all([
        supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at")
          .in("id", listingIds),
        getListingFreshness(listingIds),
      ]);

      if (listingsRes.error) return res.status(500).json({ error: listingsRes.error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listingsRes.data ?? []) listingMap[l.id] = l;

      const matchCountMap: Record<string, number> = {};
      for (const r of rankedIds) matchCountMap[r.listing_id] = r.match_count;

      const result = listingIds
        .filter((id) => listingMap[id])
        .map((id) => {
          const l = listingMap[id];
          const firstSeenAt = freshnessMap[id]?.first_seen_at ?? l.created_at;
          return {
            listing_id: id,
            title: l.title,
            price: l.price,
            size_m2: l.size_m2,
            bedrooms: l.bedrooms,
            city: l.city,
            source: l.source,
            url: l.url,
            image_url: l.image_url ?? null,
            first_seen_at: firstSeenAt,
            fresh_label: computeFreshLabel(firstSeenAt),
            match_count: matchCountMap[id] ?? 0,
          };
        });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/listings/fresh", async (_req, res) => {
    try {
      const freshRows = await getNewestListingIds(50);
      if (freshRows.length === 0) return res.json([]);

      const ids = freshRows.map((r) => r.listing_id);
      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url")
        .in("id", ids);

      if (error) return res.status(500).json({ error: error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listings ?? []) listingMap[l.id] = l;

      const result = freshRows
        .filter((r) => listingMap[r.listing_id])
        .map((r) => {
          const l = listingMap[r.listing_id];
          return {
            title: l.title,
            price: l.price,
            size_m2: l.size_m2,
            bedrooms: l.bedrooms,
            city: l.city,
            source: l.source,
            url: l.url,
            image_url: l.image_url ?? null,
            first_seen_at: r.first_seen_at,
            fresh_label: computeFreshLabel(r.first_seen_at),
          };
        });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/matches", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("created_at")
        .eq("user_id", user.id)
        .single();
      const premiumStartedAt = subRow?.created_at || null;

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const cutoff = premiumStartedAt
        ? (new Date(premiumStartedAt).getTime() > new Date(ninetyDaysAgo).getTime() ? premiumStartedAt : ninetyDaysAgo)
        : ninetyDaysAgo;

      let matchQuery = supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1000);
      const { data: matchRows, error: mErr } = await matchQuery;

      if (mErr) return res.status(500).json({ error: mErr.message });
      if (!matchRows || matchRows.length === 0) return res.json({ matches: [], totalCount: 0 });

      console.log(`[MATCHES] userId=${user.id.substring(0, 8)}... returned=${matchRows.length} newest=${matchRows[0]?.created_at} oldest=${matchRows[matchRows.length - 1]?.created_at}`);

      const enriched = matchRows.map((m: any) => ({
        ...m,
        matched_at: m.created_at,
      }));

      const dedupedByListing: Record<string, any> = {};
      for (const m of enriched) {
        if (!dedupedByListing[m.listing_id]) {
          dedupedByListing[m.listing_id] = m;
        }
      }
      let uniqueMatches = Object.values(dedupedByListing);


      const allListingIds = uniqueMatches.map((m: any) => m.listing_id);
      if (allListingIds.length === 0) return res.json({ matches: [], totalCount: 0 });

      const profileIds = [...new Set(uniqueMatches.map((m: any) => m.search_profile_id).filter(Boolean))];

      const [listingsData, freshnessMap, profilesData] = await Promise.all([
        batchedIn<any>(
          "listings", "id", allListingIds,
          "id, title, price, size_m2, bedrooms, city, source, url, image_url, furnished, pets_allowed, district",
          (q: any) => q.not("title", "is", null)
        ),
        getListingFreshness(allListingIds),
        profileIds.length > 0
          ? batchedIn<any>(
              "search_profiles", "id", profileIds,
              "id, city, price_min, price_max, bedrooms_min, size_min, furnished, extra_features, districts, location_mode"
            )
          : Promise.resolve([]),
      ]);

      const listingMap: Record<string, any> = {};
      for (const l of listingsData) listingMap[l.id] = l;

      const validListingIds = new Set(Object.keys(listingMap));
      const validMatches = uniqueMatches.filter((m: any) => validListingIds.has(m.listing_id));

      const profileMap: Record<string, any> = {};
      for (const p of profilesData) profileMap[p.id] = p;

      const recentEmailed = getRecentEmailedIds(user.id);
      const emailedIdSet = new Set(recentEmailed?.listing_ids || []);

      const validResults = validMatches.map((m: any) => {
        const l = listingMap[m.listing_id];
        const firstSeenAt = freshnessMap[m.listing_id]?.first_seen_at || m.created_at;
        const profile = profileMap[m.search_profile_id];

        let match_score = null;
        let match_label = null;
        let match_reasons: string[] = [];
        let hybrid_filters = null;
        if (l && profile) {
          const scoreResult = computeMatchScore({
            listing: { price: l.price ?? 0, bedrooms: l.bedrooms ?? 0, size_m2: l.size_m2 ?? 0, city: l.city ?? "" },
            profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
          });
          match_score = scoreResult.score;
          match_label = scoreResult.label;
          match_reasons = getMatchReasons(scoreResult.details);
          hybrid_filters = computeHybridFilters({
            listing: { furnished: l.furnished, pets_allowed: l.pets_allowed, district: l.district },
            profile: { furnished: profile.furnished, extra_features: profile.extra_features, districts: profile.districts, location_mode: profile.location_mode },
          });
        }

        return {
          listing_id: m.listing_id,
          title: l.title,
          price: l.price ?? null,
          size_m2: l.size_m2 ?? null,
          bedrooms: l.bedrooms ?? null,
          city: l.city ?? null,
          district: l.district ?? null,
          source: l.source ?? null,
          url: l.url ?? null,
          image_url: l.image_url ?? null,
          matched_at: m.matched_at,
          first_seen_at: firstSeenAt,
          fresh_label: computeFreshLabel(firstSeenAt),
          match_score,
          match_label,
          match_reasons,
          hybrid_filters,
          in_latest_email: emailedIdSet.has(m.listing_id),
        };
      });

      validResults.sort((a: any, b: any) => {
        const dateA = new Date(a.matched_at).getTime();
        const dateB = new Date(b.matched_at).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return a.listing_id.localeCompare(b.listing_id);
      });

      const top50 = validResults.slice(0, 50);

      console.log(`[MATCHES ORDER] userId=${user.id.substring(0, 8)}... appOrder=[${top50.slice(0, 10).map((m: any) => m.listing_id.substring(0, 8)).join(",")}] sortField=matched_at timestamps=[${top50.slice(0, 10).map((m: any) => m.matched_at).join(",")}]`);

      const [canonicalStats, canonicalStates] = await Promise.all([
        getUserMatchStats(user.id),
        getCanonicalMatchStates(user.id),
      ]);

      const matchesWithState = top50.map((m: any) => {
        const cs = canonicalStates.get(m.listing_id);
        return {
          ...m,
          canonical_viewed: cs?.viewed ?? false,
          canonical_saved: cs?.saved ?? false,
          canonical_applied: cs?.applied ?? false,
          canonical_dismissed: cs?.dismissed ?? false,
        };
      });


      const stats = canonicalStats || { total: 0, new_count: 0, viewed: 0, saved: 0, applied: 0, email_sent: 0, push_sent: 0 };

      return res.json({
        matches: matchesWithState,
        totalCount: stats.total,
        newCount: stats.new_count,
        canonicalStats: {
          total: stats.total,
          new_count: stats.new_count,
          viewed: stats.viewed,
          saved: stats.saved,
          applied: stats.applied,
          email_sent: stats.email_sent,
          push_sent: stats.push_sent,
        },
        latestEmailAt: recentEmailed?.timestamp ? new Date(recentEmailed.timestamp).toISOString() : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/matches/:matchListingId/applied", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      const { applied } = req.body;
      if (typeof applied !== "boolean") return res.status(400).json({ error: "applied must be a boolean" });

      const { data, error } = await supabase
        .from("matches")
        .update({ applied })
        .eq("listing_id", matchListingId)
        .eq("user_id", user.id)
        .select("id, listing_id, applied");

      if (error) {
        console.error("[matches] PATCH applied error:", error.message);
      }

      const listingMeta: any = { user_id: user.id, listing_id: matchListingId };
      try {
        const { data: listing } = await supabase.from("listings").select("title, city, price, source, url").eq("id", matchListingId).single();
        if (listing) {
          listingMeta.listing_title = listing.title || null;
          listingMeta.listing_city = listing.city || null;
          listingMeta.listing_price = listing.price || null;
          listingMeta.listing_source = listing.source || null;
          listingMeta.listing_url = listing.url || null;
        }
      } catch {}

      if (applied) {
        try {
          await upsertUserMatch(listingMeta);
          await markApplied(user.id, matchListingId, true);
          console.log(`[matches] canonical applied sync OK for user=${user.id.substring(0, 8)}... listing=${matchListingId.substring(0, 8)}...`);
        } catch (pgErr: any) {
          console.error("[matches] canonical applied sync error:", pgErr.message);
        }
      } else {
        markApplied(user.id, matchListingId, false).catch(() => {});
      }

      if (data && data.length > 0) {
        return res.json(data[0]);
      }
      return res.json({ listing_id: matchListingId, applied });
    } catch (err: any) {
      console.error("[matches] PATCH applied error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/matches/applied", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const [supaResult, pgResult] = await Promise.allSettled([
        supabase
          .from("matches")
          .select("listing_id")
          .eq("user_id", user.id)
          .eq("applied", true),
        pgPool.query("SELECT listing_id FROM user_matches WHERE user_id = $1 AND applied = true", [user.id]),
      ]);

      const appliedSet = new Set<string>();
      if (supaResult.status === "fulfilled" && supaResult.value.data) {
        for (const m of supaResult.value.data) appliedSet.add(m.listing_id);
      }
      if (pgResult.status === "fulfilled" && pgResult.value.rows) {
        for (const r of pgResult.value.rows) appliedSet.add(r.listing_id);
      }
      return res.json({ applied: Array.from(appliedSet) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/favorites", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows } = await pgPool.query(
        "SELECT listing_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
      return res.json({ favoriteIds: rows.map((r: any) => r.listing_id) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/favorites/listings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows: favRows } = await pgPool.query(
        "SELECT listing_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
      const favIds = favRows.map((r: any) => r.listing_id);
      if (favIds.length === 0) return res.json({ listings: [] });

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at, furnished, pets_allowed, district")
        .in("id", favIds);

      if (error) return res.status(500).json({ error: error.message });

      const orderedListings = favIds
        .map((id: string) => listings?.find((l: any) => l.id === id))
        .filter(Boolean)
        .map((l: any) => ({
          listing_id: l.id,
          title: l.title,
          price: l.price,
          size_m2: l.size_m2,
          bedrooms: l.bedrooms,
          city: l.city,
          source: l.source,
          url: l.url,
          image_url: l.image_url,
          created_at: l.created_at,
          furnished: l.furnished,
          pets_allowed: l.pets_allowed,
          district: l.district,
          match_score: 0,
          match_reasons: [],
        }));

      return res.json({ listings: orderedListings });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/favorites/:listingId", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { listingId } = req.params;
      await pgPool.query(
        `INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)
         ON CONFLICT (user_id, listing_id) DO NOTHING`,
        [user.id, listingId]
      );
      return res.json({ favorited: true, listing_id: listingId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/favorites/:listingId", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { listingId } = req.params;
      await pgPool.query(
        "DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2",
        [user.id, listingId]
      );
      return res.json({ favorited: false, listing_id: listingId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Listing ID is required" });

      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at, furnished, pets_allowed, district")
        .eq("id", id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const freshnessMap = await getListingFreshness([id]);
      const firstSeenAt = freshnessMap[id]?.first_seen_at || data.created_at;

      let match_score = null;
      let match_label = null;
      let match_reasons: string[] = [];
      let hybrid_filters = null;
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            const { data: matchRow } = await supabase
              .from("matches")
              .select("search_profile_id")
              .eq("user_id", user.id)
              .eq("listing_id", id)
              .limit(1)
              .maybeSingle();

            if (matchRow?.search_profile_id) {
              const { data: profile } = await supabase
                .from("search_profiles")
                .select("city, price_min, price_max, bedrooms_min, size_min, furnished, extra_features, districts, location_mode")
                .eq("id", matchRow.search_profile_id)
                .single();

              if (profile) {
                const scoreResult = computeMatchScore({
                  listing: { price: data.price ?? 0, bedrooms: data.bedrooms ?? 0, size_m2: data.size_m2 ?? 0, city: data.city ?? "" },
                  profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
                });
                match_score = scoreResult.score;
                match_label = scoreResult.label;
                match_reasons = getMatchReasons(scoreResult.details);
                hybrid_filters = computeHybridFilters({
                  listing: { furnished: data.furnished, pets_allowed: data.pets_allowed, district: data.district },
                  profile: { furnished: profile.furnished, extra_features: profile.extra_features, districts: profile.districts, location_mode: profile.location_mode },
                });
              }
            }
          }
        } catch {}
      }

      return res.json({
        ...data,
        first_seen_at: firstSeenAt,
        fresh_label: computeFreshLabel(firstSeenAt),
        match_score,
        match_label,
        match_reasons,
        hybrid_filters,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/estimate", async (req, res) => {
    try {
      const { city, minPrice, maxPrice, minRooms, minSize } = req.query;

      if (!city || typeof city !== "string") {
        return res.status(400).json({ error: "city is required" });
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("city", `%${city}%`)
        .gte("created_at", sevenDaysAgo);

      if (minPrice && Number(minPrice) > 0) {
        query = query.gte("price", Number(minPrice));
      }
      if (maxPrice && Number(maxPrice) > 0) {
        query = query.lte("price", Number(maxPrice));
      }
      if (minRooms && Number(minRooms) > 0) {
        query = query.gte("bedrooms", Number(minRooms));
      }
      if (minSize && Number(minSize) > 0) {
        query = query.gte("size_m2", Number(minSize));
      }

      const { count, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const last7dCount = count ?? 0;
      const perWeekEstimate = last7dCount;

      return res.json({ perWeekEstimate, last7dCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripe/stripeClient");
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, fullName } = req.body;
      log(`[SIGNUP] Attempt: email=${email}, hasPassword=${!!password}, fullName=${fullName || "(none)"}`);
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const adminSb = getSupabaseAdmin();

      const { data: newUser, error: createErr } = await adminSb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "", email_needs_verification: true },
      });

      if (createErr || !newUser?.user) {
        const msg = createErr?.message || "User creation failed";
        log("auth", `[SIGNUP] Admin createUser failed: ${msg}`);
        const isDuplicate = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("exists");
        return res.status(isDuplicate ? 409 : 400).json({
          error: isDuplicate ? "user_exists" : msg,
          message: isDuplicate ? "An account with this email already exists." : msg,
        });
      }

      const userId = newUser.user.id;
      log(`[SIGNUP] User created OK: id=${userId}, email=${email}`);

      try {
        const detectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
        log(`[LANG AUTO-DETECT] userId=${userId.substring(0, 8)}... detected="${detectedLang}" from accept-language="${(req.headers["accept-language"] || "").substring(0, 60)}"`);
        await pgPool.query(
          `INSERT INTO user_profile_data (user_id, first_name, language, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, fullName || email.split("@")[0], detectedLang]
        );
        log(`[LANG FIRST SAVE] userId=${userId.substring(0, 8)}... language="${detectedLang}" saved to DB on signup`);
      } catch (profileErr: any) {
        log(`[SIGNUP] WARNING: Failed to create user_profile_data row for user=${userId}: ${profileErr.message}`);
      }

      try {
        const sub = await ensureTrialSubscription(userId);
        if (sub) {
          log(`[SIGNUP] Trial subscription created: user=${userId}, plan=${sub.plan || "trial"}, status=${sub.status}`);
          trackActivationEvent(userId, "account_created", {});
          trackActivationEvent(userId, "trial_started", { plan: sub.plan || "trial" });
        } else {
          log(`[SIGNUP] Trial subscription returned null for user=${userId}`);
        }
      } catch (trialErr: any) {
        log(`[SIGNUP] Trial creation FAILED for user=${userId}: ${trialErr.message}`);
      }

      return res.json({ ok: true, userId });
    } catch (err: any) {
      log(`[SIGNUP] Unexpected error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const adminSb = getSupabaseAdmin();
      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      const { data: inviteData, error: inviteErr } = await adminSb.auth.admin.inviteUserByEmail(user.email!, {
        redirectTo: `${baseUrl}/auth/callback`,
      });

      if (inviteErr) {
        log("auth", `[VERIFY] inviteUserByEmail failed: ${inviteErr.message}, trying generateLink+resend`);
        const { error: resendErr } = await supabase.auth.resend({ type: "signup", email: user.email! });
        if (resendErr) {
          log("auth", `[VERIFY] Resend also failed: ${resendErr.message}`);
          return res.status(500).json({ error: "Could not send verification email" });
        }
      }

      log("auth", `[VERIFY] Verification email sent to ${user.email}`);
      return res.json({ ok: true });
    } catch (err: any) {
      log("auth", `[VERIFY] Unexpected error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/subscription/ensure-trial", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const etDetectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
      pgPool.query(
        `INSERT INTO user_profile_data (user_id, first_name, language, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, user.user_metadata?.full_name || user.email?.split("@")[0] || "", etDetectedLang]
      ).then(() => {
        log(`[ensure-trial] Profile row ensured in user_profile_data: user=${user.id} lang=${etDetectedLang}`);
      }).catch((err: any) => {
        log(`[ensure-trial] WARNING: user_profile_data insert failed for user=${user.id}: ${err.message}`);
      });

      const sub = await ensureTrialSubscription(user.id);
      if (!sub) {
        return res.status(500).json({ error: "Trial creation failed" });
      }
      hasActivationEvent(user.id, "account_created").then(has => {
        if (!has) trackActivationEvent(user.id, "account_created", {});
      }).catch(() => {});
      trackActivationEvent(user.id, "trial_started", { plan: sub.plan || "trial" });
      return res.json({ ok: true, subscription: sub });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/subscription/status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const status = await getSubscriptionStatus(user.id);
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  let PLAN_PRICE_MAP: Record<string, string> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_1_MONTH || "",
    two_month: process.env.STRIPE_PRICE_TWO_MONTH || process.env.STRIPE_PRICE_2_MONTHS || "",
    three_month: process.env.STRIPE_PRICE_THREE_MONTH || process.env.STRIPE_PRICE_3_MONTHS || "",
  };

  log(`[stripe-config] Env price IDs: monthly=${PLAN_PRICE_MAP.monthly || "(empty)"}, two_month=${PLAN_PRICE_MAP.two_month || "(empty)"}, three_month=${PLAN_PRICE_MAP.three_month || "(empty)"}`);

  if (stripeAvailable) {
    try {
      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      if (PLAN_PRICE_MAP.monthly) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.monthly);
        } catch {
          log(`[stripe-config] monthly price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.monthly = "";
        }
      }
      if (PLAN_PRICE_MAP.two_month) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.two_month);
        } catch {
          log(`[stripe-config] two_month price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.two_month = "";
        }
      }
      if (PLAN_PRICE_MAP.three_month) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.three_month);
        } catch {
          log(`[stripe-config] three_month price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.three_month = "";
        }
      }

      if (!PLAN_PRICE_MAP.monthly || !PLAN_PRICE_MAP.two_month || !PLAN_PRICE_MAP.three_month) {
        const prices = await stripe.prices.list({ active: true, limit: 50, expand: ["data.product"] });
        for (const price of prices.data) {
          if (price.nickname === "monthly" && !PLAN_PRICE_MAP.monthly) PLAN_PRICE_MAP.monthly = price.id;
          if (price.nickname === "two_month" && !PLAN_PRICE_MAP.two_month) PLAN_PRICE_MAP.two_month = price.id;
          if (price.nickname === "three_month" && !PLAN_PRICE_MAP.three_month) PLAN_PRICE_MAP.three_month = price.id;
          if (!price.nickname && price.recurring) {
            const interval = price.recurring.interval;
            const count = price.recurring.interval_count;
            if (interval === "month" && count === 1 && !PLAN_PRICE_MAP.monthly) PLAN_PRICE_MAP.monthly = price.id;
            if (interval === "month" && count === 2 && !PLAN_PRICE_MAP.two_month) PLAN_PRICE_MAP.two_month = price.id;
            if (interval === "month" && count === 3 && !PLAN_PRICE_MAP.three_month) PLAN_PRICE_MAP.three_month = price.id;
          }
        }
      }

      log(`[stripe-config] Final price IDs: monthly=${PLAN_PRICE_MAP.monthly || "(missing)"}, two_month=${PLAN_PRICE_MAP.two_month || "(missing)"}, three_month=${PLAN_PRICE_MAP.three_month || "(missing)"}`);
    } catch (err: any) {
      log(`[stripe-config] Price validation/lookup failed: ${err.message}`);
    }
  }

  const PRICE_TO_PLAN: Record<string, string> = {};
  for (const [plan, priceId] of Object.entries(PLAN_PRICE_MAP)) {
    if (priceId) PRICE_TO_PLAN[priceId] = plan;
  }

  app.post("/api/stripe/portal", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "stripe_not_configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .single();

      if (!subRow?.stripe_customer_id) {
        return res.status(404).json({ error: "no_stripe_customer" });
      }

      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `https://${req.headers.host}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subRow.stripe_customer_id,
        return_url: `${baseUrl}/account/subscription`,
      });

      return res.json({ url: portalSession.url });
    } catch (err: any) {
      log(`[stripe-portal] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { plan } = req.body;
      log(`[checkout] Started: user=${user.id}, email=${user.email}, plan=${plan}`);

      if (!plan || !PLAN_PRICE_MAP[plan]) {
        log(`[checkout] Invalid plan "${plan}" — available: ${Object.keys(PLAN_PRICE_MAP).join(", ")}`);
        return res.status(400).json({ error: "Invalid plan. Use: monthly, two_month, or three_month" });
      }

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        log(`[checkout] No price ID for plan "${plan}" — Stripe prices not configured`);
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe prices are not yet configured." });
      }

      if (!stripeAvailable) {
        log(`[checkout] Stripe not available — cannot create session`);
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe is not available. Set STRIPE_SECRET_KEY or connect Stripe via Replit integration." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        log(`[checkout] Found existing Stripe customer: ${customerId}`);
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        log(`[checkout] Created new Stripe customer: ${customerId}`);
      }

      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      log(`[checkout] Creating Stripe session: plan=${plan}, priceId=${stripePriceId}, customer=${customerId}, successUrl=${baseUrl}/subscription-success`);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { supabase_user_id: user.id, plan },
        },
        success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/onboarding/value`,
        metadata: { supabase_user_id: user.id, plan },
      });

      log(`[checkout] Session created: id=${session.id}, url=${session.url?.substring(0, 60)}...`);
      return res.json({ url: session.url });
    } catch (err: any) {
      log(`[checkout] Error: ${err.message}`);
      console.error("Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/session-guest", async (req, res) => {
    try {
      const { plan } = req.body;
      if (!plan || !PLAN_PRICE_MAP[plan]) {
        return res.status(400).json({ error: "Invalid plan. Use: monthly, two_month, or three_month" });
      }

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe prices are not yet configured." });
      }

      if (!stripeAvailable) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe is not available." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      log(`[checkout-guest] Creating guest session: plan=${plan}, priceId=${stripePriceId}`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { plan, source: "embed_guest" },
        },
        success_url: `${baseUrl}/?embed=true&session_id={CHECKOUT_SESSION_ID}#/embed-success`,
        cancel_url: `${baseUrl}/?embed=true#/onboarding/value`,
        metadata: { plan, source: "embed_guest" },
      });

      log(`[checkout-guest] Session created: id=${session.id}, url=${session.url?.substring(0, 60)}...`);
      return res.json({ url: session.url });
    } catch (err: any) {
      log(`[checkout-guest] Error: ${err.message}`);
      console.error("Guest checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/link-session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { session_id } = req.body;
      if (!session_id) return res.status(400).json({ error: "session_id is required" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.metadata?.source !== "embed_guest") {
        log(`[checkout-link] Rejected: session ${session_id} source=${session.metadata?.source}, expected embed_guest`);
        return res.status(403).json({ error: "Session not eligible for linking" });
      }

      const existingCustomerId = session.customer as string | null;
      if (existingCustomerId) {
        const customer = await stripe.customers.retrieve(existingCustomerId);
        if (customer && !("deleted" in customer && customer.deleted)) {
          const custMeta = (customer as any).metadata;
          if (custMeta?.supabase_user_id && custMeta.supabase_user_id !== user.id) {
            log(`[checkout-link] Rejected: session ${session_id} already linked to different user`);
            return res.status(403).json({ error: "Session already linked to another account" });
          }
        }
      }

      const stripeSubscriptionId = session.subscription as string;
      if (!stripeSubscriptionId) {
        log(`[checkout-link] No subscription ID in session ${session_id}`);
        return res.status(202).json({ success: false, message: "Payment processing" });
      }

      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const isTrialing = sub.status === "trialing";
      const isPaid = session.payment_status === "paid";

      if (!isPaid && !isTrialing) {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const plan = session.metadata?.plan || sub.metadata?.plan || "monthly";
      let stripeCustomerId = session.customer as string;

      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        stripeCustomerId = customer.id;
      }

      await stripe.subscriptions.update(stripeSubscriptionId, {
        metadata: { supabase_user_id: user.id, plan },
      });

      if (isTrialing) {
        const trialEnd = (sub as any).trial_end;
        const trialEndsAt = trialEnd && trialEnd > 0
          ? new Date(trialEnd * 1000)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(user.id, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
      } else {
        const rawEnd = (sub as any).current_period_end;
        const periodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(user.id, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
      }

      log(`[checkout-link] Linked session ${session_id} to user ${user.id}, plan=${plan}`);
      trackActivationEvent(user.id, "subscription_started", { plan, source: "embed_guest_linked" });

      const status = await getSubscriptionStatus(user.id);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[checkout-link] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: "priceId is required" });

      const legacyMap: Record<string, string> = {
        "1-month": "monthly",
        "2-months": "two_month",
        "3-months": "three_month",
      };
      const plan = legacyMap[priceId] || priceId;

      req.body = { plan };
      req.headers["authorization"] = `Bearer ${token}`;

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        return res.status(400).json({ error: "Stripe prices are not yet configured." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { supabase_user_id: user.id, plan },
        },
        success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/onboarding/value`,
        metadata: { supabase_user_id: user.id, plan },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/verify", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { session_id } = req.body;
      if (!session_id) return res.status(400).json({ error: "session_id is required" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(session_id);

      const stripeSubscriptionId = session.subscription as string;
      if (!stripeSubscriptionId) {
        log(`[checkout-verify] No subscription ID in session ${session_id}`);
        return res.status(202).json({ success: false, message: "Payment processing" });
      }

      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const isTrialing = sub.status === "trialing";
      const isPaid = session.payment_status === "paid";

      if (!isPaid && !isTrialing) {
        log(`[checkout-verify] Session ${session_id} payment_status=${session.payment_status}, sub_status=${sub.status} — not valid`);
        return res.status(400).json({ error: "Payment not completed" });
      }

      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan || sub.metadata?.plan || "monthly";
      const stripeCustomerId = session.customer as string;

      if (userId !== user.id) {
        log(`[checkout-verify] User mismatch: session user=${userId}, request user=${user.id}`);
        return res.status(403).json({ error: "Forbidden" });
      }

      if (isTrialing) {
        const trialEnd = (sub as any).trial_end;
        const trialEndsAt = trialEnd && trialEnd > 0
          ? new Date(trialEnd * 1000)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        log(`[checkout-verify] Stripe sub=${stripeSubscriptionId} is trialing, trial_end=${trialEndsAt.toISOString()}`);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
      } else {
        const rawEnd = (sub as any).current_period_end;
        const periodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        log(`[checkout-verify] Stripe sub=${stripeSubscriptionId} status=${sub.status} period_end=${periodEnd.toISOString()}`);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
      }
      log(`[checkout-verify] Subscription synced for user=${userId} plan=${plan}`);
      trackActivationEvent(userId, "subscription_started", { plan, source: "checkout" });

      const status = await getSubscriptionStatus(userId);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[checkout-verify] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    log(`[stripe-webhook] Incoming request — has signature: ${!!req.headers["stripe-signature"]}, body size: ${req.rawBody ? (req.rawBody as Buffer).length : 0} bytes`);
    try {
      const { getUncachableStripeClient, getStripeSecretKey } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log("[stripe-webhook] ERROR: STRIPE_WEBHOOK_SECRET not configured — set it in Replit Secrets");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      log(`[stripe-webhook] Verifying signature (secret prefix: ${webhookSecret.substring(0, 8)}...)`);

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } catch (err: any) {
        log(`[stripe-webhook] SIGNATURE VERIFICATION FAILED: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      log(`[stripe-webhook] Event verified OK — type: ${event.type}, id: ${event.id}`);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.metadata?.supabase_user_id;
          const plan = session.metadata?.plan || "monthly";
          const stripeCustomerId = session.customer as string;
          const stripeSubscriptionId = session.subscription as string;

          log(`[stripe-webhook] checkout.session.completed — userId=${userId}, customerId=${stripeCustomerId}, subscriptionId=${stripeSubscriptionId}, plan=${plan}`);

          if (userId && stripeSubscriptionId) {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            log(`[stripe-webhook] Stripe subscription status: ${sub.status}`);
            if (sub.status === "trialing") {
              const trialEnd = (sub as any).trial_end;
              const trialEndsAt = trialEnd && trialEnd > 0
                ? new Date(trialEnd * 1000)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] DB UPDATE: setting user=${userId} to trial, trialEndsAt=${trialEndsAt.toISOString()}`);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
              trackActivationEvent(userId, "trial_started", { plan, source: "webhook" });
              log(`[stripe-webhook] ACTIVATION: user=${userId} is now ACTIVE (trial) ✓`);
            } else {
              const rawEnd = (sub as any).current_period_end;
              const periodEnd = rawEnd && rawEnd > 0
                ? new Date(rawEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] DB UPDATE: setting user=${userId} to active, periodEnd=${periodEnd.toISOString()}`);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
              trackActivationEvent(userId, "subscription_started", { plan, source: "webhook" });
              log(`[stripe-webhook] ACTIVATION: user=${userId} is now ACTIVE (paid) ✓`);
            }
          } else {
            log(`[stripe-webhook] SKIPPED checkout.session.completed — missing userId=${userId} or subscriptionId=${stripeSubscriptionId}`);
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          const stripeCustomerId = sub.customer as string;
          const stripeSubId = sub.id;
          const subStatus = sub.status;

          log(`[stripe-webhook] ${event.type} — customerId=${stripeCustomerId}, subId=${stripeSubId}, status=${subStatus}`);

          const userId = await findUserByStripeCustomerId(stripeCustomerId);
          if (userId) {
            log(`[stripe-webhook] Matched user=${userId} for customer=${stripeCustomerId}`);
            const priceId = sub.items?.data?.[0]?.price?.id;
            const plan = (priceId && PRICE_TO_PLAN[priceId]) || sub.metadata?.plan || "monthly";

            if (subStatus === "trialing") {
              const trialEnd = sub.trial_end;
              const trialEndsAt = trialEnd && trialEnd > 0
                ? new Date(trialEnd * 1000)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] DB UPDATE: user=${userId} → trial, plan=${plan}`);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, null, trialEndsAt);
            } else if (subStatus === "active") {
              if (sub.cancel_at_period_end) {
                const rawEnd = sub.current_period_end;
                const periodEnd = rawEnd && rawEnd > 0
                  ? new Date(rawEnd * 1000)
                  : null;
                log(`[stripe-webhook] DB UPDATE: user=${userId} → canceled (cancel_at_period_end), periodEnd=${periodEnd?.toISOString()}`);
                await updateSubscriptionStatus(stripeSubId, "canceled", periodEnd ?? undefined);
              } else {
                const rawEnd = sub.current_period_end;
                const periodEnd = rawEnd && rawEnd > 0
                  ? new Date(rawEnd * 1000)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                log(`[stripe-webhook] DB UPDATE: user=${userId} → active, plan=${plan}, periodEnd=${periodEnd.toISOString()}`);
                await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, periodEnd, null);
              }
            } else if (subStatus === "canceled" || subStatus === "unpaid") {
              log(`[stripe-webhook] DB UPDATE: sub=${stripeSubId} → canceled`);
              await updateSubscriptionStatus(stripeSubId, "canceled");
            } else if (subStatus === "past_due" || subStatus === "incomplete_expired") {
              log(`[stripe-webhook] DB UPDATE: sub=${stripeSubId} → expired`);
              await updateSubscriptionStatus(stripeSubId, "expired");
            }
          } else {
            log(`[stripe-webhook] NO USER FOUND for customer=${stripeCustomerId} — cannot process ${event.type}`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          log(`[stripe-webhook] subscription.deleted — subId=${sub.id}, customerId=${sub.customer}`);
          await updateSubscriptionStatus(sub.id, "canceled");
          break;
        }

        default:
          log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      }

      log(`[stripe-webhook] Event ${event.id} processed OK`);
      return res.json({ received: true });
    } catch (err: any) {
      log(`[stripe-webhook] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/search-profiles", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data: profiles, error } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(profiles ?? []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/search-profiles/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;

      const { data: profile } = await supabase
        .from("search_profiles")
        .select("user_id")
        .eq("id", id)
        .single();

      if (!profile || profile.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { error } = await supabase
        .from("search_profiles")
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  let _searchProfileColumns: Set<string> | null = null;
  async function getSearchProfileColumns(): Promise<Set<string>> {
    if (_searchProfileColumns) return _searchProfileColumns;
    const { data } = await supabase.from("search_profiles").select("*").limit(1);
    if (data && data.length > 0) {
      _searchProfileColumns = new Set(Object.keys(data[0]));
      log(`[search-profiles] Detected columns: ${[..._searchProfileColumns].join(", ")}`);
    } else {
      _searchProfileColumns = new Set(["id", "user_id", "city", "price_min", "price_max", "bedrooms_min", "size_min", "created_at"]);
    }
    return _searchProfileColumns;
  }

  app.put("/api/search-profiles/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileId = req.params.id;
      const { data: existing } = await supabase
        .from("search_profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();

      if (!existing || existing.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const body = req.body;
      const allFields = [
        "city", "city_name", "country_code", "latitude", "longitude", "place_id",
        "price_min", "price_max", "bedrooms_min", "size_min",
        "location_mode", "districts", "radius_km",
        "commute_destination", "commute_lat", "commute_lng", "commute_mode", "commute_minutes",
        "furnished", "property_types", "extra_features", "target_categories",
      ];
      const coreFields = ["city", "price_min", "price_max", "bedrooms_min", "size_min"];

      const availableCols = await getSearchProfileColumns();
      const updateRow: Record<string, unknown> = {};
      for (const f of allFields) {
        if ((f in body) && availableCols.has(f)) updateRow[f] = body[f];
      }

      log(`[search-profiles] Updating profile=${profileId} for user=${user.id}, fields=${JSON.stringify(Object.keys(updateRow))}`);

      const { error } = await supabase
        .from("search_profiles")
        .update(updateRow)
        .eq("id", profileId)
        .eq("user_id", user.id);

      if (error) {
        log(`[search-profiles] Full update failed: code=${(error as any).code} msg=${error.message}`);
        const coreRow: Record<string, unknown> = {};
        for (const f of coreFields) {
          if (f in body) coreRow[f] = body[f];
        }
        const { error: coreErr } = await supabase
          .from("search_profiles")
          .update(coreRow)
          .eq("id", profileId)
          .eq("user_id", user.id);

        if (coreErr) {
          log(`[search-profiles] Core update also failed: ${coreErr.message}`);
          return res.status(500).json({ error: coreErr.message });
        }
        log(`[search-profiles] Core-only update succeeded for profile=${profileId}`);
        _searchProfileColumns = null;
        return res.json({ success: true, partial: true });
      }

      log(`[search-profiles] Update succeeded for profile=${profileId}`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/search-profiles/backfill", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { searchProfileId } = req.body;
      if (!searchProfileId) return res.status(400).json({ error: "searchProfileId is required" });

      const { data: profile } = await supabase
        .from("search_profiles")
        .select("user_id")
        .eq("id", searchProfileId)
        .single();

      if (!profile || profile.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const matchCount = await backfillMatchesForSearchProfile(searchProfileId);
      if (matchCount > 0) {
        await flushUserAlerts(user.id, supabase);
      }
      return res.json({ matches: matchCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/boost", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileDataPromise = pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1", [user.id])
        .then(r => ({ data: r.rows[0] ?? null }))
        .catch(() => ({ data: null }));

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const notif = notifResult.data ?? { email_enabled: true, phone_e164: null };
      const profileData = profileDataResult.data;
      const searchProfiles = searchProfilesResult.data ?? [];

      const { resolveCompletionStates, calculateBoostScore } = await import("./boost");
      const states = resolveCompletionStates(notif, profileData, searchProfiles, user.email ?? null);
      const result = calculateBoostScore(states);

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profile-strength", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileDataPromise = pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1", [user.id])
        .then(r => ({ data: r.rows[0] ?? null }))
        .catch(() => ({ data: null }));

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const rawNotif = notifResult.data;
      const notif = rawNotif ?? { email_enabled: true, phone_e164: null };
      const profileData = profileDataResult.data;
      const searchProfiles = searchProfilesResult.data ?? [];

      const hasAlertChannel = !!(notif.email_enabled);
      const hasSearchBuddy = !!(profileData?.search_buddy_email && profileData.search_buddy_email.trim().length > 0);

      const hasStrongProfile = searchProfiles.some(p => {
        let filters = 0;
        if (p.price_min > 0 || p.price_max > 0) filters++;
        if (p.bedrooms_min > 0) filters++;
        if (p.size_min > 0) filters++;
        return filters >= 2;
      });
      const hasOptimizedSearch = searchProfiles.length >= 2 || hasStrongProfile;

      const hasApplicationTemplate = !!(profileData?.application_template && profileData.application_template.trim().length > 20);

      const checklist = (profileData?.document_checklist ?? {}) as Record<string, boolean>;
      const checklistValues = Object.values(checklist);
      const checklistDone = checklistValues.filter(Boolean).length;
      const REQUIRED_DOC_COUNT = 6;
      const hasDocuments = checklistDone >= REQUIRED_DOC_COUNT;

      const profilePhone = profileData?.phone;
      const hasPhone = !!(
        (notif.phone_e164 && notif.phone_e164.length > 5) ||
        (profilePhone && typeof profilePhone === "string" && profilePhone.length > 6)
      );

      const hasNetworkDone = !!(profileData?.network_task_done);
      const hasViewingTipsDone = !!(profileData?.viewing_tips_done);
      const hasMultipleProfiles = searchProfiles.length >= 2;

      const accountTasks = [
        { id: "alerts", completed: hasAlertChannel, score: 20 },
        { id: "search_buddy", completed: hasSearchBuddy, score: 10 },
        { id: "search_optimize", completed: hasOptimizedSearch, score: 20 },
        { id: "application_template", completed: hasApplicationTemplate, score: 15 },
        { id: "documents", completed: hasDocuments, score: 20 },
        { id: "phone", completed: hasPhone, score: 15 },
      ];

      const hasSearchProfile = searchProfiles.length >= 1;

      const prepTasks = [
        { id: "prep_search_profile", completed: hasSearchProfile, score: 15 },
        { id: "prep_letter", completed: hasApplicationTemplate, score: 10 },
        { id: "prep_extra_profile", completed: hasMultipleProfiles, score: 15 },
        { id: "prep_network", completed: hasNetworkDone, score: 5 },
        { id: "prep_viewing_tips", completed: hasViewingTipsDone, score: 5 },
      ];

      const allTasks = [...accountTasks, ...prepTasks];
      const score = allTasks.filter(t => t.completed).reduce((sum, t) => sum + t.score, 0);
      const completedCount = accountTasks.filter(t => t.completed).length;
      const prepCompletedCount = prepTasks.filter(t => t.completed).length;

      const channels = {
        email: !!(notif.email_enabled),
        push: false,
      };

      const speedSteps = [
        { id: "alerts_active", done: hasAlertChannel },
        { id: "letter_ready", done: hasApplicationTemplate },
        { id: "documents_ready", done: hasDocuments },
        { id: "phone_added", done: hasPhone },
      ];

      const speedDone = speedSteps.filter(s => s.done).length;

      const recommendedChannel = notif.email_enabled ? "email" : null;

      return res.json({
        score,
        tasks: accountTasks,
        completedCount,
        totalCount: accountTasks.length,
        prepTasks,
        prepCompletedCount,
        prepTotalCount: prepTasks.length,
        maxScore: allTasks.reduce((s, t) => s + t.score, 0),
        channels,
        speedSteps,
        speedDone,
        speedTotal: speedSteps.length,
        recommendedChannel,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profile-data", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      log(`[profile-data] GET request userId=${user.id.substring(0, 8)}... email=${user.email}`);

      let { rows } = await pgPool.query(
        "SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1",
        [user.id]
      );

      log(`[profile-data] GET pgRow exists=${rows.length > 0} userId=${user.id.substring(0, 8)}...`);

      if (rows.length === 0) {
        const meta = user.user_metadata || {};
        let firstName = meta.first_name || null;
        let lastName = meta.last_name || null;
        if (!firstName && meta.full_name) {
          const parts = (meta.full_name as string).trim().split(/\s+/);
          firstName = parts[0] || null;
          lastName = parts.slice(1).join(" ") || null;
        }
        if (!firstName) firstName = user.email?.split("@")[0] || null;
        const detectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
        try {
          const { rows: created } = await pgPool.query(
            `INSERT INTO user_profile_data (user_id, first_name, last_name, language, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               first_name = COALESCE(user_profile_data.first_name, EXCLUDED.first_name),
               last_name = COALESCE(user_profile_data.last_name, EXCLUDED.last_name),
               language = COALESCE(user_profile_data.language, EXCLUDED.language),
               updated_at = NOW()
             RETURNING *`,
            [user.id, firstName, lastName, detectedLang]
          );
          log(`[profile-data] Auto-created profile row for user=${user.id.substring(0, 8)}... name="${firstName} ${lastName}"`);
          rows = created;
        } catch (bootstrapErr: any) {
          log(`[profile-data] Auto-create failed for user=${user.id.substring(0, 8)}...: ${bootstrapErr.message}`);
        }
      }

      const row = rows[0];
      if (row && !row.language) {
        const detected = detectLanguageFromHeader(req.headers["accept-language"]);
        log(`[LANG AUTO-DETECT] userId=${user.id.substring(0, 8)}... language was NULL, detected="${detected}" from accept-language="${(req.headers["accept-language"] || "").substring(0, 60)}"`);
        pgPool.query(
          "UPDATE user_profile_data SET language = $1, updated_at = NOW() WHERE user_id = $2 AND (language IS NULL OR language = '')",
          [detected, user.id]
        ).then(() => {
          log(`[LANG FIRST SAVE] userId=${user.id.substring(0, 8)}... backfilled language="${detected}" to DB`);
        }).catch((e: any) => {
          log(`[LANG FIRST SAVE] userId=${user.id.substring(0, 8)}... backfill failed: ${e.message}`);
        });
        row.language = detected;
      }

      const defaults = { user_id: user.id, search_buddy_email: null, search_buddy_enabled: false, application_template: null, document_checklist: {} };
      return res.json(row ?? defaults);
    } catch (err: any) {
      console.error("[profile-data] GET error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/profile-data", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      log(`[profile-data] PUT request userId=${user.id.substring(0, 8)}... email=${user.email} fields=${JSON.stringify(Object.keys(req.body))}`);

      const ALLOWED_FIELDS = [
        "search_buddy_email", "search_buddy_enabled", "application_template", "document_checklist",
        "network_task_done", "viewing_tips_done",
        "first_name", "last_name", "birth_date", "phone", "bio",
        "profile_photo_url", "occupation", "monthly_income", "language",
      ];

      const updates: Record<string, any> = {};
      for (const f of ALLOWED_FIELDS) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }

      if (updates.language !== undefined) {
        const validLangs = ["de", "en", "nl"];
        if (!validLangs.includes(updates.language)) {
          console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... REJECTED invalid language="${updates.language}"`);
          delete updates.language;
        } else {
          console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... saving language="${updates.language}"`);
        }
      }

      let oldBuddyEmail: string | null = null;
      if (updates.search_buddy_email !== undefined) {
        try {
          const { rows: oldRows } = await pgPool.query(
            "SELECT search_buddy_email FROM user_profile_data WHERE user_id = $1 LIMIT 1",
            [user.id]
          );
          oldBuddyEmail = oldRows[0]?.search_buddy_email?.trim() || null;
        } catch {}

        const buddyEmail = typeof updates.search_buddy_email === "string" ? updates.search_buddy_email.trim() : "";
        if (buddyEmail) {
          if (updates.search_buddy_enabled === undefined) {
            updates.search_buddy_enabled = true;
            console.log(`[profile-data] Buddy auto-enabled for user ${user.id.substring(0, 8)}... (first email entry: ${buddyEmail})`);
          }
        } else {
          updates.search_buddy_email = null;
          updates.search_buddy_enabled = false;
          console.log(`[profile-data] Buddy auto-disabled for user ${user.id.substring(0, 8)}... (email removed)`);
        }
      }
      if (updates.search_buddy_enabled !== undefined && updates.search_buddy_email === undefined) {
        console.log(`[profile-data] Buddy toggle changed for user ${user.id.substring(0, 8)}...: search_buddy_enabled=${updates.search_buddy_enabled}`);
      }

      if (Object.keys(updates).length === 0) {
        const { rows } = await pgPool.query(
          "SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1",
          [user.id]
        );
        return res.json(rows[0] ?? { user_id: user.id });
      }

      updates.updated_at = new Date().toISOString();
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
      const insertFields = ["user_id", ...fields];
      const insertPlaceholders = insertFields.map((_, i) => `$${i + 1}`).join(", ");
      const insertValues = [user.id, ...values];

      const query = `
        INSERT INTO user_profile_data (${insertFields.join(", ")})
        VALUES (${insertPlaceholders})
        ON CONFLICT (user_id) DO UPDATE SET ${setClauses}
        RETURNING *
      `;

      const { rows, rowCount } = await pgPool.query(query, insertValues);
      log(`[profile-data] PUT write userId=${user.id.substring(0, 8)}... rowCount=${rowCount} returned=${rows.length > 0} fields=${JSON.stringify(fields)}`);

      if (rows.length === 0) {
        log(`[profile-data] PUT FAILED - no rows returned for userId=${user.id.substring(0, 8)}... query was: ${query.substring(0, 200)}`);
        return res.status(500).json({ error: "Profile save failed - no rows affected" });
      }

      if (updates.language !== undefined) {
        console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... CONFIRMED saved language="${rows[0]?.language}" in DB`);
      }

      if (updates.search_buddy_email !== undefined) {
        const newBuddyEmail = rows[0]?.search_buddy_email?.trim() || null;
        if (newBuddyEmail && newBuddyEmail.toLowerCase() !== (oldBuddyEmail || "").toLowerCase()) {
          const inviterName = rows[0]?.first_name || user.email?.split("@")[0] || "Someone";
          const userLang = rows[0]?.language || "nl";
          import("./email").then(({ sendBuddyInvitationEmail }) => {
            sendBuddyInvitationEmail(newBuddyEmail, inviterName, userLang as any).catch(err => {
              console.error(`[profile-data] Buddy invite email failed: ${err.message}`);
            });
          }).catch(() => {});
          console.log(`[profile-data] Buddy invite email queued for ${newBuddyEmail} (inviter: ${inviterName}, lang: ${userLang})`);
        }
      }

      if (updates.phone !== undefined) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        const phoneVal = updates.phone && typeof updates.phone === "string" && e164Regex.test(updates.phone)
          ? updates.phone : null;
        supabase
          .from("user_notification_settings")
          .upsert(
            { user_id: user.id, phone_e164: phoneVal, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          )
          .then(({ error: syncErr }) => {
            if (syncErr) console.error("[profile-data] Phone sync to notification_settings failed:", syncErr.message);
          });
      }

      log(`[profile-data] PUT success userId=${user.id.substring(0, 8)}... saved fields: ${JSON.stringify(Object.fromEntries(fields.filter(f => f !== 'updated_at').map(f => [f, rows[0]?.[f]])))}`);
      return res.json(rows[0]);
    } catch (err: any) {
      log(`[profile-data] PUT ERROR: ${err.message}\n${err.stack}`);
      return res.status(500).json({ error: "Profile save failed. Please try again." });
    }
  });

  app.post("/api/profile-photo", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "No image provided" });

      const matches = image.match(/^data:(image\/[\w+-]+);base64,(.+)$/s);
      if (!matches) return res.status(400).json({ error: "Invalid image format" });

      const contentType = matches[1];
      const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
      const buffer = Buffer.from(matches[2], "base64");

      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Image too large (max 5MB)" });
      }

      const filePath = `profile-photos/${user.id}.${ext}`;

      const extensions = ["jpg", "png", "webp"];
      const oldPaths = extensions.filter(e => e !== ext).map(e => `profile-photos/${user.id}.${e}`);
      await supabase.storage.from("avatars").remove(oldPaths).catch(() => {});
      await supabase.storage.from("avatars").remove([filePath]).catch(() => {});

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error("[profile-photo] Upload error:", uploadError.message);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;

      await pgPool.query(
        `INSERT INTO user_profile_data (user_id, profile_photo_url, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = $2, updated_at = $3`,
        [user.id, photoUrl, new Date().toISOString()]
      );

      return res.json({ profile_photo_url: photoUrl });
    } catch (err: any) {
      console.error("[profile-photo] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/profile-photo", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const extensions = ["jpg", "png", "webp", "gif"];
      const filePaths = extensions.map(ext => `profile-photos/${user.id}.${ext}`);
      await supabase.storage.from("avatars").remove(filePaths);

      await pgPool.query(
        `INSERT INTO user_profile_data (user_id, profile_photo_url, updated_at) VALUES ($1, NULL, $2)
         ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = NULL, updated_at = $2`,
        [user.id, new Date().toISOString()]
      );

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/account", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const subStatus = await getSubscriptionStatus(user.id);
      if (subStatus.status === "active" && !subStatus.isTrial) {
        return res.status(400).json({
          error: "active_subscription",
          message: "Du hast ein aktives Abonnement. Bitte kündige dieses zuerst, bevor du dein Konto löschst.",
        });
      }

      await supabase.from("matches").delete().eq("user_id", user.id);
      await supabase.from("search_profiles").delete().eq("user_id", user.id);
      await supabase.from("subscriptions").delete().eq("user_id", user.id);
      await supabase.from("user_notification_settings").delete().eq("user_id", user.id);
      await pgPool.query("DELETE FROM user_profile_data WHERE user_id = $1", [user.id]);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        log(`[account-delete] Failed to delete auth user ${user.id}: ${deleteError.message}`);
        return res.status(500).json({ error: "Kontodaten gelöscht, aber Authentifizierung konnte nicht entfernt werden. Bitte kontaktiere den Support." });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[account-delete] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  async function getVisibleMatchListingIds(userId: string): Promise<{ validIds: Set<string>; premiumStartedAt: string | null }> {
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("created_at")
      .eq("user_id", userId)
      .single();
    const premiumStartedAt = subRow?.created_at || null;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff = premiumStartedAt
      ? (new Date(premiumStartedAt).getTime() > new Date(ninetyDaysAgo).getTime() ? premiumStartedAt : ninetyDaysAgo)
      : ninetyDaysAgo;

    let dashMatchQuery = supabase
      .from("matches")
      .select("id, listing_id, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoff);
    const { data: matchRows } = await dashMatchQuery;

    if (!matchRows || matchRows.length === 0) {
      return { validIds: new Set(), premiumStartedAt };
    }

    const enriched = matchRows.map((m: any) => ({
      ...m,
      matched_at: m.created_at,
    }));
    enriched.sort((a: any, b: any) =>
      new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
    );

    const dedupedByListing: Record<string, any> = {};
    for (const m of enriched) {
      if (!dedupedByListing[m.listing_id]) {
        dedupedByListing[m.listing_id] = m;
      }
    }
    let uniqueMatches = Object.values(dedupedByListing);

    const listingIds = uniqueMatches.map((m: any) => m.listing_id);
    if (listingIds.length === 0) {
      return { validIds: new Set(), premiumStartedAt };
    }

    const existingListings = await batchedIn<any>(
      "listings", "id", listingIds, "id",
      (q: any) => q.not("title", "is", null)
    );

    const validIds = new Set(existingListings.map((l: any) => l.id));
    return { validIds, premiumStartedAt };
  }

  app.get("/api/profile-stats", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const subStatus = await getSubscriptionStatus(user.id);
      const hasActiveOrTrial = subStatus.status === "active" || subStatus.status === "trial";

      if (!hasActiveOrTrial) {
        return res.json({ matches_received: 0, reactions_sent: 0 });
      }

      const stats = await getUserMatchStats(user.id);
      return res.json({
        matches_received: stats?.total ?? 0,
        reactions_sent: stats?.applied ?? 0,
      });
    } catch (err: any) {
      return res.json({ matches_received: 0, reactions_sent: 0 });
    }
  });

  app.get("/api/referrals/me", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows: profileRows } = await pgPool.query(
        "SELECT first_name FROM user_profile_data WHERE user_id = $1",
        [user.id]
      );
      const firstName = profileRows[0]?.first_name || null;

      const summary = await getReferralSummary(pgPool, user.id, firstName);
      return res.json(summary);
    } catch (err: any) {
      log(`[referrals] GET /me error: ${err.message}`, "referral");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/referrals/apply", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "missing_code" });
      }

      const result = await applyReferralCode(pgPool, user.id, code);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true });
    } catch (err: any) {
      log(`[referrals] POST /apply error: ${err.message}`, "referral");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/referrals/validate", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ valid: false, error: "missing_code" });
      }

      const result = await validateReferralCode(pgPool, code, user.id);
      return res.json({ valid: result.valid, error: result.error || null });
    } catch (err: any) {
      log(`[referrals] POST /validate error: ${err.message}`, "referral");
      return res.status(500).json({ valid: false, error: "Internal error" });
    }
  });

  app.patch("/api/matches/:matchListingId/viewed", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      await markViewed(user.id, [matchListingId]);
      return res.json({ listing_id: matchListingId, viewed: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/matches/:matchListingId/saved", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      const { saved } = req.body;
      if (typeof saved !== "boolean") return res.status(400).json({ error: "saved must be a boolean" });

      const updated = await markSaved(user.id, matchListingId, saved);
      if (!updated) return res.status(404).json({ error: "Match not found in canonical records" });
      return res.json({ listing_id: matchListingId, saved });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/backfill-images", async (req, res) => {
    try {
      const cheerio = await import("cheerio");
      const UA = "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.com)";

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, source, url")
        .is("image_url", null)
        .limit(50);

      if (error) return res.status(500).json({ error: error.message });
      if (!listings || listings.length === 0) return res.json({ updated: 0, message: "No listings need backfill" });

      let updated = 0;
      let failed = 0;

      for (const listing of listings) {
        try {
          await new Promise(r => setTimeout(r, 800));
          const resp = await fetch(listing.url, {
            headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" },
            redirect: "follow",
          });
          if (!resp.ok) { failed++; continue; }
          const html = await resp.text();
          const $ = cheerio.load(html);

          let imageUrl: string | null = null;
          if (listing.source === "kleinanzeigen") {
            const img = $("#viewad-image img, .galleryimage-element img, img[src*='img.kleinanzeigen.de']").first();
            imageUrl = img.attr("src") || null;
            if (!imageUrl) {
              const meta = $("meta[property='og:image']").attr("content") || null;
              if (meta && meta.startsWith("http")) imageUrl = meta;
            }
          } else if (listing.source === "wohnungsboerse") {
            const img = $("img[src*='wohnungsboerse.net/assets']").first();
            imageUrl = img.attr("src") || null;
            if (!imageUrl) {
              const meta = $("meta[property='og:image']").attr("content") || null;
              if (meta && meta.startsWith("http")) imageUrl = meta;
            }
          } else if (listing.source === "wg-gesucht") {
            const img = $("img.sp-gallery__image, img[src*='img.wg-gesucht.de']").first();
            imageUrl = img.attr("src") || null;
            if (!imageUrl) {
              const meta = $("meta[property='og:image']").attr("content") || null;
              if (meta && meta.startsWith("http")) imageUrl = meta;
            }
          } else {
            const meta = $("meta[property='og:image']").attr("content") || null;
            if (meta && meta.startsWith("http")) imageUrl = meta;
          }

          if (imageUrl) {
            await supabase.from("listings").update({ image_url: imageUrl }).eq("id", listing.id);
            updated++;
            log(`Backfilled image for ${listing.source} listing ${listing.id}`);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      return res.json({ updated, failed, total: listings.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ingest/run", async (req, res) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.INGEST_BEARER_TOKEN;
    if (!expectedToken || !authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const report = await runAllIngesters();
      return res.json(report);
    } catch (err: any) {
      if (err instanceof OverlapError) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onboarding-drafts", async (req, res) => {
    try {
      const {
        country_code, city_name, latitude, longitude, place_id,
        location_mode, districts, radius_km,
        commute_destination, commute_lat, commute_lng, commute_mode, commute_minutes,
        price_min, price_max, property_type,
      } = req.body;

      if (!city_name || typeof city_name !== "string" || city_name.trim() === "") {
        return res.status(400).json({ error: "city_name is required" });
      }

      const row: Record<string, unknown> = {
        country_code: country_code || "DE",
        city_name: city_name.trim(),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        place_id: place_id ?? null,
        location_mode: location_mode || "city",
        price_min: parseInt(price_min) || 0,
        price_max: parseInt(price_max) || 0,
        property_type: property_type || null,
      };

      if (districts && Array.isArray(districts) && districts.length > 0) row.districts = districts;
      if (radius_km != null) row.radius_km = parseInt(radius_km);
      if (commute_destination) row.commute_destination = commute_destination;
      if (commute_lat != null) row.commute_lat = parseFloat(commute_lat);
      if (commute_lng != null) row.commute_lng = parseFloat(commute_lng);
      if (commute_mode) row.commute_mode = commute_mode;
      if (commute_minutes != null) row.commute_minutes = parseInt(commute_minutes);

      const { data, error } = await supabase
        .from("onboarding_drafts")
        .insert(row)
        .select("id")
        .single();

      if (error) {
        log(`[onboarding-draft] Insert error: ${error.message}`);
        return res.status(500).json({ error: "Failed to save draft" });
      }

      return res.json({ id: data.id });
    } catch (err: any) {
      log(`[onboarding-draft] Error: ${err.message}`);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/onboarding-drafts/:id/claim", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_id } = req.body;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id) || !user_id || !uuidRegex.test(user_id)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      const { data: check, error: checkErr } = await supabase
        .from("onboarding_drafts")
        .select("claimed_by")
        .eq("id", id)
        .single();

      if (checkErr || !check) {
        return res.status(404).json({ error: "Draft not found" });
      }

      if (check.claimed_by && check.claimed_by !== user_id) {
        return res.status(409).json({ error: "Dieser Suchauftrag wurde bereits von jemand anderem verwendet." });
      }

      const { error: updateErr } = await supabase
        .from("onboarding_drafts")
        .update({ claimed_by: user_id, claimed_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) {
        return res.status(500).json({ error: "Claim failed" });
      }

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/onboarding-drafts/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }

      const { data, error } = await supabase
        .from("onboarding_drafts")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Draft not found" });
      }

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  async function requireAdmin(req: any, res: any, next: any) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      log(`[admin] requireAdmin: no token in Authorization header`);
      return res.status(401).json({ error: "Unauthorized — no token provided" });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      log(`[admin] requireAdmin: auth failed — ${authErr?.message || "no user"}`);
      return res.status(401).json({ error: "Unauthorized — invalid session" });
    }
    if (!isAdminEmail(user.email || "")) {
      log(`[admin] requireAdmin: ${user.email} is not an admin`);
      return res.status(403).json({ error: "Forbidden — not an admin" });
    }

    (req as any).adminUser = user;
    next();
  }

  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const targetEmail = req.body?.email || "martin.essie87@gmail.com";

      log(`[EMAIL TEST] Admin ${adminUser.email} triggering test email to ${targetEmail}`);

      const testListing = {
        title: "Modern apartment in Berlin",
        city: "Berlin",
        price: 1200,
        bedrooms: 2,
        size_m2: 65,
        url: "https://example.com",
        image_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=400&fit=crop",
      };

      const { sendMatchAlert } = await import("./email");
      const { getUserLanguage } = await import("./notifications/buffer");
      const adminLang = await getUserLanguage(adminUser.id);
      const success = await sendMatchAlert(targetEmail, testListing, adminLang);

      if (success) {
        log(`[EMAIL TEST] Test email sent successfully to ${targetEmail} lang=${adminLang}`);
        return res.json({ success: true, sentTo: targetEmail, from: "HousAlert <new@housalert.com>", message: "Test email sent successfully" });
      } else {
        log(`[EMAIL TEST] Test email FAILED to ${targetEmail}`);
        return res.status(500).json({ success: false, sentTo: targetEmail, message: "Email send returned false — check Resend logs" });
      }
    } catch (err: any) {
      log(`[EMAIL TEST] Error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/test-push", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const rawUserId = req.body?.user_id;
      const targetUserId = (typeof rawUserId === "string" && /^[0-9a-f-]{36}$/i.test(rawUserId)) ? rawUserId : adminUser.id;
      log(`[PUSH TEST] Admin ${adminUser.email} triggering test push for user ${targetUserId.substring(0, 8)}...`);

      const webResult = await sendPushToUser(
        targetUserId,
        {
          title: "HousAlert Test",
          body: "Push notificaties werken! 🏠",
          url: "/dashboard",
        },
        supabase
      );

      const expoResult = await sendExpoTestPush(targetUserId);

      const totalSent = webResult.sent + expoResult.sent;

      if (totalSent > 0) {
        log(`[PUSH TEST] Test push sent: web=${webResult.sent} expo=${expoResult.sent}`);
        return res.json({ success: true, targetUserId, web: webResult, expo: expoResult });
      } else {
        log(`[PUSH TEST] No push sent (web=${webResult.sent}, expo=${expoResult.sent})`);
        return res.json({
          success: false,
          targetUserId,
          web: webResult,
          expo: expoResult,
          message: "No active push subscriptions or Expo tokens found for this user",
        });
      }
    } catch (err: any) {
      log(`[PUSH TEST] Error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/push-debug", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const rawId = req.query.user_id as string | undefined;
      const targetUserId = (rawId && /^[0-9a-f-]{36}$/i.test(rawId)) ? rawId : adminUser.id;
      const sb = getSupabaseAdmin();

      const { data: userData } = await supabase.auth.admin.getUserById(targetUserId);
      const email = userData?.user?.email || "unknown";

      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("id, expo_push_token, platform, is_active, created_at, updated_at")
        .eq("user_id", targetUserId)
        .order("updated_at", { ascending: false });

      const { data: webSubs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, created_at")
        .eq("user_id", targetUserId);

      const { data: notifSettings } = await supabase
        .from("user_notification_settings")
        .select("email_enabled, push_enabled")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status, plan, trial_end, current_period_end")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const { data: recentLogs } = await sb
        .from("push_delivery_log")
        .select("id, channel, token_snippet, listing_count, title, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      const activeExpoTokens = (tokens || []).filter((t: any) => t.is_active);
      const maskedTokens = (tokens || []).map((t: any) => ({
        ...t,
        expo_push_token: t.expo_push_token ? t.expo_push_token.substring(0, 30) + "..." : null,
      }));

      return res.json({
        user_id: targetUserId,
        email,
        subscription: subRow || null,
        notification_settings: notifSettings || { email_enabled: true, push_enabled: false },
        push_ready: activeExpoTokens.length > 0 && (notifSettings?.push_enabled ?? false),
        expo_tokens: {
          total: (tokens || []).length,
          active: activeExpoTokens.length,
          tokens: maskedTokens,
        },
        web_push_subscriptions: {
          total: (webSubs || []).length,
          subscriptions: (webSubs || []).map((s: any) => ({
            id: s.id,
            endpoint: s.endpoint?.substring(0, 50) + "...",
            created_at: s.created_at,
          })),
        },
        recent_delivery_logs: recentLogs || [],
        diagnosis: {
          has_active_tokens: activeExpoTokens.length > 0,
          push_enabled_in_settings: notifSettings?.push_enabled ?? false,
          has_active_subscription: subRow?.status === "active" || (subRow?.trial_end && new Date(subRow.trial_end) > new Date()),
          can_receive_push: activeExpoTokens.length > 0 && (notifSettings?.push_enabled ?? false),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-push-to-token", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { expo_push_token, title, body, deep_link } = req.body;

      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid expo_push_token — must start with ExponentPushToken[" });
      }

      const pushTitle = title || "HousAlert Test";
      const pushBody = body || "Direct token test push";
      const pushDeepLink = typeof deep_link === "string" && deep_link.startsWith("/") ? deep_link : "/dashboard";

      log(`[PUSH TEST] Admin ${adminUser.email} sending direct push to token ${expo_push_token.substring(0, 30)}...`);

      const { sendWithRetry } = await import("./notifications/expo-push");
      const message = {
        to: expo_push_token,
        sound: "default",
        title: pushTitle,
        body: pushBody,
        data: { url: pushDeepLink, type: "admin_test" },
        priority: "high" as const,
        channelId: "match-alerts",
      };

      const { tickets, error } = await sendWithRetry([message]);

      const ticket = tickets[0];
      const sb = getSupabaseAdmin();
      try {
        await sb.from("push_delivery_log").insert({
          user_id: adminUser.id,
          channel: "expo",
          token_snippet: expo_push_token.substring(0, 30) + "...",
          full_token: expo_push_token,
          listing_ids: [],
          listing_count: 0,
          title: pushTitle,
          body: pushBody,
          status: error ? "api_error" : (ticket?.status === "ok" ? "sent" : "failed"),
          expo_ticket_id: ticket?.id || null,
          error_type: error ? "api_error" : (ticket?.details?.error || null),
          error_message: error || ticket?.message || null,
        });
      } catch {}

      if (error) {
        return res.json({ success: false, error, token: expo_push_token.substring(0, 30) + "..." });
      }

      return res.json({
        success: ticket?.status === "ok",
        ticket,
        payload_sent: {
          title: pushTitle,
          body: pushBody,
          deep_link: pushDeepLink,
          channel: "match-alerts",
        },
        token: expo_push_token.substring(0, 30) + "...",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const DEV_USER_ID = "acb0a5e8-49bc-404e-bdd9-7ed568fdfaed";

    app.get("/api/dev/test-push", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();
        const { data: tokens } = await sb
          .from("expo_push_tokens")
          .select("expo_push_token, platform")
          .eq("user_id", DEV_USER_ID)
          .eq("is_active", true);

        const activeTokens = tokens || [];
        if (activeTokens.length === 0) {
          return res.json({ success: false, tokens_found: 0, tokens_targeted: 0, error: "No active tokens registered" });
        }

        const { sendWithRetry } = await import("./notifications/expo-push");
        const messages = activeTokens.map((t: any) => ({
          to: t.expo_push_token,
          sound: "default",
          title: "HousAlert Dev Test",
          body: `Push test @ ${new Date().toLocaleTimeString("nl-NL")}`,
          data: { url: "/dashboard", type: "dev_test" },
          priority: "high" as const,
          channelId: "match-alerts",
        }));

        const { tickets, error } = await sendWithRetry(messages);
        const ticketIds = (tickets || []).filter((t: any) => t?.id).map((t: any) => t.id);

        return res.json({
          success: !error && tickets.every((t: any) => t?.status === "ok"),
          tokens_found: activeTokens.length,
          tokens_targeted: messages.length,
          push_ticket_ids: ticketIds.length > 0 ? ticketIds : null,
          tickets,
          error: error || null,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    app.get("/api/dev/push-debug", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();

        const { data: tokens } = await sb
          .from("expo_push_tokens")
          .select("expo_push_token, platform, is_active, updated_at")
          .eq("user_id", DEV_USER_ID)
          .eq("is_active", true);

        const activeTokens = tokens || [];
        const masked = activeTokens.map((t: any) => ({
          token: t.expo_push_token.substring(0, 25) + "...]",
          platform: t.platform,
          updated_at: t.updated_at,
        }));

        const { data: logs } = await sb
          .from("push_delivery_log")
          .select("id, channel, token_snippet, title, body, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
          .eq("user_id", DEV_USER_ID)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: settings } = await sb
          .from("notification_settings")
          .select("push_enabled, email_enabled")
          .eq("user_id", DEV_USER_ID)
          .maybeSingle();

        return res.json({
          active_token_count: activeTokens.length,
          masked_tokens: masked,
          push_enabled: settings?.push_enabled ?? null,
          email_enabled: settings?.email_enabled ?? null,
          recent_delivery_logs: logs || [],
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/dev/expo-push-tokens-count", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();
        const { count: total } = await sb.from("expo_push_tokens").select("*", { count: "exact", head: true });
        const { count: active } = await sb.from("expo_push_tokens").select("*", { count: "exact", head: true }).eq("is_active", true);
        const { data: allTokens } = await sb.from("expo_push_tokens").select("user_id, expo_push_token, platform, is_active, updated_at").order("updated_at", { ascending: false }).limit(20);
        const masked = (allTokens || []).map((t: any) => ({
          user_id: t.user_id.substring(0, 8) + "...",
          token: t.expo_push_token.substring(0, 25) + "...]",
          platform: t.platform,
          is_active: t.is_active,
          updated_at: t.updated_at,
        }));
        return res.json({ total, active, tokens: masked });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/dev/test-email-send", async (req, res) => {
      try {
        const targetEmail = req.body?.email || "martin.essie87@gmail.com";
        log(`[DEV EMAIL TEST] Sending test email to ${targetEmail}`);

        const { sendMatchAlert } = await import("./email");
        const testListing = {
          title: "Modern apartment in Berlin",
          city: "Berlin",
          price: 1200,
          bedrooms: 2,
          size_m2: 65,
          url: "https://example.com",
          image_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=400&fit=crop",
        };

        const success = await sendMatchAlert(targetEmail, testListing, "de");
        return res.json({ success, sentTo: targetEmail, from: "HousAlert <new@housalert.com>" });
      } catch (err: any) {
        log(`[DEV EMAIL TEST] Error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post("/api/dev/referral-seed", async (req, res) => {
      try {
        const { userId, pending = 1, qualified = 1, rewarded = 1 } = req.body || {};
        if (!userId) return res.status(400).json({ error: "userId required" });

        const code = await ensureUserHasReferralCode(pgPool, userId);

        const statuses = [
          ...Array(Number(pending)).fill("pending"),
          ...Array(Number(qualified)).fill("qualified"),
          ...Array(Number(rewarded)).fill("rewarded"),
        ];

        let seeded = 0;
        for (const status of statuses) {
          const fakeId = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`.slice(0, 36);
          try {
            await pgPool.query(
              `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, created_at, updated_at, qualified_at, rewarded_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)`,
              [
                userId,
                fakeId,
                code,
                status,
                status === "qualified" || status === "rewarded" ? new Date() : null,
                status === "rewarded" ? new Date() : null,
              ]
            );
            seeded++;
          } catch (err: any) {
            log(`[DEV REFERRAL SEED] Insert skipped: ${err.message}`);
          }
        }

        return res.json({ success: true, code, seeded, total: statuses.length });
      } catch (err: any) {
        log(`[DEV REFERRAL SEED] Error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    });

    log("[DEV] Registered /api/dev/test-push, /api/dev/push-debug, /api/dev/expo-push-tokens-count, /api/dev/test-email-send, /api/dev/referral-seed (no auth, dev only)");
  }

  app.get("/api/admin/push-delivery-log", requireAdmin, async (req, res) => {
    try {
      const userId = req.query.user_id as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
      const sb = getSupabaseAdmin();

      let q = sb
        .from("push_delivery_log")
        .select("id, user_id, channel, token_snippet, listing_count, title, body, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (userId) q = q.eq("user_id", userId);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      return res.json({ count: data?.length || 0, logs: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/push-tokens", requireAdmin, async (req, res) => {
    try {
      const userId = req.query.user_id as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
      const sb = getSupabaseAdmin();

      let q = sb
        .from("expo_push_tokens")
        .select("id, user_id, expo_push_token, platform, is_active, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (userId) q = q.eq("user_id", userId);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      const masked = (data || []).map((t: any) => ({
        ...t,
        expo_push_token: t.expo_push_token
          ? t.expo_push_token.substring(0, 25) + "...]"
          : null,
      }));
      return res.json({ count: masked.length, tokens: masked });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/debug/match-alignment", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const targetUserId = (req.query.user_id as string) || adminUser.id;

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("created_at, status")
        .eq("user_id", targetUserId)
        .single();
      const premiumStartedAt = subRow?.created_at || null;

      let debugMatchQuery = supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", targetUserId);
      if (premiumStartedAt) {
        debugMatchQuery = debugMatchQuery.gte("created_at", premiumStartedAt);
      }
      const { data: matchRows } = await debugMatchQuery;

      if (!matchRows || matchRows.length === 0) {
        return res.json({
          user_id: targetUserId,
          subscription: { status: subRow?.status || null, created_at: premiumStartedAt },
          total_match_rows: 0,
          unique_after_dedup: 0,
          after_premium_filter: 0,
          app_visible_count: 0,
          recent_emailed_count: 0,
          mismatch_count: 0,
          emailed_at: null,
          app_visible: [],
          recent_emailed: [],
          emailed_but_not_visible: [],
        });
      }

      const enriched = matchRows.map((m: any) => ({
        ...m,
        matched_at: m.created_at,
      }));
      enriched.sort((a: any, b: any) =>
        new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
      );

      const dedupedByListing: Record<string, any> = {};
      for (const m of enriched) {
        if (!dedupedByListing[m.listing_id]) {
          dedupedByListing[m.listing_id] = m;
        }
      }
      let uniqueMatches = Object.values(dedupedByListing);
      const prePremiumCount = uniqueMatches.length;

      if (premiumStartedAt) {
        const premiumStart = new Date(premiumStartedAt).getTime();
        uniqueMatches = uniqueMatches.filter((m: any) =>
          new Date(m.matched_at).getTime() >= premiumStart
        );
      }

      const allListingIds = uniqueMatches.map((m: any) => m.listing_id);

      const recentEmailed = getRecentEmailedIds(targetUserId);
      const emailedIdList = recentEmailed?.listing_ids || [];

      const allIdsToFetch = [...new Set([...allListingIds, ...emailedIdList])];

      let fullListingMap: Record<string, any> = {};
      if (allIdsToFetch.length > 0) {
        const allListings = await batchedIn<any>(
          "listings", "id", allIdsToFetch,
          "id, title, city, price, source, url"
        );
        for (const l of allListings) fullListingMap[l.id] = l;
      }

      const appVisibleIds = new Set(
        allListingIds.filter(id => fullListingMap[id] && fullListingMap[id].title)
      );

      const emailedSet = new Set(emailedIdList);

      function buildEntry(listingId: string, matchRow: any) {
        const l = fullListingMap[listingId];
        return {
          listing_id: listingId,
          title: l?.title || null,
          city: l?.city || null,
          price: l?.price || null,
          source: l?.source || null,
          url: l?.url || null,
          matched_at: matchRow?.matched_at || null,
          search_profile_id: matchRow?.search_profile_id || null,
        };
      }

      const appVisible = [...appVisibleIds].slice(0, 30).map(id =>
        buildEntry(id, dedupedByListing[id])
      );

      const recentEmailedEntries = emailedIdList.slice(0, 30).map(id =>
        buildEntry(id, dedupedByListing[id])
      );

      const emailedButNotVisible = emailedIdList
        .filter(id => !appVisibleIds.has(id))
        .slice(0, 20)
        .map(id => {
          const matchRow = dedupedByListing[id];
          const l = fullListingMap[id];
          let reason = "unknown";
          if (!l) reason = "listing_deleted";
          else if (!l.title) reason = "null_title";
          else if (!matchRow) reason = "no_match_after_dedup";
          else if (premiumStartedAt && new Date(matchRow.matched_at).getTime() < new Date(premiumStartedAt).getTime())
            reason = "before_premium_start";
          return { ...buildEntry(id, matchRow), exclusion_reason: reason };
        });

      return res.json({
        user_id: targetUserId,
        subscription: { status: subRow?.status || null, created_at: premiumStartedAt },
        total_match_rows: matchRows.length,
        unique_after_dedup: prePremiumCount,
        after_premium_filter: uniqueMatches.length,
        app_visible_count: appVisibleIds.size,
        recent_emailed_count: emailedIdList.length,
        emailed_at: recentEmailed?.timestamp ? new Date(recentEmailed.timestamp).toISOString() : null,
        mismatch_count: emailedButNotVisible.length,
        app_visible: appVisible,
        recent_emailed: recentEmailedEntries,
        emailed_but_not_visible: emailedButNotVisible,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/summary", requireAdmin, async (_req, res) => {
    try {
      const runs = await getRecentRuns(20);
      const status = getLastRunStatus();
      const nextRun = getNextRun();
      res.json({
        running: status.running,
        lastRunAt: status.lastRunAt,
        lastSuccessfulRunAt: status.lastSuccessfulRunAt,
        lastError: status.lastError,
        nextRunAt: nextRun.nextRunAt,
        intervalMinutes: nextRun.intervalMinutes,
        todayFetched: status.todayFetched,
        todayInserted: status.todayInserted,
        runs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/cities", requireAdmin, async (_req, res) => {
    try {
      const cities = await getLatestRunCities();
      res.json({ cities });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/sources", requireAdmin, async (_req, res) => {
    try {
      const sources = await getSourceAggregates();
      const statuses = getSourceStatuses();
      res.json({ sources, statuses });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/run/:id", requireAdmin, async (req, res) => {
    try {
      const run = await getRunDetail(parseInt(req.params.id, 10));
      if (!run) return res.status(404).json({ error: "Run not found" });
      res.json(run);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/listing-status", requireAdmin, async (_req, res) => {
    try {
      const { getStatusSummary } = await import("./listing-status");
      const summary = await getStatusSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/listing-status/refresh", requireAdmin, async (_req, res) => {
    try {
      const { updateStalenessStatuses } = await import("./listing-status");
      const result = await updateStalenessStatuses();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/listing-status/:listingId", requireAdmin, async (req, res) => {
    try {
      const { getListingStatus } = await import("./listing-status");
      const status = await getListingStatus(req.params.listingId);
      res.json({ listing_id: req.params.listingId, status: status ?? "unknown" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/match-audit", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const { data: profiles } = await supabase
        .from("search_profiles")
        .select("id, city, city_name, price_min, price_max, bedrooms_min, size_min")
        .eq("user_id", userId);

      const stats = await getUserMatchStats(userId);
      const recentMatches = await getRecentUserMatches(userId, 100);
      const fetchRuns = await getRecentFetchRuns(20);

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status, plan, created_at, current_period_end, trial_end")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: userData } = await supabase.auth.admin.getUserById(userId);

      const { data: notifSettings } = await supabase
        .from("user_notification_settings")
        .select("email_enabled, push_enabled, whatsapp_enabled, sms_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      let lastEmailSentAt: string | null = null;
      let lastPushSentAt: string | null = null;
      if (recentMatches.length > 0) {
        const emailSent = recentMatches.filter(m => m.email_sent && m.email_sent_at);
        if (emailSent.length > 0) {
          lastEmailSentAt = emailSent.sort((a, b) =>
            new Date(b.email_sent_at!).getTime() - new Date(a.email_sent_at!).getTime()
          )[0].email_sent_at;
        }
        const pushSent = recentMatches.filter(m => m.push_sent && m.push_sent_at);
        if (pushSent.length > 0) {
          lastPushSentAt = pushSent.sort((a, b) =>
            new Date(b.push_sent_at!).getTime() - new Date(a.push_sent_at!).getTime()
          )[0].push_sent_at;
        }
      }

      const lastFetchRun = fetchRuns.length > 0 ? fetchRuns[0] : null;

      res.json({
        account: {
          user_id: userId,
          email: userData?.user?.email || "unknown",
          created_at: userData?.user?.created_at,
        },
        subscription: subRow || null,
        notification_settings: notifSettings || { email_enabled: true, push_enabled: false },
        search_profiles: {
          count: profiles?.length || 0,
          profiles: profiles || [],
        },
        stats: stats || { total: 0, new_count: 0, viewed: 0, saved: 0, applied: 0, email_sent: 0, push_sent: 0 },
        timing: {
          last_fetch_run_at: lastFetchRun?.started_at || null,
          last_email_sent_at: lastEmailSentAt,
          last_push_sent_at: lastPushSentAt,
        },
        recent_matches: recentMatches.slice(0, 50),
        fetch_runs: fetchRuns.slice(0, 10),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/match-audit/backfill", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_id, listing_id, search_profile_id, created_at")
        .eq("user_id", userId)
        .gte("created_at", ninetyDaysAgo);

      if (!matchRows || matchRows.length === 0) {
        return res.json({ backfilled: 0, message: "No matches to backfill" });
      }

      const listingIds = [...new Set(matchRows.map(m => m.listing_id))];
      const listingsData = await batchedIn<any>(
        "listings", "id", listingIds,
        "id, title, city, price, source, url, source_id",
        (q: any) => q
      );
      const listingMap: Record<string, any> = {};
      for (const l of listingsData) listingMap[l.id] = l;

      const { data: pushLogs } = await supabase
        .from("push_sent_log")
        .select("listing_id")
        .eq("user_id", userId);
      const pushSentMap: Record<string, Set<string>> = {};
      pushSentMap[userId] = new Set((pushLogs || []).map((r: any) => r.listing_id));

      const count = await backfillFromSupabaseMatches(matchRows, listingMap, pushSentMap);

      res.json({ backfilled: count, total_supabase_matches: matchRows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/match-audit/recalculate", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const stats = await getUserMatchStats(userId);
      res.json({ recalculated: true, stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/debug/email-pipeline", requireAdmin, async (_req, res) => {
    try {
      const { getBufferSize } = await import("./notifications/buffer");
      const { getUndeliveredMatches } = await import("./user-matches");

      const bufSize = getBufferSize();
      const undelivered = await getUndeliveredMatches(24);

      const byUser = new Map<string, { count: number; oldest: string | null }>();
      for (const m of undelivered) {
        const existing = byUser.get(m.user_id);
        if (existing) {
          existing.count++;
          if (m.matched_at && (!existing.oldest || m.matched_at < existing.oldest)) {
            existing.oldest = m.matched_at;
          }
        } else {
          byUser.set(m.user_id, { count: 1, oldest: m.matched_at || null });
        }
      }

      const perUserStats = await pgPool.query(`
        SELECT user_id,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE email_sent) as emailed,
          COUNT(*) FILTER (WHERE push_sent) as pushed,
          COUNT(*) FILTER (WHERE NOT email_sent AND NOT push_sent AND visible_in_app AND NOT dismissed) as pending
        FROM user_matches
        GROUP BY user_id
      `);

      res.json({
        alerts_enabled: process.env.ALERTS_ENABLED === "true",
        buffer: bufSize,
        undelivered_24h: {
          total: undelivered.length,
          users: byUser.size,
          per_user: Object.fromEntries(byUser),
        },
        per_user_delivery: perUserStats.rows.map((r: any) => ({
          user_id: r.user_id.substring(0, 8),
          total: Number(r.total),
          emailed: Number(r.emailed),
          pushed: Number(r.pushed),
          pending: Number(r.pending),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

  const _placesRateMap = new Map<string, { count: number; resetAt: number }>();
  const PLACES_RATE_LIMIT = 30;
  const PLACES_RATE_WINDOW = 60_000;

  function checkPlacesRate(ip: string): boolean {
    const now = Date.now();
    const entry = _placesRateMap.get(ip);
    if (!entry || now > entry.resetAt) {
      _placesRateMap.set(ip, { count: 1, resetAt: now + PLACES_RATE_WINDOW });
      return true;
    }
    if (entry.count >= PLACES_RATE_LIMIT) return false;
    entry.count++;
    return true;
  }

  app.get("/api/places/autocomplete", async (req, res) => {
    const input = (req.query.input as string || "").trim();
    const sessionToken = req.query.session_token as string || "";

    if (!input || input.length < 2) {
      return res.json({ suggestions: [] });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkPlacesRate(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded", suggestions: [] });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(503).json({ error: "Google Places not configured", suggestions: [] });
    }

    try {
      const body = {
        input,
        includedRegionCodes: ["de"],
        includedPrimaryTypes: ["locality", "sublocality", "administrative_area_level_3"],
        languageCode: "de",
        sessionToken: sessionToken || undefined,
      };

      const gRes = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => "");
        log(`[google-places] Autocomplete error ${gRes.status}: ${errText}`);
        return res.status(502).json({ error: "Places API error", suggestions: [] });
      }

      const data = await gRes.json();
      const suggestions = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .slice(0, 8)
        .map((s: any) => {
          const p = s.placePrediction;
          const mainText = p.structuredFormat?.mainText?.text || "";
          const secondaryText = p.structuredFormat?.secondaryText?.text || "";
          return {
            place_id: p.placeId || "",
            display_name: p.text?.text || mainText,
            city_name: mainText,
            state: secondaryText,
            country_code: "DE",
          };
        });

      res.json({ suggestions });
    } catch (err: any) {
      log(`[google-places] Autocomplete fetch error: ${err.message}`);
      res.status(500).json({ error: "Internal error", suggestions: [] });
    }
  });

  app.get("/api/places/details", async (req, res) => {
    const placeId = (req.query.place_id as string || "").trim();
    const sessionToken = req.query.session_token as string || "";

    if (!placeId) {
      return res.status(400).json({ error: "place_id required" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkPlacesRate(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(503).json({ error: "Google Places not configured" });
    }

    try {
      const fields = "id,displayName,formattedAddress,location,addressComponents";
      const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=de`;

      const gRes = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": fields,
          ...(sessionToken ? { "X-Goog-Session-Token": sessionToken } : {}),
        },
      });

      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => "");
        log(`[google-places] Details error ${gRes.status}: ${errText}`);
        return res.status(502).json({ error: "Places API error" });
      }

      const data = await gRes.json();
      const loc = data.location || {};
      const components = data.addressComponents || [];

      let cityName = data.displayName?.text || "";
      let state = "";
      for (const comp of components) {
        const types: string[] = comp.types || [];
        if (types.includes("locality")) {
          cityName = comp.longText || cityName;
        }
        if (types.includes("administrative_area_level_1")) {
          state = comp.longText || "";
        }
      }

      res.json({
        place: {
          place_id: placeId,
          display_name: data.displayName?.text || cityName,
          city_name: cityName,
          state,
          country_code: "DE",
          latitude: loc.latitude ?? null,
          longitude: loc.longitude ?? null,
        },
      });
    } catch (err: any) {
      log(`[google-places] Details fetch error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/places/normalize", (req, res) => {
    const city = (req.query.city as string || "").trim();
    if (!city) {
      return res.status(400).json({ error: "city required" });
    }

    try {
      const result = normalizeCity(city);
      res.json(result);
    } catch (err: any) {
      log(`[city-normalize] Error: ${err.message}`);
      res.status(500).json({ error: "Normalization error" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const { event, metadata } = req.body || {};
      if (!event || typeof event !== "string") {
        return res.status(400).json({ error: "event name required" });
      }

      await trackActivationEvent(user.id, event, metadata || {});
      res.json({ ok: true });
    } catch (err: any) {
      log(`[events] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/activation-status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const [profilesResult, notifResult, matchResult, appliedResult, totalMatchResult, subResult, eventStatus] = await Promise.all([
        supabase.from("search_profiles").select("id, created_at").eq("user_id", user.id).limit(1),
        supabase.from("user_notification_settings").select("email_enabled, push_enabled").eq("user_id", user.id).maybeSingle(),
        pgPool.query("SELECT 1 FROM user_matches WHERE user_id = $1 AND viewed = true LIMIT 1", [user.id]),
        pgPool.query("SELECT 1 FROM user_matches WHERE user_id = $1 AND applied = true LIMIT 1", [user.id]),
        pgPool.query("SELECT COUNT(*) as c FROM user_matches WHERE user_id = $1", [user.id]),
        supabase.from("subscriptions").select("status, trial_ends_at").eq("user_id", user.id).maybeSingle(),
        getUserActivationStatus(user.id),
      ]);

      const profileCreated = (profilesResult.data?.length ?? 0) > 0;
      const profileCreatedAt = profilesResult.data?.[0]?.created_at || null;
      const notifEnabled = !!(notifResult.data?.email_enabled || notifResult.data?.push_enabled);
      const firstMatchViewed = matchResult.rows.length > 0 || eventStatus.firstMatchViewed;
      const firstReaction = appliedResult.rows.length > 0 || eventStatus.firstReaction;
      const totalMatches = parseInt(totalMatchResult.rows[0]?.c || "0");
      const subData = subResult.data;
      const trialStarted = !!subData?.trial_ends_at || eventStatus.trialStarted;
      const subscriptionStarted = subData?.status === "active" || eventStatus.subscriptionStarted;

      res.json({
        profileCreated,
        profileCreatedAt,
        notificationsEnabled: notifEnabled,
        firstMatchViewed,
        firstReaction,
        trialStarted,
        subscriptionStarted,
        totalMatches,
      });
    } catch (err: any) {
      log(`[activation] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/admin/activation-funnel", requireAdmin, async (_req, res) => {
    try {
      const [eventFunnel, totalUsersResult, withProfileResult, withNotifsResult, withMatchResult, withReactionResult, trialResult, activeSubResult] = await Promise.all([
        getActivationFunnel(),
        supabase.rpc("count_auth_users").then(r => r.data ?? null).catch(() => null),
        supabase.from("search_profiles").select("user_id").then(r => new Set((r.data ?? []).map((d: any) => d.user_id)).size),
        supabase.from("user_notification_settings").select("user_id").or("email_enabled.eq.true,push_enabled.eq.true").then(r => (r.data ?? []).length),
        pgPool.query("SELECT COUNT(DISTINCT user_id) as c FROM user_matches WHERE viewed = true").then(r => parseInt(r.rows[0]?.c || "0")),
        pgPool.query("SELECT COUNT(DISTINCT user_id) as c FROM user_matches WHERE applied = true").then(r => parseInt(r.rows[0]?.c || "0")),
        supabase.from("subscriptions").select("user_id").not("trial_ends_at", "is", null).then(r => (r.data ?? []).length),
        supabase.from("subscriptions").select("user_id").eq("status", "active").then(r => (r.data ?? []).length),
      ]);

      res.json({
        ...eventFunnel,
        sourceOfTruth: {
          totalAuthUsers: totalUsersResult,
          withSearchProfile: withProfileResult,
          withNotifications: withNotifsResult,
          withMatchViewed: withMatchResult,
          withReaction: withReactionResult,
          withTrial: trialResult,
          withActiveSubscription: activeSubResult,
        },
      });
    } catch (err: any) {
      log(`[admin] Activation funnel error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/cancellation-feedback", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const { reasonType, reasonText } = req.body;
      if (!reasonType || !["found_via_housalert", "found_not_via_housalert", "not_found", "other"].includes(reasonType)) {
        return res.status(400).json({ error: "Invalid reason type" });
      }

      const foundHome = reasonType === "found_via_housalert" ? true
        : reasonType === "found_not_via_housalert" ? true
        : reasonType === "not_found" ? false
        : null;

      await saveCancellationFeedback(user.id, reasonType, reasonText || null, foundHome);
      res.json({ ok: true });
    } catch (err: any) {
      log(`[cancellation] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/admin/cancellation-stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await getCancellationStats();
      res.json(stats);
    } catch (err: any) {
      log(`[admin] Cancellation stats error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // =============================================
  // ADMIN PORTAL API
  // =============================================

  app.get("/api/admin/portal/overview", requireAdmin, async (_req, res) => {
    try {
      log(`[admin-portal] Overview request received`);
      const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let totalUsers = 0;
      let activeSubscriptions = 0;
      let trialUsers = 0;
      let allSubs: any[] = [];
      let activeProfiles = 0;
      let listingsToday = 0;
      let matchesToday = 0;
      let listingsWeekVal = 0;
      let matchesWeekVal = 0;
      let signupsTodayVal = 0;
      let signupsWeekVal = 0;
      let emailsTodayVal = 0;
      let pushesTodayVal = 0;
      let sourceHealth: any[] = [];

      try {
        const adminSb = getSupabaseAdmin();
        const { data: allAuthData } = await adminSb.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const allAuthUsers = allAuthData?.users || [];
        totalUsers = allAuthUsers.length;
        const todayDate = new Date(todayStart);
        const weekDate = new Date(weekAgo);
        signupsTodayVal = allAuthUsers.filter((u: any) => new Date(u.created_at) >= todayDate).length;
        signupsWeekVal = allAuthUsers.filter((u: any) => new Date(u.created_at) >= weekDate).length;
        log(`[admin-portal] Overview: auth users OK (total=${totalUsers}, today=${signupsTodayVal}, week=${signupsWeekVal})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: auth.admin.listUsers failed: ${e.message} — falling back to PG`);
        try {
          const pgTotal = await pgPool.query("SELECT COUNT(*) FROM user_profile_data");
          totalUsers = parseInt(pgTotal.rows[0]?.count || "0");
          const signupsTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_profile_data WHERE created_at >= $1", [todayStart]);
          const signupsWeekRes = await pgPool.query("SELECT COUNT(*) FROM user_profile_data WHERE created_at >= $1", [weekAgo]);
          signupsTodayVal = parseInt(signupsTodayRes.rows[0]?.count || "0");
          signupsWeekVal = parseInt(signupsWeekRes.rows[0]?.count || "0");
        } catch (pgErr: any) {
          log(`[admin-portal] Overview: PG signup fallback also failed: ${pgErr.message}`);
        }
      }

      try {
        const [activeSubsRes, trialSubsRes, allSubsRes] = await Promise.all([
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
          supabase.from("subscriptions").select("status, plan"),
        ]);
        activeSubscriptions = activeSubsRes.count ?? 0;
        trialUsers = trialSubsRes.count ?? 0;
        allSubs = allSubsRes.data || [];
        log(`[admin-portal] Overview: subscriptions OK (active=${activeSubscriptions}, trial=${trialUsers}, total=${allSubs.length})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: subscriptions query failed: ${e.message}`);
      }

      try {
        const [profilesRes, listingsTodayRes, matchesTodayRes, listingsWeekRes, matchesWeekRes] = await Promise.all([
          supabase.from("search_profiles").select("id", { count: "exact", head: true }),
          supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
          supabase.from("matches").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
          supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
          supabase.from("matches").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        ]);
        activeProfiles = profilesRes.count ?? 0;
        listingsToday = listingsTodayRes.count ?? 0;
        matchesToday = matchesTodayRes.count ?? 0;
        listingsWeekVal = listingsWeekRes.count ?? 0;
        matchesWeekVal = matchesWeekRes.count ?? 0;
        log(`[admin-portal] Overview: listings/matches OK (profiles=${activeProfiles}, listingsToday=${listingsToday}, matchesToday=${matchesToday})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: listings/matches query failed: ${e.message}`);
      }

      try {
        const eRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND matched_at >= $1", [todayStart]);
        emailsTodayVal = parseInt(eRes.rows[0]?.count || "0");
      } catch (e: any) {
        log(`[admin-portal] Overview: email count failed: ${e.message}`);
      }
      try {
        const pRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE push_sent = true AND matched_at >= $1", [todayStart]);
        pushesTodayVal = parseInt(pRes.rows[0]?.count || "0");
      } catch (e: any) {
        log(`[admin-portal] Overview: push count failed: ${e.message}`);
      }

      let mrr = 0;
      const pricingMap: Record<string, number> = { monthly: 14.99, two_month: 12.49, three_month: 9.99 };
      for (const sub of allSubs) {
        if (sub.status === "active") {
          mrr += pricingMap[sub.plan] || 14.99;
        }
      }

      try {
        const sourceHealthRes = await pgPool.query("SELECT source_reports FROM ingestion_runs ORDER BY started_at DESC LIMIT 1");
        sourceHealth = sourceHealthRes.rows[0]?.source_reports || [];
      } catch (e: any) {
        log(`[admin-portal] Overview: source health failed: ${e.message}`);
      }

      log(`[admin-portal] Overview: responding with data`);
      res.json({
        totalUsers,
        activeSubscriptions,
        trialUsers,
        signupsToday: signupsTodayVal,
        mrr: Math.round(mrr * 100) / 100,
        activeProfiles,
        listingsToday,
        matchesToday,
        emailsToday: emailsTodayVal,
        pushesToday: pushesTodayVal,
        signupsWeek: signupsWeekVal,
        listingsWeek: listingsWeekVal,
        matchesWeek: matchesWeekVal,
        sourceHealth,
      });
    } catch (err: any) {
      log(`[admin-portal] Overview FATAL error: ${err.message}\n${err.stack}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/users", requireAdmin, async (req, res) => {
    try {
      const search = (req.query.search as string || "").trim().toLowerCase();
      const filter = req.query.filter as string || "all";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      const adminSb = getSupabaseAdmin();
      const { data: authData, error: authListErr } = await adminSb.auth.admin.listUsers({
        page,
        perPage: limit,
      });
      if (authListErr) throw authListErr;

      const authUsers = authData?.users || [];
      const totalUsers = (authData as any)?.total ?? authUsers.length;

      let filteredAuth = authUsers;
      if (search) {
        filteredAuth = authUsers.filter((u: any) => {
          const email = (u.email || "").toLowerCase();
          const meta = u.user_metadata || {};
          const fullName = `${meta.first_name || ""} ${meta.last_name || ""}`.toLowerCase();
          const uid = u.id.toLowerCase();
          return email.includes(search) || fullName.includes(search) || uid.includes(search);
        });
      }

      const userIds = filteredAuth.map((u: any) => u.id);
      if (userIds.length === 0) {
        return res.json({ users: [], total: search ? 0 : totalUsers, page, limit });
      }

      const [profilesRes, subsRes, profilesCountRes, matchCountRes] = await Promise.all([
        pgPool.query(`SELECT * FROM user_profile_data WHERE user_id = ANY($1::uuid[])`, [userIds]),
        supabase.from("subscriptions").select("user_id, status, plan, trial_ends_at, current_period_ends_at").in("user_id", userIds),
        supabase.from("search_profiles").select("user_id").in("user_id", userIds),
        pgPool.query(`SELECT user_id, COUNT(*) as cnt FROM user_matches WHERE user_id = ANY($1::uuid[]) GROUP BY user_id`, [userIds]),
      ]);

      const profileMap: Record<string, any> = {};
      for (const p of profilesRes.rows) profileMap[p.user_id] = p;

      const subsMap: Record<string, any> = {};
      for (const s of (subsRes.data || [])) subsMap[s.user_id] = s;

      const profileCountMap: Record<string, number> = {};
      for (const p of (profilesCountRes.data || [])) profileCountMap[p.user_id] = (profileCountMap[p.user_id] || 0) + 1;

      const matchCountMap: Record<string, number> = {};
      for (const m of matchCountRes.rows) matchCountMap[m.user_id] = parseInt(m.cnt);

      let users = filteredAuth.map((authUser: any) => {
        const profile = profileMap[authUser.id];
        const meta = authUser.user_metadata || {};
        return {
          user_id: authUser.id,
          first_name: profile?.first_name || meta.first_name || null,
          last_name: profile?.last_name || meta.last_name || null,
          email: authUser.email || null,
          language: profile?.language || null,
          profile_photo_url: profile?.profile_photo_url || null,
          created_at: profile?.created_at || authUser.created_at,
          has_profile_data: !!profile,
          subscription: subsMap[authUser.id] || null,
          searchProfileCount: profileCountMap[authUser.id] || 0,
          matchCount: matchCountMap[authUser.id] || 0,
        };
      });

      if (filter === "paid") users = users.filter((u: any) => u.subscription?.status === "active");
      else if (filter === "trial") users = users.filter((u: any) => u.subscription?.status === "trial");
      else if (filter === "canceled") users = users.filter((u: any) => u.subscription?.status === "canceled");
      else if (filter === "expired") users = users.filter((u: any) => u.subscription?.status === "expired");

      res.json({
        users,
        total: search ? filteredAuth.length : totalUsers,
        page,
        limit,
      });
    } catch (err: any) {
      log(`[admin-portal] Users error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/users/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const adminSb = getSupabaseAdmin();
      const [authUserRes, profileRes, subRes, searchProfilesRes, recentMatchesRes] = await Promise.all([
        adminSb.auth.admin.getUserById(userId),
        pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1", [userId]),
        supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("search_profiles").select("*").eq("user_id", userId),
        pgPool.query("SELECT * FROM user_matches WHERE user_id = $1 ORDER BY matched_at DESC LIMIT 20", [userId]),
      ]);

      let cancellationFeedback = null;
      try {
        const cfRes = await pgPool.query("SELECT * FROM cancellation_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]);
        cancellationFeedback = cfRes.rows[0] || null;
      } catch {}

      const notifsRes = await supabase.from("user_notification_settings").select("*").eq("user_id", userId).maybeSingle();

      const authUser = authUserRes.data?.user || null;
      let pgProfile = profileRes.rows[0] || null;
      const meta = authUser?.user_metadata || {};

      if (!pgProfile && authUser) {
        let firstName = meta.first_name || null;
        let lastName = meta.last_name || null;
        if (!firstName && meta.full_name) {
          const parts = (meta.full_name as string).trim().split(/\s+/);
          firstName = parts[0] || null;
          lastName = parts.slice(1).join(" ") || null;
        }
        if (!firstName) firstName = authUser.email?.split("@")[0] || null;
        try {
          const { rows: created } = await pgPool.query(
            `INSERT INTO user_profile_data (user_id, first_name, last_name, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               first_name = COALESCE(user_profile_data.first_name, EXCLUDED.first_name),
               last_name = COALESCE(user_profile_data.last_name, EXCLUDED.last_name),
               updated_at = NOW()
             RETURNING *`,
            [authUser.id, firstName, lastName]
          );
          pgProfile = created[0] || null;
          log(`[admin-portal] Auto-bootstrapped profile row for user=${authUser.id.substring(0, 8)}... name="${firstName} ${lastName}"`);
        } catch (bootstrapErr: any) {
          log(`[admin-portal] Auto-bootstrap failed for user=${authUser.id.substring(0, 8)}...: ${bootstrapErr.message}`);
        }
      }

      log(`[admin-portal] User detail userId=${userId.substring(0, 8)}... pgProfile=${!!pgProfile} authUser=${!!authUser} pgPhone=${pgProfile?.phone} pgOccupation=${pgProfile?.occupation} pgUpdatedAt=${pgProfile?.updated_at}`);

      const profile = pgProfile
        ? { ...pgProfile, email: authUser?.email || null }
        : authUser
          ? {
              user_id: authUser.id,
              first_name: meta.first_name || null,
              last_name: meta.last_name || null,
              email: authUser.email || null,
              created_at: authUser.created_at,
              has_profile_data: false,
            }
          : null;

      log(`[admin-portal] User detail response profile.phone=${profile?.phone} profile.occupation=${profile?.occupation} profile.first_name=${profile?.first_name}`);

      res.json({
        profile,
        subscription: subRes.data || null,
        searchProfiles: searchProfilesRes.data || [],
        recentMatches: recentMatchesRes.rows,
        cancellationFeedback,
        notificationSettings: notifsRes.data || null,
      });
    } catch (err: any) {
      log(`[admin-portal] User detail error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/subscriptions", requireAdmin, async (req, res) => {
    try {
      const filter = req.query.filter as string || "all";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      let query = supabase.from("subscriptions").select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      for (const s of (data || [])) statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      log(`[admin-portal] Subscriptions query: total=${count}, returned=${(data || []).length}, filter=${filter}, statuses=${JSON.stringify(statusCounts)}`);

      const userIds = (data || []).map((s: any) => s.user_id).filter(Boolean);
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const usersRes = await pgPool.query(
            `SELECT user_id, first_name, last_name FROM user_profile_data WHERE user_id = ANY($1::uuid[])`,
            [userIds]
          );
          for (const u of usersRes.rows) userMap[u.user_id] = u;
        } catch (pgErr: any) {
          log(`[admin-portal] Subscriptions user enrichment failed (non-fatal): ${pgErr.message}`);
        }
      }

      const enriched = (data || []).map((s: any) => {
        const profile = userMap[s.user_id];
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
          : "Unknown";
        return { ...s, userName };
      });

      res.json({ subscriptions: enriched, total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Subscriptions error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/search-profiles", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      const { data, count, error } = await supabase.from("search_profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      const userIds = (data || []).map((p: any) => p.user_id).filter(Boolean);
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const usersRes = await pgPool.query(
            `SELECT user_id, first_name, last_name FROM user_profile_data WHERE user_id = ANY($1::uuid[])`,
            [userIds]
          );
          for (const u of usersRes.rows) userMap[u.user_id] = u;
        } catch (pgErr: any) {
          log(`[admin-portal] Search profiles user enrichment failed (non-fatal): ${pgErr.message}`);
        }
      }

      const enriched = (data || []).map((p: any) => {
        const profile = userMap[p.user_id];
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
          : "Unknown";
        return { ...p, userName };
      });

      res.json({ profiles: enriched, total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Search profiles error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/listings", requireAdmin, async (req, res) => {
    try {
      const source = req.query.source as string || "";
      const city = req.query.city as string || "";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      let query = supabase.from("listings")
        .select("id, title, source, city, price, size_m2, bedrooms, url, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (source) query = query.eq("source", source);
      if (city) query = query.ilike("city", `%${city}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      res.json({ listings: data || [], total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Listings error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/sources", requireAdmin, async (_req, res) => {
    try {
      const runsRes = await pgPool.query(
        "SELECT source_reports, started_at, finished_at, duration_sec, status FROM ingestion_runs ORDER BY started_at DESC LIMIT 5"
      );

      const latestRun = runsRes.rows[0] || null;
      const sources = latestRun?.source_reports || [];

      res.json({ sources, latestRun: latestRun ? { started_at: latestRun.started_at, finished_at: latestRun.finished_at, duration_sec: latestRun.duration_sec, status: latestRun.status } : null });
    } catch (err: any) {
      log(`[admin-portal] Sources error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/matches", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
      const offset = (page - 1) * limit;
      const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

      const matchesRes = await pgPool.query(
        `SELECT um.*, upd.first_name, upd.last_name
         FROM user_matches um
         LEFT JOIN user_profile_data upd ON um.user_id = upd.user_id
         ORDER BY um.matched_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countRes = await pgPool.query("SELECT COUNT(*) FROM user_matches");
      const emailsTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND matched_at >= $1", [todayStart]);
      const pushesTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE push_sent = true AND matched_at >= $1", [todayStart]);

      let failuresWeek = 0;
      try {
        const failRes = await supabase.from("push_delivery_log").select("id", { count: "exact", head: true }).eq("status", "error").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        failuresWeek = failRes.count ?? 0;
      } catch {}

      res.json({
        matches: matchesRes.rows,
        total: parseInt(countRes.rows[0]?.count || "0"),
        page,
        limit,
        stats: {
          emailsToday: parseInt(emailsTodayRes.rows[0]?.count || "0"),
          pushesToday: parseInt(pushesTodayRes.rows[0]?.count || "0"),
          failuresWeek,
        },
      });
    } catch (err: any) {
      log(`[admin-portal] Matches error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/growth", requireAdmin, async (_req, res) => {
    try {
      const funnelSteps = [
        { key: "landing_viewed", label: "Landing Viewed" },
        { key: "account_created", label: "Signup Started" },
        { key: "profile_created", label: "Search Created" },
        { key: "pricing_viewed", label: "Pricing Viewed" },
        { key: "checkout_started", label: "Checkout Started" },
        { key: "subscription_started", label: "Subscription Started" },
        { key: "first_match_received", label: "First Match Received" },
        { key: "listing_opened", label: "First Listing Viewed" },
        { key: "first_reaction", label: "First Reaction Sent" },
      ];

      const funnelCountsResult = await pgPool.query(
        `SELECT event_name, COUNT(DISTINCT user_id) AS cnt
         FROM activation_events
         WHERE event_name = ANY($1)
         GROUP BY event_name`,
        [funnelSteps.map(s => s.key)]
      );
      const countMap: Record<string, number> = {};
      for (const row of funnelCountsResult.rows) {
        countMap[row.event_name] = parseInt(row.cnt, 10);
      }

      let effectiveStartIndex = 0;
      if ((countMap["landing_viewed"] || 0) === 0 && (countMap["account_created"] || 0) > 0) {
        effectiveStartIndex = 1;
      }

      const activeFunnelSteps = funnelSteps.slice(effectiveStartIndex);

      const funnel = activeFunnelSteps.map((step, i) => {
        const count = countMap[step.key] || 0;
        const prevCount = i > 0 ? (countMap[activeFunnelSteps[i - 1].key] || 0) : 0;
        const conversionPct = i === 0 ? 100 : (prevCount > 0 ? Math.min(100, Math.round((count / prevCount) * 100)) : 0);
        return { ...step, count, conversionPct, prevLabel: i > 0 ? activeFunnelSteps[i - 1].label : null };
      });

      const totalUsersResult = await pgPool.query(`SELECT COUNT(*) AS cnt FROM user_profile_data`);
      const totalUsers = parseInt(totalUsersResult.rows[0]?.cnt || "0", 10);

      const usersWithMatchResult = await pgPool.query(`SELECT COUNT(DISTINCT user_id) AS cnt FROM user_matches`);
      const usersWithMatch = parseInt(usersWithMatchResult.rows[0]?.cnt || "0", 10);

      const listingViewersResult = await pgPool.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'listing_opened'`
      );
      const listingViewers = parseInt(listingViewersResult.rows[0]?.cnt || "0", 10);

      const reactorsResult = await pgPool.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'first_reaction'`
      );
      const reactors = parseInt(reactorsResult.rows[0]?.cnt || "0", 10);

      let trialUsers = 0;
      let paidUsers = 0;
      try {
        const { data: subs } = await supabase.from("subscriptions").select("status");
        if (subs) {
          for (const s of subs) {
            if (s.status === "trialing") trialUsers++;
            if (s.status === "active") paidUsers++;
          }
        }
      } catch {}

      const activationRate = totalUsers > 0 ? Math.min(100, Math.round((usersWithMatch / totalUsers) * 100)) : 0;
      const listingViewRate = usersWithMatch > 0 ? Math.min(100, Math.round((listingViewers / usersWithMatch) * 100)) : 0;
      const reactionRate = listingViewers > 0 ? Math.min(100, Math.round((reactors / listingViewers) * 100)) : 0;
      const trialToPaid = trialUsers > 0 ? Math.min(100, Math.round((paidUsers / trialUsers) * 100)) : 0;

      const metrics = { activationRate, listingViewRate, reactionRate, trialToPaid, totalUsers, usersWithMatch, listingViewers, reactors, paidUsers, trialUsers };

      let cityPerformance: any[] = [];
      try {
        const cityResult = await pgPool.query(
          `SELECT
             COALESCE(e.city, 'Unknown') AS city,
             COUNT(DISTINCT e.user_id) AS users,
             0 AS search_profiles,
             0 AS matches,
             0 AS listing_views,
             0 AS reactions
           FROM (
             SELECT user_id, (metadata->>'city') AS city
             FROM activation_events
             WHERE metadata->>'city' IS NOT NULL AND metadata->>'city' != ''
           ) e
           GROUP BY e.city
           ORDER BY users DESC
           LIMIT 20`
        );
        cityPerformance = cityResult.rows;

        for (const row of cityPerformance) {
          const cityLower = row.city.toLowerCase();
          try {
            const { count: spCount } = await supabase
              .from("search_profiles")
              .select("*", { count: "exact", head: true })
              .ilike("city", `%${cityLower}%`);
            row.search_profiles = spCount || 0;
          } catch {}

          try {
            const matchResult = await pgPool.query(
              `SELECT COUNT(*) AS cnt FROM user_matches WHERE LOWER(city) = $1`, [cityLower]
            );
            row.matches = parseInt(matchResult.rows[0]?.cnt || "0", 10);
          } catch {}

          try {
            const viewResult = await pgPool.query(
              `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'listing_opened' AND LOWER(metadata->>'city') = $1`, [cityLower]
            );
            row.listing_views = parseInt(viewResult.rows[0]?.cnt || "0", 10);
          } catch {}

          try {
            const reactResult = await pgPool.query(
              `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'first_reaction' AND LOWER(metadata->>'city') = $1`, [cityLower]
            );
            row.reactions = parseInt(reactResult.rows[0]?.cnt || "0", 10);
          } catch {}
        }
      } catch (err: any) {
        log(`[admin-portal] City performance query error: ${err.message}`);
      }

      res.json({ funnel, metrics, cityPerformance });
    } catch (err: any) {
      log(`[admin-portal] Growth data error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/retention", requireAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const cancel7Res = await pgPool.query(
        `SELECT COUNT(*) AS cnt FROM cancellation_feedback WHERE created_at >= $1`, [d7]
      );
      const cancel30Res = await pgPool.query(
        `SELECT COUNT(*) AS cnt FROM cancellation_feedback WHERE created_at >= $1`, [d30]
      );
      const cancellations7d = parseInt(cancel7Res.rows[0]?.cnt || "0", 10);
      const cancellations30d = parseInt(cancel30Res.rows[0]?.cnt || "0", 10);

      const avgDaysRes = await pgPool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (cf.created_at - upd.created_at)) / 86400)::int AS avg_days
         FROM cancellation_feedback cf
         JOIN user_profile_data upd ON cf.user_id = upd.user_id
         WHERE upd.created_at IS NOT NULL`
      );
      const avgDaysBeforeCancel = parseInt(avgDaysRes.rows[0]?.avg_days || "0", 10);

      const cancelBeforeMatchRes = await pgPool.query(
        `SELECT COUNT(DISTINCT cf.user_id) AS cnt
         FROM cancellation_feedback cf
         LEFT JOIN user_matches um ON cf.user_id = um.user_id
         WHERE um.user_id IS NULL`
      );
      const cancelBeforeMatch = parseInt(cancelBeforeMatchRes.rows[0]?.cnt || "0", 10);

      const cancelAfterMatchRes = await pgPool.query(
        `SELECT COUNT(DISTINCT cf.user_id) AS cnt
         FROM cancellation_feedback cf
         INNER JOIN user_matches um ON cf.user_id = um.user_id`
      );
      const cancelAfterMatch = parseInt(cancelAfterMatchRes.rows[0]?.cnt || "0", 10);

      const detailRes = await pgPool.query(
        `SELECT cf.user_id, cf.reason_type, cf.reason_text, cf.created_at,
                upd.first_name, upd.last_name,
                EXTRACT(EPOCH FROM (cf.created_at - upd.created_at))::int / 86400 AS days_active,
                (SELECT COUNT(*) FROM user_matches um WHERE um.user_id = cf.user_id) AS match_count
         FROM cancellation_feedback cf
         LEFT JOIN user_profile_data upd ON cf.user_id = upd.user_id
         ORDER BY cf.created_at DESC
         LIMIT 50`
      );

      const cancellations = detailRes.rows.map((r: any) => {
        let city = "—";
        let plan = "—";
        return {
          userId: r.user_id,
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.user_id?.substring(0, 12),
          city,
          plan,
          daysActive: r.days_active ?? 0,
          matchCount: parseInt(r.match_count || "0", 10),
          reason: r.reason_type,
          reasonText: r.reason_text,
          cancelledAt: r.created_at,
        };
      });

      for (const c of cancellations) {
        try {
          const { data: sp } = await supabase.from("search_profiles").select("city").eq("user_id", c.userId).limit(1).maybeSingle();
          if (sp?.city) c.city = sp.city;
        } catch {}
        try {
          const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", c.userId).maybeSingle();
          if (sub?.plan) c.plan = sub.plan;
        } catch {}
      }

      res.json({
        cancellations7d,
        cancellations30d,
        avgDaysBeforeCancel,
        cancelBeforeMatch,
        cancelAfterMatch,
        cancellations,
      });
    } catch (err: any) {
      log(`[admin-portal] Retention error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/source-performance", requireAdmin, async (_req, res) => {
    try {
      const runRes = await pgPool.query(
        `SELECT source_reports FROM ingestion_runs ORDER BY finished_at DESC LIMIT 10`
      );

      const sourceMap: Record<string, { source: string; city: string; listings: number; matches: number }> = {};
      for (const row of runRes.rows) {
        if (!Array.isArray(row.source_reports)) continue;
        for (const sr of row.source_reports) {
          const rawName = sr.name || sr.source || "";
          const cityMatch = rawName.match(/\(([^)]+)\)/);
          const city = cityMatch ? cityMatch[1] : "Unknown";
          const sourceName = rawName.replace(/\s*\([^)]+\)/, "").trim();
          const key = `${sourceName}|${city}`;
          if (!sourceMap[key]) {
            sourceMap[key] = { source: sourceName, city, listings: 0, matches: 0 };
          }
          sourceMap[key].listings += (sr.found || 0);
          sourceMap[key].matches += (sr.matches || 0);
        }
      }

      const sources = Object.values(sourceMap);

      for (const s of sources) {
        try {
          const vRes = await pgPool.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events
             WHERE event_name = 'listing_opened' AND LOWER(metadata->>'city') = $1`,
            [s.city.toLowerCase()]
          );
          (s as any).listingViews = parseInt(vRes.rows[0]?.cnt || "0", 10);
        } catch {
          (s as any).listingViews = 0;
        }

        try {
          const rRes = await pgPool.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events
             WHERE event_name = 'first_reaction' AND LOWER(metadata->>'city') = $1`,
            [s.city.toLowerCase()]
          );
          (s as any).reactions = parseInt(rRes.rows[0]?.cnt || "0", 10);
        } catch {
          (s as any).reactions = 0;
        }
      }

      sources.sort((a: any, b: any) => (b.reactions || 0) - (a.reactions || 0));

      res.json({ sources });
    } catch (err: any) {
      log(`[admin-portal] Source performance error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/alerts", requireAdmin, async (_req, res) => {
    try {
      const alerts: Array<{ type: string; severity: string; message: string; timestamp: string }> = [];
      const now = new Date();

      try {
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
        const scraperRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM ingestion_runs WHERE finished_at >= $1 AND total_found > 0`,
          [fourHoursAgo]
        );
        const hasRecentCompletedRun = parseInt(scraperRes.rows[0]?.cnt || "0", 10) > 0;

        const currentlyRunning = isRunning();
        const lastActivity = getLastActivityAt();
        const activityRecent = lastActivity && new Date(lastActivity).getTime() > now.getTime() - 4 * 60 * 60 * 1000;

        if (!hasRecentCompletedRun) {
          if (currentlyRunning && activityRecent) {
            alerts.push({
              type: "scraper_stale",
              severity: "info",
              message: `Ingestion cycle in progress (last activity: ${lastActivity}) — no completed run in last 4 hours yet`,
              timestamp: now.toISOString(),
            });
          } else {
            alerts.push({
              type: "scraper_stale",
              severity: "critical",
              message: currentlyRunning && !activityRecent
                ? "Ingestion cycle appears stuck — running but no activity in last 4 hours"
                : "No listings scraped in the last 4 hours",
              timestamp: now.toISOString(),
            });
          }
        }
      } catch {}

      try {
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        const todayMatchRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM user_matches WHERE matched_at >= $1`, [todayStart.toISOString()]
        );
        const yesterdayMatchRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM user_matches WHERE matched_at >= $1 AND matched_at < $2`,
          [yesterdayStart.toISOString(), todayStart.toISOString()]
        );
        const todayMatches = parseInt(todayMatchRes.rows[0]?.cnt || "0", 10);
        const yesterdayMatches = parseInt(yesterdayMatchRes.rows[0]?.cnt || "0", 10);
        if (yesterdayMatches > 0 && todayMatches < yesterdayMatches * 0.5) {
          alerts.push({
            type: "match_drop",
            severity: "warning",
            message: `Matches dropped >50%: today ${todayMatches} vs yesterday ${yesterdayMatches}`,
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      try {
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const totalEmailRes = await pgPool.query(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE email_sent = false AND matched_at >= $1) AS failed
           FROM user_matches WHERE matched_at >= $1`,
          [todayStart.toISOString()]
        );
        const total = parseInt(totalEmailRes.rows[0]?.total || "0", 10);
        const failed = parseInt(totalEmailRes.rows[0]?.failed || "0", 10);
        if (total > 10 && (failed / total) > 0.05) {
          alerts.push({
            type: "email_failure",
            severity: "warning",
            message: `Email delivery failure rate ${Math.round((failed / total) * 100)}% (${failed}/${total})`,
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      try {
        const recentErrors = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM ingestion_runs
           WHERE finished_at >= $1 AND status = 'failed'`,
          [new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()]
        );
        if (parseInt(recentErrors.rows[0]?.cnt || "0", 10) > 0) {
          alerts.push({
            type: "ingestion_failure",
            severity: "warning",
            message: "One or more ingestion runs failed in the last 24 hours",
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      res.json({ alerts });
    } catch (err: any) {
      log(`[admin-portal] Alerts error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/system-status", requireAdmin, async (_req, res) => {
    try {
      const checks: Record<string, any> = {};

      try {
        const { getUncachableStripeClient } = await import("./stripe/stripeClient");
        const stripe = await getUncachableStripeClient();
        await stripe.products.list({ limit: 1 });
        checks.stripe = { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.stripe = { status: "error", message: e.message?.substring(0, 100) };
      }

      const placesKey = process.env.GOOGLE_PLACES_API_KEY;
      checks.placesApi = placesKey
        ? { status: "operational", message: "API key configured" }
        : { status: "warning", message: "No API key — using Nominatim fallback" };

      const schedulerEnabled = process.env.ENABLE_INGEST_SCHEDULER === "true";
      let lastRun: any = null;
      try {
        const lastRunRes = await pgPool.query("SELECT started_at, status FROM ingestion_runs ORDER BY started_at DESC LIMIT 1");
        lastRun = lastRunRes.rows[0] || null;
      } catch {}
      checks.ingestionScheduler = {
        status: schedulerEnabled ? "operational" : "disabled",
        message: schedulerEnabled
          ? `Enabled — last run: ${lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString() : "never"} (${lastRun?.status || "unknown"})`
          : "Disabled (ENABLE_INGEST_SCHEDULER != true)",
      };

      let emailStatus = { status: "warning", message: "No Resend API key" };
      try {
        const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
        if (hostname) {
          const xReplitToken = process.env.REPL_IDENTITY
            ? "repl " + process.env.REPL_IDENTITY
            : process.env.WEB_REPL_RENEWAL
            ? "depl " + process.env.WEB_REPL_RENEWAL
            : null;
          if (xReplitToken) {
            const connRes = await fetch(
              "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
              { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
            ).then(r => r.json());
            if (connRes?.items?.[0]?.settings?.api_key) {
              emailStatus = { status: "operational", message: "Resend configured (via connector)" };
            }
          }
        }
        if (emailStatus.status === "warning" && process.env.RESEND_API_KEY) {
          emailStatus = { status: "operational", message: "Resend configured (via env var)" };
        }
      } catch {}
      checks.email = emailStatus;

      const vapidKey = process.env.VAPID_PRIVATE_KEY;
      checks.pushNotifications = vapidKey
        ? { status: "operational", message: "VAPID keys configured" }
        : { status: "warning", message: "No VAPID keys" };

      try {
        await pgPool.query("SELECT 1");
        checks.replitDb = { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.replitDb = { status: "error", message: e.message?.substring(0, 100) };
      }

      try {
        const { error } = await supabase.from("subscriptions").select("id").limit(1);
        checks.supabaseDb = error
          ? { status: "error", message: error.message }
          : { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.supabaseDb = { status: "error", message: e.message?.substring(0, 100) };
      }

      res.json(checks);
    } catch (err: any) {
      log(`[admin-portal] System status error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
