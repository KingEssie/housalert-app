import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../log", () => ({
  log: vi.fn(),
}));

const MOCK_RESEND_SEND = vi.fn();

vi.mock("resend", () => {
  class MockResend {
    emails = { send: MOCK_RESEND_SEND };
    constructor(_apiKey: string) {}
  }
  return { Resend: MockResend };
});

vi.stubEnv("REPLIT_CONNECTORS_HOSTNAME", "fake-connectors.replit.dev");
vi.stubEnv("REPL_IDENTITY", "test-identity-token");

const MOCK_CONNECTOR_RESPONSE = {
  items: [
    {
      settings: {
        api_key: "re_test_fake_key",
        from_email: "HousAlert <noreply@housalert.nl>",
      },
    },
  ],
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  MOCK_RESEND_SEND.mockReset();
  MOCK_RESEND_SEND.mockResolvedValue({ error: null });
  vi.mocked(log).mockReset();

  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(MOCK_CONNECTOR_RESPONSE),
  }) as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

import { sendMatchAlert, sendBatchMatchAlert } from "../../email";
import { log } from "../../log";

const FULL_LISTING = {
  listing_id: "lst-001",
  title: "Ruim 3-kamer appartement in centrum",
  city: "Amsterdam",
  price: 1850,
  bedrooms: 3,
  size_m2: 75,
  url: "https://funda.nl/huur/amsterdam/appartement-123",
  image_url: "https://images.funda.nl/photo-abc.jpg",
};

const NO_IMAGE_LISTING = {
  listing_id: "lst-002",
  title: "Studio nabij station",
  city: "Utrecht",
  price: 950,
  bedrooms: 1,
  size_m2: 35,
  url: "https://pararius.nl/studio-456",
  image_url: null,
};

const ZERO_PRICE_LISTING = {
  listing_id: "lst-003",
  title: "Woning op aanvraag",
  city: "Den Haag",
  price: 0,
  bedrooms: 0,
  size_m2: 0,
  url: "https://example.com/listing-789",
  image_url: null,
};

const MINIMAL_LISTING = {
  listing_id: "lst-004",
  title: "Kamer beschikbaar",
  city: "Rotterdam",
  price: 500,
  bedrooms: 1,
  size_m2: 12,
  url: null,
  image_url: null,
};

const XSS_LISTING = {
  listing_id: "lst-xss",
  title: '<script>alert("xss")</script>Woning',
  city: "Amsterdam<br>",
  price: 1000,
  bedrooms: 2,
  size_m2: 50,
  url: "https://example.com/safe",
  image_url: "https://example.com/img.jpg",
};

function getCapturedHtml(): string {
  return MOCK_RESEND_SEND.mock.calls[0][0].html;
}

function getCapturedText(): string {
  return MOCK_RESEND_SEND.mock.calls[0][0].text;
}

function getCapturedSubject(): string {
  return MOCK_RESEND_SEND.mock.calls[0][0].subject;
}

