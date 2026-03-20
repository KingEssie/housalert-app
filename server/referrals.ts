import { Pool } from "pg";

export async function ensureReferralSchema(pgPool: Pool) {
  await pgPool.query(`
    DO $$ BEGIN
      ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
      ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
      ALTER TABLE user_profile_data ADD COLUMN IF NOT EXISTS referral_applied_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id BIGSERIAL PRIMARY KEY,
      referrer_user_id UUID NOT NULL,
      referred_user_id UUID NOT NULL,
      referral_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      qualified_at TIMESTAMPTZ,
      rewarded_at TIMESTAMPTZ,
      reward_type TEXT,
      reward_value TEXT,
      notes TEXT,
      UNIQUE(referred_user_id)
    );
  `);
}

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

export function generateReferralCode(firstName?: string | null): string {
  const base = firstName && firstName.trim().length >= 2
    ? sanitizeName(firstName.trim())
    : "HOUS";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

export async function ensureUserHasReferralCode(
  pgPool: Pool,
  userId: string,
  firstName?: string | null
): Promise<string> {
  const { rows } = await pgPool.query(
    "SELECT referral_code FROM user_profile_data WHERE user_id = $1",
    [userId]
  );

  if (rows[0]?.referral_code) {
    return rows[0].referral_code;
  }

  let code = generateReferralCode(firstName);
  let attempts = 0;

  while (attempts < 10) {
    try {
      await pgPool.query(
        "UPDATE user_profile_data SET referral_code = $1, updated_at = NOW() WHERE user_id = $2",
        [code, userId]
      );
      return code;
    } catch (err: any) {
      if (err.code === "23505") {
        code = generateReferralCode(firstName);
        attempts++;
      } else {
        throw err;
      }
    }
  }

  const fallback = `HOUS${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
  await pgPool.query(
    "UPDATE user_profile_data SET referral_code = $1, updated_at = NOW() WHERE user_id = $2",
    [fallback, userId]
  );
  return fallback;
}

export async function validateReferralCode(
  pgPool: Pool,
  code: string,
  currentUserId: string
): Promise<{ valid: boolean; error?: string; referrerUserId?: string }> {
  const normalised = code.trim().toUpperCase();

  if (!normalised || normalised.length < 4) {
    return { valid: false, error: "invalid_code" };
  }

  const { rows } = await pgPool.query(
    "SELECT user_id FROM user_profile_data WHERE referral_code = $1",
    [normalised]
  );

  if (rows.length === 0) {
    return { valid: false, error: "invalid_code" };
  }

  const referrerUserId = rows[0].user_id;

  if (referrerUserId === currentUserId) {
    return { valid: false, error: "own_code" };
  }

  const { rows: existing } = await pgPool.query(
    "SELECT referred_by_code FROM user_profile_data WHERE user_id = $1",
    [currentUserId]
  );

  if (existing[0]?.referred_by_code) {
    return { valid: false, error: "already_used" };
  }

  return { valid: true, referrerUserId };
}

export async function applyReferralCode(
  pgPool: Pool,
  currentUserId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const normalised = code.trim().toUpperCase();

  const validation = await validateReferralCode(pgPool, normalised, currentUserId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const updateResult = await client.query(
      `UPDATE user_profile_data
       SET referred_by_code = $1, referral_applied_at = NOW(), updated_at = NOW()
       WHERE user_id = $2 AND referred_by_code IS NULL`,
      [normalised, currentUserId]
    );

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "already_used" };
    }

    const insertResult = await client.query(
      `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [validation.referrerUserId, currentUserId, normalised]
    );

    if (insertResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "already_used" };
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getReferralSummary(
  pgPool: Pool,
  userId: string,
  firstName?: string | null
): Promise<{
  code: string;
  totalInvited: number;
  pending: number;
  qualified: number;
  rewarded: number;
  usedCode: string | null;
}> {
  const code = await ensureUserHasReferralCode(pgPool, userId, firstName);

  const { rows } = await pgPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IS NOT NULL) AS total,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending,
       COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
       COUNT(*) FILTER (WHERE status = 'rewarded') AS rewarded
     FROM referrals WHERE referrer_user_id = $1`,
    [userId]
  );

  const { rows: profileRows } = await pgPool.query(
    "SELECT referred_by_code FROM user_profile_data WHERE user_id = $1",
    [userId]
  );

  return {
    code,
    totalInvited: parseInt(rows[0]?.total || "0"),
    pending: parseInt(rows[0]?.pending || "0"),
    qualified: parseInt(rows[0]?.qualified || "0"),
    rewarded: parseInt(rows[0]?.rewarded || "0"),
    usedCode: profileRows[0]?.referred_by_code || null,
  };
}
