import type { Express } from "express";
import { createServer, type Server } from "http";
import { sendEmailMatchAlert } from "./notifications";
import {
  runAllIngesters,
  getEnabledSources,
  getLastRunStatus,
  OverlapError,
} from "./ingesters";
import { getNextRun } from "./scheduler";
import { getListingFreshness, getMatchTimestamps, getNewestListingIds } from "./freshness";
import { supabase } from "./ingesters/matching";
import { backfillMatchesForSearchProfile } from "./matching/engine";
import {
  ensureTrialSubscription,
  getSubscriptionStatus,
  updateSubscriptionFromCheckout,
  updateSubscriptionStatus,
  findUserByStripeCustomerId,
} from "./subscriptions";
import { log } from "./log";
import { computeMatchScore, getMatchReasons } from "../shared/match-score";

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

      return res.json(
        settings ?? {
          user_id: user.id,
          phone_e164: null,
          whatsapp_enabled: false,
          sms_enabled: false,
          email_enabled: true,
        }
      );
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

      const { phone_e164, whatsapp_enabled, sms_enabled, email_enabled } = req.body;

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
      if (typeof whatsapp_enabled === "boolean") payload.whatsapp_enabled = whatsapp_enabled;
      if (typeof sms_enabled === "boolean") payload.sms_enabled = sms_enabled;
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
        if (payload.whatsapp_enabled === undefined) payload.whatsapp_enabled = false;
        if (payload.sms_enabled === undefined) payload.sms_enabled = false;
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
      time: new Date().toISOString(),
    });
  });

  app.get("/api/ingest/status", (_req, res) => {
    return res.json(getLastRunStatus());
  });

  app.get("/api/ingest/next-run", (_req, res) => {
    return res.json(getNextRun());
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

      result.sort((a: any, b: any) => (b.match_score ?? 0) - (a.match_score ?? 0));

      return res.json(result);
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
        .select("id, title, price, size_m2, bedrooms, city, district, source, url, image_url, created_at")
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

  const PLAN_PRICE_MAP: Record<string, string> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_1_MONTH || "",
    two_month: process.env.STRIPE_PRICE_TWO_MONTH || process.env.STRIPE_PRICE_2_MONTHS || "",
    three_month: process.env.STRIPE_PRICE_THREE_MONTH || process.env.STRIPE_PRICE_3_MONTHS || "",
  };

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
        success_url: `${baseUrl}/dashboard?payment=success`,
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
        success_url: `${baseUrl}/dashboard?payment=success`,
        cancel_url: `${baseUrl}/paywall`,
        metadata: { supabase_user_id: user.id, plan },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
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
            const periodEnd = new Date((sub as any).current_period_end * 1000);
            await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd);
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          const stripeCustomerId = sub.customer as string;
          const stripeSubId = sub.id;
          const subStatus = sub.status;
          const periodEnd = new Date(sub.current_period_end * 1000);

          let status: "active" | "canceled" | "expired" = "active";
          if (subStatus === "canceled" || subStatus === "unpaid") {
            status = "canceled";
          } else if (subStatus === "past_due" || subStatus === "incomplete_expired") {
            status = "expired";
          }

          const userId = await findUserByStripeCustomerId(stripeCustomerId);
          if (userId) {
            const priceId = sub.items?.data?.[0]?.price?.id;
            const plan = (priceId && PRICE_TO_PLAN[priceId]) || "monthly";
            await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, periodEnd);
            if (status !== "active") {
              await updateSubscriptionStatus(stripeSubId, status, periodEnd);
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

      const profileDataPromise = supabase.from("user_profile_data").select("*").eq("user_id", user.id).maybeSingle()
        .then(r => r.error ? { data: null } : r);

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const notif = notifResult.data ?? { email_enabled: true, sms_enabled: false, whatsapp_enabled: false, phone_e164: null };
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

      const profileDataPromise = supabase.from("user_profile_data").select("*").eq("user_id", user.id).maybeSingle()
        .then(r => r.error ? { data: null } : r);

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const rawNotif = notifResult.data;
      const notif = rawNotif ?? { email_enabled: true, sms_enabled: false, whatsapp_enabled: false, phone_e164: null };
      const profileData = profileDataResult.data;
      const searchProfiles = searchProfilesResult.data ?? [];

      const hasAlertChannel = !!(notif.email_enabled || notif.sms_enabled || notif.whatsapp_enabled);
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

      const prepTasks = [
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
        sms: !!(notif.sms_enabled),
        whatsapp: !!(notif.whatsapp_enabled),
        phone: hasPhone,
      };

      const speedSteps = [
        { id: "alerts_active", label: "Alerts actief", done: hasAlertChannel },
        { id: "letter_ready", label: "Aanmeldingsbrief klaar", done: hasApplicationTemplate },
        { id: "documents_ready", label: "Documenten klaar", done: hasDocuments },
        { id: "phone_added", label: "Telefoonnummer toegevoegd", done: hasPhone },
      ];

      const speedDone = speedSteps.filter(s => s.done).length;

      const recommendedChannel = notif.whatsapp_enabled ? "WhatsApp" :
        notif.sms_enabled ? "SMS" :
        notif.email_enabled ? "E-mail" : null;

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
      const { data, error } = await supabase
        .from("user_profile_data")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        if (error.message?.includes("user_profile_data")) return res.json(defaults);
        return res.status(500).json({ error: error.message });
      }
      return res.json(data ?? defaults);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/profile-data", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { search_buddy_email, application_template, document_checklist, network_task_done, viewing_tips_done, first_name, last_name, date_of_birth, bio, profile_photo_url, occupation, monthly_income } = req.body;

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (search_buddy_email !== undefined) updates.search_buddy_email = search_buddy_email;
      if (application_template !== undefined) updates.application_template = application_template;
      if (document_checklist !== undefined) updates.document_checklist = document_checklist;
      if (network_task_done !== undefined) updates.network_task_done = network_task_done;
      if (viewing_tips_done !== undefined) updates.viewing_tips_done = viewing_tips_done;
      if (first_name !== undefined) updates.first_name = first_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
      if (bio !== undefined) updates.bio = bio;
      if (profile_photo_url !== undefined) updates.profile_photo_url = profile_photo_url;
      if (occupation !== undefined) updates.occupation = occupation;
      if (monthly_income !== undefined) updates.monthly_income = monthly_income;

      const { data, error } = await supabase
        .from("user_profile_data")
        .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        if (error.message?.includes("Could not find the table")) {
          return res.status(503).json({ error: "Profielgegevens zijn tijdelijk niet beschikbaar. Neem contact op met support." });
        }
        return res.status(500).json({ error: "Opslaan mislukt. Probeer opnieuw." });
      }
      return res.json(data);
    } catch (err: any) {
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

      await supabase
        .from("user_profile_data")
        .upsert({ user_id: user.id, profile_photo_url: photoUrl, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

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

      await supabase
        .from("user_profile_data")
        .upsert({ user_id: user.id, profile_photo_url: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profile-stats", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

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
      const UA = "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

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

  return httpServer;
}
