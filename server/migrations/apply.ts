import { log } from "../log";
import { pool } from "../pg-pool";

export async function runStartupMigration() {
  try {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profile_data' ORDER BY ordinal_position"
    );
    if (result.rows.length === 0) {
      log("[MIGRATION] Table 'user_profile_data' not found — it should exist in the Replit PostgreSQL database.", "migration");
    } else {
      log(`[MIGRATION] user_profile_data table OK (${result.rows.length} columns)`, "migration");
    }
  } catch (err: any) {
    log(`[MIGRATION] Error checking user_profile_data: ${err.message}`, "migration");
  }
}
