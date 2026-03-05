import { log } from "./index";
import { runAllIngesters, OverlapError } from "./ingesters";

const INTERVAL_MS = 10 * 60 * 1000;

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
}

export function startScheduler() {
  if (process.env.ENABLE_INGEST_SCHEDULER !== "true") {
    log("Ingestion scheduler disabled (ENABLE_INGEST_SCHEDULER != true)", "scheduler");
    return;
  }

  log(`Ingestion scheduler started — running every ${INTERVAL_MS / 60000} minutes`, "scheduler");

  setTimeout(() => tick(), 5000);
  setInterval(() => tick(), INTERVAL_MS);
}
