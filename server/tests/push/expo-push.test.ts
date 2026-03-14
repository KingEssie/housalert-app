import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  buildMatchPayload,
  sendWithRetry,
  sendExpoMatchPush,
  sendExpoTestPush,
  checkExpoReceipts,
  setPushProvider,
  resetPushProvider,
  type PushProvider,
  type ExpoPushTicket,
  type ExpoPushReceipt,
  type ExpoMatchListing,
} from "../../notifications/expo-push";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const TEST_TOKEN = "ExponentPushToken[test-abc-123]";
const TEST_TOKEN_2 = "ExponentPushToken[test-xyz-789]";

function makeSuccessProvider(ticketId = "ticket-ok-1"): PushProvider {
  return {
    async sendPush(messages) {
      return {
        data: messages.map((): ExpoPushTicket => ({
          status: "ok",
          id: ticketId,
        })),
      };
    },
    async getReceipts(ids) {
      const data: Record<string, ExpoPushReceipt> = {};
      for (const id of ids) data[id] = { status: "ok" };
      return { data };
    },
  };
}

function makeFailureProvider(errorType = "DeviceNotRegistered"): PushProvider {
  return {
    async sendPush(messages) {
      return {
        data: messages.map((): ExpoPushTicket => ({
          status: "error",
          message: "Token not registered",
          details: { error: errorType },
        })),
      };
    },
    async getReceipts() {
      return { data: {} };
    },
  };
}

function makeTemporaryFailProvider(failTimes: number): PushProvider {
  let callCount = 0;
  return {
    async sendPush(messages) {
      callCount++;
      if (callCount <= failTimes) {
        throw Object.assign(new Error(`Expo API 429`), { retryable: true, status: 429 });
      }
      return {
        data: messages.map((): ExpoPushTicket => ({
          status: "ok",
          id: `ticket-retry-${callCount}`,
        })),
      };
    },
    async getReceipts() {
      return { data: {} };
    },
  };
}

async function cleanupTestData() {
  await sb.from("expo_push_tokens").delete().eq("user_id", TEST_USER_ID);
  await sb.from("push_delivery_log").delete().eq("user_id", TEST_USER_ID);
}

