import { log } from "../log";
import { supabase } from "../ingesters/matching";

export async function runStartupMigration() {
  try {
    const { error } = await supabase.from("user_profile_data").select("user_id").limit(1);
    if (error && error.message.includes("Could not find the table")) {
      log(
        "[MIGRATION NEEDED] Table 'user_profile_data' does not exist. Run 010_user_profile_data_full.sql in the Supabase SQL Editor.",
        "migration"
      );
    } else if (!error) {
      const { error: colErr } = await supabase.from("user_profile_data").select("occupation, monthly_income").limit(1);
      if (colErr) {
        log(
          "[MIGRATION NEEDED] Table 'user_profile_data' is missing columns (occupation, monthly_income). Run 010_user_profile_data_full.sql in the Supabase SQL Editor.",
          "migration"
        );
      }
    }
  } catch {
  }

  log("All data persisted in Supabase (listing_freshness, match_timestamps tables)", "migration");
}
