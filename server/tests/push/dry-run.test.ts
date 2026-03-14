import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  sendExpoMatchPush,
  setPushProvider,
  resetPushProvider,
  type PushProvider,
  type ExpoPushTicket,
  type ExpoMatchListing,
} from "../../notifications/expo-push";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DRY_USER = "00000000-0000-0000-0000-dryrun000001";
const DRY_TOKEN = "ExponentPushToken[dry-run-device-abc]";

let sentMessages: any[] = [];

const dryRunProvider: PushProvider = {
  async sendPush(messages) {
    sentMessages.push(...messages);
    return {
      data: messages.map((): ExpoPushTicket => ({
        status: "ok",
        id: `dry-ticket-${Date.now()}`,
      })),
    };
  },
  async getReceipts(ids) {
    const data: Record<string, any> = {};
    for (const id of ids) data[id] = { status: "ok" };
    return { data };
  },
};

async function cleanup() {
  await sb.from("expo_push_tokens").delete().eq("user_id", DRY_USER);
  await sb.from("push_delivery_log").delete().eq("user_id", DRY_USER);
}

describe("End-to-End Dry Run: full push flow", () => {
  beforeAll(async () => {
    await cleanup();
    setPushProvider(dryRunProvider);
    sentMessages = [];
  });

  afterAll(async () => {
    await cleanup();
    resetPushProvider();
  });

  it("Step 1: register device token", async () => {
    const { error } = await sb.from("expo_push_tokens").upsert(
      {
        user_id: DRY_USER,
        expo_push_token: DRY_TOKEN,
        platform: "ios",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" }
    );
    expect(error).toBeNull();

    const { data: tokens } = await sb
      .from("expo_push_tokens")
      .select("*")
      .eq("user_id", DRY_USER)
      .eq("is_active", true);
    expect(tokens!.length).toBe(1);
    expect(tokens![0].expo_push_token).toBe(DRY_TOKEN);
    console.log("  Token registered:", DRY_TOKEN);
  });

  it("Step 2: dispatch push for one match", async () => {
    const listings: ExpoMatchListing[] = [
      {
        listing_id: "dry-lst-001",
        title: "Gezellige woning in Kreuzberg",
        city: "Berlin",
        price: 850,
        url: "https://example.com/listing/dry-lst-001",
      },
    ];

    const result = await sendExpoMatchPush(DRY_USER, listings);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(sentMessages.length).toBe(1);

    const msg = sentMessages[0];
    expect(msg.to).toBe(DRY_TOKEN);
    expect(msg.title).toContain("Berlin");
    expect(msg.body).toContain("€850");
    expect(msg.data.url).toBe("/listing/dry-lst-001");
    expect(msg.data.type).toBe("match_alert");
    expect(msg.channelId).toBe("match-alerts");
    console.log("  Push dispatched:", msg.title, "→", msg.body);
  });

  it("Step 3: verify delivery log exists", async () => {
    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("*")
      .eq("user_id", DRY_USER)
      .order("created_at", { ascending: false })
      .limit(5);

    expect(logs!.length).toBeGreaterThanOrEqual(1);
    const log = logs![0];
    expect(log.status).toBe("sent");
    expect(log.channel).toBe("expo");
    expect(log.listing_count).toBe(1);
    expect(log.expo_ticket_id).toBeTruthy();
    expect(log.full_token).toBe(DRY_TOKEN);
    console.log("  Delivery log:", log.status, "ticket:", log.expo_ticket_id);
  });

  it("Step 4: second push for same match is NOT blocked at push level (dedup is in buffer layer)", async () => {
    sentMessages = [];
    const result = await sendExpoMatchPush(DRY_USER, [
      {
        listing_id: "dry-lst-001",
        title: "Gezellige woning in Kreuzberg",
        city: "Berlin",
        price: 850,
        url: null,
      },
    ]);
    expect(result.sent).toBe(1);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("id")
      .eq("user_id", DRY_USER)
      .eq("status", "sent");
    expect(logs!.length).toBe(2);
    console.log("  Note: push-level dedup is not enforced here — buffer.ts handles dedup via user_matches.push_sent flag");
  });

  it("Step 5: multi-listing push", async () => {
    sentMessages = [];
    const listings: ExpoMatchListing[] = [
      { listing_id: "dry-lst-002", title: "Woning A", city: "Berlin", price: 700, url: null },
      { listing_id: "dry-lst-003", title: "Woning B", city: "Munich", price: 1100, url: null },
      { listing_id: "dry-lst-004", title: "Woning C", city: "Berlin", price: 950, url: null },
    ];

    const result = await sendExpoMatchPush(DRY_USER, listings);
    expect(result.sent).toBe(1);

    const msg = sentMessages[0];
    expect(msg.title).toContain("3 nieuwe matches");
    expect(msg.data.url).toBe("/dashboard?tab=matches");
    expect(msg.data.listingIds).toHaveLength(3);
    console.log("  Multi-listing:", msg.title);
  });

  it("Step 6: cleanup verification", async () => {
    await cleanup();

    const { data: tokens } = await sb
      .from("expo_push_tokens")
      .select("id")
      .eq("user_id", DRY_USER);
    expect(tokens!.length).toBe(0);

    const { data: logs } = await sb
      .from("push_delivery_log")
      .select("id")
      .eq("user_id", DRY_USER);
    expect(logs!.length).toBe(0);
    console.log("  Cleanup: all test data removed");
  });
});
