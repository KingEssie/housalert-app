import { log } from "./log";
import { runAllIngesters, OverlapError } from "./ingesters";
import { persistIngestionRun } from "./admin";
import { cleanupStaleFetchRuns } from "./user-matches";
import { recoverUndeliveredMatches } from "./notifications/buffer";
import { checkExpoReceipts } from "./notifications/expo-push";

const intervalMinutes = parseInt(process.env.INGEST_INTERVAL_MINUTES || "10", 10);
const INTERVAL_MS = intervalMinutes * 60 * 1000;
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

let nextRunAt: Date | null = null;
let _recoveryRunning = false;

async function tick() {
  const startedAt = new Date();
  try {
    const report = await runAllIngesters();
    await persistIngestionRun(report, startedAt);
  } catch (err: any) {
    if (err instanceof OverlapError) {
      log("[INGEST] Skipping — previous run still in progress", "scheduler");
    } else {
      log(`[INGEST ERROR] ${err.message}`, "scheduler");
    }
  }
  nextRunAt = new Date(Date.now() + INTERVAL_MS);
}

async function runRecoveryCycle() {
  if (_recoveryRunning) return;
  _recoveryRunning = true;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const result = await recoverUndeliveredMatches(supabase);
    if (result.recovered > 0) {
      log(`[RECOVERY] Recovered ${result.recovered} undelivered → sent ${result.sent}, failed ${result.failed}`, "scheduler");
    }
  } catch (err: any) {
    log(`[RECOVERY ERROR] ${err.message}`, "scheduler");
  } finally {
    _recoveryRunning = false;
  }
}

export function getNextRun() {
  return {
    nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
    intervalMinutes,
  };
}

export async function startScheduler() {
  const cleaned = await cleanupStaleFetchRuns();
  if (cleaned > 0) {
    log(`[scheduler] Cleaned up ${cleaned} stale fetch runs from previous server`, "scheduler");
  }

  setTimeout(() => runRecoveryCycle(), 15_000);
  setInterval(() => runRecoveryCycle(), RECOVERY_INTERVAL_MS);
  log(`Email recovery timer started — runs every ${RECOVERY_INTERVAL_MS / 1000}s`, "scheduler");

  const RECEIPT_CHECK_MS = 20 * 60 * 1000;
  setTimeout(async () => {
    try { await checkExpoReceipts(); } catch (e: any) { log(`[EXPO-RECEIPTS] Error: ${e.message}`, "scheduler"); }
  }, 60_000);
  setInterval(async () => {
    try { await checkExpoReceipts(); } catch (e: any) { log(`[EXPO-RECEIPTS] Error: ${e.message}`, "scheduler"); }
  }, RECEIPT_CHECK_MS);
  log(`Expo receipt checker started — runs every ${RECEIPT_CHECK_MS / 1000}s`, "scheduler");

  if (process.env.ENABLE_INGEST_SCHEDULER !== "true") {
    log("Ingestion scheduler disabled (ENABLE_INGEST_SCHEDULER != true)", "scheduler");
    return;
  }

  log(`Ingestion scheduler started — running every ${intervalMinutes} minutes`, "scheduler");

  nextRunAt = new Date(Date.now() + 5000);
  setTimeout(() => tick(), 5000);
  setInterval(() => tick(), INTERVAL_MS);
}
