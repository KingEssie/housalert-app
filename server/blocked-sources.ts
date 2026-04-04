import { pool } from "./pg-pool";

let tableReady = false;

const SOURCE_MAP: Record<string, string> = {
  immowelt: "immowelt",
  kleinanzeigen: "kleinanzeigen",
  "wg-gesucht": "wg-gesucht",
  wohnungsboerse: "wohnungsboerse",
  immoscout: "immoscout",
  immonet: "immonet",
  rentola: "rentola",
  nestpick: "nestpick",
  pararius: "pararius",
  funda: "funda",
  kamernet: "kamernet",
};

export function normalizeSourceName(raw: string): string {
  const s = (raw || "").trim().toLowerCase();
  return SOURCE_MAP[s] || s;
}

async function ensureTable(): Promise<boolean> {
  if (tableReady) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_sources (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, source_name)
      )
    `);
    tableReady = true;
    return true;
  } catch (err) {
    console.error("[blocked-sources] ensureTable failed:", err);
    return false;
  }
}

export async function getBlockedSources(userId: string): Promise<string[]> {
  if (!(await ensureTable())) return [];
  const { rows } = await pool.query(
    "SELECT source_name FROM blocked_sources WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map((r: any) => r.source_name);
}

export async function addBlockedSource(userId: string, sourceName: string): Promise<boolean> {
  if (!(await ensureTable())) return false;
  const normalized = normalizeSourceName(sourceName);
  if (!normalized) return false;
  await pool.query(
    `INSERT INTO blocked_sources (user_id, source_name) VALUES ($1, $2)
     ON CONFLICT (user_id, source_name) DO NOTHING`,
    [userId, normalized]
  );
  return true;
}

export async function removeBlockedSource(userId: string, sourceName: string): Promise<boolean> {
  if (!(await ensureTable())) return false;
  const normalized = normalizeSourceName(sourceName);
  await pool.query(
    "DELETE FROM blocked_sources WHERE user_id = $1 AND source_name = $2",
    [userId, normalized]
  );
  return true;
}
