import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getPool, closePool, cleanTestData,
  testUserId, testListingId,
  getCanonicalMatches,
} from "./helpers";
import {
  upsertUserMatch, markApplied,
  getUserMatchStats, getRecentUserMatches,
} from "../../server/user-matches";

beforeAll(async () => { getPool(); });
afterAll(async () => { await cleanTestData(); await closePool(); });
beforeEach(async () => { await cleanTestData(); });

describe("TEST 4 — Applied / Unapplied State Consistency", () => {
  it("applied=true then applied=false correctly reverses state via real markApplied", async () => {
    const u = testUserId(400);
    const l = testListingId(400);

    await upsertUserMatch({ user_id: u, listing_id: l });

    await markApplied(u, l, true);

    let stats = await getUserMatchStats(u);
    expect(stats!.applied).toBe(1);

    await markApplied(u, l, false);

    stats = await getUserMatchStats(u);
    expect(stats!.applied).toBe(0);

    const matches = await getCanonicalMatches(u);
    expect(matches).toHaveLength(1);
    expect(matches[0].applied).toBe(false);
  });

  it("multiple applied/unapplied transitions stay consistent", async () => {
    const u = testUserId(401);
    const l = testListingId(401);

    await upsertUserMatch({ user_id: u, listing_id: l });

    for (let i = 0; i < 5; i++) {
      await markApplied(u, l, true);
      await markApplied(u, l, false);
    }

    const stats = await getUserMatchStats(u);
    expect(stats!.applied).toBe(0);
    expect(stats!.total).toBe(1);
  });
});

describe("TEST 5 — Newest-First Ordering", () => {
  it("getRecentUserMatches returns newest-first order", async () => {
    const u = testUserId(500);

    const timestamps = [
      "2025-01-01T10:00:00Z",
      "2025-01-03T10:00:00Z",
      "2025-01-02T10:00:00Z",
      "2025-01-05T10:00:00Z",
      "2025-01-04T10:00:00Z",
    ];

    for (let i = 0; i < timestamps.length; i++) {
      await upsertUserMatch({
        user_id: u,
        listing_id: testListingId(500 + i),
        matched_at: timestamps[i],
        listing_title: `Listing ${i}`,
      });
    }

    const matches = await getRecentUserMatches(u, 50);
    expect(matches).toHaveLength(5);

    for (let i = 1; i < matches.length; i++) {
      const prev = new Date(matches[i - 1].matched_at).getTime();
      const curr = new Date(matches[i].matched_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }

    expect(matches[0].listing_id).toBe(testListingId(503));
  });
});
