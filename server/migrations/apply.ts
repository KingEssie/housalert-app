import { log } from "../log";

export async function runStartupMigration() {
  log("All data persisted in Supabase (listing_freshness, match_timestamps tables)", "migration");
}
