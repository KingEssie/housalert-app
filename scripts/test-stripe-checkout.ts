import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = "http://localhost:5000";
const PLANS = ["monthly", "two_month", "three_month"] as const;

let passed = 0;
let failed = 0;

function assert(section: string, label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function getTestToken(): Promise<string | null> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) return null;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return data.session.access_token;
}

async function testEnvCheck() {
  console.log("\n═══ ENV CHECK ═══");

  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const priceTwoMonth = process.env.STRIPE_PRICE_TWO_MONTH;
  const priceThreeMonth = process.env.STRIPE_PRICE_THREE_MONTH;
  const baseUrl = process.env.APP_PUBLIC_BASE_URL;

  assert("ENV", "STRIPE_PRICE_MONTHLY is set", !!priceMonthly);
  assert("ENV", "STRIPE_PRICE_TWO_MONTH is set", !!priceTwoMonth);
  assert("ENV", "STRIPE_PRICE_THREE_MONTH is set", !!priceThreeMonth);
  assert("ENV", "APP_PUBLIC_BASE_URL is set", !!baseUrl, baseUrl || "not set");

  if (priceMonthly) assert("ENV", "STRIPE_PRICE_MONTHLY starts with 'price_'", priceMonthly.startsWith("price_"), priceMonthly);
  if (priceTwoMonth) assert("ENV", "STRIPE_PRICE_TWO_MONTH starts with 'price_'", priceTwoMonth.startsWith("price_"), priceTwoMonth);
  if (priceThreeMonth) assert("ENV", "STRIPE_PRICE_THREE_MONTH starts with 'price_'", priceThreeMonth.startsWith("price_"), priceThreeMonth);
}

async function testUnauthenticated() {
  console.log("\n═══ AUTH CHECK ═══");

  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "monthly" }),
  });
  assert("AUTH", "No token → 401", res.status === 401);

  const res2 = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer bad_token" },
    body: JSON.stringify({ plan: "monthly" }),
  });
  assert("AUTH", "Bad token → 401", res2.status === 401);
}

async function testInvalidPlan(token: string) {
  console.log("\n═══ INVALID PLAN ═══");

  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan: "invalid_plan" }),
  });
  assert("INVALID", "Invalid plan → 400", res.status === 400);
}

async function testPlanCheckout(token: string, plan: string) {
  const sectionName = plan.toUpperCase() + " PLAN";
  console.log(`\n═══ ${sectionName} ═══`);

  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });

  const data = await res.json();

  assert(sectionName, `Status is 200`, res.status === 200, `got ${res.status}`);
  assert(sectionName, `Response contains url`, !!data.url, JSON.stringify(data).slice(0, 200));
  assert(sectionName, `URL is a Stripe checkout URL`, data.url?.includes("checkout.stripe.com"), data.url?.slice(0, 80));

  return data;
}

async function testRedirectUrls(token: string) {
  console.log("\n═══ REDIRECT URLS ═══");

  const baseUrl = process.env.APP_PUBLIC_BASE_URL || "http://localhost:5000";

  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan: "monthly" }),
  });

  const data = await res.json();

  if (!data.url) {
    assert("URLS", "Got checkout URL to inspect", false, "No URL returned");
    return;
  }

  const { getUncachableStripeClient } = await import("../server/stripe/stripeClient");
  const stripe = await getUncachableStripeClient();

  const sessionId = new URL(data.url).pathname.split("/").pop();
  if (!sessionId) {
    assert("URLS", "Extracted session ID from URL", false, data.url);
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const expectedSuccess = `${baseUrl}/dashboard?payment=success`;
  const expectedCancel = `${baseUrl}/paywall`;

  assert("URLS", `success_url = ${expectedSuccess}`, session.success_url === expectedSuccess, session.success_url || "null");
  assert("URLS", `cancel_url = ${expectedCancel}`, session.cancel_url === expectedCancel, session.cancel_url || "null");
}

async function testPriceMapping(token: string) {
  console.log("\n═══ PRICE MAPPING ═══");

  const { getUncachableStripeClient } = await import("../server/stripe/stripeClient");
  const stripe = await getUncachableStripeClient();

  const priceMap: Record<string, string> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || "",
    two_month: process.env.STRIPE_PRICE_TWO_MONTH || "",
    three_month: process.env.STRIPE_PRICE_THREE_MONTH || "",
  };

  for (const plan of PLANS) {
    const res = await fetch(`${BASE}/api/checkout/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();
    if (!data.url) {
      assert("PRICE", `${plan}: got checkout URL`, false);
      continue;
    }

    const sessionId = new URL(data.url).pathname.split("/").pop();
    if (!sessionId) continue;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    const lineItemPriceId = session.line_items?.data?.[0]?.price?.id;
    const expectedPriceId = priceMap[plan];

    assert("PRICE", `${plan}: price ID matches (${expectedPriceId})`, lineItemPriceId === expectedPriceId, `got ${lineItemPriceId}`);
  }
}

async function run() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   STRIPE CHECKOUT FLOW TEST REPORT   ║");
  console.log("╚══════════════════════════════════════╝");

  await testEnvCheck();
  await testUnauthenticated();

  const token = await getTestToken();
  if (!token) {
    console.log("\n❌ Could not get test user token. Set TEST_USER_EMAIL and TEST_USER_PASSWORD.");
    process.exit(1);
  }
  console.log("\n  🔑 Test user authenticated");

  await testInvalidPlan(token);

  for (const plan of PLANS) {
    await testPlanCheckout(token, plan);
  }

  await testRedirectUrls(token);
  await testPriceMapping(token);

  console.log("\n╔══════════════════════════════════════╗");
  console.log(`║   RESULTS: ${passed} PASSED, ${failed} FAILED${" ".repeat(Math.max(0, 13 - String(passed).length - String(failed).length))}║`);
  console.log("╚══════════════════════════════════════╝");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
