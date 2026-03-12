import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  const userId = process.argv[2];

  if (!userId) {
    console.log("Usage: npx tsx tests/verify-matches.ts <user_id>");
    console.log("\nProvide a specific user ID to inspect their canonical match state.");
    await pool.end();
    return;
  }

  console.log(`\n=== Match Verification for user: ${userId} ===\n`);

  const stats = await pool.query(
    `SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE visible_in_app)::int as visible,
      COUNT(*) FILTER (WHERE visible_in_app AND NOT viewed AND NOT dismissed)::int as new_count,
      COUNT(*) FILTER (WHERE viewed)::int as viewed,
      COUNT(*) FILTER (WHERE applied)::int as applied,
      COUNT(*) FILTER (WHERE email_sent)::int as email_sent,
      COUNT(*) FILTER (WHERE push_sent)::int as push_sent,
      COUNT(*) FILTER (WHERE dismissed)::int as dismissed,
      COUNT(*) FILTER (WHERE saved)::int as saved
     FROM user_matches WHERE user_id = $1`,
    [userId]
  );

  const s = stats.rows[0];
  console.log("Canonical Stats:");
  console.log(`  Total matches:    ${s.total}`);
  console.log(`  Visible in app:   ${s.visible}`);
  console.log(`  New (unviewed):   ${s.new_count}`);
  console.log(`  Viewed:           ${s.viewed}`);
  console.log(`  Applied:          ${s.applied}`);
  console.log(`  Email sent:       ${s.email_sent}`);
  console.log(`  Push sent:        ${s.push_sent}`);
  console.log(`  Dismissed:        ${s.dismissed}`);
  console.log(`  Saved:            ${s.saved}`);

  const visibleCount = await pool.query(
    `SELECT COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE visible_in_app AND NOT viewed AND NOT dismissed)::int as new_count
     FROM user_matches WHERE user_id = $1 AND visible_in_app = TRUE`,
    [userId]
  );
  const vc = visibleCount.rows[0];
  console.log(`\nApp-facing counts (getMatchCountForUser):`);
  console.log(`  Total visible:    ${vc.total}`);
  console.log(`  New count:        ${vc.new_count}`);

  const emailLeakCheck = s.email_sent <= s.total;
  const pushLeakCheck = s.push_sent <= s.total;
  console.log(`\nConsistency checks:`);
  console.log(`  email_sent <= total:  ${emailLeakCheck ? "PASS" : "FAIL"}`);
  console.log(`  push_sent <= total:   ${pushLeakCheck ? "PASS" : "FAIL"}`);
  console.log(`  new + viewed + dismissed = visible: ${s.new_count + s.viewed + s.dismissed === s.visible ? "PASS" : "CHECK"}`);

  console.log("\n--- Latest 10 Canonical Matches ---");
  const recent = await pool.query(
    `SELECT listing_id, listing_title, listing_city, listing_price,
            matched_at, visible_in_app, email_sent, push_sent, viewed, applied
     FROM user_matches WHERE user_id = $1 ORDER BY matched_at DESC LIMIT 10`,
    [userId]
  );

  for (const m of recent.rows) {
    const flags = [
      m.visible_in_app ? "visible" : "",
      m.email_sent ? "emailed" : "",
      m.push_sent ? "pushed" : "",
      m.viewed ? "viewed" : "",
      m.applied ? "applied" : "",
    ].filter(Boolean).join(", ");
    console.log(`  [${new Date(m.matched_at).toISOString().slice(0, 16)}] ${m.listing_title || m.listing_id} (${m.listing_city || "?"}, €${m.listing_price || "?"}) — ${flags || "no flags"}`);
  }

  console.log("\n--- Latest 5 Fetch Runs ---");
  const runs = await pool.query(
    `SELECT id, started_at, status, fetched_count, deduplicated_count,
            newly_matched_count, emails_sent_count, pushes_sent_count, error_count
     FROM fetch_runs ORDER BY started_at DESC LIMIT 5`
  );

  if (runs.rows.length === 0) {
    console.log("  No fetch runs recorded.");
  } else {
    for (const r of runs.rows) {
      console.log(`  Run #${r.id} [${r.status}] ${new Date(r.started_at).toISOString().slice(0, 16)} — fetched:${r.fetched_count} dedup:${r.deduplicated_count} matched:${r.newly_matched_count} emails:${r.emails_sent_count} pushes:${r.pushes_sent_count} errors:${r.error_count}`);
    }
  }

  const dupCheck = await pool.query(
    `SELECT listing_id, COUNT(*)::int as cnt
     FROM user_matches WHERE user_id = $1
     GROUP BY listing_id HAVING COUNT(*) > 1 LIMIT 5`,
    [userId]
  );
  if (dupCheck.rows.length > 0) {
    console.log("\nDUPLICATE MATCHES DETECTED:");
    for (const d of dupCheck.rows) {
      console.log(`  listing_id=${d.listing_id} count=${d.cnt}`);
    }
  } else {
    console.log("\nNo duplicate matches found. PASS");
  }

  console.log("\n=== Verification complete ===\n");
  await pool.end();
}

verify().catch(err => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
