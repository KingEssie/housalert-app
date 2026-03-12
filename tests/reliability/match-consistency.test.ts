import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getPool, closePool, cleanTestData,
  testUserId, testListingId, testProfileId,
  getCanonicalMatches,
} from "./helpers";
import {
  upsertUserMatch, markEmailSent, markPushSent, markViewed,
  getUserMatchStats, getMatchCountForUser,
} from "../../server/user-matches";

beforeAll(async () => { getPool(); });
afterAll(async () => { await cleanTestData(); await closePool(); });
beforeEach(async () => { await cleanTestData(); });

describe("TEST 1 — Single Match Consistency", () => {
  it("creates exactly 1 canonical user_match with correct defaults via real upsert", async () => {
    const u = testUserId(100);
    const l = testListingId(100);

    const result = await upsertUserMatch({
      user_id: u,
      listing_id: l,
      search_profile_id: testProfileId(100),
      listing_title: "2-Zimmer Berlin",
      listing_city: "Berlin",
      listing_price: 950,
      listing_source: "wg-gesucht",
    });
    expect(result).toBe(true);

    const matches = await getCanonicalMatches(u);
    expect(matches).toHaveLength(1);
    expect(matches[0].listing_id).toBe(l);
    expect(matches[0].visible_in_app).toBe(true);
    expect(matches[0].email_sent).toBe(false);
    expect(matches[0].push_sent).toBe(false);
    expect(matches[0].viewed).toBe(false);
    expect(matches[0].applied).toBe(false);

    const stats = await getUserMatchStats(u);
    expect(stats).not.toBeNull();
    expect(stats!.total).toBe(1);
    expect(stats!.new_count).toBe(1);

    const counts = await getMatchCountForUser(u);
    expect(counts.total).toBe(1);
    expect(counts.new_count).toBe(1);
  });

  it("markEmailSent and markPushSent update the canonical record via real functions", async () => {
    const u = testUserId(101);
    const l = testListingId(101);

    await upsertUserMatch({ user_id: u, listing_id: l, listing_title: "Email test" });

    await markEmailSent(u, [l]);
    await markPushSent(u, [l]);

    const stats = await getUserMatchStats(u);
    expect(stats!.email_sent).toBe(1);
    expect(stats!.push_sent).toBe(1);
    expect(stats!.total).toBe(1);
  });

  it("markViewed changes new_count to 0 via real functions", async () => {
    const u = testUserId(102);
    const l = testListingId(102);

    await upsertUserMatch({ user_id: u, listing_id: l });

    let counts = await getMatchCountForUser(u);
    expect(counts.new_count).toBe(1);

    await markViewed(u, [l]);

    counts = await getMatchCountForUser(u);
    expect(counts.new_count).toBe(0);
    expect(counts.total).toBe(1);

    const stats = await getUserMatchStats(u);
    expect(stats!.viewed).toBe(1);
  });
});

describe("TEST 2 — Duplicate Fetch Deduplication", () => {
  it("upsertUserMatch called twice produces exactly 1 canonical match", async () => {
    const u = testUserId(200);
    const l = testListingId(200);

    await upsertUserMatch({ user_id: u, listing_id: l, listing_title: "First" });
    await upsertUserMatch({ user_id: u, listing_id: l, listing_title: "Second" });

    const matches = await getCanonicalMatches(u);
    expect(matches).toHaveLength(1);

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(1);
  });

  it("duplicate upsert preserves existing delivery flags", async () => {
    const u = testUserId(201);
    const l = testListingId(201);

    await upsertUserMatch({ user_id: u, listing_id: l });
    await markEmailSent(u, [l]);
    await markPushSent(u, [l]);

    await upsertUserMatch({ user_id: u, listing_id: l, listing_title: "Re-fetched" });

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(1);
    expect(stats!.email_sent).toBe(1);
    expect(stats!.push_sent).toBe(1);
  });

  it("markEmailSent is idempotent via real function", async () => {
    const u = testUserId(202);
    const l = testListingId(202);

    await upsertUserMatch({ user_id: u, listing_id: l });
    await markEmailSent(u, [l]);
    await markEmailSent(u, [l]);

    const stats = await getUserMatchStats(u);
    expect(stats!.email_sent).toBe(1);
  });
});

describe("TEST 3 — Multi-Profile Same Listing", () => {
  it("same user+listing from different profiles results in exactly 1 canonical match via real upsert", async () => {
    const u = testUserId(300);
    const l = testListingId(300);

    await upsertUserMatch({ user_id: u, listing_id: l, search_profile_id: testProfileId(1) });
    await upsertUserMatch({ user_id: u, listing_id: l, search_profile_id: testProfileId(2) });

    const matches = await getCanonicalMatches(u);
    expect(matches).toHaveLength(1);
    expect(matches[0].search_profile_id).toBe(testProfileId(1));

    const stats = await getUserMatchStats(u);
    expect(stats!.total).toBe(1);
    expect(stats!.new_count).toBe(1);
  });
});
