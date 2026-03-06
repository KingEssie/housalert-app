import { log } from "../log";
import type { Ingester, IngestionResult } from "./types";
import { wgGesuchtIngester } from "./wg-gesucht";
import { kleinanzeigenIngester } from "./kleinanzeigen";
import { immoweltIngester } from "./immowelt";
import { createConfigIngester } from "./html-config";
import configSources from "./config/sources";

const hardcodedIngesters: Ingester[] = [wgGesuchtIngester, kleinanzeigenIngester, immoweltIngester];

const hardcodedNames = new Set(hardcodedIngesters.map((i) => i.name));
const configIngesters: Ingester[] = configSources
  .filter((cfg) => !hardcodedNames.has(cfg.name))
  .map((cfg) => createConfigIngester(cfg));

const ingesters: Ingester[] = [...hardcodedIngesters, ...configIngesters];

export interface SourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

export interface IngestionReport {
  sources: SourceReport[];
  total: {
    found: number;
    inserted: number;
    duplicates: number;
    matches: number;
    errors: number;
  };
}

let _running = false;
let _lastRunAt: string | null = null;
let _lastResult: IngestionReport | null = null;
let _lastError: string | null = null;

export function isRunning(): boolean {
  return _running;
}

export function getEnabledSources(): string[] {
  return ingesters.map((i) => i.name);
}

export function getLastRunStatus(): {
  lastRunAt: string | null;
  lastResult: IngestionReport | null;
  lastError: string | null;
  running: boolean;
} {
  return {
    lastRunAt: _lastRunAt,
    lastResult: _lastResult,
    lastError: _lastError,
    running: _running,
  };
}

export async function runAllIngesters(): Promise<IngestionReport> {
  if (_running) {
    throw new OverlapError("Ingest already running");
  }

  _running = true;
  _lastError = null;
  const startTime = Date.now();
  log("[INGEST START]", "ingest");

  const sources: SourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  try {
    for (const ingester of ingesters) {
      try {
        log(`Running ${ingester.name}...`, "ingest");
        const result = await ingester.run();

        const report: SourceReport = {
          name: ingester.name,
          found: result.found,
          inserted: result.inserted,
          duplicates: result.duplicates,
          matches: result.matches,
          errors: result.errors,
        };

        sources.push(report);
        log(
          `  ${ingester.name}: found=${result.found} inserted=${result.inserted} duplicates=${result.duplicates} matches=${result.matches} errors=${result.errors}`,
          "ingest"
        );

        total.found += result.found;
        total.inserted += result.inserted;
        total.duplicates += result.duplicates;
        total.matches += result.matches;
        total.errors += result.errors;
      } catch (err: any) {
        log(`  ${ingester.name} failed: ${err.message}`, "ingest");
        sources.push({
          name: ingester.name,
          found: 0,
          inserted: 0,
          duplicates: 0,
          matches: 0,
          errors: 1,
        });
        total.errors += 1;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `[INGEST COMPLETE] in ${duration}s — inserted=${total.inserted} matches=${total.matches} errors=${total.errors}`,
      "ingest"
    );

    const report: IngestionReport = { sources, total };
    _lastResult = report;
    _lastRunAt = new Date().toISOString();
    return report;
  } catch (err: any) {
    _lastError = err.message;
    throw err;
  } finally {
    _running = false;
  }
}

export class OverlapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverlapError";
  }
}