async function insertTestToken(token = TEST_TOKEN, active = true) {
  await sb.from("expo_push_tokens").upsert(
    {
      user_id: TEST_USER_ID,
      expo_push_token: token,
      platform: "ios",
      is_active: active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,expo_push_token" }
  );
}

describe("buildMatchPayload", () => {
  it("builds single-listing payload with price", () => {
    const result = buildMatchPayload([
      { listing_id: "lst-1", title: "Mooie woning", city: "Berlin", price: 950, url: null },
    ]);
    expect(result.title).toBe("Nieuwe match in Berlin");
    expect(result.body).toContain("€950");
    expect(result.deepLink).toBe("/listing/lst-1");
    expect(result.listingIds).toEqual(["lst-1"]);
  });

  it("builds multi-listing payload", () => {
    const result = buildMatchPayload([
      { listing_id: "lst-1", title: "A", city: "Berlin", price: 800, url: null },
      { listing_id: "lst-2", title: "B", city: "Munich", price: 1200, url: null },
      { listing_id: "lst-3", title: "C", city: "Berlin", price: 600, url: null },
    ]);
    expect(result.title).toContain("3 nieuwe matches");
    expect(result.title).toContain("Berlin");
    expect(result.deepLink).toBe("/dashboard?tab=matches");
    expect(result.listingIds).toHaveLength(3);
  });

  it("handles zero price listing", () => {
    const result = buildMatchPayload([
      { listing_id: "lst-1", title: "Gratis woning", city: "Berlin", price: 0, url: null },
    ]);
    expect(result.body).not.toContain("€");
    expect(result.body).toContain("Gratis woning");
  });

  it("uses fallback city when empty", () => {
    const result = buildMatchPayload([
      { listing_id: "lst-1", title: "Test", city: "", price: 500, url: null },
    ]);
    expect(result.title).toBe("Nieuwe match in je stad");
  });

  it("deep link format is correct for single listing", () => {
    const result = buildMatchPayload([
      { listing_id: "abc-def-123", title: "T", city: "Berlin", price: 100, url: null },
    ]);
    expect(result.deepLink).toMatch(/^\/listing\/abc-def-123$/);
  });
});

describe("sendWithRetry", () => {
  afterAll(() => resetPushProvider());

  it("succeeds on first try with success provider", async () => {
    setPushProvider(makeSuccessProvider("tkt-1"));
    const result = await sendWithRetry([{ to: TEST_TOKEN, title: "test" }]);
    expect(result.error).toBeUndefined();
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].status).toBe("ok");
    expect(result.tickets[0].id).toBe("tkt-1");
  });

  it("retries on temporary failure then succeeds", async () => {
    setPushProvider(makeTemporaryFailProvider(1));
    const result = await sendWithRetry([{ to: TEST_TOKEN, title: "retry-test" }]);
    expect(result.error).toBeUndefined();
    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].status).toBe("ok");
  });

  it("fails after exhausting retries", async () => {
    setPushProvider(makeTemporaryFailProvider(5));
    const result = await sendWithRetry([{ to: TEST_TOKEN, title: "fail-test" }]);
    expect(result.error).toBeDefined();
    expect(result.tickets).toHaveLength(0);
  });

  it("does not retry permanent errors", async () => {
    let callCount = 0;
    setPushProvider({
      async sendPush() {
        callCount++;
        throw Object.assign(new Error("Bad request"), { retryable: false });
      },
      async getReceipts() { return { data: {} }; },
    });
    const result = await sendWithRetry([{ to: TEST_TOKEN, title: "perm-fail" }]);
    expect(result.error).toBeDefined();
    expect(callCount).toBe(1);
  });
});

