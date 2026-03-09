import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function backfillOne(listing: {
  id: string;
  source: string;
  url: string;
  title: string;
}): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 1200));

  try {
    const resp = await fetch(listing.url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!resp.ok) {
      console.log(`  HTTP ${resp.status} for ${listing.title.substring(0, 40)}`);
      return false;
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    let imageUrl: string | null = null;

    const ogImg = $('meta[property="og:image"]').attr("content") || null;

    if (listing.source === "kleinanzeigen") {
      if (ogImg && ogImg.startsWith("http") && ogImg.includes("kleinanzeigen")) {
        imageUrl = ogImg;
      }
      if (!imageUrl) {
        const img = $(
          '.galleryimage-element img, img[src*="img.kleinanzeigen.de"]'
        ).first();
        imageUrl = img.attr("src") || null;
      }
    } else if (listing.source === "wohnungsboerse") {
      if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
      if (!imageUrl) {
        const img = $('img[src*="wohnungsboerse.net/assets"]').first();
        imageUrl = img.attr("src") || null;
      }
    } else if (listing.source === "wg-gesucht") {
      if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
    } else if (listing.source === "nestpick") {
      if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
    } else {
      if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
    }

    if (imageUrl) {
      const { error } = await supabase
        .from("listings")
        .update({ image_url: imageUrl })
        .eq("id", listing.id);
      if (error) {
        console.log(`  DB error: ${error.message}`);
        return false;
      }
      console.log(`  OK: ${listing.source} - ${listing.title.substring(0, 50)}`);
      return true;
    } else {
      console.log(
        `  No image found: ${listing.source} - ${listing.title.substring(0, 50)}`
      );
      return false;
    }
  } catch (err: any) {
    console.log(`  Error: ${err.message}`);
    return false;
  }
}

async function main() {
  const userId = process.argv[2] || "6e751fd6-a61d-4b2b-a956-ac6a9cd198fb";

  const { data: matches } = await supabase
    .from("matches")
    .select("listing_id")
    .eq("user_id", userId);

  const ids = [...new Set((matches || []).map((m: any) => m.listing_id))];

  const listings: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { data } = await supabase
      .from("listings")
      .select("id, source, url, title")
      .in("id", batch)
      .is("image_url", null);
    if (data) listings.push(...data);
  }

  if (!listings || listings.length === 0) {
    console.log("All listings have images!");
    return;
  }

  console.log(`Backfilling ${listings.length} listings...`);
  let ok = 0;
  let fail = 0;

  for (const listing of listings) {
    const success = await backfillOne(listing);
    if (success) ok++;
    else fail++;
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`);
}

main().catch(console.error);
