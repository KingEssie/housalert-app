import { pool } from "./pg-pool";
import { log } from "./log";

export async function createActivationEventsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activation_events (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activation_events_user ON activation_events(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activation_events_name ON activation_events(event_name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activation_events_created ON activation_events(created_at DESC)`);

    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'activation_events' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] activation_events table OK (${colCheck.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating activation_events: ${err.message}`, "migration");
  }
}

export async function trackEvent(userId: string, eventName: string, metadata: Record<string, any> = {}) {
  try {
    await pool.query(
      `INSERT INTO activation_events (user_id, event_name, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, eventName, JSON.stringify(metadata)]
    );
  } catch (err: any) {
    log(`[ACTIVATION] Failed to track event ${eventName} for ${userId}: ${err.message}`);
  }
}

export async function hasEvent(userId: string, eventName: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM activation_events WHERE user_id = $1 AND event_name = $2 LIMIT 1`,
      [userId, eventName]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function getUserActivationStatus(userId: string) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT event_name FROM activation_events WHERE user_id = $1`,
      [userId]
    );
    const events = new Set(result.rows.map((r: any) => r.event_name));
    return {
      profileCreated: events.has("profile_created"),
      notificationsEnabled: events.has("notifications_enabled"),
      firstMatchViewed: events.has("first_match_viewed"),
      firstReaction: events.has("first_reaction"),
      trialStarted: events.has("trial_started"),
      subscriptionStarted: events.has("subscription_started"),
    };
  } catch (err: any) {
    log(`[ACTIVATION] Failed to get status for ${userId}: ${err.message}`);
    return {
      profileCreated: false,
      notificationsEnabled: false,
      firstMatchViewed: false,
      firstReaction: false,
      trialStarted: false,
      subscriptionStarted: false,
    };
  }
}

export async function getActivationFunnel() {
  try {
    const totalUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM activation_events`
    );
    const totalUsers = parseInt(totalUsersResult.rows[0]?.count || "0");

    const funnelResult = await pool.query(`
      SELECT event_name, COUNT(DISTINCT user_id) as user_count
      FROM activation_events
      GROUP BY event_name
      ORDER BY user_count DESC
    `);

    const funnel: Record<string, number> = {};
    for (const row of funnelResult.rows) {
      funnel[row.event_name] = parseInt(row.user_count);
    }

    const recentResult = await pool.query(`
      SELECT event_name, user_id, created_at
      FROM activation_events
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return {
      totalTrackedUsers: totalUsers,
      funnel,
      recentEvents: recentResult.rows,
    };
  } catch (err: any) {
    log(`[ACTIVATION] Failed to get funnel: ${err.message}`);
    return { totalTrackedUsers: 0, funnel: {}, recentEvents: [] };
  }
}
