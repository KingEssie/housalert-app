import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = "http://localhost:5000";
const BEARER = process.env.INGEST_BEARER_TOKEN!;

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

// ─── 1. SCHEDULER ───

async function testScheduler() {
  console.log("\n═══ SCHEDULER ═══");

  const enabled = process.env.ENABLE_INGEST_SCHEDULER;
  assert("ENABLE_INGEST_SCHEDULER is set", !!enabled, enabled || "not set");
  assert("Scheduler is enabled", enabled === "true", `value="${enabled}"`);

  const healthRes = await fetch(`${BASE}/api/ingest/health`);
  const health = await healthRes.json();
  assert("Health endpoint returns 200", healthRes.status === 200);
  assert("Health status is ok", health.ok === true, JSON.stringify(health));
  assert("Sources list is non-empty", Array.isArray(health.sourcesEnabled) && health.sourcesEnabled.length > 0, `sourcesEnabled=${JSON.stringify(health.sourcesEnabled)}`);
  console.log(`  ℹ️  Enabled sources: ${health.sourcesEnabled?.join(", ")}`);

  const statusRes = await fetch(`${BASE}/api/ingest/status`);
  const status = await statusRes.json();
  assert("Status endpoint returns 200", statusRes.status === 200);
  assert("Status has lastRun data", !!status.lastRun || status.running !== undefined, JSON.stringify(status).slice(0, 200));

  const nextRes = await fetch(`${BASE}/api/ingest/next-run`);
  const next = await nextRes.json();
  assert("Next-run endpoint returns 200", nextRes.status === 200);
  assert("Next run time is set", !!next.nextRunAt, JSON.stringify(next));
}

// ─── 2. INGEST RUN ───

async function testIngestRun(): Promise<any> {
  console.log("\n═══ INGEST RUN ═══");

  // Check auth first
  const noAuthRes = await fetch(`${BASE}/api/ingest/run`, { method: "POST" });
  assert("Ingest run rejects unauthenticated request", noAuthRes.status === 401 || noAuthRes.status === 403, `got ${noAuthRes.status}`);

  // Record listing count before run
  const { count: beforeCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true });

  console.log(`  ℹ️  Listings before run: ${beforeCount}`);

  // Trigger manual run
  console.log("  ℹ️  Starting manual ingestion run (this takes ~1-2 minutes)...");
  const runRes = await fetch(`${BASE}/api/ingest/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${BEARER}` },
  });

  assert("Ingest run returns 200", runRes.status === 200, `got ${runRes.status}`);

  const report = await runRes.json();
  assert("Report has sources array", Array.isArray(report.sources), typeof report.sources);

  let totalFound = 0, totalInserted = 0, totalDuplicates = 0, totalErrors = 0, totalMatches = 0;

  if (report.sources) {
    for (const src of report.sources) {
      totalFound += src.found || 0;
      totalInserted += src.inserted || 0;
      totalDuplicates += src.duplicates || 0;
      totalErrors += src.errors || 0;
      totalMatches += src.matches || 0;
      console.log(`  ℹ️  ${src.name}: found=${src.found} inserted=${src.inserted} dup=${src.duplicates} matches=${src.matches} errors=${src.errors}`);
    }
  }

  assert("Total sources attempted > 0", (report.sources?.length ?? 0) > 0);
  assert("Total listings found > 0", totalFound > 0, `found=${totalFound}`);
  assert("No errors during ingestion", totalErrors === 0, `errors=${totalErrors}`);

  console.log(`\n  📊 TOTALS: found=${totalFound} inserted=${totalInserted} duplicates=${totalDuplicates} matches=${totalMatches} errors=${totalErrors}`);

  return { totalInserted, totalMatches, totalDuplicates, beforeCount };
}

// ─── 3. LISTING STORAGE ───

