import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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

  app.get("/api/listings/fresh", async (_req, res) => {
    try {
      const freshRows = await getNewestListingIds(50);
      if (freshRows.length === 0) return res.json([]);

      const ids = freshRows.map((r) => r.listing_id);
      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url")
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
        .select("id, listing_id, created_at")
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

      const [listingsRes, freshnessMap] = await Promise.all([
        supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url")
          .in("id", listingIds),
        getListingFreshness(listingIds),
      ]);

      if (listingsRes.error) return res.status(500).json({ error: listingsRes.error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listingsRes.data ?? []) listingMap[l.id] = l;

      const result = top50.map((m: any) => {
        const l = listingMap[m.listing_id];
        const firstSeenAt = freshnessMap[m.listing_id]?.first_seen_at || m.created_at;

        return {
          listing_id: m.listing_id,
          title: l?.title ?? null,
          price: l?.price ?? null,
          size_m2: l?.size_m2 ?? null,
          bedrooms: l?.bedrooms ?? null,
          city: l?.city ?? null,
          source: l?.source ?? null,
          url: l?.url ?? null,
          matched_at: m.matched_at,
          first_seen_at: firstSeenAt,
          fresh_label: computeFreshLabel(firstSeenAt),
        };
      });

      return res.json(result);
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

  app.post("/api/checkout", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: "priceId is required" });

      const PLAN_PRICE_MAP: Record<string, string> = {
        "1-month": process.env.STRIPE_PRICE_1_MONTH || "",
        "2-months": process.env.STRIPE_PRICE_2_MONTHS || "",
        "3-months": process.env.STRIPE_PRICE_3_MONTHS || "",
      };

      const stripePriceId = PLAN_PRICE_MAP[priceId] || priceId;
      if (!stripePriceId) {
        return res.status(400).json({ error: "Stripe prices are not yet configured. Set STRIPE_PRICE_* environment variables." });
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

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${protocol}://${host}/dashboard?checkout=success`,
        cancel_url: `${protocol}://${host}/paywall?checkout=cancelled`,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err);
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
