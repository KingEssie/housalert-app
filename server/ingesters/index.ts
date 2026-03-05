import { log } from "../index";
import type { Ingester, IngestionResult } from "./types";
import { wgGesuchtIngester } from "./wg-gesucht";
import { kleinanzeigenIngester } from "./kleinanzeigen";

const ingesters: Ingester[] = [wgGesuchtIngester, kleinanzeigenIngester];

interface SourceReport {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

interface IngestionReport {
  sources: SourceReport[];
  total: {
    found: number;
    inserted: number;
    duplicates: number;
    matches: number;
    errors: number;
  };
}

export async function runAllIngesters(): Promise<IngestionReport> {
  const sources: SourceReport[] = [];
  const total = { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 0 };

  for (const ingester of ingesters) {
    try {
      log(`Starting ingestion: ${ingester.name}`);
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

      total.found += result.found;
      total.inserted += result.inserted;
      total.duplicates += result.duplicates;
      total.matches += result.matches;
      total.errors += result.errors;
    } catch (err: any) {
      log(`Ingester ${ingester.name} failed: ${err.message}`);
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

  log(`All ingestion complete: ${JSON.stringify(total)}`);
  return { sources, total };
}