describe("sendExpoMatchPush (with Supabase)", () => {
  beforeEach(async () => {
    await cleanupTestData();
    setPushProvider(makeSuccessProvider("tkt-match-1"));
  });

  afterAll(async () => {
    await cleanupTestData();
    resetPushProvider();
  });

  it("returns skipped when no tokens exist", async () => {
    const result = await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-1", title: "A", city: "Berlin", price: 900, url: null },
    ]);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("sends to active token and creates delivery log", async () => {
    await insertTestToken();
    const listings: ExpoMatchListing[] = [
      { listing_id: "lst-1", title: "Woning A", city: "Berlin", price: 900, url: null },
    ];
    const result = await sendExpoMatchPush(TEST_USER_ID, listings);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("*")
      .eq("user_id", TEST_USER_ID)
      .eq("status", "sent");
    expect(logs).not.toBeNull();
    expect(logs!.length).toBeGreaterThanOrEqual(1);
    expect(logs![0].expo_ticket_id).toBe("tkt-match-1");
    expect(logs![0].channel).toBe("expo");
  });

  it("deactivates token on DeviceNotRegistered", async () => {
    await insertTestToken();
    setPushProvider(makeFailureProvider("DeviceNotRegistered"));

    const result = await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-1", title: "A", city: "Berlin", price: 900, url: null },
    ]);
    expect(result.failed).toBe(1);

    const { data: tokens } = await sb
      .from("expo_push_tokens")
      .select("is_active")
      .eq("user_id", TEST_USER_ID)
      .eq("expo_push_token", TEST_TOKEN);
    expect(tokens![0].is_active).toBe(false);
  });

  it("does not deactivate on generic error", async () => {
    await insertTestToken();
    setPushProvider(makeFailureProvider("InvalidCredentials"));

    await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-1", title: "A", city: "Berlin", price: 900, url: null },
    ]);

    const { data: tokens } = await sb
      .from("expo_push_tokens")
      .select("is_active")
      .eq("user_id", TEST_USER_ID)
      .eq("expo_push_token", TEST_TOKEN);
    expect(tokens![0].is_active).toBe(true);
  });

  it("returns empty result for empty listings", async () => {
    const result = await sendExpoMatchPush(TEST_USER_ID, []);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("logs api_error on complete failure", async () => {
    await insertTestToken();
    setPushProvider(makeTemporaryFailProvider(5));

    const result = await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-1", title: "A", city: "Berlin", price: 900, url: null },
    ]);
    expect(result.failed).toBe(1);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("status")
      .eq("user_id", TEST_USER_ID)
      .eq("status", "api_error");
    expect(logs!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("sendExpoTestPush", () => {
  beforeEach(async () => {
    await cleanupTestData();
    setPushProvider(makeSuccessProvider("tkt-test-1"));
  });

  afterAll(async () => {
    await cleanupTestData();
    resetPushProvider();
  });

  it("sends test push to active token", async () => {
    await insertTestToken();
    const result = await sendExpoTestPush(TEST_USER_ID);
    expect(result.sent).toBe(1);
    expect(result.tokens).toBe(1);
  });

  it("returns zero when no tokens", async () => {
    const result = await sendExpoTestPush(TEST_USER_ID);
    expect(result.sent).toBe(0);
    expect(result.tokens).toBe(0);
  });
});

describe("token upsert behavior", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("upsert reactivates existing inactive token", async () => {
    await insertTestToken(TEST_TOKEN, false);

    const { data: before } = await sb
      .from("expo_push_tokens")
      .select("is_active")
      .eq("user_id", TEST_USER_ID)
      .eq("expo_push_token", TEST_TOKEN)
      .single();
    expect(before!.is_active).toBe(false);

    await sb.from("expo_push_tokens").upsert(
      {
        user_id: TEST_USER_ID,
        expo_push_token: TEST_TOKEN,
        platform: "ios",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" }
    );

    const { data: after } = await sb
      .from("expo_push_tokens")
      .select("is_active")
      .eq("user_id", TEST_USER_ID)
      .eq("expo_push_token", TEST_TOKEN)
      .single();
    expect(after!.is_active).toBe(true);
  });

  it("prevents duplicate tokens for same user", async () => {
    await insertTestToken();
    await insertTestToken();

    const { data } = await sb
      .from("expo_push_tokens")
      .select("id")
      .eq("user_id", TEST_USER_ID)
      .eq("expo_push_token", TEST_TOKEN);
    expect(data!.length).toBe(1);
  });

  it("allows same user with different tokens", async () => {
    await insertTestToken(TEST_TOKEN);
    await insertTestToken(TEST_TOKEN_2);

    const { data } = await sb
      .from("expo_push_tokens")
      .select("id")
      .eq("user_id", TEST_USER_ID);
    expect(data!.length).toBe(2);
  });
});

describe("delivery log creation", () => {
  beforeEach(async () => {
    await cleanupTestData();
    setPushProvider(makeSuccessProvider("tkt-log-1"));
  });

  afterAll(async () => {
    await cleanupTestData();
    resetPushProvider();
  });

  it("creates delivery log on successful send", async () => {
    await insertTestToken();
    await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-log-1", title: "Log Test", city: "Berlin", price: 800, url: null },
    ]);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("*")
      .eq("user_id", TEST_USER_ID)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(logs!.length).toBe(1);
    const log = logs![0];
    expect(log.status).toBe("sent");
    expect(log.expo_ticket_id).toBe("tkt-log-1");
    expect(log.channel).toBe("expo");
    expect(log.listing_count).toBe(1);
    expect(log.full_token).toBe(TEST_TOKEN);
    expect(log.title).toContain("Berlin");
  });

  it("creates delivery log on failure", async () => {
    await insertTestToken();
    setPushProvider(makeFailureProvider("InvalidCredentials"));

    await sendExpoMatchPush(TEST_USER_ID, [
      { listing_id: "lst-f-1", title: "Fail", city: "Berlin", price: 500, url: null },
    ]);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("*")
      .eq("user_id", TEST_USER_ID)
      .eq("status", "failed");

    expect(logs!.length).toBe(1);
    expect(logs![0].error_type).toBe("InvalidCredentials");
  });
});

describe("checkExpoReceipts", () => {
  const RECEIPT_USER = "00000000-0000-0000-0000-000000000002";
  const RECEIPT_TOKEN = "ExponentPushToken[receipt-test-abc]";

  async function cleanupReceiptData() {
    await sb.from("expo_push_tokens").delete().eq("user_id", RECEIPT_USER);
    await sb.from("push_delivery_log").delete().eq("user_id", RECEIPT_USER);
  }

  beforeEach(async () => {
    await cleanupReceiptData();
  });

  afterAll(async () => {
    await cleanupReceiptData();
    resetPushProvider();
  });

  it("returns zeros when no pending receipts", async () => {
    setPushProvider(makeSuccessProvider());
    const result = await checkExpoReceipts();
    expect(result.checked).toBe(0);
    expect(result.ok).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("processes ok receipt and updates log", async () => {
    const ticketId = "receipt-ok-test-" + Date.now();
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    await sb.from("push_delivery_log").insert({
      user_id: RECEIPT_USER,
      channel: "expo",
      full_token: RECEIPT_TOKEN,
      listing_ids: ["lst-r-1"],
      listing_count: 1,
      title: "Test",
      body: "Receipt test",
      status: "sent",
      expo_ticket_id: ticketId,
      created_at: twentyMinAgo,
    });

    setPushProvider({
      async sendPush() { return { data: [] }; },
      async getReceipts(ids) {
        const data: Record<string, ExpoPushReceipt> = {};
        for (const id of ids) data[id] = { status: "ok" };
        return { data };
      },
    });

    const result = await checkExpoReceipts();
    expect(result.ok).toBeGreaterThanOrEqual(1);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("expo_receipt_status")
      .eq("user_id", RECEIPT_USER)
      .eq("expo_ticket_id", ticketId)
      .single();
    expect(logs!.expo_receipt_status).toBe("ok");
  });

  it("processes error receipt and deactivates token on DeviceNotRegistered", async () => {
    const ticketId = "receipt-err-test-" + Date.now();
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    await sb.from("expo_push_tokens").upsert(
      {
        user_id: RECEIPT_USER,
        expo_push_token: RECEIPT_TOKEN,
        platform: "ios",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" }
    );

    await sb.from("push_delivery_log").insert({
      user_id: RECEIPT_USER,
      channel: "expo",
      full_token: RECEIPT_TOKEN,
      listing_ids: ["lst-r-2"],
      listing_count: 1,
      title: "Test",
      body: "Receipt error test",
      status: "sent",
      expo_ticket_id: ticketId,
      created_at: twentyMinAgo,
    });

    setPushProvider({
      async sendPush() { return { data: [] }; },
      async getReceipts(ids) {
        const data: Record<string, ExpoPushReceipt> = {};
        for (const id of ids) data[id] = {
          status: "error",
          message: "The device is not registered",
          details: { error: "DeviceNotRegistered" },
        };
        return { data };
      },
    });

    const result = await checkExpoReceipts();
    expect(result.errors).toBeGreaterThanOrEqual(1);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("expo_receipt_status, error_type")
      .eq("user_id", RECEIPT_USER)
      .eq("expo_ticket_id", ticketId)
      .single();
    expect(logs!.expo_receipt_status).toBe("error");
    expect(logs!.error_type).toBe("DeviceNotRegistered");

    const { data: tokens } = await sb
      .from("expo_push_tokens")
      .select("is_active")
      .eq("user_id", RECEIPT_USER)
      .eq("expo_push_token", RECEIPT_TOKEN)
      .single();
    expect(tokens!.is_active).toBe(false);
  });
});
