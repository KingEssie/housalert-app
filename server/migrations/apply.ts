import { log } from "../index";

export async function runStartupMigration() {
  log("Freshness tracking uses local database (listing_freshness, match_timestamps tables)", "migration");
}
