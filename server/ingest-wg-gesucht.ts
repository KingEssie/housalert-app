import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { log } from "./index";
import { sendMatchAlert } from "./email";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ingestion");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WG_GESUCHT_BASE = "https://www.wg-gesucht.de";
const BERLIN_SEARCH_URL =
  WG_GESUCHT_BASE + "/wohnungen-in-Berlin.8.2.1.0.html";
const USER_AGENT =
  "Stekkies/1.0 (rental alert app; polite single-page fetch; contact: stekkies@example.com)";

interface ParsedListing {
  title: string;
  url: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  source: string;
  source_id: string;
}

function extractSourceId(href: string): string {
  const match = href.match(/\.(\d+)\.html/);
  if (match) return match[1];
  return createHash("sha256").update(href).digest("hex").slice(0, 16);
}

function parseZimmer(text: string): number {
  const match = text.match(/([\d,]+)-Zimmer/);
  if (match) {
    const num = parseFloat(match[1].replace(",", "."));
    return Math.floor(num);
  }
  return 0;
}

function parsePrice(html: string): number {
  const cleaned = html.replace(/&euro;/g, "€").replace(/&nbsp;/g, " ");
  const match = cleaned.match(/([\d.]+)\s*€/);
  if (match) return parseInt(match[1].replace(/\./g, ""), 10);
  return 0;
}

function parseSize(html: string): number {
  const cleaned = html.replace(/&sup2;/g, "²").replace(/&nbsp;/g, " ");
  const match = cleaned.match(/([\d.]+)\s*m/);
  if (match) return parseInt(match[1].replace(/\./g, ""), 10);
  return 0;
}

export async function fetchAndParseListings(): Promise<ParsedListing[]> {
  log("Fetching WG-Gesucht Berlin listings...");

  const response = await fetch(BERLIN_SEARCH_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
    },
  });

  if (!response.ok) {
    throw new Error(`WG-Gesucht returned ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const listings: ParsedListing[] = [];

  $(".wgg_card.offer_list_item").each((_i, el) => {
    const card = $(el);
    const dataId = card.attr("data-id");

    if (card.hasClass("housinganywhere_ad") || card.hasClass("airbnb_ad")) {
      return;
    }

    const titleLink = card.find("h2.truncate_title a").first();
    const title = titleLink.text().trim();
    const href = titleLink.attr("href") || "";
    if (!title || !href) return;

    const fullUrl = href.startsWith("http") ? href : WG_GESUCHT_BASE + href;
    const sourceId = dataId || extractSourceId(href);

    const detailSpan = card.find(".col-xs-11 span").first().text();
    const bedrooms = parseZimmer(detailSpan);

    const middleRow = card.find(".row.middle");
    const cols = middleRow.find("[class*='col-xs']");

    let price = 0;
    let size = 0;

    if (cols.length >= 1) {
      price = parsePrice(cols.eq(0).html() || "");
    }
    if (cols.length >= 3) {
      size = parseSize(cols.eq(2).html() || "");
    }

    listings.push({
      title,
      url: fullUrl,
      city: "Berlin",
      price,
      bedrooms,
      size_m2: size,
      source: "wg-gesucht",
      source_id: sourceId,
    });
  });

  log(`Parsed ${listings.length} listings from WG-Gesucht`);
  return listings;
}

interface SearchProfile {
  id: string;
  user_id: string;
  city: string;
  price_min: number;
  price_max: number;
  bedrooms_min: number;
  size_min: number;
}

interface DbListing {
  id: string;
  source: string;
  url: string | null;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
}

function doesListingMatchProfile(listing: DbListing, profile: SearchProfile): boolean {
  const listingCity = listing.city.toLowerCase().trim();
  const profileCity = profile.city.toLowerCase().trim();
  if (!listingCity.includes(profileCity) && !profileCity.includes(listingCity)) {
    return false;
  }
  if (profile.price_min > 0 && listing.price < profile.price_min) return false;
  if (profile.price_max > 0 && listing.price > profile.price_max) return false;
  if (profile.bedrooms_min > 0 && listing.bedrooms < profile.bedrooms_min) return false;
  if (profile.size_min > 0 && listing.size_m2 < profile.size_min) return false;
  return true;
}

async function runMatchingForListing(listing: DbListing): Promise<number> {
  const { data: profiles, error: pErr } = await supabase
    .from("search_profiles")
    .select("*");

  if (pErr || !profiles || profiles.length === 0) return 0;

  let totalMatches = 0;
  const alertedUsers = new Set<string>();

  for (const profile of profiles as SearchProfile[]) {
    if (!doesListingMatchProfile(listing, profile)) continue;

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("search_profile_id", profile.id)
      .eq("listing_id", listing.id)
      .maybeSingle();

    if (existing) continue;

    const { error: mErr } = await supabase.from("matches").insert({
      user_id: profile.user_id,
      search_profile_id: profile.id,
      listing_id: listing.id,
    });

    if (!mErr) {
      totalMatches++;

      if (!alertedUsers.has(profile.user_id)) {
        alertedUsers.add(profile.user_id);

        const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
        const email = userData?.user?.email;
        if (email) {
          sendMatchAlert(email, listing).catch(() => {});
        }
      }
    }
  }

  return totalMatches;
}

let hasSourceIdColumn: boolean | null = null;

async function checkSourceIdColumn(): Promise<boolean> {
  if (hasSourceIdColumn !== null) return hasSourceIdColumn;
  const { error } = await supabase.from("listings").select("source_id").limit(1);
  hasSourceIdColumn = !error;
  if (!hasSourceIdColumn) {
    log("source_id column not found on listings table — using URL-based dedup only");
  }
  return hasSourceIdColumn;
}

export async function ingestWgGesucht(): Promise<{
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
}> {
  const parsed = await fetchAndParseListings();
  const useSourceId = await checkSourceIdColumn();

  let inserted = 0;
  let duplicates = 0;
  let totalMatches = 0;

  for (const listing of parsed) {
    let isDuplicate = false;

    if (useSourceId) {
      const { data: existingRows } = await supabase
        .from("listings")
        .select("id")
        .eq("source", listing.source)
        .eq("source_id", listing.source_id)
        .limit(1);
      isDuplicate = !!(existingRows && existingRows.length > 0);
    }

    if (!isDuplicate) {
      const { data: existingByUrl } = await supabase
        .from("listings")
        .select("id")
        .eq("url", listing.url)
        .limit(1);
      isDuplicate = !!(existingByUrl && existingByUrl.length > 0);
    }

    if (isDuplicate) {
      duplicates++;
      continue;
    }

    const insertData: Record<string, any> = {
      source: listing.source,
      url: listing.url,
      title: listing.title,
      city: listing.city,
      price: listing.price,
      bedrooms: listing.bedrooms,
      size_m2: listing.size_m2,
    };

    if (useSourceId) {
      insertData.source_id = listing.source_id;
    }

    const { data: row, error: insertErr } = await supabase
      .from("listings")
      .insert(insertData)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        duplicates++;
      } else {
        log(`Insert error for ${listing.source_id}: ${insertErr.message}`);
      }
      continue;
    }

    inserted++;

    if (row) {
      const matchCount = await runMatchingForListing(row as DbListing);
      totalMatches += matchCount;
    }
  }

  log(
    `WG-Gesucht ingestion complete: found=${parsed.length}, inserted=${inserted}, duplicates=${duplicates}, matches=${totalMatches}`
  );

  return {
    found: parsed.length,
    inserted,
    duplicates,
    matches: totalMatches,
  };
}
