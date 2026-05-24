import { pool } from "../pg-pool";
import { log } from "../log";
import type { IngestionReport } from "../ingesters";

const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
const ZERO_RESULTS_THRESHOLD = 3;
const SOURCE_DOWN_MINUTES = 30;
const HIGH_ERROR_RATE_PCT = 30;

export interface AdminAlert {
  id: number;
  alert_key: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  source_name: string | null;
  city: string | null;
  metadata: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_notified_at: string | null;
  notification_count: number;
}

async function upsertAlert(
  alertKey: string,
  alertType: string,
  severity: string,
  title: string,
  message: string,
  sourceName: string | null,
  city: string | null,
  metadata: Record<string, any> = {}
): Promise<{ isNew: boolean; alert: AdminAlert | null }> {
  try {
    const existing = await pool.query(
      `SELECT * FROM admin_alerts WHERE alert_key = $1 AND status = 'open'`,
      [alertKey]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE admin_alerts SET message = $1, updated_at = NOW() WHERE id = $2`,
        [message, existing.rows[0].id]
      );
      return { isNew: false, alert: existing.rows[0] };
    }

    const res = await pool.query(
      `INSERT INTO admin_alerts
        (alert_key, alert_type, severity, title, message, source_name, city, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [alertKey, alertType, severity, title, message, sourceName, city, JSON.stringify(metadata)]
    );
    return { isNew: res.rows.length > 0, alert: res.rows[0] ?? null };
  } catch (err: any) {
    log(`[alerts] upsertAlert error: ${err.message}`);
    return { isNew: false, alert: null };
  }
}

async function resolveAlert(alertKey: string, reason?: string): Promise<void> {
  try {
    if (reason) {
      await pool.query(
        `UPDATE admin_alerts
         SET status = 'resolved', resolved_at = NOW(), updated_at = NOW(),
             message = message || ' [Auto-resolved: ' || $2 || ']'
         WHERE alert_key = $1 AND status = 'open'`,
        [alertKey, reason]
      );
    } else {
      await pool.query(
        `UPDATE admin_alerts
         SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
         WHERE alert_key = $1 AND status = 'open'`,
        [alertKey]
      );
    }
  } catch (err: any) {
    log(`[alerts] resolveAlert error: ${err.message}`);
  }
}

async function sendAdminAlertEmail(alert: AdminAlert): Promise<void> {
  if (process.env.ADMIN_ALERT_EMAILS_ENABLED !== "true") return;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map(e => e.trim()).filter(Boolean);
  if (adminEmails.length === 0) return;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const now = alert.last_notified_at ? new Date(alert.last_notified_at).getTime() : 0;
    if (Date.now() - now < ALERT_COOLDOWN_MS) return;

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@housalert.app";
    const severityEmoji = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "🔵";

    await resend.emails.send({
      from: fromEmail,
      to: adminEmails,
      subject: `${severityEmoji} HousAlert Admin Alert: ${alert.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#d97706' : '#2563eb'};">
            ${severityEmoji} ${alert.title}
          </h2>
          <p style="color: #374151; font-size: 15px;">${alert.message}</p>
          <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
            <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600; width: 140px;">Type</td><td style="padding: 6px 12px;">${alert.alert_type}</td></tr>
            <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">Severity</td><td style="padding: 6px 12px;">${alert.severity}</td></tr>
            ${alert.source_name ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">Source</td><td style="padding: 6px 12px;">${alert.source_name}</td></tr>` : ""}
            ${alert.city ? `<tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">City</td><td style="padding: 6px 12px;">${alert.city}</td></tr>` : ""}
            <tr><td style="padding: 6px 12px; background: #f9fafb; font-weight: 600;">Detected</td><td style="padding: 6px 12px;">${new Date(alert.created_at).toUTCString()}</td></tr>
          </table>
          <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">
            View details in the <a href="${process.env.APP_PUBLIC_BASE_URL || "https://housalert.app"}/admin/pipeline-health">HousAlert Admin Portal</a>.
            Alerts auto-resolve when the source recovers. Emails re-send after a 1-hour cooldown per alert.
          </p>
        </div>
      `,
    });

    await pool.query(
      `UPDATE admin_alerts SET last_notified_at = NOW(), notification_count = notification_count + 1 WHERE id = $1`,
      [alert.id]
    );
    log(`[alerts] Admin email sent for alert: ${alert.title}`);
  } catch (err: any) {
    log(`[alerts] sendAdminAlertEmail error: ${err.message}`);
  }
}

export async function evaluateAlertRules(
  report: IngestionReport,
  runStartedAt: Date,
  runStatus: string
): Promise<void> {
  const now = new Date();

  if (runStatus === "failed") {
    const key = "ingest_failed:global:";
    const { isNew, alert } = await upsertAlert(
      key, "ingest_failed", "critical",
      "Ingestion job failed",
      `The full ingestion cycle failed at ${runStartedAt.toISOString()}. Errors: ${report.total.errors}. No listings were processed.`,
      null, null, { errors: report.total.errors }
    );
    if (isNew && alert) await sendAdminAlertEmail(alert);
  } else {
    await resolveAlert("ingest_failed:global:", "ingestion succeeded");
  }

  if (report.total.inserted > 0 && report.total.matches === 0) {
    const key = "no_matches_from_inserts:global:";
    const { isNew, alert } = await upsertAlert(
      key, "no_matches_from_inserts", "warning",
      "New listings inserted but 0 matches created",
      `${report.total.inserted} new listings were inserted but the matching engine created 0 matches. This may indicate the matching engine is not running or all user profiles are deactivated.`,
      null, null, { inserted: report.total.inserted }
    );
    if (isNew && alert) await sendAdminAlertEmail(alert);
  } else if (report.total.matches > 0) {
    await resolveAlert("no_matches_from_inserts:global:", "matches are being created");
  }

  for (const sr of report.sources) {
    const m = sr.name.match(/^(.+?)\s*\((.+)\)$/);
    let sourceName = m ? m[1].trim() : sr.name.trim();
    const city = m ? m[2].trim() : "";
    // Strip redundant ":city" suffix that the German ingester appends (e.g. "vonovia:Berlin (Berlin)").
    if (city && sourceName.toLowerCase().endsWith(`:${city.toLowerCase()}`)) {
      sourceName = sourceName.slice(0, sourceName.length - 1 - city.length);
    }
    const baseKey = `${sourceName}:${city}`;

    // Skip alert evaluation for sources marked as disabled in source_health.
    // Disabled sources are intentionally excluded from the ingester and should
    // not generate alerts.
    const disabledCheck = await pool.query(
      `SELECT 1 FROM source_health WHERE source_name = $1 AND city = $2 AND status = 'disabled'`,
      [sourceName, city]
    );
    if (disabledCheck.rows.length > 0) {
      await resolveAlert(`source_down:${baseKey}`, "source disabled");
      await resolveAlert(`zero_results:${baseKey}`, "source disabled");
      await resolveAlert(`high_error_rate:${baseKey}`, "source disabled");
      continue;
    }

    if (sr.errors > 0) {
      const healthRow = await pool.query(
        `SELECT consecutive_failures, last_success_at FROM source_health
         WHERE source_name = $1 AND city = $2`,
        [sourceName, city]
      );
      const consec = (healthRow.rows[0]?.consecutive_failures ?? 0) + 1;
      const lastSuccess = healthRow.rows[0]?.last_success_at;
      const minutesSinceSuccess = lastSuccess
        ? (now.getTime() - new Date(lastSuccess).getTime()) / 60000
        : 999;

      if (minutesSinceSuccess >= SOURCE_DOWN_MINUTES) {
        const key = `source_down:${baseKey}`;
        const { isNew, alert } = await upsertAlert(
          key, "source_down", "critical",
          `Source down: ${sourceName}${city ? ` (${city})` : ""}`,
          `${sourceName}${city ? ` for ${city}` : ""} has had no successful scrape for ${Math.round(minutesSinceSuccess)} minutes (${consec} consecutive failure${consec !== 1 ? "s" : ""}). Last error: ${sr.errorMessage || "unknown"}`,
          sourceName, city, { consecutive_failures: consec, minutes_down: Math.round(minutesSinceSuccess) }
        );
        if (isNew && alert) await sendAdminAlertEmail(alert);
      }

      const errorRateKey = `high_error_rate:${baseKey}`;
      const recentRuns = await pool.query(
        `SELECT SUM(CASE WHEN sr->>'errors' != '0' THEN 1 ELSE 0 END) AS err_runs,
                COUNT(*) AS total_runs
         FROM ingestion_runs, jsonb_array_elements(source_reports) AS sr
         WHERE started_at >= NOW() - INTERVAL '1 hour'
           AND sr->>'name' ILIKE $1`,
        [`%${sr.name}%`]
      );
      const errRuns = parseInt(recentRuns.rows[0]?.err_runs ?? "0");
      const totalRuns = parseInt(recentRuns.rows[0]?.total_runs ?? "1");
      const errorPct = totalRuns > 0 ? Math.round((errRuns / totalRuns) * 100) : 0;

      if (errorPct >= HIGH_ERROR_RATE_PCT && totalRuns >= 3) {
        const { isNew, alert } = await upsertAlert(
          errorRateKey, "high_error_rate", "warning",
          `High error rate: ${sourceName}${city ? ` (${city})` : ""}`,
          `${sourceName}${city ? ` / ${city}` : ""} has a ${errorPct}% error rate in the last hour (${errRuns}/${totalRuns} runs failed).`,
          sourceName, city, { error_pct: errorPct, err_runs: errRuns, total_runs: totalRuns }
        );
        if (isNew && alert) await sendAdminAlertEmail(alert);
      } else {
        await resolveAlert(errorRateKey, `error rate dropped to ${errorPct}%`);
      }
    } else {
      await resolveAlert(`source_down:${baseKey}`, "source recovered");
      await resolveAlert(`high_error_rate:${baseKey}`, "error rate resolved");
    }

    if (sr.found === 0 && sr.errors === 0) {
      const zeroRow = await pool.query(
        `SELECT consecutive_zeros FROM source_health WHERE source_name = $1 AND city = $2`,
        [sourceName, city]
      );
      const zeros = (zeroRow.rows[0]?.consecutive_zeros ?? 0) + 1;
      if (zeros >= ZERO_RESULTS_THRESHOLD) {
        const key = `zero_results:${baseKey}`;
        const { isNew, alert } = await upsertAlert(
          key, "zero_results", "warning",
          `Zero results: ${sourceName}${city ? ` (${city})` : ""}`,
          `${sourceName}${city ? ` / ${city}` : ""} has returned 0 listings for ${zeros} consecutive runs despite no errors. The source may have changed its response structure or the city has no active listings.`,
          sourceName, city, { consecutive_zeros: zeros }
        );
        if (isNew && alert) await sendAdminAlertEmail(alert);
      }
    } else if (sr.found > 0) {
      await resolveAlert(`zero_results:${baseKey}`, `found ${sr.found} listings`);
    }
  }

  try {
    const runIds = await pool.query(
      `SELECT id FROM ingestion_runs WHERE started_at >= NOW() - INTERVAL '24 hours'
       AND total_inserted > 0 ORDER BY started_at DESC LIMIT 3`
    );
    if (runIds.rows.length > 0) {
      const noMatchUsers = await pool.query(
        `SELECT DISTINCT um.user_id
         FROM user_matches um
         WHERE um.matched_at < NOW() - INTERVAL '24 hours'
           AND um.user_id NOT IN (
             SELECT DISTINCT user_id FROM user_matches
             WHERE matched_at >= NOW() - INTERVAL '24 hours'
           )
         LIMIT 5`
      );
      if (noMatchUsers.rows.length > 0) {
        const key = "users_no_recent_matches:global:";
        const { isNew, alert } = await upsertAlert(
          key, "users_no_recent_matches", "info",
          "Users with no recent matches despite new inventory",
          `${noMatchUsers.rows.length} users have active history but no matches in the last 24 hours, even though new listings were inserted. Check their search profiles.`,
          null, null, { user_count: noMatchUsers.rows.length }
        );
        if (isNew && alert) await sendAdminAlertEmail(alert);
      } else {
        await resolveAlert("users_no_recent_matches:global:", "all active users receiving matches");
      }
    }
  } catch { }

  // ─── SLA Alert Rules ────────────────────────────────────────────
  try {
    const { evaluateSlaAlertConditions } = await import("./sla-metrics");
    const slaAlerts = evaluateSlaAlertConditions();

    for (const a of slaAlerts) {
      const dbKey = `${a.type}:${a.source ?? "global"}:${a.city ?? ""}`;
      const severity = a.type === "sla_p95_exceeded" ? "critical" : "warning";
      const title =
        a.type === "sla_p95_exceeded" ? `SLA breach: ${a.source}/${a.city} — end-to-end p95 > 60s` :
        a.type === "match_to_notif_p95_exceeded" ? `Slow notification: ${a.source}/${a.city} — match→notif p95 > 30s` :
        a.type === "fast_lane_stale" ? "Fast-lane stale — no run in >2 minutes" :
        a.type === "flush_stuck" ? "Alert flush stuck — in progress >2 minutes" :
        a.type;
      const { isNew, alert: dbAlert } = await upsertAlert(
        dbKey, a.type as any, severity, title, a.message,
        a.source ?? null, a.city ?? null, {}
      );
      if (isNew && dbAlert) await sendAdminAlertEmail(dbAlert);
    }

    const activeTypes = new Set(slaAlerts.map(a => `${a.type}:${a.source ?? "global"}:${a.city ?? ""}`));
    const slaAlertTypes = ["sla_p95_exceeded", "match_to_notif_p95_exceeded", "fast_lane_stale", "flush_stuck"];
    const openSlaAlerts = await pool.query(
      `SELECT alert_key FROM admin_alerts WHERE alert_type = ANY($1) AND status = 'open'`,
      [slaAlertTypes]
    );
    for (const row of openSlaAlerts.rows) {
      if (!activeTypes.has(row.alert_key)) {
        await resolveAlert(row.alert_key, "SLA condition resolved");
      }
    }
  } catch { }
}

export async function getOpenAlerts(): Promise<AdminAlert[]> {
  const { rows } = await pool.query(
    `SELECT * FROM admin_alerts WHERE status = 'open' ORDER BY severity DESC, created_at DESC`
  );
  return rows;
}

export async function getRecentAlerts(limit = 50): Promise<AdminAlert[]> {
  const { rows } = await pool.query(
    `SELECT * FROM admin_alerts ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function resolveAlertById(id: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE admin_alerts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'open' RETURNING id`,
    [id]
  );
  return res.rows.length > 0;
}
