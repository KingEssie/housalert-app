import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { Resend } from "resend";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "";
const TEST_PASS = process.env.TEST_USER_PASSWORD ?? "";
const TEST_PHONE = process.env.TEST_PHONE_E164 ?? "";
const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface CheckResult { name: string; pass: boolean; detail: string }
const checks: CheckResult[] = [];
function pass(name: string, detail = "") { checks.push({ name, pass: true, detail }); }
function fail(name: string, detail: string) { checks.push({ name, pass: false, detail }); }

const cleanup: Array<() => Promise<void>> = [];

function formatMessage(listing: any): string {
  const parts = [
    `Nieuwe match gevonden: ${listing.title}`,
    listing.city,
    listing.price > 0 ? `€${listing.price}/mnd` : null,
    listing.size_m2 > 0 ? `${listing.size_m2}m²` : null,
    listing.bedrooms > 0 ? `${listing.bedrooms} slk.` : null,
  ].filter(Boolean).join(" — ");
  const link = listing.url || "";
  return link ? `${parts}\nLink: ${link}` : parts;
}

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
    );
    const data: any = await res.json();
    const conn = data.items?.[0];
    if (!conn?.settings?.api_key) return null;
    return { apiKey: conn.settings.api_key, fromEmail: conn.settings.from_email };
  } catch { return null; }
}