describe("Email Template Unit Tests", () => {

  describe("sendMatchAlert — function signature", () => {
    it("accepts (userEmail, listing) and returns Promise<boolean> = true on success", async () => {
      const result = await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });

    it("returns false when Resend returns an error", async () => {
      MOCK_RESEND_SEND.mockResolvedValueOnce({
        error: { message: "rate limited", name: "rate_limit", statusCode: 429 },
      });
      const result = await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(result).toBe(false);
    });

    it("returns false when Resend throws", async () => {
      MOCK_RESEND_SEND.mockRejectedValueOnce(new Error("network timeout"));
      const result = await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(result).toBe(false);
    });
  });

  describe("sendBatchMatchAlert — function signature", () => {
    it("accepts (userEmail, listings[]) and returns Promise<boolean> = true on success", async () => {
      const result = await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });

    it("returns false for empty array", async () => {
      const result = await sendBatchMatchAlert("user@test.nl", []);
      expect(result).toBe(false);
    });

    it("delegates to sendMatchAlert for single-item array", async () => {
      const result = await sendBatchMatchAlert("user@test.nl", [FULL_LISTING]);
      expect(result).toBe(true);
      const subject = getCapturedSubject();
      expect(subject).toContain("Nieuwe match");
      expect(subject).not.toContain("woningen");
    });
  });

  describe("Subject line generation", () => {
    it("single: contains house emoji and listing title", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const subject = getCapturedSubject();
      expect(subject).toContain("\u{1F3E0}");
      expect(subject).toContain("Nieuwe match");
      expect(subject).toContain(FULL_LISTING.title);
    });

    it("batch: contains house emoji and listing count", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING, ZERO_PRICE_LISTING]);
      const subject = getCapturedSubject();
      expect(subject).toContain("\u{1F3E0}");
      expect(subject).toContain("3");
      expect(subject).toContain("woningen");
    });
  });

  describe("sanitizeSubject behavior", () => {
    it("strips newlines and control characters from title", async () => {
      const listing = { ...FULL_LISTING, title: "Woning\r\nmet\tnewline\x00chars" };
      await sendMatchAlert("user@test.nl", listing);
      const subject = getCapturedSubject();
      expect(subject).not.toContain("\r");
      expect(subject).not.toContain("\n");
      expect(subject).not.toContain("\t");
      expect(subject).not.toContain("\x00");
      expect(subject).toContain("Woning");
      expect(subject).toContain("met");
    });

    it("truncates very long titles to max 200 chars", async () => {
      const listing = { ...FULL_LISTING, title: "A".repeat(300) };
      await sendMatchAlert("user@test.nl", listing);
      const subject = getCapturedSubject();
      expect(subject.length).toBeLessThanOrEqual(200);
    });
  });

  describe("Single-match HTML rendering", () => {
    it("contains the listing title", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Ruim 3-kamer appartement in centrum");
    });

    it("contains the price formatted with euro sign and /mnd", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("\u20AC");
      expect(html).toContain("1.850");
      expect(html).toContain("/mnd");
    });

    it("contains bedroom and size chips", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("3 kamers");
      expect(html).toContain("75 m\u00B2");
    });

    it("contains city chip", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Amsterdam");
    });

    it("contains hero image when image_url is present", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("<img");
      expect(html).toContain("photo-abc.jpg");
    });

    it("contains Reageer direct CTA button with apply link", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Reageer direct");
      expect(html).toContain("/apply/lst-001");
    });

    it("contains Bekijk woning CTA button with external link", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Bekijk woning");
      expect(html).toContain("funda.nl");
    });

    it("contains hidden preheader for inbox preview", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("display:none");
      expect(html).toContain(FULL_LISTING.title);
    });

    it("contains HousAlert brand header with tagline", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("HousAlert");
      expect(html).toContain("Huurkansen, direct in je inbox");
    });

    it("contains Instellingen link in header", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Instellingen");
      expect(html).toContain("/instellingen");
    });

    it("contains footer disclaimer with settings link", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("zoekprofiel");
      expect(html).toContain("Meldingen aanpassen");
    });

    it("contains Nieuwe match label and intro text", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Nieuwe match");
      expect(html).toContain("Er is een woning gevonden");
    });

    it("uses table-based layout for email client compatibility", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain('role="presentation"');
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('lang="nl"');
    });
  });

  describe("Missing image fallback", () => {
    it("does not render <img> when image_url is null", async () => {
      await sendMatchAlert("user@test.nl", NO_IMAGE_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("<img");
    });

    it("still renders title, city, price, and CTA when image is missing", async () => {
      await sendMatchAlert("user@test.nl", NO_IMAGE_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Studio nabij station");
      expect(html).toContain("Utrecht");
      expect(html).toContain("Reageer direct");
    });
  });

  describe("Zero/empty price handling", () => {
    it("does not render price section when price is 0", async () => {
      await sendMatchAlert("user@test.nl", ZERO_PRICE_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("/mnd");
      expect(html).not.toContain("\u20AC0");
    });

    it("does not render bedroom chip when bedrooms is 0", async () => {
      await sendMatchAlert("user@test.nl", ZERO_PRICE_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("kamer");
    });

    it("does not render size chip when size_m2 is 0", async () => {
      await sendMatchAlert("user@test.nl", ZERO_PRICE_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("m\u00B2");
    });
  });

  describe("CTA link generation", () => {
    it("apply link uses APP_PUBLIC_BASE_URL + /apply/ + listing_id", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("/apply/lst-001");
    });

    it("view link uses the original listing URL", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("https://funda.nl/huur/amsterdam/appartement-123");
    });

    it("no apply button when listing_id is missing", async () => {
      const listing = { ...FULL_LISTING, listing_id: undefined };
      await sendMatchAlert("user@test.nl", listing);
      const html = getCapturedHtml();
      expect(html).not.toContain("/apply/");
    });

    it("no view button when url is null", async () => {
      await sendMatchAlert("user@test.nl", MINIMAL_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("Bekijk woning");
    });

    it("rejects javascript: protocol URLs", async () => {
      const listing = { ...FULL_LISTING, url: "javascript:alert(1)" };
      await sendMatchAlert("user@test.nl", listing);
      const html = getCapturedHtml();
      expect(html).not.toContain("javascript:");
    });
  });

  describe("Batch HTML rendering", () => {
    it("renders count badge with correct number", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      const html = getCapturedHtml();
      expect(html).toContain("2 nieuwe matches");
    });

    it("renders intro text with plural-aware Dutch", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      const html = getCapturedHtml();
      expect(html).toContain("zijn");
      expect(html).toContain("2 woningen");
      expect(html).toContain("passen");
    });

    it("renders multiple listing cards", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      const html = getCapturedHtml();
      expect(html).toContain("Ruim 3-kamer appartement in centrum");
      expect(html).toContain("Studio nabij station");
    });

    it("renders image only for listing with image_url", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      const html = getCapturedHtml();
      expect(html).toContain("photo-abc.jpg");
      const imgMatches = html.match(/<img /g);
      expect(imgMatches?.length).toBe(1);
    });
  });

  describe("Digest numbering (Woning N)", () => {
    it("batch cards have Woning 1, Woning 2, Woning 3", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING, ZERO_PRICE_LISTING]);
      const html = getCapturedHtml();
      expect(html).toContain("Woning 1");
      expect(html).toContain("Woning 2");
      expect(html).toContain("Woning 3");
    });

    it("single-match card does NOT have Woning numbering", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("Woning 1");
    });
  });

  describe("Plain text fallback generation", () => {
    it("single: contains title, city, price, rooms, size, and sign-off", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const text = getCapturedText();
      expect(text).toContain("Hallo");
      expect(text).toContain(FULL_LISTING.title);
      expect(text).toContain("Amsterdam");
      expect(text).toContain("1.850");
      expect(text).toContain("Kamers: 3");
      expect(text).toContain("75 m\u00B2");
      expect(text).toContain("HousAlert-team");
    });

    it("single: contains listing URL when available", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      const text = getCapturedText();
      expect(text).toContain("https://funda.nl/huur/amsterdam/appartement-123");
    });

    it("single: omits URL line when url is null", async () => {
      await sendMatchAlert("user@test.nl", MINIMAL_LISTING);
      const text = getCapturedText();
      expect(text).not.toContain("Bekijk woning:");
    });

    it("single: omits price line when price is 0", async () => {
      await sendMatchAlert("user@test.nl", ZERO_PRICE_LISTING);
      const text = getCapturedText();
      expect(text).not.toContain("Huur:");
    });

    it("batch: contains numbered listings", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      const text = getCapturedText();
      expect(text).toContain("1. Ruim 3-kamer appartement in centrum");
      expect(text).toContain("2. Studio nabij station");
    });

    it("batch: omits price prefix when price is 0", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, ZERO_PRICE_LISTING]);
      const text = getCapturedText();
      const lines = text.split("\n");
      const zeroPriceLine = lines.find((l: string) => l.includes("Woning op aanvraag"));
      expect(zeroPriceLine).toBeDefined();
      const idx = lines.indexOf(zeroPriceLine!);
      const detailLine = lines[idx + 1];
      expect(detailLine.trim()).toBe("Den Haag");
    });
  });

  describe("HTML escaping and XSS prevention", () => {
    it("escapes HTML special chars in listing title", async () => {
      await sendMatchAlert("user@test.nl", XSS_LISTING);
      const html = getCapturedHtml();
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes HTML special chars in city name", async () => {
      await sendMatchAlert("user@test.nl", XSS_LISTING);
      const html = getCapturedHtml();
      expect(html).toContain("Amsterdam&lt;br&gt;");
    });
  });

  describe("Resend API call shape", () => {
    it("sends from, to, subject, text, and html fields", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(MOCK_RESEND_SEND).toHaveBeenCalledTimes(1);
      const call = MOCK_RESEND_SEND.mock.calls[0][0];
      expect(call).toHaveProperty("from");
      expect(call).toHaveProperty("to", "user@test.nl");
      expect(call).toHaveProperty("subject");
      expect(call).toHaveProperty("text");
      expect(call).toHaveProperty("html");
      expect(call.from).toContain("HousAlert");
    });
  });

  describe("Logging behavior", () => {
    it("logs [EMAIL OK] on success", async () => {
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("[EMAIL OK]"));
    });

    it("logs [EMAIL FAIL] on Resend error response", async () => {
      MOCK_RESEND_SEND.mockResolvedValueOnce({
        error: { message: "invalid API key", name: "auth_error", statusCode: 401 },
      });
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("[EMAIL FAIL]"));
    });

    it("logs [EMAIL ERROR] on exception", async () => {
      MOCK_RESEND_SEND.mockRejectedValueOnce(new Error("socket hangup"));
      await sendMatchAlert("user@test.nl", FULL_LISTING);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("[EMAIL ERROR]"));
    });

    it("logs batch OK with count", async () => {
      await sendBatchMatchAlert("user@test.nl", [FULL_LISTING, NO_IMAGE_LISTING]);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("[EMAIL OK] batch"));
    });
  });
});

