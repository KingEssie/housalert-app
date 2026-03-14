import { pool } from "./pg-pool";
import { log } from "./log";

export async function createCancellationFeedbackTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cancellation_feedback (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        reason_type TEXT NOT NULL,
        reason_text TEXT,
        found_home_via_housalert BOOLEAN,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_user ON cancellation_feedback(user_id)`);

    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'cancellation_feedback' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] cancellation_feedback table OK (${colCheck.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating cancellation_feedback: ${err.message}`, "migration");
  }
}

export async function saveCancellationFeedback(
  userId: string,
  reasonType: string,
  reasonText: string | null,
  foundHomeViaHousalert: boolean | null
) {
  await pool.query(
    `INSERT INTO cancellation_feedback (user_id, reason_type, reason_text, found_home_via_housalert)
     VALUES ($1, $2, $3, $4)`,
    [userId, reasonType, reasonText, foundHomeViaHousalert]
  );
}

export async function getCancellationStats() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE reason_type = 'found_via_housalert') as found_via_housalert,
        COUNT(*) FILTER (WHERE reason_type = 'found_not_via_housalert') as found_not_via_housalert,
        COUNT(*) FILTER (WHERE reason_type = 'not_found') as not_found,
        COUNT(*) FILTER (WHERE reason_type = 'other') as other
      FROM cancellation_feedback
    `);
    const row = result.rows[0] || {};
    return {
      total: parseInt(row.total || "0"),
      foundViaHousalert: parseInt(row.found_via_housalert || "0"),
      foundNotViaHousalert: parseInt(row.found_not_via_housalert || "0"),
      notFound: parseInt(row.not_found || "0"),
      other: parseInt(row.other || "0"),
    };
  } catch (err: any) {
    log(`[CANCELLATION] Failed to get stats: ${err.message}`);
    return { total: 0, foundViaHousalert: 0, foundNotViaHousalert: 0, notFound: 0, other: 0 };
  }
}
