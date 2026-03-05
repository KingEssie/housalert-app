import { log } from "./index";
import { runAllIngesters, OverlapError } from "./ingesters";

const intervalMinutes = parseInt(process.env.INGEST_INTERVAL_MINUTES || "10", 10);
const INTERVAL_MS = intervalMinutes * 60 * 1000;

let nextRunAt: Date | null = null;

async function tick() {
  try {
    await runAllIngesters();
  } catch (err: any) {
    if (err instanceof OverlapError) {
      log("[INGEST] Skipping — previous run still in progress", "scheduler");
    } else {
      log(`[INGEST ERROR] ${err.message}`, "scheduler");
    }
  }
  nextRunAt = new Date(Date.now() + INTERVAL_MS);
}

export function getNextRun() {
  return {
    nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
    intervalMinutes,
  };
}

export function startScheduler() {
  if (process.env.ENABLE_INGEST_SCHEDULER !== "true") {
    log("Ingestion scheduler disabled (ENABLE_INGEST_SCHEDULER != true)", "scheduler");
    return;
  }

  log(`Ingestion scheduler started — running every ${intervalMinutes} minutes`, "scheduler");

  nextRunAt = new Date(Date.now() + 5000);
  setTimeout(() => tick(), 5000);
  setInterval(() => tick(), INTERVAL_MS);
}