async function main() {
  console.log("🔔 Notification Delivery Test\n");

  // ── PRECHECK ──
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SUPABASE_ANON) missing.push("VITE_SUPABASE_ANON_KEY");
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!TEST_EMAIL) missing.push("TEST_USER_EMAIL");
  if (!TEST_PASS) missing.push("TEST_USER_PASSWORD");
  if (!TEST_PHONE) missing.push("TEST_PHONE_E164");
  if (missing.length > 0) {
    fail("PRECHECK", `Missing env: ${missing.join(", ")}`);
    printAndExit();
    return;
  }
  pass("PRECHECK", "All env vars present");

  // ── A) SETTINGS ──
  const anonSb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: signIn, error: signInErr } = await anonSb.auth.signInWithPassword({
    email: TEST_EMAIL, password: TEST_PASS,
  });
  if (signInErr || !signIn.session) {
    fail("SETTINGS", `Login failed: ${signInErr?.message ?? "no session"}`);
    printAndExit();
    return;
  }
  const userId = signIn.user!.id;
  const token = signIn.session.access_token;

  const putBody = {
    email_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: true,
    phone_e164: TEST_PHONE,
  };
  const putRes = await fetch(`${BASE}/api/notifications/settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    fail("SETTINGS", `PUT failed: ${err.error}`);
    printAndExit();
    return;
  }

  const getRes = await fetch(`${BASE}/api/notifications/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const settings = await getRes.json();
  console.log("  Settings:", JSON.stringify({
    email_enabled: settings.email_enabled,
    sms_enabled: settings.sms_enabled,
    whatsapp_enabled: settings.whatsapp_enabled,
    phone_e164: settings.phone_e164,
  }));

  if (settings.email_enabled && settings.sms_enabled && settings.whatsapp_enabled && settings.phone_e164 === TEST_PHONE) {
    pass("SETTINGS", "All channels enabled");
  } else {
    fail("SETTINGS", "Settings mismatch after save");
    printAndExit();
    return;
  }

  // ── B) GUARANTEED MATCH ──
  const { data: profile, error: profErr } = await sb
    .from("search_profiles")
    .insert({ user_id: userId, city: "Berlin", price_min: 0, price_max: 99999, bedrooms_min: 0, size_min: 0 })
    .select("id")
    .single();

  if (profErr || !profile) {
    fail("MATCH", `Profile create failed: ${profErr?.message ?? "null"}`);
    printAndExit();
    return;
  }
  cleanup.push(async () => {
    await sb.from("matches").delete().eq("search_profile_id", profile.id);
    await sb.from("search_profiles").delete().eq("id", profile.id);
  });

  const ts = Date.now();
  const listing = {
    source: "e2e-test", source_id: `e2e-notif-test-${ts}`,
    url: "https://example.com/e2e-notif-test",
    title: "E2E NOTIF TEST - Berlin", city: "Berlin",
    price: 1200, bedrooms: 2, size_m2: 60,
  };

  const { data: listingRow, error: lErr } = await sb.from("listings").insert(listing).select("id").single();
  if (lErr || !listingRow) {
    fail("MATCH", `Listing insert failed: ${lErr?.message ?? "null"}`);
    await runCleanup();
    printAndExit();
    return;
  }
  cleanup.push(async () => {
    await sb.from("matches").delete().eq("listing_id", listingRow.id);
    await sb.from("listings").delete().eq("id", listingRow.id);
  });

  const { data: existing } = await sb
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .eq("search_profile_id", profile.id)
    .eq("listing_id", listingRow.id)
    .maybeSingle();

  if (!existing) {
    const { error: mErr } = await sb
      .from("matches")
      .insert({ user_id: userId, search_profile_id: profile.id, listing_id: listingRow.id });
    if (mErr) {
      fail("MATCH", `Match insert failed: ${mErr.message}`);
      await runCleanup();
      printAndExit();
      return;
    }
  }

  pass("MATCH", `profile=${profile.id.slice(0, 8)}… listing=${listingRow.id.slice(0, 8)}…`);

  // ── C) TRIGGER ALERTS ── call channels directly, capturing results
  pass("ALERT_CALL", "Calling all 3 channels now…");

  const deliveryResults: { channel: string; status: string; detail: string }[] = [];

  // EMAIL via Resend
  const resendCreds = await getResendCredentials();
  if (!resendCreds) {
    deliveryResults.push({ channel: "EMAIL", status: "SKIP", detail: "Resend connector not available (REPLIT_CONNECTORS_HOSTNAME or token missing)" });
  } else {
    try {
      const resend = new Resend(resendCreds.apiKey);
      const { data: emailData, error: emailErr } = await resend.emails.send({
        from: resendCreds.fromEmail || "Stekkies <onboarding@resend.dev>",
        to: TEST_EMAIL,
        subject: `[E2E TEST] Nieuwe match: ${listing.title}`,
        text: `E2E test alert\n\n${formatMessage(listing)}`,
      });
      if (emailErr) {
        deliveryResults.push({ channel: "EMAIL", status: "FAIL", detail: emailErr.message });
      } else {
        deliveryResults.push({ channel: "EMAIL", status: "PASS", detail: `id=${(emailData as any)?.id ?? "unknown"}` });
      }
    } catch (e: any) {
      deliveryResults.push({ channel: "EMAIL", status: "FAIL", detail: e.message });
    }
  }

  // SMS via Twilio
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!twilioSid || !twilioToken || !smsFrom) {
    deliveryResults.push({ channel: "SMS", status: "SKIP", detail: "TWILIO_ACCOUNT_SID / AUTH_TOKEN / SMS_FROM not all set" });
  } else {
    try {
      const client = twilio(twilioSid, twilioToken);
      const msg = await client.messages.create({
        body: `[E2E TEST] ${formatMessage(listing)}`,
        from: smsFrom,
        to: TEST_PHONE,
      });
      deliveryResults.push({ channel: "SMS", status: "PASS", detail: `SID=${msg.sid} status=${msg.status}` });
    } catch (e: any) {
      deliveryResults.push({ channel: "SMS", status: "FAIL", detail: e.message });
    }
  }

  // WHATSAPP via Twilio
  if (!twilioSid || !twilioToken || !waFrom) {
    deliveryResults.push({ channel: "WHATSAPP", status: "SKIP", detail: "TWILIO_WHATSAPP_FROM not set" });
  } else {
    try {
      const client = twilio(twilioSid, twilioToken);
      const waTo = TEST_PHONE.startsWith("whatsapp:") ? TEST_PHONE : `whatsapp:${TEST_PHONE}`;
      const msg = await client.messages.create({
        body: `[E2E TEST] ${formatMessage(listing)}`,
        from: waFrom,
        to: waTo,
      });
      deliveryResults.push({ channel: "WHATSAPP", status: "PASS", detail: `SID=${msg.sid} status=${msg.status}` });
    } catch (e: any) {
      let detail = e.message;
      if (e.code === 63007 || e.code === 21608 || detail.includes("sandbox") || detail.includes("not a valid WhatsApp")) {
        detail += "\n\n     ℹ️  WhatsApp Sandbox Setup Required:\n"
          + "     1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn\n"
          + "     2. Send the 'join <keyword>' message from your phone to the sandbox number\n"
          + "     3. TWILIO_WHATSAPP_FROM must be 'whatsapp:+14155238886' (the sandbox number)\n"
          + "     4. The TO number must have joined the sandbox first\n"
          + "     5. For production: apply for a WhatsApp Business Profile in Twilio console";
      }
      deliveryResults.push({ channel: "WHATSAPP", status: "FAIL", detail });
    }
  }

  // ── D) DELIVERY REPORT ──
  console.log("\n  ── Delivery Results ──");
  let allDelivered = true;
  for (const d of deliveryResults) {
    const icon = d.status === "PASS" ? "✅" : d.status === "SKIP" ? "⏭️" : "❌";
    console.log(`  ${icon}  ${d.channel.padEnd(10)} ${d.status}  ${d.detail}`);
    if (d.status === "FAIL") allDelivered = false;
  }

  const deliveryDetail = deliveryResults.map(d => `${d.channel}=${d.status}`).join(" ");
  if (allDelivered) pass("DELIVERY", deliveryDetail);
  else fail("DELIVERY", deliveryDetail);

  // ── E) CLEANUP ──
  await runCleanup();
  console.log("  ✅  Cleanup complete");

  printAndExit();
}

async function runCleanup() {
  for (const fn of cleanup.reverse()) {
    try { await fn(); } catch {}
  }
  cleanup.length = 0;
  try {
    await sb.from("user_notification_settings").delete().eq("user_id",
      (await sb.auth.admin.listUsers()).data.users.find(u => u.email === TEST_EMAIL)?.id ?? "");
  } catch {}
}

function printAndExit() {
  console.log("\n" + "═".repeat(56));
  console.log("  E2E Notification Delivery — Summary");
  console.log("═".repeat(56) + "\n");

  let maxName = 0;
  for (const c of checks) maxName = Math.max(maxName, c.name.length);

  for (const c of checks) {
    const icon = c.pass ? "✅" : "❌";
    console.log(`  ${icon}  ${c.name.padEnd(maxName + 2)}${c.detail}`);
  }

  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  console.log("\n" + "─".repeat(56));
  console.log(`  ✅ ${passed} passed  |  ❌ ${failed} failed`);
  console.log("─".repeat(56) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("💥 Unhandled:", err.message);
  runCleanup().finally(() => process.exit(1));
});
