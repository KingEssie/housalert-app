import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function getTestToken(): Promise<{ token: string; userId: string }> {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Auth failed: ${error?.message}`);
  return { token: data.session.access_token, userId: data.user.id };
}

async function getStripeClient(): Promise<Stripe> {
  const { getUncachableStripeClient } = await import("../server/stripe/stripeClient");
  return getUncachableStripeClient();
}

// ─── 1. ENV CHECK ───

async function testEnvCheck() {
  console.log("\n═══ ENV CHECK ═══");

  const vars = [
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_TWO_MONTH",
    "STRIPE_PRICE_THREE_MONTH",
    "APP_PUBLIC_BASE_URL",
    "STRIPE_WEBHOOK_SECRET",
  ];

  for (const v of vars) {
    assert(`${v} is set`, !!process.env[v]);
  }

  let stripeOk = false;
  try {
    const stripe = await getStripeClient();
    await stripe.prices.list({ limit: 1 });
    stripeOk = true;
  } catch (e: any) {
    stripeOk = false;
  }
  assert("Stripe API connection works", stripeOk);
}

// ─── 2. WEBHOOK ROUTE ───

async function testWebhookRoute() {
  console.log("\n═══ WEBHOOK ROUTE ═══");

  const res1 = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert("Webhook rejects unsigned request (400)", res1.status === 400, `got ${res1.status}`);

  const res2 = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=123,v1=bad_signature",
    },
    body: "{}",
  });
  assert("Webhook rejects bad signature (400)", res2.status === 400, `got ${res2.status}`);
}

// ─── 3. CHECKOUT SESSION ───

async function testCheckoutSession(token: string) {
  console.log("\n═══ CHECKOUT SESSION ═══");

  const plans = ["monthly", "two_month", "three_month"];

  for (const plan of plans) {
    const res = await fetch(`${BASE}/api/checkout/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    assert(`${plan}: returns 200`, res.status === 200, `got ${res.status}`);
    assert(`${plan}: returns Stripe URL`, data.url?.includes("checkout.stripe.com"), data.url?.slice(0, 60));
  }
}

// ─── 4. SUBSCRIPTION ACTIVATION (simulated webhook) ───

async function testSubscriptionActivation(token: string, userId: string) {
  console.log("\n═══ SUBSCRIPTION ACTIVATION ═══");

  const stripe = await getStripeClient();
  const plan = "monthly";

  // Step 1: Reset user to trial state
  await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      status: "trial",
      plan: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_ends_at: null,
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  const { data: before } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  assert("User starts in trial state", before?.status === "trial", `status=${before?.status}`);

  // Step 2: Create a checkout session
  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
  const { url } = await res.json();
  assert("Checkout session created", !!url);

  // Step 3: Read back user's stripe_customer_id (set during checkout session creation)
  const { data: afterCheckout } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  assert("stripe_customer_id set after checkout creation", !!afterCheckout?.stripe_customer_id, afterCheckout?.stripe_customer_id || "null");

  const stripeCustomerId = afterCheckout?.stripe_customer_id;

  // Step 4: Simulate what the webhook does by calling the subscription helper directly
  // (We can't complete a real Stripe payment in a test, but we can verify
  //  the webhook handler logic by calling the same functions it calls)
  console.log("  ℹ️  Simulating webhook activation (calling same helpers as webhook handler)...");

  const { updateSubscriptionFromCheckout } = await import("../server/subscriptions");

  const fakeStripeSubId = `sub_test_${Date.now()}`;
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await updateSubscriptionFromCheckout(
    userId,
    stripeCustomerId || `cus_test_${Date.now()}`,
    fakeStripeSubId,
    plan,
    periodEnd
  );

  // Step 5: Verify the subscription was activated
  const { data: after } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  assert("status = active", after?.status === "active", `status=${after?.status}`);
  assert("plan = monthly", after?.plan === "monthly", `plan=${after?.plan}`);
  assert("stripe_customer_id is set", !!after?.stripe_customer_id);
  assert("stripe_subscription_id is set", after?.stripe_subscription_id === fakeStripeSubId, after?.stripe_subscription_id || "null");
  assert("current_period_ends_at is set", !!after?.current_period_ends_at);

  // Step 6: Verify the subscription status endpoint reflects active
  const statusRes = await fetch(`${BASE}/api/subscription/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const statusData = await statusRes.json();
  assert("GET /api/subscription/status → isActive=true", statusData.isActive === true, JSON.stringify(statusData));
  assert("GET /api/subscription/status → isExpired=false", statusData.isExpired === false);
  assert("GET /api/subscription/status → plan=monthly", statusData.plan === "monthly", `plan=${statusData.plan}`);

  return fakeStripeSubId;
}

// ─── 5. CANCEL / FAILURE BEHAVIOR ───

async function testCancelBehavior(userId: string, stripeSubId: string) {
  console.log("\n═══ FAILURE / CANCEL BEHAVIOR ═══");

  const { updateSubscriptionStatus } = await import("../server/subscriptions");

  // Simulate subscription cancellation (same as webhook: customer.subscription.deleted)
  await updateSubscriptionStatus(stripeSubId, "canceled");

  const { data: after } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  assert("Cancel: status = canceled", after?.status === "canceled", `status=${after?.status}`);
  assert("Cancel: plan still set", after?.plan === "monthly", `plan=${after?.plan}`);

  // Invalid plan should not create a checkout
  const { token } = await getTestToken();
  const res = await fetch(`${BASE}/api/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan: "nonexistent_plan" }),
  });
  assert("Invalid plan rejected (400)", res.status === 400, `got ${res.status}`);
}

// ─── 6. CLEANUP & RESTORE ───

async function cleanup(userId: string) {
  // Restore user to trial state for normal app usage
  await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      status: "trial",
      plan: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_ends_at: null,
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

// ─── RUNNER ───

async function run() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   STRIPE E2E PAYMENT + WEBHOOK TEST      ║");
  console.log("╚══════════════════════════════════════════╝");

  await testEnvCheck();
  await testWebhookRoute();

  const { token, userId } = await getTestToken();
  console.log(`\n  🔑 Authenticated as ${userId}`);

  await testCheckoutSession(token);
  const stripeSubId = await testSubscriptionActivation(token, userId);
  await testCancelBehavior(userId, stripeSubId);

  await cleanup(userId);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║   FINAL RESULT: ${passed} PASSED, ${failed} FAILED${" ".repeat(Math.max(0, 12 - String(passed).length - String(failed).length))}║`);
  console.log("╚══════════════════════════════════════════╝");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
