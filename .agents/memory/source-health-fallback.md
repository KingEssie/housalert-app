---
name: Dual-DB source health fallback
description: sources endpoint falls back to source_health table when ingestion_run source_reports is empty (dev env)
---

## Rule
In `/api/admin/portal/sources`, always check `latestRun?.source_reports?.length > 0` before returning. When empty, call `getSourceHealthSummary()` and map rows to the `{ name, source, city, found, inserted, errors, status, durationMs, lastError }` shape the SourcesTab expects.

**Why:** The deep-scan scheduler only runs in production. In dev, `ingestion_runs.source_reports` is always `[]`. The `source_health` table (203 rows, updated by deep-scan) is the correct fallback so the admin Sources tab shows real data in both environments.

**How to apply:** Import `getSourceHealthSummary` from `./monitoring/source-health` — it is already imported in routes.ts. The mapping is: `source_name→source`, `found_count→found`, `inserted_count→inserted`, `error_count→errors`, `duplicate_count→duplicates`, `duration_ms→durationMs`, `last_error→lastError`.
