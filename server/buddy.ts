import { pool as pgPool } from "./pg-pool";
import { log } from "./log";
import { getSubscriptionStatus, type SubscriptionStatus } from "./subscriptions";
import crypto from "crypto";

export interface BuddyRelation {
  id: string;
  owner_user_id: string;
  buddy_user_id: string | null;
  invite_email: string;
  invite_token: string;
  invite_status: "pending" | "accepted" | "revoked";
  role: string;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  created_at: string;
  accepted_at: string | null;
}

export interface BuddyAction {
  id: string;
  buddy_relation_id: string;
  actor_user_id: string;
  actor_role: "owner" | "buddy";
  action_type: "responded" | "favorited" | "recommended";
  listing_id: string;
  created_at: string;
}

export async function ensureBuddyTables(): Promise<void> {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS search_profile_buddies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id UUID NOT NULL,
        buddy_user_id UUID,
        invite_email TEXT NOT NULL,
        invite_token TEXT NOT NULL,
        invite_status TEXT NOT NULL DEFAULT 'pending',
        role TEXT NOT NULL DEFAULT 'buddy',
        email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        UNIQUE(owner_user_id, invite_email)
      )
    `);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_spb_owner ON search_profile_buddies(owner_user_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_spb_buddy ON search_profile_buddies(buddy_user_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_spb_token ON search_profile_buddies(invite_token)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_spb_email ON search_profile_buddies(invite_email)`);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS buddy_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buddy_relation_id UUID NOT NULL REFERENCES search_profile_buddies(id) ON DELETE CASCADE,
        actor_user_id UUID NOT NULL,
        actor_role TEXT NOT NULL,
        action_type TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_ba_relation ON buddy_actions(buddy_relation_id)`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_ba_listing ON buddy_actions(listing_id)`);

    const colCheck = await pgPool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'search_profile_buddies' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] search_profile_buddies table OK (${colCheck.rows.length} columns)`, "migration");
    const colCheck2 = await pgPool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'buddy_actions' ORDER BY ordinal_position"
    );
    log(`[MIGRATION] buddy_actions table OK (${colCheck2.rows.length} columns)`, "migration");
  } catch (err: any) {
    log(`[MIGRATION] Error creating buddy tables: ${err.message}`, "migration");
  }
}

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function inviteBuddy(ownerUserId: string, buddyEmail: string): Promise<{ relation: BuddyRelation | null; error?: string; isNew: boolean }> {
  const email = buddyEmail.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return { relation: null, error: "Invalid email", isNew: false };
  }

  const existing = await pgPool.query(
    `SELECT * FROM search_profile_buddies WHERE owner_user_id = $1 AND invite_email = $2`,
    [ownerUserId, email]
  );

  if (existing.rows.length > 0) {
    const rel = existing.rows[0] as BuddyRelation;
    if (rel.invite_status === "accepted") {
      return { relation: rel, error: "Already connected", isNew: false };
    }
    if (rel.invite_status === "pending") {
      return { relation: rel, error: undefined, isNew: false };
    }
    if (rel.invite_status === "revoked") {
      const token = generateInviteToken();
      const result = await pgPool.query(
        `UPDATE search_profile_buddies SET invite_status = 'pending', invite_token = $1, accepted_at = NULL, buddy_user_id = NULL WHERE id = $2 RETURNING *`,
        [token, rel.id]
      );
      return { relation: result.rows[0] as BuddyRelation, isNew: true };
    }
  }

  const activeCount = await pgPool.query(
    `SELECT COUNT(*) as cnt FROM search_profile_buddies WHERE owner_user_id = $1 AND invite_status IN ('pending', 'accepted')`,
    [ownerUserId]
  );
  if (parseInt(activeCount.rows[0].cnt) >= 1) {
    return { relation: null, error: "You can only have one active buddy", isNew: false };
  }

  const token = generateInviteToken();
  const result = await pgPool.query(
    `INSERT INTO search_profile_buddies (owner_user_id, invite_email, invite_token, invite_status, role)
     VALUES ($1, $2, $3, 'pending', 'buddy')
     RETURNING *`,
    [ownerUserId, email, token]
  );

  return { relation: result.rows[0] as BuddyRelation, isNew: true };
}

export async function acceptInvite(token: string, buddyUserId: string, buddyEmail?: string): Promise<{ relation: BuddyRelation | null; error?: string }> {
  const result = await pgPool.query(
    `SELECT * FROM search_profile_buddies WHERE invite_token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return { relation: null, error: "Invalid invite token" };
  }

  const rel = result.rows[0] as BuddyRelation;

  if (rel.invite_status === "accepted") {
    return { relation: rel, error: "Already accepted" };
  }
  if (rel.invite_status === "revoked") {
    return { relation: null, error: "This invitation has been revoked" };
  }
  if (rel.owner_user_id === buddyUserId) {
    return { relation: null, error: "You cannot be your own buddy" };
  }

  if (buddyEmail) {
    const normalizedBuddyEmail = buddyEmail.toLowerCase().trim();
    const normalizedInviteEmail = rel.invite_email.toLowerCase().trim();
    if (normalizedBuddyEmail !== normalizedInviteEmail) {
      log(`[BUDDY] Accept rejected: email mismatch — invite_email=${normalizedInviteEmail} auth_email=${normalizedBuddyEmail}`);
      return { relation: null, error: "This invitation was sent to a different email address" };
    }
  }

  const updated = await pgPool.query(
    `UPDATE search_profile_buddies
     SET invite_status = 'accepted', buddy_user_id = $1, accepted_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [buddyUserId, rel.id]
  );

  return { relation: updated.rows[0] as BuddyRelation };
}

export async function revokeBuddy(ownerUserId: string, relationId: string): Promise<boolean> {
  const result = await pgPool.query(
    `UPDATE search_profile_buddies
     SET invite_status = 'revoked'
     WHERE id = $1 AND owner_user_id = $2
     RETURNING id`,
    [relationId, ownerUserId]
  );
  return (result.rowCount || 0) > 0;
}

export async function getOwnerBuddyRelation(ownerUserId: string): Promise<BuddyRelation | null> {
  const result = await pgPool.query(
    `SELECT * FROM search_profile_buddies
     WHERE owner_user_id = $1 AND invite_status IN ('pending', 'accepted')
     ORDER BY created_at DESC LIMIT 1`,
    [ownerUserId]
  );
  return result.rows.length > 0 ? (result.rows[0] as BuddyRelation) : null;
}

export async function getBuddyRelationsForUser(buddyUserId: string): Promise<BuddyRelation[]> {
  const result = await pgPool.query(
    `SELECT * FROM search_profile_buddies
     WHERE buddy_user_id = $1 AND invite_status = 'accepted'
     ORDER BY accepted_at DESC`,
    [buddyUserId]
  );
  return result.rows as BuddyRelation[];
}

export async function getPendingInvitesForEmail(email: string): Promise<BuddyRelation[]> {
  const result = await pgPool.query(
    `SELECT * FROM search_profile_buddies
     WHERE invite_email = $1 AND invite_status = 'pending'
     ORDER BY created_at DESC`,
    [email.toLowerCase().trim()]
  );
  return result.rows as BuddyRelation[];
}

export async function getRelationById(id: string): Promise<BuddyRelation | null> {
  const result = await pgPool.query(`SELECT * FROM search_profile_buddies WHERE id = $1`, [id]);
  return result.rows.length > 0 ? (result.rows[0] as BuddyRelation) : null;
}

export async function updateBuddyPreferences(
  buddyUserId: string,
  relationId: string,
  prefs: { email_notifications_enabled?: boolean; push_notifications_enabled?: boolean }
): Promise<boolean> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (prefs.email_notifications_enabled !== undefined) {
    sets.push(`email_notifications_enabled = $${idx++}`);
    vals.push(prefs.email_notifications_enabled);
  }
  if (prefs.push_notifications_enabled !== undefined) {
    sets.push(`push_notifications_enabled = $${idx++}`);
    vals.push(prefs.push_notifications_enabled);
  }

  if (sets.length === 0) return false;

  vals.push(relationId, buddyUserId);
  const result = await pgPool.query(
    `UPDATE search_profile_buddies SET ${sets.join(", ")} WHERE id = $${idx++} AND buddy_user_id = $${idx} AND invite_status = 'accepted' RETURNING id`,
    vals
  );
  return (result.rowCount || 0) > 0;
}

export async function recordBuddyAction(
  relationId: string,
  actorUserId: string,
  actorRole: "owner" | "buddy",
  actionType: "responded" | "favorited" | "recommended",
  listingId: string,
  note?: string
): Promise<BuddyAction | null> {
  try {
    const result = await pgPool.query(
      `INSERT INTO buddy_actions (buddy_relation_id, actor_user_id, actor_role, action_type, listing_id, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [relationId, actorUserId, actorRole, actionType, listingId, note || null]
    );
    return result.rows[0] as BuddyAction;
  } catch (err: any) {
    log(`[BUDDY] Error recording action: ${err.message}`);
    return null;
  }
}

