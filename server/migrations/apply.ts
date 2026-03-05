import { createClient } from "@supabase/supabase-js";
import { log } from "../index";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function runStartupMigration() {
  const { error: listingErr } = await supabase
    .from("listings")
    .select("first_seen_at, last_seen_at")
    .limit(1);

  const { error: matchErr } = await supabase
    .from("matches")
    .select("matched_at")
    .limit(1);

  if (!listingErr && !matchErr) {
    log("All freshness columns present", "migration");
    return;
  }

  if (listingErr) {
    log(
      "Missing columns on listings (first_seen_at, last_seen_at). Run server/migrations/001_freshness_columns.sql in Supabase Dashboard.",
      "migration"
    );
  }

  if (matchErr) {
    log(
      "Missing column on matches (matched_at). Run server/migrations/001_freshness_columns.sql in Supabase Dashboard.",
      "migration"
    );
  }
}
