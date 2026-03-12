import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getPool, closePool, cleanTestData,
  testUserId, testListingId,
  getCanonicalMatches,
} from "./helpers";
import {
  upsertUserMatch, markEmailSent, markPushSent,
  getUserMatchStats, getMatchCountForUser,
  backfillFromSupabaseMatches,
  createFetchRun, completeFetchRun, getRecentFetchRuns,
} from "../../server/user-matches";

beforeAll(async () => { getPool(); });
afterAll(async () => { await cleanTestData(); await closePool(); });
beforeEach(async () => { await cleanTestData(); });

describe("TEST 6 — Backfill / Reimport Does Not Inflate Counts", () => {
  it("backfillFromSupabaseMatches deduplicates using real function", async () => {
    const u = testUserId(600);

    await upsertUserMatch({ user_id: u, listing_id: testListingId(601), listing_title: "Existing A" });
    await upsertUserMatch({ user_id: u, listing_id: testListingId(602), listing_title: "Existing B" });

    const backfillMatches = [
      { user_id: u, listing_id: testListingId(601), search_profile_id: testListingId(1), created_at: new Date().toISOString() },
      { user_id: u, listing_id: testListingId(602), search_profile_id: testListingId(1), created_at: new Date().toISOString() },
      { user_id: u, listing_id: testListingId(603), search_profile_id: testListingId(1), created_at: new Date().toISOString() },
    ];

    const inserted = await backfillFromSupabaseMatches(backfillMatches, {}, {});

    expect(inserted).toBe(1);

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(3);
  });

  it("backfill does not overwrite existing delivery flags", async () => {
    const u = testUserId(610);
    const l = testListingId(610);

    await upsertUserMatch({ user_id: u, listing_id: l });
    await markEmailSent(u, [l]);
    await markPushSent(u, [l]);

    const backfillMatches = [
      { user_id: u, listing_id: l, search_profile_id: testListingId(1), created_at: new Date().toISOString() },
    ];

    const inserted = await backfillFromSupabaseMatches(backfillMatches, {}, {});
    expect(inserted).toBe(0);

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(1);
    expect(stats!.email_sent).toBe(1);
    expect(stats!.push_sent).toBe(1);
  });
});

describe("TEST 7 — Fetch Run Metrics Integrity", () => {
  it("createFetchRun + completeFetchRun stores and retrieves exact metrics via real functions", async () => {
    const runId = await createFetchRun();
    expect(runId).not.toBeNull();
    expect(runId).toBeGreaterThan(0);

    const metrics = {
      fetched_count: 42,
      deduplicated_count: 10,
      newly_matched_count: 5,
      emails_sent_count: 3,
      pushes_sent_count: 2,
      error_count: 1,
      cities_processed: 7,
    };

    await completeFetchRun(runId!, metrics);

    const runs = await getRecentFetchRuns(1);
    expect(runs.length).toBeGreaterThanOrEqual(1);

    const run = runs.find((r: any) => r.id === runId);
    expect(run).toBeDefined();
    expect(run.fetched_count).toBe(42);
    expect(run.deduplicated_count).toBe(10);
    expect(run.newly_matched_count).toBe(5);
    expect(run.emails_sent_count).toBe(3);
    expect(run.pushes_sent_count).toBe(2);
    expect(run.error_count).toBe(1);
    expect(run.cities_processed).toBe(7);
    expect(run.status).toBe("completed");
  });

  it("pushes_sent_count stored independently from emails_sent_count", async () => {
    const runId = await createFetchRun();
    await completeFetchRun(runId!, {
      fetched_count: 10,
      deduplicated_count: 2,
      newly_matched_count: 3,
      emails_sent_count: 3,
      pushes_sent_count: 0,
      error_count: 0,
      cities_processed: 1,
    });

    const runs = await getRecentFetchRuns(5);
    const run = runs.find((r: any) => r.id === runId);
    expect(run.emails_sent_count).toBe(3);
    expect(run.pushes_sent_count).toBe(0);
  });
});

describe("TEST 8 — Admin Debug Data Consistency", () => {
  it("getUserMatchStats matches getMatchCountForUser for same data", async () => {
    const u = testUserId(800);

    await upsertUserMatch({ user_id: u, listing_id: testListingId(801) });
    await upsertUserMatch({ user_id: u, listing_id: testListingId(802) });
    await upsertUserMatch({ user_id: u, listing_id: testListingId(803) });

    await markEmailSent(u, [testListingId(801), testListingId(802)]);
    await markPushSent(u, [testListingId(801)]);

    const pool = getPool();
    await pool.query(
      `UPDATE user_matches SET viewed = TRUE, viewed_at = NOW()
       WHERE user_id = $1 AND listing_id = $2`, [u, testListingId(801)]
    );

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(3);
    expect(stats!.email_sent).toBe(2);
    expect(stats!.push_sent).toBe(1);
    expect(stats!.viewed).toBe(1);
    expect(stats!.new_count).toBe(2);

    const counts = await getMatchCountForUser(u);
    expect(counts.total).toBe(3);
    expect(counts.new_count).toBe(2);

    expect(stats!.new_count).toBe(counts.new_count);
  });

  it("getMatchCountForUser excludes non-visible matches", async () => {
    const u = testUserId(810);

    await upsertUserMatch({ user_id: u, listing_id: testListingId(811) });
    await upsertUserMatch({ user_id: u, listing_id: testListingId(812) });

    const pool = getPool();
    await pool.query(
      `UPDATE user_matches SET visible_in_app = FALSE WHERE user_id = $1 AND listing_id = $2`,
      [u, testListingId(812)]
    );

    const counts = await getMatchCountForUser(u);
    expect(counts.total).toBe(1);
    expect(counts.new_count).toBe(1);

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(2);
  });
});