export async function getBuddyActionsForListing(relationId: string, listingId: string): Promise<BuddyAction[]> {
  const result = await pgPool.query(
    `SELECT * FROM buddy_actions WHERE buddy_relation_id = $1 AND listing_id = $2 ORDER BY created_at DESC`,
    [relationId, listingId]
  );
  return result.rows as BuddyAction[];
}

export async function getBuddyActionsForListings(relationId: string, listingIds: string[]): Promise<Record<string, BuddyAction[]>> {
  if (listingIds.length === 0) return {};
  const result = await pgPool.query(
    `SELECT * FROM buddy_actions WHERE buddy_relation_id = $1 AND listing_id = ANY($2) ORDER BY created_at DESC`,
    [relationId, listingIds]
  );
  const map: Record<string, BuddyAction[]> = {};
  for (const row of result.rows) {
    if (!map[row.listing_id]) map[row.listing_id] = [];
    map[row.listing_id].push(row as BuddyAction);
  }
  return map;
}

export async function isOwnerSubscriptionActive(ownerUserId: string): Promise<{ active: boolean; status: SubscriptionStatus }> {
  const status = await getSubscriptionStatus(ownerUserId);
  return { active: status.isActive, status };
}

export function isBuddyAction(action: string): boolean {
  return ["responded", "favorited", "recommended"].includes(action);
}

export async function getRelationByOwnerAndBuddy(ownerUserId: string, buddyUserId: string): Promise<BuddyRelation | null> {
  const result = await pgPool.query(
    `SELECT * FROM search_profile_buddies
     WHERE owner_user_id = $1 AND buddy_user_id = $2 AND invite_status = 'accepted'
     LIMIT 1`,
    [ownerUserId, buddyUserId]
  );
  return result.rows.length > 0 ? (result.rows[0] as BuddyRelation) : null;
}

export async function getOwnerNameForBuddy(ownerUserId: string): Promise<{ first_name: string; last_name: string } | null> {
  try {
    const result = await pgPool.query(
      `SELECT first_name, last_name FROM user_profile_data WHERE user_id = $1`,
      [ownerUserId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch {
    return null;
  }
}
