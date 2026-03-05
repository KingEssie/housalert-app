import { log } from "./index";
import { runAllIngesters } from "./ingesters";

const INTERVAL_MS = 10 * 60 * 1000;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  if (running) {
    log("[INGEST] Skipping — previous run still in progress", "scheduler");
    return;
  }

  running = true;
  const start = Date.now();
  log("[INGEST START]", "scheduler");

  try {
    const report = await runAllIngesters();

    for (const src of report.sources) {
      log(
        `  ${src.name}: found=${src.found} inserted=${src.inserted} duplicates=${src.duplicates} matches=${src.matches} errors=${src.errors}`,
        "scheduler"
      );
    }

    const t = report.total;
    log(
      `  Totals: inserted=${t.inserted} matches=${t.matches} errors=${t.errors}`,
      "scheduler"
    );
  } catch (err: any) {
    log(`[INGEST ERROR] ${err.message}`, "scheduler");
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  log(`[INGEST COMPLETE] in ${duration}s`, "scheduler");
  running = false;
}

export function startScheduler() {
  if (process.env.ENABLE_INGEST_SCHEDULER !== "true") {
    log("Ingestion scheduler disabled (ENABLE_INGEST_SCHEDULER != true)", "scheduler");
    return;
  }

  log(`Ingestion scheduler started — running every ${INTERVAL_MS / 60000} minutes`, "scheduler");

  setTimeout(() => tick(), 5000);

  timer = setInterval(() => tick(), INTERVAL_MS);
}
