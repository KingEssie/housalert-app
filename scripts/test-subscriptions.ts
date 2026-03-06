import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let passed = 0;
let failed = 0;
let testUserId: string | null = null;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function findTestUser(): Promise<string | null> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (data?.users?.length) {
    return data.users[0].id;
  }
  return null;
}

async function cleanup() {
  if (testUserId) {
    await supabase.from("subscriptions").delete().eq("user_id", testUserId);
  }
}

async function testTrialCreation() {
  console.log("\n1. Trial subscription creation");

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: testUserId!,
      status: "trial",
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();

  assert("Trial row inserted without error", !error, error?.message);
  assert("Status is 'trial'", data?.status === "trial");
  assert("trial_ends_at is set", !!data?.trial_ends_at);
  assert("plan is null", data?.plan === null);

  return data;
}

async function testDuplicatePrevention() {
  console.log("\n2. Duplicate trial prevention (unique constraint)");

  const { error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: testUserId!,
      status: "trial",
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

  assert("Duplicate insert rejected (unique user_id)", !!error, error?.message);
}

async function testStatusLogic() {
  console.log("\n3. Subscription status logic");

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", testUserId!)
    .single();

  assert("Row found", !!data);

  if (data) {
    const now = new Date();
    const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null;

    const isTrial = data.status === "trial" && trialEnd !== null && trialEnd > now;
    const isActive = data.status === "active";
    const hasAccess = isTrial || isActive;

    assert("isTrial is true (trial not expired)", isTrial);
    assert("isActive is false (no subscription yet)", !isActive);
    assert("hasAccess is true (in trial)", hasAccess);
  }
}

async function testStatusUpdate() {
  console.log("\n4. Subscription activation");

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      plan: "monthly",
      stripe_customer_id: "cus_test_123",
      stripe_subscription_id: "sub_test_123",
      current_period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", testUserId!);

  assert("Update to active succeeded", !error, error?.message);

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", testUserId!)
    .single();

  assert("Status is 'active'", data?.status === "active");
  assert("Plan is 'monthly'", data?.plan === "monthly");
  assert("stripe_customer_id is set", data?.stripe_customer_id === "cus_test_123");
  assert("stripe_subscription_id is set", data?.stripe_subscription_id === "sub_test_123");
  assert("current_period_ends_at is set", !!data?.current_period_ends_at);
}

async function testStatusEndpoint() {
  console.log("\n5. GET /api/subscription/status endpoint");

  try {
    const res = await fetch("http://localhost:5000/api/subscription/status");
    assert("Unauthenticated request returns 401", res.status === 401);
  } catch (err: any) {
    assert("Status endpoint reachable", false, err.message);
  }
}

async function testCheckoutEndpoint() {
  console.log("\n6. POST /api/checkout/session endpoint");

  try {
    const res = await fetch("http://localhost:5000/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "monthly" }),
    });
    assert("Unauthenticated request returns 401", res.status === 401);
  } catch (err: any) {
    assert("Checkout endpoint reachable", false, err.message);
  }

  try {
    const res = await fetch("http://localhost:5000/api/checkout/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_token",
      },
      body: JSON.stringify({ plan: "monthly" }),
    });
    assert("Invalid token returns 401", res.status === 401);
  } catch (err: any) {
    assert("Checkout endpoint reachable with bad token", false, err.message);
  }
}

async function testEnsureTrialEndpoint() {
  console.log("\n7. POST /api/subscription/ensure-trial endpoint");

  try {
    const res = await fetch("http://localhost:5000/api/subscription/ensure-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert("Unauthenticated request returns 401", res.status === 401);
  } catch (err: any) {
    assert("Ensure-trial endpoint reachable", false, err.message);
  }
}

async function run() {
  console.log("=== Subscription Tests ===");

  testUserId = await findTestUser();
  if (!testUserId) {
    console.error("No users found in Supabase. Cannot run tests.");
    process.exit(1);
  }
  console.log(`Using test user: ${testUserId}`);

  await cleanup();

  await testTrialCreation();
  await testDuplicatePrevention();
  await testStatusLogic();
  await testStatusUpdate();
  await testStatusEndpoint();
  await testCheckoutEndpoint();
  await testEnsureTrialEndpoint();

  await cleanup();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