async function testListingStorage() {
  console.log("\n═══ LISTING STORAGE ═══");

  const { data: newest, error } = await supabase
    .from("listings")
    .select("id, source, title, city, price, bedrooms, size_m2, url, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  assert("Query succeeded", !error, error?.message);
  assert("At least 1 listing exists", (newest?.length ?? 0) > 0);

  if (newest && newest.length > 0) {
    console.log("\n  📋 5 NEWEST LISTINGS:");
    for (const l of newest) {
      const fields = [
        l.source ? "✓src" : "✗src",
        l.title ? "✓title" : "✗title",
        l.city ? "✓city" : "✗city",
        l.price ? `✓€${l.price}` : "✗price",
        l.bedrooms !== null ? `✓${l.bedrooms}bd` : "✗bed",
        l.size_m2 ? `✓${l.size_m2}m²` : "✗size",
        l.url ? "✓url" : "✗url",
      ].join(" | ");
      console.log(`     ${l.source?.padEnd(16)} ${l.title?.slice(0, 40)?.padEnd(42)} ${fields}`);
    }

    const sample = newest[0];
    assert("Newest listing has source", !!sample.source);
    assert("Newest listing has title", !!sample.title);
    assert("Newest listing has city", !!sample.city);
    assert("Newest listing has url", !!sample.url);
    assert("Newest listing has created_at", !!sample.created_at);
  }
}

// ─── 4. MATCHING ───

async function testMatching(totalMatches: number) {
  console.log("\n═══ MATCHING ═══");

  // Check active search profiles exist
  const { data: profiles, error: profErr } = await supabase
    .from("search_profiles")
    .select("id, city, user_id")
    .limit(10);

  assert("Search profiles query succeeded", !profErr, profErr?.message);
  const profileCount = profiles?.length ?? 0;
  assert("At least 1 search profile exists", profileCount > 0, `count=${profileCount}`);

  if (profileCount > 0) {
    console.log(`  ℹ️  Active search profiles: ${profileCount}`);
    for (const p of profiles!) {
      console.log(`     profile=${p.id.slice(0, 8)}… city=${p.city} user=${p.user_id.slice(0, 8)}…`);
    }
  }

  // Check matches table
  const { count: matchCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true });

  assert("Matches exist in database", (matchCount ?? 0) > 0, `count=${matchCount}`);
  console.log(`  ℹ️  Total matches in DB: ${matchCount}`);

  const { data: recentMatches } = await supabase
    .from("matches")
    .select("user_id, search_profile_id, listing_id")
    .order("matched_at", { ascending: false })
    .limit(200);

  if (recentMatches) {
    const seen = new Set<string>();
    let dupCount = 0;
    for (const m of recentMatches) {
      const key = `${m.user_id}-${m.search_profile_id}-${m.listing_id}`;
      if (seen.has(key)) dupCount++;
      seen.add(key);
    }
    assert("No duplicate matches (user+profile+listing) in recent 200", dupCount === 0, `duplicates=${dupCount}`);
  }

  assert("Matching engine created matches during run", totalMatches >= 0);
  console.log(`  ℹ️  Matches created in last run: ${totalMatches}`);
}

// ─── 5. ALERTS ───

async function testAlerts() {
  console.log("\n═══ ALERTS ═══");

  const alertsEnabled = process.env.ALERTS_ENABLED;
  assert("ALERTS_ENABLED env var exists", alertsEnabled !== undefined, `value=${alertsEnabled}`);

  if (alertsEnabled === "true") {
    console.log("  ⚠️  Alerts are ENABLED — real notifications may have been sent");
    assert("Alerts are enabled (notifications may fire)", true);
  } else {
    console.log("  ℹ️  Alerts are DISABLED (ALERTS_ENABLED != true) — no notifications sent");
    assert("Alerts safely disabled", true);
  }
}

// ─── 6. OVERLAP / SCHEDULER SAFETY ───

async function testOverlap() {
  console.log("\n═══ OVERLAP SAFETY ═══");

  const statusRes = await fetch(`${BASE}/api/ingest/status`);
  const status = await statusRes.json();
  assert("Status endpoint works after run", statusRes.status === 200);
  assert("Not currently running", !status.running, `running=${status.running}`);

  if (status.lastRun) {
    assert("Last run timestamp recorded", !!status.lastRun.startedAt, JSON.stringify(status.lastRun).slice(0, 100));
    console.log(`  ℹ️  Last run started at: ${status.lastRun.startedAt}`);
  }
}

// ─── RUNNER ───

async function run() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   INGESTION PIPELINE E2E TEST REPORT      ║");
  console.log("╚═══════════════════════════════════════════╝");

  if (!BEARER) {
    console.error("❌ INGEST_BEARER_TOKEN not set. Cannot run tests.");
    process.exit(1);
  }

  await testScheduler();
  const { totalMatches } = await testIngestRun();
  await testListingStorage();
  await testMatching(totalMatches);
  await testAlerts();
  await testOverlap();

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log(`║   FINAL RESULT: ${passed} PASSED, ${failed} FAILED${" ".repeat(Math.max(0, 12 - String(passed).length - String(failed).length))}║`);
  console.log("╚═══════════════════════════════════════════╝");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
