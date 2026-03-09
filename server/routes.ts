import type { Express } from "express";
import { createServer, type Server } from "http";
import { sendEmailMatchAlert } from "./notifications";
import {
  runAllIngesters,
  getEnabledSources,
  getSourceStatuses,
  getLastRunStatus,
  isTestModeActive,
  OverlapError,
} from "./ingesters";
import { getNextRun } from "./scheduler";
import { getListingFreshness, getMatchTimestamps, getNewestListingIds } from "./freshness";
import { supabase } from "./ingesters/matching";
import { backfillMatchesForSearchProfile, explainMatch, explainAllProfilesForListing } from "./matching/engine";
import {
  ensureTrialSubscription,
  getSubscriptionStatus,
  updateSubscriptionFromCheckout,
  updateSubscriptionStatus,
  findUserByStripeCustomerId,
} from "./subscriptions";
import { log } from "./log";
import { computeMatchScore, getMatchReasons } from "../shared/match-score";
import { pool as pgPool } from "./pg-pool";

const TEN_MIN = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

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
    await getUncachableStripeClient();
    log("[stripe-config] Stripe initialized successfully.");
  } catch (err: any) {
    stripeAvailable = false;
    log(`[stripe-config] Stripe not available: ${err.message}`);
  }

  app.post("/api/match-alert", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

    const { userEmail, listing } = req.body;

    if (!userEmail || !listing || !listing.title || !listing.city) {
      return res.status(400).json({ error: "Missing userEmail or listing data" });
    }

    const sent = await sendEmailMatchAlert(userEmail, listing);
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
        };
      if (cleaned.sms_enabled !== undefined) delete cleaned.sms_enabled;
      if (cleaned.whatsapp_enabled !== undefined) delete cleaned.whatsapp_enabled;
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

      const { phone_e164, email_enabled } = req.body;

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
        result = await supabase
          .from("user_notification_settings")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) return res.status(500).json({ error: result.error.message });
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
      testMode: isTestModeActive(),
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
        testMode: status.testMode,
        testModeExpires: status.testModeExpires,
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

      const { data: matchRows, error: mErr } = await supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", user.id);

      if (mErr) return res.status(500).json({ error: mErr.message });
      if (!matchRows || matchRows.length === 0) return res.json([]);

      const matchIds = matchRows.map((m: any) => m.id);
      const matchTimestamps = await getMatchTimestamps(matchIds);

      const enriched = matchRows.map((m: any) => ({
        ...m,
        matched_at: matchTimestamps[m.id] || m.created_at,
      }));
      enriched.sort((a: any, b: any) =>
        new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
      );
      const top50 = enriched.slice(0, 50);

      const listingIds = top50.map((m: any) => m.listing_id);
      const profileIds = [...new Set(top50.map((m: any) => m.search_profile_id).filter(Boolean))];

      const [listingsRes, freshnessMap, profilesRes] = await Promise.all([
        supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url, image_url")
          .in("id", listingIds),
        getListingFreshness(listingIds),
        profileIds.length > 0
          ? supabase
              .from("search_profiles")
              .select("id, city, price_min, price_max, bedrooms_min, size_min")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (listingsRes.error) return res.status(500).json({ error: listingsRes.error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listingsRes.data ?? []) listingMap[l.id] = l;

      const profileMap: Record<string, any> = {};
      for (const p of profilesRes.data ?? []) profileMap[p.id] = p;

      const result = top50.map((m: any) => {
        const l = listingMap[m.listing_id];
        const firstSeenAt = freshnessMap[m.listing_id]?.first_seen_at || m.created_at;
        const profile = profileMap[m.search_profile_id];

        let match_score = null;
        let match_label = null;
        let match_reasons: string[] = [];
        if (l && profile) {
          const scoreResult = computeMatchScore({
            listing: { price: l.price ?? 0, bedrooms: l.bedrooms ?? 0, size_m2: l.size_m2 ?? 0, city: l.city ?? "" },
            profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
          });
          match_score = scoreResult.score;
          match_label = scoreResult.label;
          match_reasons = getMatchReasons(scoreResult.details);
        }

        return {
          listing_id: m.listing_id,
          title: l?.title ?? null,
          price: l?.price ?? null,
          size_m2: l?.size_m2 ?? null,
          bedrooms: l?.bedrooms ?? null,
          city: l?.city ?? null,
          source: l?.source ?? null,
          url: l?.url ?? null,
          image_url: l?.image_url ?? null,
          matched_at: m.matched_at,
          first_seen_at: firstSeenAt,
          fresh_label: computeFreshLabel(firstSeenAt),
          match_score,
          match_label,
          match_reasons,
        };
      });

      let validResults = result.filter((r: any) => r.title !== null);

      if (premiumStartedAt) {
        const premiumStart = new Date(premiumStartedAt).getTime();
        validResults = validResults.filter((r: any) => {
          const matchedAt = new Date(r.matched_at).getTime();
          return matchedAt >= premiumStart;
        });
      }

      validResults.sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0));

      return res.json(validResults);
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
        return res.status(500).json({ error: error.message });
      }
      if (!data || data.length === 0) return res.status(404).json({ error: "Match not found" });

      return res.json(data[0]);
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

      const { data, error } = await supabase
        .from("matches")
        .select("listing_id")
        .eq("user_id", user.id)
        .eq("applied", true);

      if (error) return res.status(500).json({ error: error.message });

      const listingIds = (data ?? []).map((m: any) => m.listing_id);
      return res.json({ applied: listingIds });
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
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at")
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
                .select("city, price_min, price_max, bedrooms_min, size_min")
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

  app.post("/api/subscription/ensure-trial", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sub = await ensureTrialSubscription(user.id);
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

  app.post("/api/checkout/session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { plan } = req.body;
      if (!plan || !PLAN_PRICE_MAP[plan]) {
        return res.status(400).json({ error: "Invalid plan. Use: monthly, two_month, or three_month" });
      }

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe prices are not yet configured." });
      }

      if (!stripeAvailable) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe is not available. Set STRIPE_SECRET_KEY or connect Stripe via Replit integration." });
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

      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

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
        cancel_url: `${baseUrl}/paywall`,
        metadata: { supabase_user_id: user.id, plan },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
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
        cancel_url: `${baseUrl}/paywall`,
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

      const status = await getSubscriptionStatus(userId);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[checkout-verify] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const { getUncachableStripeClient, getStripeSecretKey } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } catch (err: any) {
        log(`[stripe-webhook] Signature verification failed: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      log(`[stripe-webhook] Received event: ${event.type}`);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.metadata?.supabase_user_id;
          const plan = session.metadata?.plan || "monthly";
          const stripeCustomerId = session.customer as string;
          const stripeSubscriptionId = session.subscription as string;

          if (userId && stripeSubscriptionId) {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (sub.status === "trialing") {
              const trialEnd = (sub as any).trial_end;
              const trialEndsAt = trialEnd && trialEnd > 0
                ? new Date(trialEnd * 1000)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
            } else {
              const rawEnd = (sub as any).current_period_end;
              const periodEnd = rawEnd && rawEnd > 0
                ? new Date(rawEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
            }
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          const stripeCustomerId = sub.customer as string;
          const stripeSubId = sub.id;
          const subStatus = sub.status;

          const userId = await findUserByStripeCustomerId(stripeCustomerId);
          if (userId) {
            const priceId = sub.items?.data?.[0]?.price?.id;
            const plan = (priceId && PRICE_TO_PLAN[priceId]) || sub.metadata?.plan || "monthly";

            if (subStatus === "trialing") {
              const trialEnd = sub.trial_end;
              const trialEndsAt = trialEnd && trialEnd > 0
                ? new Date(trialEnd * 1000)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, null, trialEndsAt);
            } else if (subStatus === "active") {
              const rawEnd = sub.current_period_end;
              const periodEnd = rawEnd && rawEnd > 0
                ? new Date(rawEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, periodEnd, null);
            } else if (subStatus === "canceled" || subStatus === "unpaid") {
              await updateSubscriptionStatus(stripeSubId, "canceled");
            } else if (subStatus === "past_due" || subStatus === "incomplete_expired") {
              await updateSubscriptionStatus(stripeSubId, "expired");
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          await updateSubscriptionStatus(sub.id, "canceled");
          break;
        }
      }

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
      const hasDocuments = checklistDone >= 4;

      const hasPhone = !!(notif.phone_e164 && notif.phone_e164.length > 5);

      const hasNetworkDone = !!(profileData?.network_task_done);
      const hasViewingTipsDone = !!(profileData?.viewing_tips_done);
      const hasMultipleProfiles = searchProfiles.length >= 2;

      const accountTasks = [
        { id: "alerts", label: "Alerts activeren", completed: hasAlertChannel, score: 20 },
        { id: "search_buddy", label: "Zoekbuddy toevoegen", completed: hasSearchBuddy, score: 10 },
        { id: "search_optimize", label: "Zoekopdracht optimaliseren", completed: hasOptimizedSearch, score: 20 },
        { id: "application_template", label: "Aanmeldingsbrief voorbereiden", completed: hasApplicationTemplate, score: 15 },
        { id: "documents", label: "Documenten verzamelen", completed: hasDocuments, score: 20 },
        { id: "phone", label: "Telefoonnummer toevoegen", completed: hasPhone, score: 15 },
      ];

      const hasSearchProfile = searchProfiles.length >= 1;

      const prepTasks = [
        { id: "prep_search_profile", label: "Zoekopdracht aanmaken", completed: hasSearchProfile, score: 15 },
        { id: "prep_letter", label: "Schrijf een introductiebrief", completed: hasApplicationTemplate, score: 10 },
        { id: "prep_extra_profile", label: "Voeg extra zoekopdracht toe", completed: hasMultipleProfiles, score: 15 },
        { id: "prep_network", label: "Gebruik je netwerk", completed: hasNetworkDone, score: 5 },
        { id: "prep_viewing_tips", label: "Lees bezichtigingtips", completed: hasViewingTipsDone, score: 5 },
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
        { id: "alerts_active", label: "Alerts actief", done: hasAlertChannel },
        { id: "letter_ready", label: "Aanmeldingsbrief klaar", done: hasApplicationTemplate },
        { id: "documents_ready", label: "Documenten klaar", done: hasDocuments },
        { id: "phone_added", label: "Telefoonnummer toegevoegd", done: hasPhone },
      ];

      const speedDone = speedSteps.filter(s => s.done).length;

      const recommendedChannel = notif.email_enabled ? "E-mail" : null;

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

      const defaults = { user_id: user.id, search_buddy_email: null, application_template: null, document_checklist: {} };

      const { rows } = await pgPool.query(
        "SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1",
        [user.id]
      );

      return res.json(rows[0] ?? defaults);
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

      const ALLOWED_FIELDS = [
        "search_buddy_email", "application_template", "document_checklist",
        "network_task_done", "viewing_tips_done",
        "first_name", "last_name", "birth_date", "phone", "bio",
        "profile_photo_url", "occupation", "monthly_income",
      ];

      const updates: Record<string, any> = {};
      for (const f of ALLOWED_FIELDS) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
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

      const { rows } = await pgPool.query(query, insertValues);

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

      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[profile-data] PUT error:", err.message);
      return res.status(500).json({ error: "Opslaan mislukt. Probeer opnieuw." });
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

      const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: "Invalid image format" });

      const contentType = matches[1];
      const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
      const buffer = Buffer.from(matches[2], "base64");

      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Image too large (max 5MB)" });
      }

      const filePath = `profile-photos/${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
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
          message: "Je hebt een actief abonnement. Zeg dit eerst op voordat je je account verwijdert.",
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
        return res.status(500).json({ error: "Account data verwijderd, maar authenticatie kon niet worden verwijderd. Neem contact op met support." });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[account-delete] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

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

      const matchResult = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("user_id", user.id);

      let reactionCount = 0;
      try {
        const reactionResult = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("applied", true);
        reactionCount = reactionResult.count ?? 0;
      } catch {}

      return res.json({
        matches_received: matchResult.count ?? 0,
        reactions_sent: reactionCount,
      });
    } catch (err: any) {
      return res.json({ matches_received: 0, reactions_sent: 0 });
    }
  });

  app.post("/api/backfill-images", async (req, res) => {
    try {
      const cheerio = await import("cheerio");
      const UA = "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.de)";

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
        return res.status(409).json({ error: "Deze zoekopdracht is al door iemand anders gebruikt." });
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

  return httpServer;
}
