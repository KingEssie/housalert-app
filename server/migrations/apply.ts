import { log } from "../log";

export async function runStartupMigration() {
  log("Freshness tracking uses local database (listing_freshness, match_timestamps tables)", "migration");
}