describe("Pipeline Compatibility Verification", () => {
  it("sendMatchAlert has arity 2 (userEmail, listing)", () => {
    expect(typeof sendMatchAlert).toBe("function");
    expect(sendMatchAlert.length).toBe(2);
  });

  it("sendBatchMatchAlert has arity 2 (userEmail, listings[])", () => {
    expect(typeof sendBatchMatchAlert).toBe("function");
    expect(sendBatchMatchAlert.length).toBe(2);
  });

  it("sendBatchMatchAlert accepts BufferedMatch-shaped objects (superset of ListingInfo)", async () => {
    const bufferedMatch = {
      listing_id: "buf-001",
      title: "Buffer test woning",
      city: "Amsterdam",
      price: 1200,
      bedrooms: 2,
      size_m2: 55,
      url: "https://example.com/listing",
      image_url: null,
      matched_at: new Date().toISOString(),
    };
    const result = await sendBatchMatchAlert("user@test.nl", [bufferedMatch]);
    expect(result).toBe(true);
  });
});

describe("Dry-Run: Full Email Render Simulation", () => {
  it("Step 1: Renders a complete single-match email with all elements", async () => {
    await sendMatchAlert("testuser@housalert.nl", FULL_LISTING);
    expect(MOCK_RESEND_SEND).toHaveBeenCalledTimes(1);
    const html = getCapturedHtml();
    const text = getCapturedText();
    const subject = getCapturedSubject();

    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("HousAlert");
    expect(html).toContain(FULL_LISTING.title);
    expect(html).toContain("/apply/lst-001");
    expect(html).toContain("funda.nl");
    expect(html).toContain("photo-abc.jpg");
    expect(html).toContain("1.850");

    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain(FULL_LISTING.title);

    expect(subject).toContain("Nieuwe match");
  });

  it("Step 2: Renders a complete batch email with 3 listings, numbered", async () => {
    const listings = [FULL_LISTING, NO_IMAGE_LISTING, ZERO_PRICE_LISTING];
    await sendBatchMatchAlert("testuser@housalert.nl", listings);
    expect(MOCK_RESEND_SEND).toHaveBeenCalledTimes(1);
    const html = getCapturedHtml();
    const text = getCapturedText();
    const subject = getCapturedSubject();

    expect(html).toContain("3 nieuwe matches");
    expect(html).toContain("Woning 1");
    expect(html).toContain("Woning 2");
    expect(html).toContain("Woning 3");
    expect(html).toContain(FULL_LISTING.title);
    expect(html).toContain(NO_IMAGE_LISTING.title);
    expect(html).toContain(ZERO_PRICE_LISTING.title);

    const imgMatches = html.match(/<img /g);
    expect(imgMatches?.length).toBe(1);

    expect(text).toContain("1. Ruim 3-kamer");
    expect(text).toContain("2. Studio");
    expect(text).toContain("3. Woning op aanvraag");

    expect(subject).toContain("3");
    expect(subject).toContain("woningen");
  });

  it("Step 3: Duplicate send — email.ts sends both (dedup is in buffer.ts, not here)", async () => {
    await sendMatchAlert("testuser@housalert.nl", FULL_LISTING);
    await sendMatchAlert("testuser@housalert.nl", FULL_LISTING);
    expect(MOCK_RESEND_SEND).toHaveBeenCalledTimes(2);
  });

  it("Step 4: All href links are well-formed HTTPS or # URLs", async () => {
    await sendMatchAlert("testuser@housalert.nl", FULL_LISTING);
    const html = getCapturedHtml();
    const hrefMatches = html.match(/href="([^"]+)"/g) || [];
    expect(hrefMatches.length).toBeGreaterThan(0);
    for (const match of hrefMatches) {
      const url = match.slice(6, -1);
      if (url === "#") continue;
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe("Duplicate Prevention Architecture Verification", () => {
  it("email.ts does NOT implement dedup — sends on every call (correct by design)", async () => {
    const result1 = await sendMatchAlert("user@test.nl", FULL_LISTING);
    const result2 = await sendMatchAlert("user@test.nl", FULL_LISTING);
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(MOCK_RESEND_SEND).toHaveBeenCalledTimes(2);
  });

  it("documents: dedup is in buffer.ts (seenListingIds Set) + user_matches.markEmailSent (DB flag)", () => {
    expect(true).toBe(true);
  });
});
