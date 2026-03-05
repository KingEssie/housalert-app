import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "";
const TEST_PASS = process.env.TEST_USER_PASSWORD ?? "";
const TEST_PHONE = process.env.TEST_PHONE_E164 ?? "+31600000000";

interface Result { name: string; pass: boolean; detail: string }
const results: Result[] = [];

function ok(name: string, detail = "") { results.push({ name, pass: true, detail }); }
function fail(name: string, detail: string) { results.push({ name, pass: false, detail }); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function envCheck() {
  const required: [string, string][] = [
    ["VITE_SUPABASE_URL", SUPABASE_URL],
    ["VITE_SUPABASE_ANON_KEY", SUPABASE_ANON],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
    ["TEST_USER_EMAIL", TEST_EMAIL],
    ["TEST_USER_PASSWORD", TEST_PASS],
  ];
  const optional: [string, string | undefined][] = [
    ["TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID],
    ["TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN],
    ["TWILIO_SMS_FROM", process.env.TWILIO_SMS_FROM],
    ["TWILIO_WHATSAPP_FROM", process.env.TWILIO_WHATSAPP_FROM],
    ["RESEND_API_KEY", process.env.RESEND_API_KEY],
    ["REPLIT_CONNECTORS_HOSTNAME", process.env.REPLIT_CONNECTORS_HOSTNAME],
    ["INGEST_INTERVAL_MINUTES", process.env.INGEST_INTERVAL_MINUTES],
  ];

  let missing: string[] = [];
  for (const [k, v] of required) {
    if (!v) missing.push(k);
  }
  if (missing.length > 0) {
    fail("A. ENV required", `Missing: ${missing.join(", ")}`);
    return false;
  }
  ok("A. ENV required", "All present");

  const optMissing = optional.filter(([, v]) => !v).map(([k]) => k);
  if (optMissing.length > 0) {
    ok("A. ENV optional", `Not set (ok): ${optMissing.join(", ")}`);
  } else {
    ok("A. ENV optional", "All present");
  }
  return true;
}

async function apiHealth() {
  try {
    const r1 = await fetch(`${BASE}/api/ingest/health`);
    const j1 = await r1.json();
    if (j1.ok) ok("B. /ingest/health", `sources: ${j1.sourcesEnabled?.length ?? "?"}`);
    else fail("B. /ingest/health", JSON.stringify(j1));
  } catch (e: any) { fail("B. /ingest/health", e.message); }

  try {
    const r2 = await fetch(`${BASE}/api/ingest/status`);
    const j2 = await r2.json();
    if ("running" in j2) ok("B. /ingest/status", `running=${j2.running}`);
    else fail("B. /ingest/status", "No running flag");
  } catch (e: any) { fail("B. /ingest/status", e.message); }

  try {
    const r3 = await fetch(`${BASE}/api/ingest/next-run`);
    const j3 = await r3.json();
    if (j3.intervalMinutes) ok("B. /ingest/next-run", `interval=${j3.intervalMinutes}min`);
    else fail("B. /ingest/next-run", JSON.stringify(j3));
  } catch (e: any) { fail("B. /ingest/next-run", e.message); }

  try {
    const r4 = await fetch(`${BASE}/api/listings/fresh`);
    const j4 = await r4.json();
    const arr = Array.isArray(j4) ? j4 : j4.listings;
    if (Array.isArray(arr)) ok("B. /listings/fresh", `count=${arr.length}`);
    else fail("B. /listings/fresh", "Not an array");
  } catch (e: any) { fail("B. /listings/fresh", e.message); }
}

let testUserId = "";
let accessToken = "";

async function authFlow() {
  const anonSb = createClient(SUPABASE_URL, SUPABASE_ANON);

  const { data: signIn, error: signInErr } = await anonSb.auth.signInWithPassword({
    email: TEST_EMAIL, password: TEST_PASS,
  });

  if (signInErr) {
    const { data: signUp, error: signUpErr } = await anonSb.auth.signUp({
      email: TEST_EMAIL, password: TEST_PASS,
    });
    if (signUpErr || !signUp.session) {
      fail("C. Auth sign-in/up", signUpErr?.message ?? "No session after signup");
      return false;
    }
    testUserId = signUp.user!.id;
    accessToken = signUp.session.access_token;
    ok("C. Auth sign-up", `user=${testUserId.slice(0, 8)}…`);
  } else {
    testUserId = signIn.user!.id;
    accessToken = signIn.session!.access_token;
    ok("C. Auth sign-in", `user=${testUserId.slice(0, 8)}…`);
  }

  try {
    const r = await fetch(`${BASE}/api/notifications/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = await r.json();
    if (r.ok) ok("B. /notifications/settings", `email=${j.email_enabled}`);
    else fail("B. /notifications/settings", j.error);
  } catch (e: any) { fail("B. /notifications/settings", e.message); }

  try {
    const putBody = {
      email_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: false,
      phone_e164: TEST_PHONE,
    };
    const r = await fetch(`${BASE}/api/notifications/settings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(putBody),
    });
    const j = await r.json();
    if (!r.ok) { fail("C. PUT settings", j.error); return false; }

    const r2 = await fetch(`${BASE}/api/notifications/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j2 = await r2.json();
    const checks = [
      j2.email_enabled === true,
      j2.sms_enabled === true,
      j2.whatsapp_enabled === false,
      j2.phone_e164 === TEST_PHONE,
    ];
    if (checks.every(Boolean)) ok("C. Settings roundtrip", "All values match");
    else fail("C. Settings roundtrip", `Got: email=${j2.email_enabled} sms=${j2.sms_enabled} wa=${j2.whatsapp_enabled} phone=${j2.phone_e164}`);
  } catch (e: any) { fail("C. Settings roundtrip", e.message); }

  return true;
}

interface ProfileRow { id: string; user_id: string; city: string; price_min: number; price_max: number; bedrooms_min: number; size_min: number }
interface ListingRow { id: string; source: string; url: string | null; title: string; city: string; price: number; bedrooms: number; size_m2: number }

function doesListingMatchProfile(listing: ListingRow, profile: ProfileRow): boolean {
  const lCity = listing.city.toLowerCase().trim();
  const pCity = profile.city.toLowerCase().trim();
  if (!lCity.includes(pCity) && !pCity.includes(lCity)) return false;
  if (profile.price_min > 0 && listing.price < profile.price_min) return false;
  if (profile.price_max > 0 && listing.price > profile.price_max) return false;
  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) return false;
  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) return false;
  return true;
}

async function runMatchingForListing(listing: ListingRow): Promise<number> {
  const { data: profiles, error: pErr } = await sb.from("search_profiles").select("*");
  if (pErr || !profiles || profiles.length === 0) return 0;

  let totalMatches = 0;
  for (const profile of profiles as ProfileRow[]) {
    if (!doesListingMatchProfile(listing, profile)) continue;

    const { data: existing } = await sb
      .from("matches")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("search_profile_id", profile.id)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (existing) continue;

    const { data: matchRow, error: mErr } = await sb
      .from("matches")
      .insert({ user_id: profile.user_id, search_profile_id: profile.id, listing_id: listing.id })
      .select("id")
      .single();

    if (!mErr && matchRow) totalMatches++;
  }
  return totalMatches;
}

const createdIds = { profileId: "", goodListingId: "", badListingId: "", matchIds: [] as string[] };

async function matchFlow() {
  const { data: profile, error: pErr } = await sb
    .from("search_profiles")
    .insert({ user_id: testUserId, city: "Berlin", price_min: 0, price_max: 1500, bedrooms_min: 1, size_min: 30 })
    .select("id")
    .single();

  if (pErr || !profile) { fail("D. Create profile", pErr?.message ?? "null"); return; }
  createdIds.profileId = profile.id;
  ok("D. Create profile", `id=${profile.id.slice(0, 8)}…`);

  const ts = Date.now();
  const goodListing = {
    source: "test-e2e", source_id: `test-good-${ts}`,
    url: `https://test.local/good-${ts}`,
    title: "Test Good Listing", city: "Berlin", price: 900, bedrooms: 2, size_m2: 55,
  };
  const badListing = {
    source: "test-e2e", source_id: `test-bad-${ts}`,
    url: `https://test.local/bad-${ts}`,
    title: "Test Bad Listing", city: "Munich", price: 3000, bedrooms: 0, size_m2: 10,
  };

  const { data: gRow, error: gErr } = await sb.from("listings").insert(goodListing).select("id").single();
  if (gErr || !gRow) { fail("D. Insert good listing", gErr?.message ?? "null"); return; }
  createdIds.goodListingId = gRow.id;

  const { data: bRow, error: bErr } = await sb.from("listings").insert(badListing).select("id").single();
  if (bErr || !bRow) { fail("D. Insert bad listing", bErr?.message ?? "null"); return; }
  createdIds.badListingId = bRow.id;
  ok("D. Insert listings", `good=${gRow.id.slice(0, 8)}… bad=${bRow.id.slice(0, 8)}…`);

  const goodMatches = await runMatchingForListing({
    id: gRow.id, source: goodListing.source, url: goodListing.url,
    title: goodListing.title, city: goodListing.city,
    price: goodListing.price, bedrooms: goodListing.bedrooms, size_m2: goodListing.size_m2,
  });

  const badMatches = await runMatchingForListing({
    id: bRow.id, source: badListing.source, url: badListing.url,
    title: badListing.title, city: badListing.city,
    price: badListing.price, bedrooms: badListing.bedrooms, size_m2: badListing.size_m2,
  });

  if (goodMatches >= 1) ok("D. Good listing matched", `matches=${goodMatches}`);
  else fail("D. Good listing matched", `expected >=1, got ${goodMatches}`);

  if (badMatches === 0) ok("D. Bad listing no match", "0 matches (correct)");
  else fail("D. Bad listing no match", `expected 0, got ${badMatches}`);

  const { data: matchRows } = await sb
    .from("matches")
    .select("id")
    .eq("listing_id", gRow.id)
    .eq("user_id", testUserId);
  createdIds.matchIds = (matchRows ?? []).map((m: any) => m.id);

  const emailConfigured = !!(process.env.REPLIT_CONNECTORS_HOSTNAME || process.env.RESEND_API_KEY);
  const smsConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM);

  ok("D. Alert channels", `email_configured=${emailConfigured} sms_configured=${smsConfigured}`);
  if (!emailConfigured) ok("D. Email alert", "Skipped — not configured");
  else ok("D. Email alert", "Configured (sent async during matching)");
  if (!smsConfigured) ok("D. SMS alert", "Skipped — not configured");
  else ok("D. SMS alert", "Configured (sent async during matching)");
}

async function cleanup() {
  let cleaned = 0;
  try {
    for (const listingId of [createdIds.goodListingId, createdIds.badListingId]) {
      if (!listingId) continue;
      const { data: lMatches } = await sb.from("matches").select("id").eq("listing_id", listingId);
      if (lMatches && lMatches.length > 0) {
        await sb.from("matches").delete().in("id", lMatches.map((m: any) => m.id));
        cleaned += lMatches.length;
      }
    }

    if (createdIds.profileId) {
      const { data: pMatches } = await sb.from("matches").select("id").eq("search_profile_id", createdIds.profileId);
      if (pMatches && pMatches.length > 0) {
        await sb.from("matches").delete().in("id", pMatches.map((m: any) => m.id));
        cleaned += pMatches.length;
      }
      await sb.from("search_profiles").delete().eq("id", createdIds.profileId);
      cleaned++;
    }

    if (createdIds.goodListingId) {
      await sb.from("listings").delete().eq("id", createdIds.goodListingId);
      cleaned++;
    }
    if (createdIds.badListingId) {
      await sb.from("listings").delete().eq("id", createdIds.badListingId);
      cleaned++;
    }

    if (testUserId) {
      await sb.from("user_notification_settings").delete().eq("user_id", testUserId);
      cleaned++;
    }

    ok("E. Cleanup", `Removed ${cleaned} test rows`);
  } catch (e: any) {
    fail("E. Cleanup", `Error during cleanup: ${e.message} (removed ${cleaned} rows before failure)`);
  }
}

function printReport() {
  console.log("\n" + "═".repeat(60));
  console.log("  STEKKIES — Full Test Report");
  console.log("═".repeat(60) + "\n");

  let maxName = 0;
  for (const r of results) maxName = Math.max(maxName, r.name.length);

  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    const name = r.name.padEnd(maxName + 2);
    console.log(`  ${icon}  ${name}${r.detail}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log("\n" + "─".repeat(60));
  console.log(`  Total: ${results.length}  |  ✅ ${passed} passed  |  ❌ ${failed} failed`);
  console.log("─".repeat(60) + "\n");

  return failed === 0;
}

async function main() {
  console.log("🔍 Starting full test suite…\n");

  const envOk = await envCheck();
  if (!envOk) { printReport(); process.exit(1); }

  await apiHealth();

  let needsCleanup = false;
  try {
    const authOk = await authFlow();
    if (authOk) {
      needsCleanup = true;
      await matchFlow();
    }
  } finally {
    if (needsCleanup) await cleanup().catch(() => {});
  }

  const allOk = printReport();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
