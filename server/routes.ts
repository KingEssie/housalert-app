import type { Express } from "express";
import { createServer, type Server } from "http";
import { computeMatchEstimate, type NormalizedFilters } from "./match-estimate";
import { getSourceHealthSummary, getStaleSourceHealth } from "./monitoring/source-health";
import { getOpenAlerts, getRecentAlerts, resolveAlertById } from "./monitoring/alerts";
import { SOURCE_REGISTRY } from "./ingesters/source-registry";
import { explainMatchInternal } from "./matching/engine";
import { sendEmailMatchAlert } from "./notifications";
import {
  runAllIngesters,
  getEnabledSources,
  getSourceStatuses,
  getLastRunStatus,
  getLastActivityAt,
  isRunning,
  OverlapError,
} from "./ingesters";
import { getNextRun } from "./scheduler";
import { getListingFreshness, getMatchTimestamps, getNewestListingIds, batchedIn } from "./freshness";
import { supabase } from "./ingesters/matching";
import { backfillMatchesForSearchProfile, explainMatch, explainAllProfilesForListing } from "./matching/engine";
import { flushUserAlerts, getRecentEmailedIds } from "./notifications/buffer";
import {
  getSubscriptionStatus,
  updateSubscriptionFromCheckout,
  updateSubscriptionStatus,
  findUserByStripeCustomerId,
  stripeStatusToDb,
} from "./subscriptions";
import { log } from "./log";
import { validateBuddyUnsubscribeToken, sendBuddyInvitationEmail, sendBuddyCollaborationEmail, sendBuddyRevokedEmail, sendBuddyRevokedOwnerEmail } from "./email";
import {
  inviteBuddy, acceptInvite, revokeBuddy, revokeBuddyAsBuddy,
  getOwnerBuddyRelation, getBuddyRelationsForUser, getPendingInvitesForEmail,
  getRelationById, updateBuddyPreferences, recordBuddyAction,
  getBuddyActionsForListing, getBuddyActionsForListings,
  isOwnerSubscriptionActive, getRelationByOwnerAndBuddy, getOwnerNameForBuddy, lookupInviteByToken, getBuddyLanguage,
  type BuddyRelation,
} from "./buddy";
import { detectLanguage, isValidLocale } from "./i18n";
import { computeMatchScore, getMatchReasons, computeHybridFilters } from "../shared/match-score";
import { normalizeCity } from "../shared/city-normalize";
import { pool as pgPool } from "./pg-pool";
import { getFaqSuggestions } from "./support-faq";
import { isAdminEmail, getRecentRuns, getRunDetail, getLatestRunCities, getSourceAggregates, getDynamicCitiesReport } from "./admin";
import { trackEvent as trackActivationEvent, getUserActivationStatus, getActivationFunnel, hasEvent as hasActivationEvent } from "./activation-events";
import { saveCancellationFeedback, getCancellationStats } from "./cancellation-feedback";
import { getBlockedSources, addBlockedSource, removeBlockedSource, normalizeSourceName } from "./blocked-sources";
import { getReferralSummary, applyReferralCode, validateReferralCode, ensureUserHasReferralCode } from "./referrals";
import { initWebPush, sendPushToUser, isPushInitialized } from "./notifications/push";
import { sendExpoTestPush } from "./notifications/expo-push";
import { detectAndStoreLanguage, getUserPreferredLanguage, applyDisplayBodies } from "./notifications/translate";
import { getSupabaseAdmin, lookupSupabaseUserByEmail } from "./supabase-admin";
import { markViewed, markApplied, markSaved, getUserMatchStats, getRecentUserMatches, getMatchCountForUser, getCanonicalMatchStates, getRecentFetchRuns, backfillFromSupabaseMatches, upsertUserMatch } from "./user-matches";

const TEN_MIN = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function detectLanguageFromHeader(acceptLang: string | string[] | undefined): import("./i18n").ServerLocale {
  const raw = Array.isArray(acceptLang) ? acceptLang.join(",") : acceptLang;
  return detectLanguage({ headers: { "accept-language": raw } });
}

function computeFreshLabel(firstSeenAt: string): string {
  const ageMs = Date.now() - new Date(firstSeenAt).getTime();
  if (ageMs < TEN_MIN) return "net_binnen";
  if (ageMs < ONE_HOUR) return "nieuw";
  if (ageMs < ONE_DAY) return "vandaag";
  return "ouder";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve Android App Links verification file so the OS verifies the domain and
  // fires appUrlOpen instead of opening the URL in Chrome.
  // Set ANDROID_APP_SHA256_CERT in env to the SHA-256 fingerprint of the release
  // keystore (run: keytool -list -v -keystore release.jks | grep SHA256).
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const sha256 = process.env.ANDROID_APP_SHA256_CERT;
    if (!sha256) {
      res.status(404).json({ error: "ANDROID_APP_SHA256_CERT not configured" });
      return;
    }
    res.set({
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    });
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.housalert.app",
          sha256_cert_fingerprints: [sha256],
        },
      },
    ]);
  });

  const logoFiles = ["housalert-logo.png", "email-logo-v2.png"];
  for (const logoFile of logoFiles) {
    app.get(`/${logoFile}`, async (_req, res) => {
      try {
        const path = await import("path");
        const fs = await import("fs");
        const logoPath = path.default.resolve(`client/public/${logoFile}`);
        if (!fs.default.existsSync(logoPath)) {
          res.status(404).end();
          return;
        }
        res.set({
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        });
        fs.default.createReadStream(logoPath).pipe(res);
      } catch (err: any) {
        log(`[LOGO] Error serving ${logoFile}: ${err.message}`);
        res.status(404).end();
      }
    });
  }


  app.get("/api/buddy-unsubscribe", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) {
        return res.status(400).send("Missing token.");
      }
      const parsed = validateBuddyUnsubscribeToken(token);
      if (!parsed) {
        return res.status(400).send("Invalid or expired link.");
      }
      return res.status(200).send(`
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Unsubscribe - HousAlert</title></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;text-align:center;padding:20px;">
          <h2 style="margin-bottom:12px;">Unsubscribe from Search Buddy alerts?</h2>
          <p style="color:#4B5563;margin-bottom:24px;">You will no longer receive listing alerts as a Search Buddy for this account.</p>
          <form method="POST" action="/api/buddy-unsubscribe">
            <input type="hidden" name="token" value="${token.replace(/"/g, "&quot;")}">
            <button type="submit" style="background:#e91e63;color:#fff;border:none;border-radius:6px;padding:14px 32px;font-size:16px;cursor:pointer;font-weight:600;">Yes, unsubscribe me</button>
          </form>
        </body></html>
      `);
    } catch (err: any) {
      log(`[BUDDY UNSUB] GET ERROR: ${err.message}`);
      return res.status(500).send("Something went wrong. Please try again later.");
    }
  });

  app.post("/api/buddy-unsubscribe", async (req, res) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!token) {
        return res.status(400).send("Missing token.");
      }
      const parsed = validateBuddyUnsubscribeToken(token);
      if (!parsed) {
        return res.status(400).send("Invalid or expired link.");
      }
      const { ownerUserId, buddyEmail } = parsed;
      log(`[BUDDY UNSUB] POST token valid — ownerUserId=${ownerUserId.substring(0, 8)}... buddyEmail=${buddyEmail}`);

      const [legacyResult, v2Result] = await Promise.all([
        pgPool.query(
          `UPDATE user_profile_data SET search_buddy_enabled = false, search_buddy_status = 'revoked_by_buddy', search_buddy_removed_at = NOW(), search_buddy_email = NULL WHERE user_id = $1 AND lower(trim(search_buddy_email)) = $2 AND search_buddy_status = 'active'`,
          [ownerUserId, buddyEmail]
        ),
        pgPool.query(
          `UPDATE search_profile_buddies SET invite_status = 'revoked' WHERE owner_user_id = $1 AND lower(trim(invite_email)) = $2 AND invite_status != 'revoked' RETURNING id`,
          [ownerUserId, buddyEmail]
        ),
      ]);

      log(`[BUDDY UNSUB] legacy rowsUpdated=${legacyResult.rowCount} v2RowsUpdated=${v2Result.rowCount} — userId=${ownerUserId.substring(0, 8)}... buddyEmail=${buddyEmail}`);

      if ((legacyResult.rowCount || 0) === 0 && (v2Result.rowCount || 0) === 0) {
        log(`[BUDDY UNSUB] no active buddy matched in either table — userId=${ownerUserId.substring(0, 8)}... buddyEmail=${buddyEmail}`);
        return res.status(200).send(`
          <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>HousAlert</title></head>
          <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;text-align:center;padding:20px;">
            <h2>Already unsubscribed</h2>
            <p style="color:#4B5563;">This buddy email is no longer active on this account.</p>
          </body></html>
        `);
      }

      log(`[BUDDY UNSUB] SUCCESS — userId=${ownerUserId.substring(0, 8)}... buddyEmail=${buddyEmail} status→revoked_by_buddy`);

      return res.status(200).send(`
        <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>HousAlert</title></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;text-align:center;padding:20px;">
          <h2>Unsubscribed</h2>
          <p style="color:#4B5563;">You have been removed as a Search Buddy. You will no longer receive listing alerts for this account.</p>
        </body></html>
      `);
    } catch (err: any) {
      log(`[BUDDY UNSUB] POST ERROR: ${err.message}`);
      return res.status(500).send("Something went wrong. Please try again later.");
    }
  });

  // ── Buddy V2 API ──────────────────────────────────────────────────

  async function authenticateRequest(req: any): Promise<{ user: { id: string; email?: string } } | null> {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return null;
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return { user: { id: user.id, email: user.email } };
    } catch { return null; }
  }

  app.get("/api/buddy/invite-info", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ error: "Token required" });

      const invite = await lookupInviteByToken(token);
      if (!invite) return res.status(404).json({ error: "Invalid invite token" });

      const ownerProfile = await getOwnerNameForBuddy(invite.owner_user_id);
      const ownerName = ownerProfile ? `${ownerProfile.first_name || ""} ${ownerProfile.last_name || ""}`.trim() : null;

      // Use direct GoTrue REST API — the JS SDK listUsers() silently ignores
      // the filter param and returns all users, making this check always true.
      const existingUser = await lookupSupabaseUserByEmail(invite.invite_email);
      const accountExists = !!existingUser;

      return res.json({
        invite_email: invite.invite_email,
        invite_status: invite.invite_status,
        owner_name: ownerName,
        account_exists: accountExists,
      });
    } catch (err: any) {
      log(`[BUDDY] invite-info error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buddy/invite", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { email } = req.body;
      log(`[BUDDY INVITE] POST /api/buddy/invite — owner=${auth.user.id.substring(0, 8)}... email=${email}`);
      if (!email || typeof email !== "string") return res.status(400).json({ error: "Email required" });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        log(`[BUDDY INVITE] REJECTED — invalid email format: ${email}`);
        return res.status(400).json({ error: "Invalid email address format" });
      }

      const subCheck = await isOwnerSubscriptionActive(auth.user.id);
      if (!subCheck.active) {
        log(`[BUDDY INVITE] BLOCKED — no active subscription for owner=${auth.user.id.substring(0, 8)}...`);
        return res.status(403).json({ error: "Active subscription required to invite a buddy" });
      }

      const ownerEmail = auth.user.email?.toLowerCase().trim();
      if (ownerEmail === email.toLowerCase().trim()) return res.status(400).json({ error: "You cannot invite yourself" });

      const result = await inviteBuddy(auth.user.id, email);
      log(`[BUDDY INVITE] inviteBuddy result — isNew=${result.isNew} error=${result.error || "none"} relationId=${result.relation?.id?.substring(0, 8) || "null"} status=${result.relation?.invite_status || "null"}`);
      if (result.error && !result.relation) return res.status(400).json({ error: result.error });

      const shouldSendEmail = result.relation && (result.isNew || result.relation.invite_status === "pending");
      log(`[BUDDY INVITE] shouldSendEmail=${shouldSendEmail} (isNew=${result.isNew}, status=${result.relation?.invite_status})`);

      let emailSent = false;
      let emailError: string | null = null;
      if (shouldSendEmail && result.relation) {
        const ownerProfile = await getOwnerNameForBuddy(auth.user.id);
        const inviterName = ownerProfile ? `${ownerProfile.first_name || ""} ${ownerProfile.last_name || ""}`.trim() : "Someone";

        // Resolve invitation email language:
        // 1. If buddy already has an account → use buddy's stored language
        // 2. If buddy has no account or no stored language → use owner's stored language from DB
        // 3. Never use the transient Accept-Language request header
        let lang: import("./i18n").ServerLocale = "en";
        try {
          const buddyAccount = await lookupSupabaseUserByEmail(email);
          const buddyUserId = buddyAccount?.id;
          if (buddyUserId) {
            const buddyStoredLang = await getBuddyLanguage(buddyUserId);
            if (isValidLocale(buddyStoredLang)) {
              lang = buddyStoredLang;
              log(`[BUDDY INVITE] Lang resolved from buddy account — buddyUserId=${buddyUserId.substring(0, 8)}... lang=${lang}`);
            } else {
              const ownerStoredLang = await getBuddyLanguage(auth.user.id);
              if (isValidLocale(ownerStoredLang)) lang = ownerStoredLang;
              log(`[BUDDY INVITE] Buddy has account but no stored lang — using owner stored lang=${lang}`);
            }
          } else {
            const ownerStoredLang = await getBuddyLanguage(auth.user.id);
            if (isValidLocale(ownerStoredLang)) lang = ownerStoredLang;
            log(`[BUDDY INVITE] No buddy account — using owner stored lang=${lang}`);
          }
        } catch {
          try {
            const ownerStoredLang = await getBuddyLanguage(auth.user.id);
            if (isValidLocale(ownerStoredLang)) lang = ownerStoredLang;
          } catch {}
          log(`[BUDDY INVITE] Lang lookup failed — using lang=${lang}`);
        }


        log(`[BUDDY INVITE] Sending email — to=${email} inviter="${inviterName}" lang=${lang} token=${result.relation.invite_token?.substring(0, 8)}...`);
        try {
          const emailResult = await sendBuddyInvitationEmail(email, inviterName, lang, result.relation.invite_token);
          emailSent = emailResult.sent;
          emailError = emailResult.error || null;
          log(`[BUDDY INVITE] Email result — sent=${emailSent} error=${emailError || "none"}`);
        } catch (e: any) {
          emailError = e.message;
          log(`[BUDDY INVITE] Email EXCEPTION — ${e.message}`);
        }
      }

      return res.json({ ok: true, relation: result.relation, isNew: result.isNew, emailSent, emailError });
    } catch (err: any) {
      log(`[BUDDY INVITE] UNHANDLED ERROR — ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buddy/accept", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { token } = req.body;
      if (!token || typeof token !== "string") return res.status(400).json({ error: "Token required" });

      const result = await acceptInvite(token, auth.user.id, auth.user.email);
      if (result.error && !result.relation) return res.status(400).json({ error: result.error });

      if (result.relation && result.relation.invite_status === "accepted") {
        const ownerProfile = await getOwnerNameForBuddy(result.relation.owner_user_id);
        if (ownerProfile) {
          log(`[BUDDY] Accepted: buddy ${auth.user.id.substring(0, 8)}... for owner ${result.relation.owner_user_id.substring(0, 8)}...`);
        }
      }

      return res.json({ ok: true, relation: result.relation });
    } catch (err: any) {
      log(`[BUDDY] accept error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buddy/invites", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const email = auth.user.email;
      if (!email) return res.json({ invites: [] });

      const invites = await getPendingInvitesForEmail(email);
      const enriched = await Promise.all(invites.map(async (inv) => {
        const ownerProfile = await getOwnerNameForBuddy(inv.owner_user_id);
        return { ...inv, owner_name: ownerProfile ? `${ownerProfile.first_name || ""} ${ownerProfile.last_name || ""}`.trim() : null };
      }));

      return res.json({ invites: enriched });
    } catch (err: any) {
      log(`[BUDDY] invites error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buddy/connections", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const asOwner = await getOwnerBuddyRelation(auth.user.id);
      const asBuddy = await getBuddyRelationsForUser(auth.user.id);

      let ownerData = null;
      if (asOwner) {
        ownerData = { ...asOwner };
      }

      const buddyData = await Promise.all(asBuddy.map(async (rel) => {
        const ownerProfile = await getOwnerNameForBuddy(rel.owner_user_id);
        const subCheck = await isOwnerSubscriptionActive(rel.owner_user_id);
        return {
          ...rel,
          owner_name: ownerProfile ? `${ownerProfile.first_name || ""} ${ownerProfile.last_name || ""}`.trim() : null,
          owner_sub_active: subCheck.active,
        };
      }));

      return res.json({ asOwner: ownerData, asBuddy: buddyData });
    } catch (err: any) {
      log(`[BUDDY] connections error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buddy/revoke", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { relationId } = req.body;
      if (!relationId) return res.status(400).json({ error: "Relation ID required" });

      const relation = await getRelationById(relationId);

      const ownerRevoked = await revokeBuddy(auth.user.id, relationId);
      const buddyRevoked = ownerRevoked ? false : await revokeBuddyAsBuddy(auth.user.id, relationId);
      if (!ownerRevoked && !buddyRevoked) return res.status(404).json({ error: "Not found or not authorized" });

      // Reset the former buddy's activation state so they re-enter the normal standalone onboarding flow
      const buddyUserId = ownerRevoked ? relation?.buddy_user_id : auth.user.id;
      if (buddyUserId) {
        await pgPool.query(
          `UPDATE user_profile_data SET post_paywall_onboarding_completed = false, paywall_completed = false, onboarding_current_step = NULL WHERE user_id = $1`,
          [buddyUserId]
        ).catch((err: any) => log(`[BUDDY] Failed to reset buddy activation state: ${err.message}`));
      }

      if (relation?.invite_email && relation.invite_status === "accepted") {
        if (ownerRevoked) {
          const ownerProfile = await getOwnerNameForBuddy(auth.user.id);
          const ownerName = ownerProfile
            ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(" ") || "HousAlert"
            : "HousAlert";
          const ownerLang = detectLanguage(req);
          let lang = ownerLang;
          if (relation.buddy_user_id) {
            const buddyStoredLang = await getBuddyLanguage(relation.buddy_user_id);
            if (isValidLocale(buddyStoredLang)) {
              lang = buddyStoredLang;
            }
          }
          sendBuddyRevokedEmail(relation.invite_email, ownerName, lang).catch((err: any) => {
            log(`[BUDDY] revoke email error: ${err.message}`);
          });
        } else {
          (async () => {
            try {
              const adminSb = getSupabaseAdmin();
              const { data: ownerAuthData } = await adminSb.auth.admin.getUserById(relation.owner_user_id);
              const ownerEmail = ownerAuthData?.user?.email;
              if (!ownerEmail) {
                log(`[BUDDY] buddy-revoked-owner: no email found for owner ${relation.owner_user_id.substring(0, 8)}...`);
                return;
              }
              const buddyProfile = await getOwnerNameForBuddy(auth.user.id);
              const buddyName = buddyProfile
                ? [buddyProfile.first_name, buddyProfile.last_name].filter(Boolean).join(" ") || relation.invite_email
                : relation.invite_email;
              const ownerStoredLang = await getBuddyLanguage(relation.owner_user_id);
              const lang = isValidLocale(ownerStoredLang) ? ownerStoredLang : "nl";
              await sendBuddyRevokedOwnerEmail(ownerEmail, buddyName, lang);
            } catch (err: any) {
              log(`[BUDDY] buddy-revoked-owner email error: ${err.message}`);
            }
          })();
        }
      }

      return res.json({ ok: true });
    } catch (err: any) {
      log(`[BUDDY] revoke error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.put("/api/buddy/preferences", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { relationId, email_notifications_enabled, push_notifications_enabled } = req.body;
      if (!relationId) return res.status(400).json({ error: "Relation ID required" });

      const ok = await updateBuddyPreferences(auth.user.id, relationId, {
        email_notifications_enabled,
        push_notifications_enabled,
      });
      if (!ok) return res.status(404).json({ error: "Not found or not buddy" });

      return res.json({ ok: true });
    } catch (err: any) {
      log(`[BUDDY] preferences error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buddy/action", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { listingId, actionType, note } = req.body;
      if (!listingId || !actionType) return res.status(400).json({ error: "listingId and actionType required" });
      if (!["responded", "favorited", "recommended"].includes(actionType)) return res.status(400).json({ error: "Invalid action type" });

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      const asOwnerRel = await getOwnerBuddyRelation(auth.user.id);

      let relation: BuddyRelation | null = null;
      let actorRole: "owner" | "buddy" = "buddy";

      if (asBuddy.length > 0) {
        relation = asBuddy[0];
        actorRole = "buddy";
      } else if (asOwnerRel && asOwnerRel.invite_status === "accepted") {
        relation = asOwnerRel;
        actorRole = "owner";
      }

      if (!relation) return res.status(404).json({ error: "No active buddy connection" });

      const ownerIdForSub = actorRole === "buddy" ? relation.owner_user_id : auth.user.id;
      const subCheck = await isOwnerSubscriptionActive(ownerIdForSub);
      if (!subCheck.active) return res.status(403).json({ error: "Owner subscription not active" });

      const action = await recordBuddyAction(relation.id, auth.user.id, actorRole, actionType, listingId, note);
      if (!action) return res.status(500).json({ error: "Failed to record action" });

      const recipientUserId = actorRole === "buddy" ? relation.owner_user_id : relation.buddy_user_id;
      if (recipientUserId && relation.email_notifications_enabled) {
        try {
          const actorProfile = await getOwnerNameForBuddy(auth.user.id);
          const actorName = actorProfile ? `${actorProfile.first_name || ""} ${actorProfile.last_name || ""}`.trim() : "Your buddy";
          const recipientResult = await pgPool.query(
            `SELECT upd.preferred_language FROM user_profile_data upd WHERE upd.user_id = $1`,
            [recipientUserId]
          );
          const recipientLang = (recipientResult.rows[0]?.preferred_language || "nl") as import("./i18n").ServerLocale;

          const recipientAuthAdmin = getSupabaseAdmin();
          const { data: recipientUser } = await recipientAuthAdmin.auth.admin.getUserById(recipientUserId);
          if (recipientUser?.user?.email) {
            sendBuddyCollaborationEmail(
              recipientUser.user.email,
              actorName,
              actionType,
              listingId,
              recipientLang
            ).catch(e => log(`[BUDDY] collab email error: ${e.message}`));
          }
        } catch (e: any) {
          log(`[BUDDY] collab notification error: ${e.message}`);
        }
      }

      return res.json({ ok: true, action });
    } catch (err: any) {
      log(`[BUDDY] action error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buddy/actions/:listingId", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { listingId } = req.params;

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      const asOwnerRel = await getOwnerBuddyRelation(auth.user.id);

      let relation: BuddyRelation | null = null;
      if (asBuddy.length > 0) relation = asBuddy[0];
      else if (asOwnerRel && asOwnerRel.invite_status === "accepted") relation = asOwnerRel;

      if (!relation) return res.json({ actions: [] });

      const ownerId = asBuddy.length > 0 ? relation.owner_user_id : auth.user.id;
      const subCheck = await isOwnerSubscriptionActive(ownerId);
      if (!subCheck.active) return res.status(403).json({ error: "Owner subscription not active" });

      const actions = await getBuddyActionsForListing(relation.id, listingId);
      return res.json({ actions });
    } catch (err: any) {
      log(`[BUDDY] actions error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/buddy/actions/batch", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const { listingIds } = req.body;
      if (!Array.isArray(listingIds)) return res.status(400).json({ error: "listingIds array required" });

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      const asOwnerRel = await getOwnerBuddyRelation(auth.user.id);

      let relation: BuddyRelation | null = null;
      if (asBuddy.length > 0) relation = asBuddy[0];
      else if (asOwnerRel && asOwnerRel.invite_status === "accepted") relation = asOwnerRel;

      if (!relation) return res.json({ actions: {} });

      const ownerId = asBuddy.length > 0 ? relation.owner_user_id : auth.user.id;
      const subCheck = await isOwnerSubscriptionActive(ownerId);
      if (!subCheck.active) return res.status(403).json({ error: "Owner subscription not active" });

      const actions = await getBuddyActionsForListings(relation.id, listingIds.slice(0, 100));
      return res.json({ actions });
    } catch (err: any) {
      log(`[BUDDY] batch actions error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buddy/shared-matches", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      if (asBuddy.length === 0) return res.status(403).json({ error: "Not a buddy" });

      const relation = asBuddy[0];
      const subCheck = await isOwnerSubscriptionActive(relation.owner_user_id);
      if (!subCheck.active) return res.status(403).json({ error: "Owner subscription not active" });

      const ownerId = relation.owner_user_id;

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("created_at")
        .eq("user_id", ownerId)
        .single();
      const premiumStartedAt = subRow?.created_at || null;
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const cutoff = premiumStartedAt
        ? (new Date(premiumStartedAt).getTime() > new Date(ninetyDaysAgo).getTime() ? premiumStartedAt : ninetyDaysAgo)
        : ninetyDaysAgo;

      let matchQuery = supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", ownerId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1000);
      const { data: matchRows, error: mErr } = await matchQuery;

      if (mErr) return res.status(500).json({ error: mErr.message });
      if (!matchRows || matchRows.length === 0) return res.json({ matches: [], totalCount: 0 });

      log(`[BUDDY] shared-matches buddyId=${auth.user.id.substring(0, 8)}... ownerId=${ownerId.substring(0, 8)}... rawMatches=${matchRows.length}`);

      const enriched = matchRows.map((m: any) => ({ ...m, matched_at: m.created_at }));
      const dedupedByListing: Record<string, any> = {};
      for (const m of enriched) {
        if (!dedupedByListing[m.listing_id]) dedupedByListing[m.listing_id] = m;
      }
      let uniqueMatches = Object.values(dedupedByListing);

      const allListingIds = uniqueMatches.map((m: any) => m.listing_id);
      if (allListingIds.length === 0) return res.json({ matches: [], totalCount: 0 });

      const profileIds = [...new Set(uniqueMatches.map((m: any) => m.search_profile_id).filter(Boolean))];
      const [listingsData, freshnessMap, profilesData] = await Promise.all([
        batchedIn<any>(
          "listings", "id", allListingIds,
          "id, title, price, size_m2, bedrooms, city, source, url, image_url, furnished, pets_allowed, district",
          (q: any) => q.not("title", "is", null)
        ),
        getListingFreshness(allListingIds),
        profileIds.length > 0
          ? batchedIn<any>(
              "search_profiles", "id", profileIds,
              "id, city, price_min, price_max, bedrooms_min, size_min, furnished, extra_features, districts, location_mode"
            )
          : Promise.resolve([]),
      ]);

      const listingMap: Record<string, any> = {};
      for (const l of listingsData) listingMap[l.id] = l;
      const profileMap: Record<string, any> = {};
      for (const p of profilesData) profileMap[p.id] = p;

      const validListingIds = new Set(Object.keys(listingMap));
      const validMatches = uniqueMatches.filter((m: any) => validListingIds.has(m.listing_id));

      const validResults = validMatches.map((m: any) => {
        const l = listingMap[m.listing_id];
        const firstSeenAt = freshnessMap[m.listing_id]?.first_seen_at || m.created_at;
        const publishedAt = l?.published_at ?? null;
        const sourcePublishedAt = l?.source_published_at ?? null;
        const displayTime = publishedAt || sourcePublishedAt || firstSeenAt;
        const profile = profileMap[m.search_profile_id];
        let match_score = null;
        let match_label = null;
        let match_reasons: string[] = [];
        let hybrid_filters = null;
        if (l && profile) {
          const scoreResult = computeMatchScore({
            listing: { price: l.price ?? 0, bedrooms: l.bedrooms ?? 0, size_m2: l.size_m2 ?? 0, city: l.city ?? "" },
            profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
          });
          match_score = scoreResult.score;
          match_label = scoreResult.label;
          match_reasons = getMatchReasons(scoreResult.details);
          hybrid_filters = computeHybridFilters({
            listing: { furnished: l.furnished, pets_allowed: l.pets_allowed, district: l.district },
            profile: { furnished: profile.furnished, extra_features: profile.extra_features, districts: profile.districts, location_mode: profile.location_mode },
          });
        }
        return {
          listing_id: m.listing_id,
          title: l.title,
          price: l.price ?? null,
          size_m2: l.size_m2 ?? null,
          bedrooms: l.bedrooms ?? null,
          city: l.city ?? null,
          district: l.district ?? null,
          source: l.source ?? null,
          url: l.url ?? null,
          image_url: l.image_url ?? null,
          matched_at: m.matched_at,
          published_at: publishedAt,
          source_published_at: sourcePublishedAt,
          first_seen_at: firstSeenAt,
          display_time: displayTime,
          fresh_label: computeFreshLabel(displayTime),
          match_score,
          match_label,
          match_reasons,
          hybrid_filters,
          in_latest_email: false,
          canonical_viewed: false,
          canonical_saved: false,
          canonical_applied: false,
          canonical_dismissed: false,
        };
      });

      validResults.sort((a: any, b: any) => {
        const dateA = new Date(a.matched_at).getTime();
        const dateB = new Date(b.matched_at).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return a.listing_id.localeCompare(b.listing_id);
      });

      const top50 = validResults.slice(0, 50);
      log(`[BUDDY] shared-matches returned=${top50.length} for buddy=${auth.user.id.substring(0, 8)}...`);

      return res.json({
        matches: top50,
        totalCount: validResults.length,
        owner_user_id: ownerId,
      });
    } catch (err: any) {
      log(`[BUDDY] shared-matches error: ${err.message}`);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/buddy/owner-profiles", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      if (asBuddy.length === 0) return res.status(403).json({ error: "Not a buddy" });

      const ownerId = asBuddy[0].owner_user_id;
      const { data: profiles, error } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(profiles ?? []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/buddy/owner-profile-data", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) return res.status(401).json({ error: "Unauthorized" });

      const asBuddy = await getBuddyRelationsForUser(auth.user.id);
      if (asBuddy.length === 0) return res.status(403).json({ error: "Not a buddy" });

      const ownerId = asBuddy[0].owner_user_id;
      const { rows } = await pgPool.query(
        "SELECT application_template, first_name FROM user_profile_data WHERE user_id = $1 LIMIT 1",
        [ownerId]
      );
      const row = rows[0];
      return res.json({
        application_template: row?.application_template ?? null,
        first_name: row?.first_name ?? null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── End Buddy V2 API ──────────────────────────────────────────────

  const missingStripeVars: string[] = [];
  if (!process.env.STRIPE_PRICE_MONTHLY && !process.env.STRIPE_PRICE_1_MONTH) missingStripeVars.push("STRIPE_PRICE_MONTHLY");
  if (!process.env.STRIPE_PRICE_TWO_MONTH && !process.env.STRIPE_PRICE_2_MONTHS) missingStripeVars.push("STRIPE_PRICE_TWO_MONTH");
  if (!process.env.STRIPE_PRICE_THREE_MONTH && !process.env.STRIPE_PRICE_3_MONTHS) missingStripeVars.push("STRIPE_PRICE_THREE_MONTH");
  if (!process.env.STRIPE_WEBHOOK_SECRET) missingStripeVars.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.APP_PUBLIC_BASE_URL) missingStripeVars.push("APP_PUBLIC_BASE_URL");

  if (missingStripeVars.length > 0) {
    log(`[stripe-config] Missing env vars: ${missingStripeVars.join(", ")}. Payment features may be limited.`);
  }

  let stripeAvailable = true;
  try {
    const { getUncachableStripeClient } = await import("./stripe/stripeClient");
    const stripe = await getUncachableStripeClient();
    log("[stripe-config] Stripe initialized successfully.");

    try {
      const account = await stripe.accounts.retrieve();
      console.log("=== STRIPE DEBUG ===");
      console.log("Stripe account ID:", account.id);
      console.log("Stripe email:", account.email);
      console.log("Stripe country:", account.country);
      console.log("Stripe livemode:", account.charges_enabled ? "charges enabled" : "charges disabled");
      console.log("====================");
    } catch (acctErr: any) {
      console.log("=== STRIPE DEBUG ===");
      console.log("Could not retrieve account info:", acctErr.message);
      console.log("====================");
    }
  } catch (err: any) {
    stripeAvailable = false;
    log(`[stripe-config] Stripe not available: ${err.message}`);
  }

  initWebPush();

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint, p256dh, auth } = req.body;
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing subscription fields" });
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: user.id, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
          { onConflict: "endpoint" }
        );

      if (error) return res.status(500).json({ error: error.message });
      log(`[PUSH] Subscription stored for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/push/subscribe", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      log(`[PUSH] Subscription removed for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/push/vapid-key", (_req, res) => {
    const key = process.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: "Push not configured" });
    return res.json({ publicKey: key });
  });

  app.post("/api/push/test-self", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sb = getSupabaseAdmin();
      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("expo_push_token, platform")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const activeTokens = tokens || [];
      if (activeTokens.length === 0) {
        return res.json({ success: false, tokens_found: 0, tokens_targeted: 0, error: "No active Expo push tokens registered for your account" });
      }

      const { sendWithRetry } = await import("./notifications/expo-push");
      const now = new Date().toLocaleTimeString("nl-NL");
      const messages = activeTokens.map((t: any) => ({
        to: t.expo_push_token,
        sound: "default",
        title: "HousAlert Test",
        body: `Push test geslaagd @ ${now}`,
        data: { url: "/dashboard", type: "self_test" },
        priority: "high" as const,
        channelId: "match-alerts",
      }));

      const { tickets, error } = await sendWithRetry(messages);
      const ticketIds = (tickets || []).filter((t: any) => t?.id).map((t: any) => t.id);

      log(`[PUSH TEST-SELF] User ${user.id.substring(0, 8)}... sent self-test push to ${activeTokens.length} token(s)`);

      return res.json({
        success: !error && tickets.every((t: any) => t?.status === "ok"),
        tokens_found: activeTokens.length,
        tokens_targeted: messages.length,
        push_ticket_ids: ticketIds.length > 0 ? ticketIds : null,
        error: error || null,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/push/debug-self", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sb = getSupabaseAdmin();
      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("expo_push_token, platform, is_active, updated_at")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const activeTokens = tokens || [];
      const masked = activeTokens.map((t: any) => ({
        token: t.expo_push_token.substring(0, 25) + "...]",
        platform: t.platform,
        updated_at: t.updated_at,
      }));

      const { data: logs } = await sb
        .from("push_delivery_log")
        .select("id, channel, token_snippet, title, body, status, expo_ticket_id, expo_receipt_status, error_message, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: settings } = await sb
        .from("notification_settings")
        .select("push_enabled, email_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      return res.json({
        active_token_count: activeTokens.length,
        masked_tokens: masked,
        push_enabled: settings?.push_enabled ?? null,
        email_enabled: settings?.email_enabled ?? null,
        recent_delivery_logs: logs || [],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Push: status / register / unregister (spec-compliant aliases) ──────────

  app.get("/api/push/status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sb = getSupabaseAdmin();
      const [webRes, expoRes, settingsRes] = await Promise.all([
        sb.from("push_subscriptions").select("id").eq("user_id", user.id),
        sb.from("expo_push_tokens").select("id").eq("user_id", user.id).eq("is_active", true),
        sb.from("user_notification_settings").select("push_enabled").eq("user_id", user.id).maybeSingle(),
      ]);

      const webCount = (webRes.data?.length ?? 0);
      const expoCount = (expoRes.data?.length ?? 0);
      const totalDevices = webCount + expoCount;

      return res.json({
        subscribed: totalDevices > 0,
        devices: totalDevices,
        web_subscriptions: webCount,
        expo_tokens: expoCount,
        push_enabled: settingsRes.data?.push_enabled ?? false,
        configured: !!(process.env.VITE_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/push/register", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint, p256dh, auth, platform = "web", provider = "webpush" } = req.body;
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing subscription fields (endpoint, p256dh, auth required)" });
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: user.id, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
          { onConflict: "endpoint" }
        );

      if (error) return res.status(500).json({ error: error.message });
      const endpointDomain = (() => { try { return new URL(endpoint).hostname; } catch { return "unknown"; } })();
      log(`[PUSH] Device registered for user ${user.id.substring(0, 8)}... platform=${platform} provider=${provider} endpoint_host=${endpointDomain} p256dh_prefix=${String(p256dh).substring(0, 8)}... auth_prefix=${String(auth).substring(0, 8)}...`);
      return res.json({ ok: true, platform, provider });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/push/unregister", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      log(`[PUSH] Device unregistered for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  const PUSH_REG_VERSION = "v2-2026-03-14";
  const PUSH_REG_BUILD_TIME = new Date().toISOString();

  app.get("/api/version/push-registration", (_req, res) => {
    return res.json({
      version: PUSH_REG_VERSION,
      build_time: PUSH_REG_BUILD_TIME,
      persisted_support: true,
      active_token_count_support: true,
    });
  });

  app.post("/api/expo-push-token", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        log(`[EXPO-PUSH ${PUSH_REG_VERSION}] Rejected: no auth token`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        log(`[EXPO-PUSH] Rejected: auth failed — ${authErr?.message || "no user"}`);
        return res.status(401).json({ error: "Unauthorized" });
      }

      log(`[EXPO-PUSH] Request from user ${user.id.substring(0, 8)}... body=${JSON.stringify(req.body)}`);

      const { expo_push_token, platform } = req.body;
      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        log(`[EXPO-PUSH] Rejected: invalid token format — got "${String(expo_push_token).substring(0, 30)}"`);
        return res.status(400).json({ error: "Invalid expo_push_token" });
      }

      const plat = platform === "android" ? "android" : "ios";
      const now = new Date().toISOString();
      const sb = getSupabaseAdmin();

      const { error: deactivateErr } = await sb
        .from("expo_push_tokens")
        .update({ is_active: false, updated_at: now })
        .eq("expo_push_token", expo_push_token)
        .neq("user_id", user.id);

      if (deactivateErr) {
        log(`[EXPO-PUSH] Deactivate other users warning: ${deactivateErr.message}`);
      }

      const { error: upsertErr } = await sb.from("expo_push_tokens").upsert(
        {
          user_id: user.id,
          expo_push_token,
          platform: plat,
          is_active: true,
          updated_at: now,
        },
        { onConflict: "user_id,expo_push_token" }
      );

      if (upsertErr) {
        log(`[EXPO-PUSH] UPSERT FAILED for user ${user.id.substring(0, 8)}...: ${upsertErr.message} (code=${upsertErr.code})`);
        return res.status(500).json({ ok: false, error: `Token persistence failed: ${upsertErr.message}` });
      }

      const { count } = await sb
        .from("expo_push_tokens")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      log(`[EXPO-PUSH] Token registered OK for user ${user.id.substring(0, 8)}... platform=${plat} active_count=${count}`);
      return res.json({ ok: true, persisted: true, active_token_count: count });
    } catch (err: any) {
      log(`[EXPO-PUSH] EXCEPTION registering token: ${err.message}`);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.delete("/api/expo-push-token", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { expo_push_token } = req.body;
      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid expo_push_token" });
      }

      const sb = getSupabaseAdmin();
      await sb
        .from("expo_push_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("expo_push_token", expo_push_token);

      log(`[EXPO-PUSH] Token deactivated for user ${user.id.substring(0, 8)}...`);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/match-alert", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

    const subStatus = await getSubscriptionStatus(user.id);
    if (!subStatus.isActive && !subStatus.isTrial) {
      return res.json({ sent: false, reason: "no active subscription" });
    }

    const recipientEmail = user.email;
    if (!recipientEmail) {
      return res.status(400).json({ error: "No email on account" });
    }

    const { listing } = req.body;

    if (!listing || !listing.title || !listing.city) {
      return res.status(400).json({ error: "Missing listing data" });
    }

    const sent = await sendEmailMatchAlert(recipientEmail, listing, user.id);
    return res.json({ sent });
  });

  app.get("/api/notifications/settings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data: settings, error } = await supabase
        .from("user_notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });

      const cleaned = settings ?? {
          user_id: user.id,
          phone_e164: null,
          email_enabled: true,
          push_enabled: false,
        };
      if (cleaned.sms_enabled !== undefined) delete cleaned.sms_enabled;
      if (cleaned.whatsapp_enabled !== undefined) delete cleaned.whatsapp_enabled;
      if (cleaned.push_enabled === undefined) cleaned.push_enabled = false;
      return res.json(cleaned);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/notifications/settings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { phone_e164, email_enabled, push_enabled } = req.body;

      if (phone_e164 !== undefined && phone_e164 !== null) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (typeof phone_e164 !== "string" || !e164Regex.test(phone_e164)) {
          return res.status(400).json({ error: "Invalid phone number. Use E.164 format (e.g. +31612345678)" });
        }
      }

      const payload: Record<string, any> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (phone_e164 !== undefined) payload.phone_e164 = phone_e164;
      payload.whatsapp_enabled = false;
      payload.sms_enabled = false;
      if (typeof email_enabled === "boolean") payload.email_enabled = email_enabled;
      if (typeof push_enabled === "boolean") payload.push_enabled = push_enabled;

      const { data: existing } = await supabase
        .from("user_notification_settings")
        .select("user_id, email_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      const emailWasOff = existing && existing.email_enabled === false;
      const emailTurningOn = payload.email_enabled === true;

      if (emailWasOff && emailTurningOn) {
        try {
          await pgPool.query(
            `UPDATE user_profile_data SET email_resume_after = NOW() WHERE user_id = $1`,
            [user.id]
          );
          log(`[NOTIF] Set email_resume_after for user ${user.id.substring(0, 8)}... (email re-enabled)`);
        } catch (e: any) {
          log(`[NOTIF] Failed to set email_resume_after: ${e.message}`);
        }
      }

      let result;
      if (existing) {
        const { user_id: _uid, ...updatePayload } = payload;
        result = await supabase
          .from("user_notification_settings")
          .update(updatePayload)
          .eq("user_id", user.id)
          .select()
          .single();
      } else {
        if (!payload.phone_e164) payload.phone_e164 = null;
        payload.whatsapp_enabled = false;
        payload.sms_enabled = false;
        if (payload.email_enabled === undefined) payload.email_enabled = true;
        if (payload.push_enabled === undefined) payload.push_enabled = false;
        result = await supabase
          .from("user_notification_settings")
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) return res.status(500).json({ error: result.error.message });

      if (payload.email_enabled === true || payload.push_enabled === true) {
        trackActivationEvent(user.id, "notifications_enabled", {
          email: !!payload.email_enabled,
          push: !!payload.push_enabled,
          source: "settings",
        });
      }

      return res.json(result.data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/alerts/status", (_req, res) => {
    return res.json({
      alertsEnabled: process.env.ALERTS_ENABLED === "true",
    });
  });

  app.get("/api/ingest/health", (_req, res) => {
    return res.json({
      ok: true,
      sourcesEnabled: getEnabledSources(),
      time: new Date().toISOString(),
    });
  });

  app.get("/api/health/supabase", async (_req, res) => {
    const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    const urlOk = url.startsWith("https://") && url.includes("supabase.co");
    // Accept both legacy JWT format (eyJ...) and Supabase's newer sb_secret_ format
    const keyOk = (key.startsWith("eyJ") && key.length > 100) || (key.startsWith("sb_secret_") && key.length >= 20);

    if (!urlOk || !keyOk) {
      return res.status(503).json({
        ok: false,
        stage: "credentials",
        urlOk,
        keyOk,
        urlLength: url.length,
        keyLength: key.length,
        keyPrefix: key.substring(0, 10) || "(empty)",
        hint: !urlOk
          ? "VITE_SUPABASE_URL must be https://[ref].supabase.co"
          : "SUPABASE_SERVICE_ROLE_KEY must be either a JWT (eyJ...) or sb_secret_... key from Supabase dashboard → Settings → API.",
      });
    }

    try {
      const probeRes = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      const body = await probeRes.text().catch(() => "");
      return res.json({
        ok: probeRes.ok || probeRes.status === 404,
        stage: "network",
        httpStatus: probeRes.status,
        hint: probeRes.ok ? "Supabase is reachable and credentials are accepted." : `HTTP ${probeRes.status} — check credentials or project status.`,
      });
    } catch (err: any) {
      const cause = err?.cause?.message ?? err?.cause?.code ?? err?.message ?? String(err);
      return res.status(503).json({
        ok: false,
        stage: "network",
        error: err?.message,
        cause,
        hint: cause.includes("ENOTFOUND")
          ? "DNS lookup failed — Supabase project may be paused/deleted. Go to supabase.com → your project → Resume."
          : cause.includes("ECONNREFUSED")
          ? "Connection refused — Supabase project is likely paused."
          : "Network error reaching Supabase. Check project status at supabase.com.",
      });
    }
  });

  app.get("/api/ingest/status", (_req, res) => {
    return res.json(getLastRunStatus());
  });

  app.get("/api/ingest/next-run", (_req, res) => {
    return res.json(getNextRun());
  });

  app.get("/api/ingest/debug", async (_req, res) => {
    try {
      const status = getLastRunStatus();
      const nextRun = getNextRun();

      const { count: totalListings } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true });

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count: todayListings } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

      const { count: totalProfiles } = await supabase
        .from("search_profiles")
        .select("*", { count: "exact", head: true });

      const { count: totalMatches } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true });

      const sourceStatuses = getSourceStatuses();
      const activeSources = sourceStatuses.filter(s => s.status === "active");
      const brokenSources = sourceStatuses.filter(s => s.status !== "active");

      const lastSourceErrors: Record<string, string> = {};
      if (status.lastResult?.sources) {
        for (const s of status.lastResult.sources) {
          if (s.errors > 0 && s.found === 0 && s.inserted === 0) {
            lastSourceErrors[s.name] = `${s.errors} error(s), 0 results`;
          }
        }
      }

      return res.json({
        time: new Date().toISOString(),
        scheduler: {
          nextRunAt: nextRun.nextRunAt,
          intervalMinutes: nextRun.intervalMinutes,
        },
        lastRun: {
          at: status.lastRunAt,
          successAt: status.lastSuccessfulRunAt,
          error: status.lastError,
          running: status.running,
        },
        today: {
          fetched: status.todayFetched,
          inserted: status.todayInserted,
        },
        database: {
          totalListings: totalListings ?? 0,
          todayListings: todayListings ?? 0,
          totalProfiles: totalProfiles ?? 0,
          totalMatches: totalMatches ?? 0,
        },
        sources: {
          active: activeSources.map(s => s.name),
          broken: brokenSources.map(s => ({ name: s.name, status: s.status, note: s.note })),
          lastErrors: lastSourceErrors,
        },
        lastReport: status.lastResult ? {
          cities: status.lastResult.cities,
          durationSec: status.lastResult.durationSec,
          total: status.lastResult.total,
          sources: status.lastResult.sources,
        } : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/match-debug/explain/:listingId/:profileId", async (req, res) => {
    try {
      const { listingId, profileId } = req.params;
      const result = await explainMatch(listingId, profileId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/match-debug/listing/:listingId", async (req, res) => {
    try {
      const { listingId } = req.params;
      const result = await explainAllProfilesForListing(listingId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/freshness", async (req, res) => {
    const { listingIds, matchIds } = req.body;
    const [listings, matches] = await Promise.all([
      getListingFreshness(listingIds || []),
      getMatchTimestamps(matchIds || []),
    ]);
    return res.json({ listings, matches });
  });

  // TODO: Improve popularity ranking with real engagement data (clicks, views, apply actions)
  // Currently ranks by match count across all users within the last 7 days
  app.get("/api/listings/popular", async (_req, res) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentMatches, error: mErr } = await supabase
        .from("matches")
        .select("listing_id")
        .gte("created_at", sevenDaysAgo);

      let rankedIds: { listing_id: string; match_count: number }[] = [];

      if (!mErr && recentMatches && recentMatches.length > 0) {
        const countMap: Record<string, number> = {};
        for (const m of recentMatches) {
          countMap[m.listing_id] = (countMap[m.listing_id] || 0) + 1;
        }
        rankedIds = Object.entries(countMap)
          .map(([listing_id, match_count]) => ({ listing_id, match_count }))
          .sort((a, b) => b.match_count - a.match_count)
          .slice(0, 6);
      }

      if (rankedIds.length === 0) {
        const { data: fallbackRows, error: fbErr } = await supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at")
          .order("created_at", { ascending: false })
          .limit(6);

        if (fbErr) return res.status(500).json({ error: fbErr.message });

        const ids = (fallbackRows ?? []).map((l: any) => l.id);
        const freshnessMap = ids.length > 0 ? await getListingFreshness(ids) : {};

        return res.json((fallbackRows ?? []).map((l: any) => ({
          listing_id: l.id,
          title: l.title,
          price: l.price,
          size_m2: l.size_m2,
          bedrooms: l.bedrooms,
          city: l.city,
          source: l.source,
          url: l.url,
          image_url: l.image_url ?? null,
          first_seen_at: freshnessMap[l.id]?.first_seen_at ?? l.created_at,
          fresh_label: computeFreshLabel(freshnessMap[l.id]?.first_seen_at ?? l.created_at),
          match_count: 0,
        })));
      }

      const listingIds = rankedIds.map((r) => r.listing_id);
      const [listingsRes, freshnessMap] = await Promise.all([
        supabase
          .from("listings")
          .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at")
          .in("id", listingIds),
        getListingFreshness(listingIds),
      ]);

      if (listingsRes.error) return res.status(500).json({ error: listingsRes.error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listingsRes.data ?? []) listingMap[l.id] = l;

      const matchCountMap: Record<string, number> = {};
      for (const r of rankedIds) matchCountMap[r.listing_id] = r.match_count;

      const result = listingIds
        .filter((id) => listingMap[id])
        .map((id) => {
          const l = listingMap[id];
          const firstSeenAt = freshnessMap[id]?.first_seen_at ?? l.created_at;
          return {
            listing_id: id,
            title: l.title,
            price: l.price,
            size_m2: l.size_m2,
            bedrooms: l.bedrooms,
            city: l.city,
            source: l.source,
            url: l.url,
            image_url: l.image_url ?? null,
            first_seen_at: firstSeenAt,
            fresh_label: computeFreshLabel(firstSeenAt),
            match_count: matchCountMap[id] ?? 0,
          };
        });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/listings/fresh", async (_req, res) => {
    try {
      const freshRows = await getNewestListingIds(50);
      if (freshRows.length === 0) return res.json([]);

      const ids = freshRows.map((r) => r.listing_id);
      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url")
        .in("id", ids);

      if (error) return res.status(500).json({ error: error.message });

      const listingMap: Record<string, any> = {};
      for (const l of listings ?? []) listingMap[l.id] = l;

      const result = freshRows
        .filter((r) => listingMap[r.listing_id])
        .map((r) => {
          const l = listingMap[r.listing_id];
          return {
            title: l.title,
            price: l.price,
            size_m2: l.size_m2,
            bedrooms: l.bedrooms,
            city: l.city,
            source: l.source,
            url: l.url,
            image_url: l.image_url ?? null,
            first_seen_at: r.first_seen_at,
            fresh_label: computeFreshLabel(r.first_seen_at),
          };
        });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Public endpoint — used by the onboarding account-creation screen to show a
  // real listing preview that matches the user's search criteria.
  // No auth required (user is not logged in yet).
  app.get("/api/listings/preview", async (req, res) => {
    try {
      const city = (req.query.city as string || "").trim();
      const minPrice = parseInt(req.query.minPrice as string) || 0;
      const maxPrice = parseInt(req.query.maxPrice as string) || 0;

      if (!city) return res.status(400).json({ error: "city is required" });

      let query = supabase
        .from("listings")
        .select("id, price, size_m2, city, source, image_url, created_at")
        .ilike("city", `%${city}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (minPrice > 0) query = query.gte("price", minPrice);
      if (maxPrice > 0) query = query.lte("price", maxPrice);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      const listings = (data ?? []).map((l: any) => ({
        id: l.id,
        price: l.price,
        size_m2: l.size_m2,
        city: l.city,
        source: l.source,
        image_url: l.image_url ?? null,
        fresh_label: computeFreshLabel(l.created_at),
      }));

      return res.json(listings);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Public endpoint — no auth required.
  // Accepts a normalized filter object, returns match counts for 3 time windows
  // and the best available preview listing (with/without image).
  app.post("/api/match-estimate", async (req, res) => {
    try {
      const body = req.body as Partial<NormalizedFilters>;

      if (!body.city || typeof body.city !== "string" || !body.city.trim()) {
        return res.status(400).json({ error: "city is required" });
      }

      const filters: NormalizedFilters = {
        city: body.city.trim(),
        city_name: body.city_name?.trim() || body.city.trim(),
        location_mode: (["city", "radius", "districts"].includes(body.location_mode as string)
          ? body.location_mode
          : "city") as NormalizedFilters["location_mode"],
        latitude: typeof body.latitude === "number" ? body.latitude : undefined,
        longitude: typeof body.longitude === "number" ? body.longitude : undefined,
        radius_km: typeof body.radius_km === "number" && body.radius_km > 0 ? body.radius_km : undefined,
        districts: Array.isArray(body.districts) && body.districts.length > 0 ? body.districts : undefined,
        price_min: typeof body.price_min === "number" ? body.price_min : 0,
        price_max: typeof body.price_max === "number" ? body.price_max : 0,
        bedrooms_min: typeof body.bedrooms_min === "number" ? body.bedrooms_min : 0,
        size_min: typeof body.size_min === "number" ? body.size_min : 0,
        furnished: typeof body.furnished === "string" && body.furnished !== "any" ? body.furnished : undefined,
        property_types: Array.isArray(body.property_types) && body.property_types.length > 0 ? body.property_types : undefined,
        extra_features: Array.isArray(body.extra_features) && body.extra_features.length > 0 ? body.extra_features : undefined,
        send_unclear: body.send_unclear !== false,
        price_flexible: body.price_flexible === true,
        include_rooms: body.include_rooms === true,
        include_paid_sites: body.include_paid_sites,
        include_housing_corporations: body.include_housing_corporations,
        include_lottery_housing: body.include_lottery_housing,
      };

      const result = await computeMatchEstimate(filters);
      return res.json(result);
    } catch (err: any) {
      console.error("[MATCH-ESTIMATE] Error:", err);
      return res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  app.get("/api/matches", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const tStart = Date.now();
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });
      log(`[MATCHES TIMING] userId=${user.id.substring(0, 8)} auth=${Date.now() - tStart}ms`);

      // Parallelize subscription fetch + blocked-sources fetch — both only need user.id.
      // Previously getBlockedSources ran *after* the batch fetch (sequential), costing
      // an extra ~300ms on the critical path. Moving it here saves that time.
      const tParallel = Date.now();
      const [subResult, blockedSources] = await Promise.all([
        supabase.from("subscriptions").select("created_at, status").eq("user_id", user.id).single(),
        getBlockedSources(user.id),
      ]);
      log(`[MATCHES TIMING] userId=${user.id.substring(0, 8)} sub+blocked=${Date.now() - tParallel}ms`);

      const subRow = subResult.data;
      const premiumStartedAt = subRow?.created_at || null;

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const cutoff = premiumStartedAt
        ? (new Date(premiumStartedAt).getTime() < new Date(ninetyDaysAgo).getTime() ? premiumStartedAt : ninetyDaysAgo)
        : ninetyDaysAgo;

      const tMatches = Date.now();
      log(`[MATCHES] userId=${user.id.substring(0, 8)} subStatus=${subRow?.status ?? "none"} premiumStartedAt=${premiumStartedAt ?? "none"} cutoff=${cutoff}`);

      // Fetch at most 300 rows — after dedup we take top 200 before the expensive
      // batch operations, so 300 gives enough headroom even with duplicate match rows.
      let matchQuery = supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(300);
      const { data: matchRows, error: mErr } = await matchQuery;
      log(`[MATCHES TIMING] userId=${user.id.substring(0, 8)} matchQuery=${Date.now() - tMatches}ms rows=${matchRows?.length ?? 0}`);

      if (mErr) return res.status(500).json({ error: mErr.message });
      if (!matchRows || matchRows.length === 0) return res.json({ matches: [], totalCount: 0 });

      const enriched = matchRows.map((m: any) => ({
        ...m,
        matched_at: m.created_at,
      }));

      const dedupedByListing: Record<string, any> = {};
      for (const m of enriched) {
        if (!dedupedByListing[m.listing_id]) {
          dedupedByListing[m.listing_id] = m;
        }
      }
      // Slice to 30 unique matches before batch operations. We return 20 results
      // and give 10 extra as headroom for blocked-source / deleted-listing filtering.
      // This reduces Supabase batch payload from potentially hundreds of rows to ~30.
      let uniqueMatches = Object.values(dedupedByListing).slice(0, 30);

      const allListingIds = uniqueMatches.map((m: any) => m.listing_id);
      if (allListingIds.length === 0) return res.json({ matches: [], totalCount: 0 });

      const profileIds = [...new Set(uniqueMatches.map((m: any) => m.search_profile_id).filter(Boolean))];

      // Start canonical stats early — they only need user.id and can run in parallel
      // with the listing/freshness/profile batch fetch, saving ~400ms.
      const statsPromise = Promise.all([getUserMatchStats(user.id), getCanonicalMatchStates(user.id)]);

      const tBatch = Date.now();
      const [listingsData, freshnessMap, profilesData] = await Promise.all([
        batchedIn<any>(
          "listings", "id", allListingIds,
          "id, title, price, size_m2, bedrooms, city, source, url, image_url, furnished, pets_allowed, district",
          (q: any) => q.not("title", "is", null)
        ),
        getListingFreshness(allListingIds),
        profileIds.length > 0
          ? batchedIn<any>(
              "search_profiles", "id", profileIds,
              "id, city, price_min, price_max, bedrooms_min, size_min, furnished, extra_features, districts, location_mode"
            )
          : Promise.resolve([]),
      ]);
      log(`[MATCHES TIMING] userId=${user.id.substring(0, 8)} batchFetch=${Date.now() - tBatch}ms listings=${listingsData.length}`);

      const listingMap: Record<string, any> = {};
      for (const l of listingsData) listingMap[l.id] = l;

      // blockedSources was fetched in parallel with subscription at the top
      const blockedSet = new Set(blockedSources);

      const validListingIds = new Set(Object.keys(listingMap));
      const validMatches = uniqueMatches.filter((m: any) => {
        if (!validListingIds.has(m.listing_id)) return false;
        const l = listingMap[m.listing_id];
        if (l?.source && blockedSet.has(normalizeSourceName(l.source))) return false;
        return true;
      });

      const profileMap: Record<string, any> = {};
      for (const p of profilesData) profileMap[p.id] = p;

      const recentEmailed = getRecentEmailedIds(user.id);
      const emailedIdSet = new Set(recentEmailed?.listing_ids || []);

      const validResults = validMatches.map((m: any) => {
        const l = listingMap[m.listing_id];
        const firstSeenAt = freshnessMap[m.listing_id]?.first_seen_at || m.created_at;
        const publishedAt = l?.published_at ?? null;
        const sourcePublishedAt = l?.source_published_at ?? null;
        const displayTime = publishedAt || sourcePublishedAt || firstSeenAt;
        const profile = profileMap[m.search_profile_id];

        let match_score = null;
        let match_label = null;
        let match_reasons: string[] = [];
        let hybrid_filters = null;
        if (l && profile) {
          const scoreResult = computeMatchScore({
            listing: { price: l.price ?? 0, bedrooms: l.bedrooms ?? 0, size_m2: l.size_m2 ?? 0, city: l.city ?? "" },
            profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
          });
          match_score = scoreResult.score;
          match_label = scoreResult.label;
          match_reasons = getMatchReasons(scoreResult.details);
          hybrid_filters = computeHybridFilters({
            listing: { furnished: l.furnished, pets_allowed: l.pets_allowed, district: l.district },
            profile: { furnished: profile.furnished, extra_features: profile.extra_features, districts: profile.districts, location_mode: profile.location_mode },
          });
        }

        return {
          listing_id: m.listing_id,
          title: l.title,
          price: l.price ?? null,
          size_m2: l.size_m2 ?? null,
          bedrooms: l.bedrooms ?? null,
          city: l.city ?? null,
          district: l.district ?? null,
          source: l.source ?? null,
          url: l.url ?? null,
          image_url: l.image_url ?? null,
          matched_at: m.matched_at,
          published_at: publishedAt,
          source_published_at: sourcePublishedAt,
          first_seen_at: firstSeenAt,
          display_time: displayTime,
          fresh_label: computeFreshLabel(displayTime),
          match_score,
          match_label,
          match_reasons,
          hybrid_filters,
          in_latest_email: emailedIdSet.has(m.listing_id),
        };
      });

      validResults.sort((a: any, b: any) => {
        const dateA = new Date(a.matched_at).getTime();
        const dateB = new Date(b.matched_at).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return a.listing_id.localeCompare(b.listing_id);
      });

      // Return only 20 results — enough for the initial screen without scroll.
      // The frontend can re-fetch with pagination if more are needed.
      const top20 = validResults.slice(0, 20);

      console.log(`[MATCHES ORDER] userId=${user.id.substring(0, 8)}... results=${top20.length} first=[${top20.slice(0, 5).map((m: any) => m.listing_id.substring(0, 8)).join(",")}]`);

      // Await stats that have been running in parallel since before the batch fetch
      const tStats = Date.now();
      const [canonicalStats, canonicalStates] = await statsPromise;
      log(`[MATCHES TIMING] userId=${user.id.substring(0, 8)} stats-wait=${Date.now() - tStats}ms TOTAL=${Date.now() - tStart}ms`);

      const matchesWithState = top20.map((m: any) => {
        const cs = canonicalStates.get(m.listing_id);
        return {
          ...m,
          canonical_viewed: cs?.viewed ?? false,
          canonical_saved: cs?.saved ?? false,
          canonical_applied: cs?.applied ?? false,
          canonical_dismissed: cs?.dismissed ?? false,
        };
      });


      const stats = canonicalStats || { total: 0, new_count: 0, viewed: 0, saved: 0, applied: 0, email_sent: 0, push_sent: 0 };

      return res.json({
        matches: matchesWithState,
        totalCount: stats.total,
        newCount: stats.new_count,
        canonicalStats: {
          total: stats.total,
          new_count: stats.new_count,
          viewed: stats.viewed,
          saved: stats.saved,
          applied: stats.applied,
          email_sent: stats.email_sent,
          push_sent: stats.push_sent,
        },
        latestEmailAt: recentEmailed?.timestamp ? new Date(recentEmailed.timestamp).toISOString() : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/matches/:matchListingId/applied", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      const { applied } = req.body;
      if (typeof applied !== "boolean") return res.status(400).json({ error: "applied must be a boolean" });

      const { data, error } = await supabase
        .from("matches")
        .update({ applied })
        .eq("listing_id", matchListingId)
        .eq("user_id", user.id)
        .select("id, listing_id, applied");

      if (error) {
        console.error("[matches] PATCH applied error:", error.message);
      }

      const listingMeta: any = { user_id: user.id, listing_id: matchListingId };
      try {
        const { data: listing } = await supabase.from("listings").select("title, city, price, source, url").eq("id", matchListingId).single();
        if (listing) {
          listingMeta.listing_title = listing.title || null;
          listingMeta.listing_city = listing.city || null;
          listingMeta.listing_price = listing.price || null;
          listingMeta.listing_source = listing.source || null;
          listingMeta.listing_url = listing.url || null;
        }
      } catch {}

      if (applied) {
        try {
          await upsertUserMatch(listingMeta);
          await markApplied(user.id, matchListingId, true);
          console.log(`[matches] canonical applied sync OK for user=${user.id.substring(0, 8)}... listing=${matchListingId.substring(0, 8)}...`);
        } catch (pgErr: any) {
          console.error("[matches] canonical applied sync error:", pgErr.message);
        }
      } else {
        markApplied(user.id, matchListingId, false).catch(() => {});
      }

      if (data && data.length > 0) {
        return res.json(data[0]);
      }
      return res.json({ listing_id: matchListingId, applied });
    } catch (err: any) {
      console.error("[matches] PATCH applied error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/matches/applied", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const [supaResult, pgResult] = await Promise.allSettled([
        supabase
          .from("matches")
          .select("listing_id")
          .eq("user_id", user.id)
          .eq("applied", true),
        pgPool.query("SELECT listing_id FROM user_matches WHERE user_id = $1 AND applied = true", [user.id]),
      ]);

      const appliedSet = new Set<string>();
      if (supaResult.status === "fulfilled" && supaResult.value.data) {
        for (const m of supaResult.value.data) appliedSet.add(m.listing_id);
      }
      if (pgResult.status === "fulfilled" && pgResult.value.rows) {
        for (const r of pgResult.value.rows) appliedSet.add(r.listing_id);
      }
      return res.json({ applied: Array.from(appliedSet) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/favorites", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows } = await pgPool.query(
        "SELECT listing_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
      return res.json({ favoriteIds: rows.map((r: any) => r.listing_id) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/favorites/listings", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows: favRows } = await pgPool.query(
        "SELECT listing_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
        [user.id]
      );
      const favIds = favRows.map((r: any) => r.listing_id);
      if (favIds.length === 0) return res.json({ listings: [] });

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at, furnished, pets_allowed, district")
        .in("id", favIds);

      if (error) return res.status(500).json({ error: error.message });

      const orderedListings = favIds
        .map((id: string) => listings?.find((l: any) => l.id === id))
        .filter(Boolean)
        .map((l: any) => ({
          listing_id: l.id,
          title: l.title,
          price: l.price,
          size_m2: l.size_m2,
          bedrooms: l.bedrooms,
          city: l.city,
          source: l.source,
          url: l.url,
          image_url: l.image_url,
          created_at: l.created_at,
          furnished: l.furnished,
          pets_allowed: l.pets_allowed,
          district: l.district,
          match_score: 0,
          match_reasons: [],
        }));

      return res.json({ listings: orderedListings });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/favorites/:listingId", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { listingId } = req.params;
      await pgPool.query(
        `INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)
         ON CONFLICT (user_id, listing_id) DO NOTHING`,
        [user.id, listingId]
      );
      return res.json({ favorited: true, listing_id: listingId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/favorites/:listingId", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { listingId } = req.params;
      await pgPool.query(
        "DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2",
        [user.id, listingId]
      );
      return res.json({ favorited: false, listing_id: listingId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/blocked-sources", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const sources = await getBlockedSources(user.id);
      return res.json({ blockedSources: sources });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/blocked-sources", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { source } = req.body;
      if (!source || typeof source !== "string") return res.status(400).json({ error: "source is required" });

      const ok = await addBlockedSource(user.id, source);
      if (!ok) return res.status(500).json({ error: "Failed to block source" });
      return res.json({ blocked: true, source: normalizeSourceName(source) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/blocked-sources/:source", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { source } = req.params;
      await removeBlockedSource(user.id, source);
      return res.json({ blocked: false, source });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Listing ID is required" });

      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, size_m2, bedrooms, city, source, url, image_url, created_at, furnished, pets_allowed, district")
        .eq("id", id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const freshnessMap = await getListingFreshness([id]);
      const firstSeenAt = freshnessMap[id]?.first_seen_at || data.created_at;
      const publishedAt = (data as any).published_at ?? null;
      const sourcePublishedAt = (data as any).source_published_at ?? null;
      const displayTime = publishedAt || sourcePublishedAt || firstSeenAt;
      console.log(`[LISTING-TIME] id=${id} published_at=${publishedAt ?? "N/A"} source_published_at=${sourcePublishedAt ?? "N/A"} first_seen_at=${freshnessMap[id]?.first_seen_at ?? "N/A"} created_at=${data.created_at} → display_time=${displayTime}`);

      let match_score = null;
      let match_label = null;
      let match_reasons: string[] = [];
      let hybrid_filters = null;
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            const { data: matchRow } = await supabase
              .from("matches")
              .select("search_profile_id")
              .eq("user_id", user.id)
              .eq("listing_id", id)
              .limit(1)
              .maybeSingle();

            if (matchRow?.search_profile_id) {
              const { data: profile } = await supabase
                .from("search_profiles")
                .select("city, price_min, price_max, bedrooms_min, size_min, furnished, extra_features, districts, location_mode")
                .eq("id", matchRow.search_profile_id)
                .single();

              if (profile) {
                const scoreResult = computeMatchScore({
                  listing: { price: data.price ?? 0, bedrooms: data.bedrooms ?? 0, size_m2: data.size_m2 ?? 0, city: data.city ?? "" },
                  profile: { city: profile.city, price_min: profile.price_min ?? 0, price_max: profile.price_max ?? 0, bedrooms_min: profile.bedrooms_min ?? 0, size_min: profile.size_min ?? 0 },
                });
                match_score = scoreResult.score;
                match_label = scoreResult.label;
                match_reasons = getMatchReasons(scoreResult.details);
                hybrid_filters = computeHybridFilters({
                  listing: { furnished: data.furnished, pets_allowed: data.pets_allowed, district: data.district },
                  profile: { furnished: profile.furnished, extra_features: profile.extra_features, districts: profile.districts, location_mode: profile.location_mode },
                });
              }
            }
          }
        } catch {}
      }

      return res.json({
        ...data,
        published_at: publishedAt,
        source_published_at: sourcePublishedAt,
        first_seen_at: firstSeenAt,
        display_time: displayTime,
        fresh_label: computeFreshLabel(displayTime),
        match_score,
        match_label,
        match_reasons,
        hybrid_filters,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/estimate", async (req, res) => {
    try {
      const { city, minPrice, maxPrice, minRooms, minSize } = req.query;

      if (!city || typeof city !== "string") {
        return res.status(400).json({ error: "city is required" });
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .ilike("city", `%${city}%`)
        .gte("created_at", sevenDaysAgo);

      if (minPrice && Number(minPrice) > 0) {
        query = query.gte("price", Number(minPrice));
      }
      if (maxPrice && Number(maxPrice) > 0) {
        query = query.lte("price", Number(maxPrice));
      }
      if (minRooms && Number(minRooms) > 0) {
        query = query.gte("bedrooms", Number(minRooms));
      }
      if (minSize && Number(minSize) > 0) {
        query = query.gte("size_m2", Number(minSize));
      }

      const { count, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const last7dCount = count ?? 0;
      const perWeekEstimate = last7dCount;

      return res.json({ perWeekEstimate, last7dCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripe/stripeClient");
      const key = await getStripePublishableKey();
      return res.json({ publishableKey: key });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  const forgotPwLimiter = new Map<string, number>();
  setInterval(() => forgotPwLimiter.clear(), 60_000);

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const key = ip;
      const last = forgotPwLimiter.get(key) || 0;
      if (now - last < 15_000) {
        return res.json({ ok: true });
      }
      forgotPwLimiter.set(key, now);

      const { email, lang } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");
      const locale = (lang === "nl" || lang === "de" || lang === "en") ? lang : "nl";
      const adminSb = getSupabaseAdmin();

      const baseUrl = process.env.APP_PUBLIC_BASE_URL || "https://app.housalert.com";
      const redirectTo = `${baseUrl.replace(/\/$/, "")}/reset-password`;

      const { data, error } = await adminSb.auth.admin.generateLink({
        type: "recovery",
        email: email.trim(),
        options: { redirectTo },
      });

      if (error || !data?.properties?.action_link) {
        log(`[FORGOT-PW] generateLink failed for ${maskedEmail}: ${error?.message || "no link"} — falling back to direct reset`);
        const { error: fallbackErr } = await adminSb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (fallbackErr) log(`[FORGOT-PW] Fallback resetPasswordForEmail also failed for ${maskedEmail}: ${fallbackErr.message}`);
        else log(`[FORGOT-PW] Fallback resetPasswordForEmail sent for ${maskedEmail}`);
        return res.json({ ok: true });
      }

      const actionLink = data.properties.action_link;
      log(`[FORGOT-PW] Link generated for ${maskedEmail}, sending branded email (lang=${locale})`);

      const { sendPasswordResetEmail } = await import("./email");
      const sent = await sendPasswordResetEmail(email.trim(), actionLink, locale);

      if (!sent) {
        log(`[FORGOT-PW] Branded email failed for ${maskedEmail}, falling back to Supabase default`);
        await adminSb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      }

      return res.json({ ok: true });
    } catch (err: any) {
      log(`[FORGOT-PW] Error: ${err.message}`);
      return res.json({ ok: true });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      // 1. Log content-type and incoming body keys (never log the password value)
      const contentType = req.headers["content-type"] || "(missing)";
      const bodyKeys = Object.keys(req.body || {});
      log(`[SIGNUP] content-type="${contentType}" body-keys=[${bodyKeys.join(",")}]`);

      const { email, password, fullName } = req.body;

      // 2. Verify fields are received correctly
      const pwLen = typeof password === "string" ? password.length : 0;
      log(`[SIGNUP] Attempt: email=${email}, password-length=${pwLen}, fullName=${fullName || "(none)"}`);

      if (!email || !password) {
        log(`[SIGNUP] 400 — missing field: email=${!!email} password=${!!password}`);
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (typeof password !== "string" || pwLen < 6) {
        log(`[SIGNUP] 400 — password too short or wrong type (len=${pwLen})`);
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // 3. Supabase admin user creation
      const adminSb = getSupabaseAdmin();
      log(`[SIGNUP] Calling adminSb.auth.admin.createUser for email=${email}`);

      const { data: newUser, error: createErr } = await adminSb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "", email_needs_verification: true },
      });

      // 4. Catch and log Supabase auth errors
      if (createErr || !newUser?.user) {
        const msg = createErr?.message || "User creation failed";
        console.error("[SIGNUP] adminSb.auth.admin.createUser error:", createErr);
        log(`[SIGNUP] Admin createUser failed: ${msg}`);
        const isDuplicate = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("exists");
        return res.status(isDuplicate ? 409 : 400).json({
          error: isDuplicate ? "user_exists" : msg,
          message: isDuplicate ? "An account with this email already exists." : msg,
        });
      }

      const userId = newUser.user.id;
      log(`[SIGNUP] User created OK: id=${userId}, email=${email}`);

      try {
        const detectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
        log(`[LANG AUTO-DETECT] userId=${userId.substring(0, 8)}... detected="${detectedLang}" from accept-language="${(req.headers["accept-language"] || "").substring(0, 60)}"`);
        let signupFirstName: string | null = null;
        let signupLastName: string | null = null;
        if (fullName && typeof fullName === "string") {
          const parts = fullName.trim().split(/\s+/);
          signupFirstName = parts[0] || null;
          signupLastName = parts.slice(1).join(" ") || null;
        }
        if (!signupFirstName) signupFirstName = email.split("@")[0];
        await pgPool.query(
          `INSERT INTO user_profile_data (user_id, first_name, last_name, language, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, signupFirstName, signupLastName, detectedLang]
        );
        log(`[LANG FIRST SAVE] userId=${userId.substring(0, 8)}... language="${detectedLang}" first_name="${signupFirstName}" last_name="${signupLastName}" saved to DB on signup`);
      } catch (profileErr: any) {
        log(`[SIGNUP] WARNING: Failed to create user_profile_data row for user=${userId}: ${profileErr.message}`);
      }

      try {
        trackActivationEvent(userId, "account_created", {});
        log(`[SIGNUP] Account created and event tracked: user=${userId}`);
      } catch (trialErr: any) {
        log(`[SIGNUP] Account event tracking failed for user=${userId}: ${trialErr.message}`);
      }

      return res.json({ ok: true, userId });
    } catch (err: any) {
      // 5. Full error log with stack so we can see exactly where it crashes
      console.error("[SIGNUP] Unexpected 500 error:", err);
      log(`[SIGNUP] Unexpected error: ${err?.message || String(err)}`);
      return res.status(500).json({
        error: err?.message || "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { stack: err?.stack }),
      });
    }
  });

  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const adminSb = getSupabaseAdmin();
      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      const { data: inviteData, error: inviteErr } = await adminSb.auth.admin.inviteUserByEmail(user.email!, {
        redirectTo: `${baseUrl}/auth/callback`,
      });

      if (inviteErr) {
        log("auth", `[VERIFY] inviteUserByEmail failed: ${inviteErr.message}, trying generateLink+resend`);
        const { error: resendErr } = await supabase.auth.resend({ type: "signup", email: user.email! });
        if (resendErr) {
          log("auth", `[VERIFY] Resend also failed: ${resendErr.message}`);
          return res.status(500).json({ error: "Could not send verification email" });
        }
      }

      log("auth", `[VERIFY] Verification email sent to ${user.email}`);
      return res.json({ ok: true });
    } catch (err: any) {
      log("auth", `[VERIFY] Unexpected error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/subscription/ensure-trial", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const etDetectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
      let etFirstName: string | null = null;
      let etLastName: string | null = null;
      const etFullName = user.user_metadata?.full_name as string | undefined;
      if (etFullName) {
        const parts = etFullName.trim().split(/\s+/);
        etFirstName = parts[0] || null;
        etLastName = parts.slice(1).join(" ") || null;
      }
      if (!etFirstName) etFirstName = user.user_metadata?.first_name as string || user.email?.split("@")[0] || "";
      if (!etLastName) etLastName = user.user_metadata?.last_name as string || null;
      pgPool.query(
        `INSERT INTO user_profile_data (user_id, first_name, last_name, language, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, etFirstName, etLastName, etDetectedLang]
      ).then(() => {
        log(`[ensure-trial] Profile row ensured in user_profile_data: user=${user.id} first="${etFirstName}" last="${etLastName}" lang=${etDetectedLang}`);
      }).catch((err: any) => {
        log(`[ensure-trial] WARNING: user_profile_data insert failed for user=${user.id}: ${err.message}`);
      });

      hasActivationEvent(user.id, "account_created").then(has => {
        if (!has) trackActivationEvent(user.id, "account_created", {});
      }).catch(() => {});
      log(`[ensure-trial] Trial auto-creation disabled — subscription must be started via Stripe checkout. user=${user.id}`);
      const { data: existingSub } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
      return res.json({ ok: true, subscription: existingSub ?? null });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/subscription/cancel", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      if (!stripeAvailable) return res.status(503).json({ error: "Stripe not configured" });

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, status, current_period_ends_at, trial_ends_at")
        .eq("user_id", user.id)
        .single();

      if (!subRow?.stripe_subscription_id) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Idempotent: already canceled — return current state without calling Stripe again
      if (subRow.status === "canceled") {
        log(`[subscription-cancel] Already canceled for user=${user.id.substring(0, 8)} — returning current state`);
        const status = await getSubscriptionStatus(user.id);
        return res.json({ success: true, subscription: status, alreadyCanceled: true });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const stripeSub = await stripe.subscriptions.update(subRow.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      const stripeSubStatus = stripeSub.status;
      const trialEnd = (stripeSub as any).trial_end;
      const currentPeriodEnd = (stripeSub as any).current_period_end;

      log(`[subscription-cancel] cancel_at_period_end=true set for user=${user.id.substring(0, 8)} sub=${subRow.stripe_subscription_id} stripeStatus=${stripeSubStatus} trial_end=${trialEnd ?? "null"} current_period_end=${currentPeriodEnd ?? "null"}`);

      // CRITICAL: select access boundary based on Stripe status — never use trial_end for a paid active sub.
      // An active paid sub that once trialed still has trial_end populated, so checking `trial_end > 0`
      // alone (without checking status) would wrongly pick the trial end date as the access cutoff.
      let periodEnd: Date | null;
      if (stripeSubStatus === "trialing" && trialEnd && trialEnd > 0) {
        periodEnd = new Date(trialEnd * 1000);
        log(`[subscription-cancel] status=trialing → using trial_end=${periodEnd.toISOString()} as access boundary`);
      } else if (currentPeriodEnd && currentPeriodEnd > 0) {
        periodEnd = new Date(currentPeriodEnd * 1000);
        log(`[subscription-cancel] status=${stripeSubStatus} → using current_period_end=${periodEnd.toISOString()} as access boundary`);
      } else {
        periodEnd = null;
        log(`[subscription-cancel] WARNING: no valid period end found — access boundary unset`);
      }

      await updateSubscriptionStatus(subRow.stripe_subscription_id, "canceled", periodEnd ?? undefined);

      log(`[subscription-cancel] DB updated: user=${user.id.substring(0, 8)} → canceled, periodEnd=${periodEnd?.toISOString() ?? "none"} cancel_at_period_end=true`);

      const status = await getSubscriptionStatus(user.id);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[subscription-cancel] Error for user: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/subscription/status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const status = await getSubscriptionStatus(user.id);
      log(`[sub-status] user=${user.id} → DB status=${status.status}, isActive=${status.isActive}, isTrial=${status.isTrial}, isExpired=${status.isExpired}, cancelAtPeriodEnd=${status.cancelAtPeriodEnd}, plan=${status.plan}`);
      return res.json(status);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  let PLAN_PRICE_MAP: Record<string, string> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_1_MONTH || "",
    two_month: process.env.STRIPE_PRICE_TWO_MONTH || process.env.STRIPE_PRICE_2_MONTHS || "",
    three_month: process.env.STRIPE_PRICE_THREE_MONTH || process.env.STRIPE_PRICE_3_MONTHS || "",
  };

  log(`[stripe-config] Env price IDs: monthly=${PLAN_PRICE_MAP.monthly || "(empty)"}, two_month=${PLAN_PRICE_MAP.two_month || "(empty)"}, three_month=${PLAN_PRICE_MAP.three_month || "(empty)"}`);

  if (stripeAvailable) {
    try {
      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      if (PLAN_PRICE_MAP.monthly) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.monthly);
        } catch {
          log(`[stripe-config] monthly price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.monthly = "";
        }
      }
      if (PLAN_PRICE_MAP.two_month) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.two_month);
        } catch {
          log(`[stripe-config] two_month price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.two_month = "";
        }
      }
      if (PLAN_PRICE_MAP.three_month) {
        try {
          await stripe.prices.retrieve(PLAN_PRICE_MAP.three_month);
        } catch {
          log(`[stripe-config] three_month price ID invalid, will look up dynamically`);
          PLAN_PRICE_MAP.three_month = "";
        }
      }

      if (!PLAN_PRICE_MAP.monthly || !PLAN_PRICE_MAP.two_month || !PLAN_PRICE_MAP.three_month) {
        const prices = await stripe.prices.list({ active: true, limit: 50, expand: ["data.product"] });
        for (const price of prices.data) {
          if (price.nickname === "monthly" && !PLAN_PRICE_MAP.monthly) PLAN_PRICE_MAP.monthly = price.id;
          if (price.nickname === "two_month" && !PLAN_PRICE_MAP.two_month) PLAN_PRICE_MAP.two_month = price.id;
          if (price.nickname === "three_month" && !PLAN_PRICE_MAP.three_month) PLAN_PRICE_MAP.three_month = price.id;
          if (!price.nickname && price.recurring) {
            const interval = price.recurring.interval;
            const count = price.recurring.interval_count;
            if (interval === "month" && count === 1 && !PLAN_PRICE_MAP.monthly) PLAN_PRICE_MAP.monthly = price.id;
            if (interval === "month" && count === 2 && !PLAN_PRICE_MAP.two_month) PLAN_PRICE_MAP.two_month = price.id;
            if (interval === "month" && count === 3 && !PLAN_PRICE_MAP.three_month) PLAN_PRICE_MAP.three_month = price.id;
          }
        }
      }

      log(`[stripe-config] Final price IDs: monthly=${PLAN_PRICE_MAP.monthly || "(missing)"}, two_month=${PLAN_PRICE_MAP.two_month || "(missing)"}, three_month=${PLAN_PRICE_MAP.three_month || "(missing)"}`);
    } catch (err: any) {
      log(`[stripe-config] Price validation/lookup failed: ${err.message}`);
    }
  }

  const PRICE_TO_PLAN: Record<string, string> = {};
  for (const [plan, priceId] of Object.entries(PLAN_PRICE_MAP)) {
    if (priceId) PRICE_TO_PLAN[priceId] = plan;
  }

  app.post("/api/stripe/portal", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "stripe_not_configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .single();

      if (!subRow?.stripe_customer_id) {
        return res.status(404).json({ error: "no_stripe_customer" });
      }

      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `https://${req.headers.host}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subRow.stripe_customer_id,
        return_url: `${baseUrl}/account/subscription`,
      });

      return res.json({ url: portalSession.url });
    } catch (err: any) {
      log(`[stripe-portal] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { plan, is_native } = req.body;
      log(`[checkout] Started: user=${user.id}, email=${user.email}, plan=${plan}, is_native=${!!is_native}`);

      if (!plan || !PLAN_PRICE_MAP[plan]) {
        log(`[checkout] Invalid plan "${plan}" — available: ${Object.keys(PLAN_PRICE_MAP).join(", ")}`);
        return res.status(400).json({ error: "Invalid plan. Use: monthly, two_month, or three_month" });
      }

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        log(`[checkout] No price ID for plan "${plan}" — Stripe prices not configured`);
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe prices are not yet configured." });
      }

      if (!stripeAvailable) {
        log(`[checkout] Stripe not available — cannot create session`);
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe is not available. Set STRIPE_SECRET_KEY or connect Stripe via Replit integration." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        log(`[checkout] Found existing Stripe customer: ${customerId}`);
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        log(`[checkout] Created new Stripe customer: ${customerId}`);
      }

      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      const PROD_DOMAIN = "https://app.housalert.com";
      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.NODE_ENV === "production"
        ? (process.env.APP_PUBLIC_BASE_URL || PROD_DOMAIN)
        : `${protocol}://${host}`;

      const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/onboarding/setup?cancelled=1`;

      log(`[checkout] Creating Stripe session: plan=${plan}, priceId=${stripePriceId}, customer=${customerId}, success_url=${successUrl}`);

      let referralCouponId: string | undefined;
      try {
        const { rows: refRows } = await pgPool.query(
          "SELECT referred_by_code FROM user_profile_data WHERE user_id = $1",
          [user.id]
        );
        if (refRows[0]?.referred_by_code) {
          const COUPON_ID = "REFERRAL25";
          try {
            await stripe.coupons.retrieve(COUPON_ID);
          } catch {
            await stripe.coupons.create({
              id: COUPON_ID,
              percent_off: 25,
              duration: "once",
              name: "Referral — 25% off first payment",
            });
            log(`[checkout] Created Stripe coupon ${COUPON_ID}`);
          }
          referralCouponId = COUPON_ID;
          log(`[checkout] Applying referral discount for user ${user.id} (referred by ${refRows[0].referred_by_code})`);
        }
      } catch (couponErr: any) {
        log(`[checkout] Referral coupon check failed (non-blocking): ${couponErr.message}`);
      }

      const sessionParams: any = {
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { supabase_user_id: user.id, plan },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { supabase_user_id: user.id, plan },
      };

      if (referralCouponId) {
        sessionParams.discounts = [{ coupon: referralCouponId }];
        sessionParams.subscription_data.trial_period_days = undefined;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      log(`[checkout] Session created: id=${session.id}, url=${session.url?.substring(0, 60)}...`);
      return res.json({ url: session.url, session_id: session.id });
    } catch (err: any) {
      log(`[checkout] Error: ${err.message}`);
      console.error("Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/session-guest", async (req, res) => {
    try {
      const { plan } = req.body;
      if (!plan || !PLAN_PRICE_MAP[plan]) {
        return res.status(400).json({ error: "Invalid plan. Use: monthly, two_month, or three_month" });
      }

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe prices are not yet configured." });
      }

      if (!stripeAvailable) {
        return res.status(503).json({ error: "stripe_not_configured", message: "Stripe is not available." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.APP_PUBLIC_BASE_URL || `${protocol}://${host}`;

      log(`[checkout-guest] Creating guest session: plan=${plan}, priceId=${stripePriceId}`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { plan, source: "embed_guest" },
        },
        success_url: `${baseUrl}/?embed=true&session_id={CHECKOUT_SESSION_ID}#/embed-success`,
        cancel_url: `${baseUrl}/?embed=true#/onboarding/intro`,
        metadata: { plan, source: "embed_guest" },
      });

      log(`[checkout-guest] Session created: id=${session.id}, url=${session.url?.substring(0, 60)}...`);
      return res.json({ url: session.url });
    } catch (err: any) {
      log(`[checkout-guest] Error: ${err.message}`);
      console.error("Guest checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/link-session", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { session_id } = req.body;
      if (!session_id) return res.status(400).json({ error: "session_id is required" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.metadata?.source !== "embed_guest") {
        log(`[checkout-link] Rejected: session ${session_id} source=${session.metadata?.source}, expected embed_guest`);
        return res.status(403).json({ error: "Session not eligible for linking" });
      }

      const existingCustomerId = session.customer as string | null;
      if (existingCustomerId) {
        const customer = await stripe.customers.retrieve(existingCustomerId);
        if (customer && !("deleted" in customer && customer.deleted)) {
          const custMeta = (customer as any).metadata;
          if (custMeta?.supabase_user_id && custMeta.supabase_user_id !== user.id) {
            log(`[checkout-link] Rejected: session ${session_id} already linked to different user`);
            return res.status(403).json({ error: "Session already linked to another account" });
          }
        }
      }

      const stripeSubscriptionId = session.subscription as string;
      if (!stripeSubscriptionId) {
        log(`[checkout-link] No subscription ID in session ${session_id}`);
        return res.status(202).json({ success: false, message: "Payment processing" });
      }

      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const isTrialing = sub.status === "trialing";
      const isPaid = session.payment_status === "paid";

      if (!isPaid && !isTrialing) {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const plan = session.metadata?.plan || sub.metadata?.plan || "monthly";
      let stripeCustomerId = session.customer as string;

      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        stripeCustomerId = customer.id;
      }

      await stripe.subscriptions.update(stripeSubscriptionId, {
        metadata: { supabase_user_id: user.id, plan },
      });

      if (isTrialing) {
        const trialEnd = (sub as any).trial_end;
        const trialEndsAt = trialEnd && trialEnd > 0
          ? new Date(trialEnd * 1000)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(user.id, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
      } else {
        const rawEnd = (sub as any).current_period_end;
        const periodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(user.id, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
      }

      log(`[checkout-link] Linked session ${session_id} to user ${user.id}, plan=${plan}`);
      trackActivationEvent(user.id, "subscription_started", { plan, source: "embed_guest_linked" });

      const status = await getSubscriptionStatus(user.id);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[checkout-link] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: "priceId is required" });

      const legacyMap: Record<string, string> = {
        "1-month": "monthly",
        "2-months": "two_month",
        "3-months": "three_month",
      };
      const plan = legacyMap[priceId] || priceId;

      req.body = { plan };
      req.headers["authorization"] = `Bearer ${token}`;

      const stripePriceId = PLAN_PRICE_MAP[plan];
      if (!stripePriceId) {
        return res.status(400).json({ error: "Stripe prices are not yet configured." });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }

      const PROD_DOMAIN2 = "https://app.housalert.com";
      const host2 = req.headers.host || "localhost:5000";
      const protocol2 = req.headers["x-forwarded-proto"] || req.protocol;
      const baseUrl = process.env.NODE_ENV === "production"
        ? (process.env.APP_PUBLIC_BASE_URL || PROD_DOMAIN2)
        : `${protocol2}://${host2}`;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: stripePriceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 14,
          metadata: { supabase_user_id: user.id, plan },
        },
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/onboarding/setup?cancelled=1`,
        metadata: { supabase_user_id: user.id, plan },
      });

      log(`[checkout-paywall] success_url=${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
      return res.json({ url: session.url, session_id: session.id });
    } catch (err: any) {
      console.error("Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/checkout/verify", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { session_id } = req.body;
      if (!session_id) return res.status(400).json({ error: "session_id is required" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(session_id);

      const stripeSubscriptionId = session.subscription as string;
      if (!stripeSubscriptionId) {
        log(`[checkout-verify] No subscription ID in session ${session_id}`);
        return res.status(202).json({ success: false, message: "Payment processing" });
      }

      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const isTrialing = sub.status === "trialing";
      const isPaid = session.payment_status === "paid";

      if (!isPaid && !isTrialing) {
        log(`[checkout-verify] Session ${session_id} payment_status=${session.payment_status}, sub_status=${sub.status} — not valid`);
        return res.status(400).json({ error: "Payment not completed" });
      }

      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan || sub.metadata?.plan || "monthly";
      const stripeCustomerId = session.customer as string;

      if (userId !== user.id) {
        log(`[checkout-verify] User mismatch: session user=${userId}, request user=${user.id}`);
        return res.status(403).json({ error: "Forbidden" });
      }

      if (isTrialing) {
        const trialEnd = (sub as any).trial_end;
        const trialEndsAt = trialEnd && trialEnd > 0
          ? new Date(trialEnd * 1000)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        log(`[checkout-verify] Stripe sub=${stripeSubscriptionId} is trialing, trial_end=${trialEndsAt.toISOString()}`);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
      } else {
        const rawEnd = (sub as any).current_period_end;
        const periodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        log(`[checkout-verify] Stripe sub=${stripeSubscriptionId} status=${sub.status} period_end=${periodEnd.toISOString()}`);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
      }
      log(`[checkout-verify] Subscription synced for user=${userId} plan=${plan}`);
      trackActivationEvent(userId, "subscription_started", { plan, source: "checkout" });

      const status = await getSubscriptionStatus(userId);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[checkout-verify] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stripe/confirm-session", async (req, res) => {
    try {
      const { session_id } = req.body;
      if (!session_id) return res.status(400).json({ error: "session_id is required" });

      if (!stripeAvailable) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id);

      const stripeSubscriptionId = session.subscription as string;
      if (!stripeSubscriptionId) {
        return res.status(202).json({ success: false, message: "Payment still processing" });
      }

      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const isTrialing = sub.status === "trialing";
      const isPaid = session.payment_status === "paid";

      if (!isPaid && !isTrialing) {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const userId = session.metadata?.supabase_user_id;
      if (!userId) {
        return res.status(400).json({ error: "No user linked to this session" });
      }

      const plan = session.metadata?.plan || sub.metadata?.plan || "monthly";
      const stripeCustomerId = session.customer as string;

      if (isTrialing) {
        const trialEnd = (sub as any).trial_end;
        const trialEndsAt = trialEnd && trialEnd > 0
          ? new Date(trialEnd * 1000)
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
      } else {
        const rawEnd = (sub as any).current_period_end;
        const periodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
      }

      const { rows: existingRows } = await pgPool.query(
        "SELECT paywall_completed FROM user_profile_data WHERE user_id = $1",
        [userId]
      );
      const alreadyActivated = existingRows.length > 0 && existingRows[0].paywall_completed === true;

      if (!alreadyActivated) {
        trackActivationEvent(userId, "subscription_started", { plan, source: "confirm-session" });
      }

      try {
        await pgPool.query(
          "UPDATE user_profile_data SET paywall_completed = true, onboarding_completed = true, updated_at = NOW() WHERE user_id = $1",
          [userId]
        );
      } catch {}

      log(`[confirm-session] Subscription confirmed for user=${userId} plan=${plan} alreadyActivated=${alreadyActivated}`);
      const status = await getSubscriptionStatus(userId);
      return res.json({ success: true, subscription: status });
    } catch (err: any) {
      log(`[confirm-session] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    log(`[stripe-webhook] Incoming request — has signature: ${!!req.headers["stripe-signature"]}, body size: ${req.rawBody ? (req.rawBody as Buffer).length : 0} bytes`);
    try {
      const { getUncachableStripeClient, getStripeSecretKey } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        log("[stripe-webhook] ERROR: STRIPE_WEBHOOK_SECRET not configured — set it in Replit Secrets");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      log(`[stripe-webhook] Verifying signature (secret prefix: ${webhookSecret.substring(0, 8)}...)`);

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } catch (err: any) {
        log(`[stripe-webhook] SIGNATURE VERIFICATION FAILED: ${err.message}`);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      log(`[stripe-webhook] Event verified OK — type: ${event.type}, id: ${event.id}`);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.metadata?.supabase_user_id;
          const plan = session.metadata?.plan || "monthly";
          const stripeCustomerId = session.customer as string;
          const stripeSubscriptionId = session.subscription as string;

          log(`[stripe-webhook] checkout.session.completed — userId=${userId}, customerId=${stripeCustomerId}, subscriptionId=${stripeSubscriptionId}, plan=${plan}`);

          if (userId && stripeSubscriptionId) {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            log(`[stripe-webhook] Stripe subscription status: ${sub.status}`);
            if (sub.status === "trialing") {
              const trialEnd = (sub as any).trial_end;
              const trialEndsAt = trialEnd && trialEnd > 0
                ? new Date(trialEnd * 1000)
                : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] DB UPDATE: setting user=${userId} to trial, trialEndsAt=${trialEndsAt.toISOString()}`);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, null, trialEndsAt);
              trackActivationEvent(userId, "trial_started", { plan, source: "webhook" });
              log(`[stripe-webhook] ACTIVATION: user=${userId} is now ACTIVE (trial) ✓`);
              await pgPool.query("UPDATE user_profile_data SET paywall_completed = true, updated_at = NOW() WHERE user_id = $1", [userId]).catch((e: any) => log(`[stripe-webhook] paywall_completed update failed: ${e.message}`));
            } else {
              const rawEnd = (sub as any).current_period_end;
              const periodEnd = rawEnd && rawEnd > 0
                ? new Date(rawEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] DB UPDATE: setting user=${userId} to active, periodEnd=${periodEnd.toISOString()}`);
              await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubscriptionId, plan, periodEnd, null);
              trackActivationEvent(userId, "subscription_started", { plan, source: "webhook" });
              log(`[stripe-webhook] ACTIVATION: user=${userId} is now ACTIVE (paid) ✓`);
              await pgPool.query("UPDATE user_profile_data SET paywall_completed = true, updated_at = NOW() WHERE user_id = $1", [userId]).catch((e: any) => log(`[stripe-webhook] paywall_completed update failed: ${e.message}`));
            }
          } else {
            log(`[stripe-webhook] SKIPPED checkout.session.completed — missing userId=${userId} or subscriptionId=${stripeSubscriptionId}`);
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          const stripeCustomerId = sub.customer as string;
          const stripeSubId = sub.id;
          const subStatus = sub.status;

          log(`[stripe-webhook] ${event.type} — customerId=${stripeCustomerId}, subId=${stripeSubId}, status=${subStatus}`);

          const userId = await findUserByStripeCustomerId(stripeCustomerId);
          if (userId) {
            log(`[stripe-webhook] Matched user=${userId} for customer=${stripeCustomerId}`);
            const priceId = sub.items?.data?.[0]?.price?.id;
            const plan = (priceId && PRICE_TO_PLAN[priceId]) || sub.metadata?.plan || "monthly";

            if (subStatus === "trialing") {
              if (sub.cancel_at_period_end) {
                // Trial cancelled at period end — keep status=canceled with trial_end as the access boundary
                const trialEnd = sub.trial_end ?? sub.current_period_end ?? null;
                const periodEnd = trialEnd && trialEnd > 0 ? new Date(trialEnd * 1000) : null;
                log(`[stripe-webhook] DB UPDATE: user=${userId} → canceled (trialing+cancel_at_period_end), periodEnd=${periodEnd?.toISOString()}`);
                await updateSubscriptionStatus(stripeSubId, "canceled", periodEnd ?? undefined);
              } else {
                const trialEnd = sub.trial_end;
                const trialEndsAt = trialEnd && trialEnd > 0
                  ? new Date(trialEnd * 1000)
                  : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                log(`[stripe-webhook] DB UPDATE: user=${userId} → trial, plan=${plan}`);
                await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, null, trialEndsAt);
              }
            } else if (subStatus === "active") {
              if (sub.cancel_at_period_end) {
                const rawEnd = (sub as any).current_period_end
                  ?? (sub as any).items?.data?.[0]?.current_period_end
                  ?? null;
                const periodEnd = rawEnd && rawEnd > 0
                  ? new Date(rawEnd * 1000)
                  : null;
                log(`[stripe-webhook] DB UPDATE: user=${userId} → canceled (cancel_at_period_end), periodEnd=${periodEnd?.toISOString()}`);
                await updateSubscriptionStatus(stripeSubId, "canceled", periodEnd ?? undefined);
              } else {
                const rawEnd = (sub as any).current_period_end
                  ?? (sub as any).items?.data?.[0]?.current_period_end
                  ?? null;
                const periodEnd = rawEnd && rawEnd > 0
                  ? new Date(rawEnd * 1000)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                log(`[stripe-webhook] DB UPDATE: user=${userId} → active, plan=${plan}, periodEnd=${periodEnd.toISOString()}`);
                await updateSubscriptionFromCheckout(userId, stripeCustomerId, stripeSubId, plan, periodEnd, null);
              }
            } else {
              // All other statuses — use centralized Stripe → HousAlert mapping (see stripeStatusToDb).
              // past_due uses skipIfAlreadyInStatus=true so Stripe Smart Retry events
              // don't reset updated_at and extend the 48-hour grace window.
              const dbStatus = stripeStatusToDb(subStatus);
              const isPastDue = dbStatus === "past_due";
              log(`[stripe-webhook] DB UPDATE: sub=${stripeSubId}, user=${userId} → ${dbStatus} (stripe: ${subStatus})`);
              await updateSubscriptionStatus(stripeSubId, dbStatus, undefined, isPastDue);
            }
          } else {
            log(`[stripe-webhook] NO USER FOUND for customer=${stripeCustomerId} — cannot process ${event.type}`);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          const userId = await findUserByStripeCustomerId(sub.customer);
          log(`[stripe-webhook] subscription.deleted — subId=${sub.id}, customerId=${sub.customer}, userId=${userId ?? "unknown"}`);
          await updateSubscriptionStatus(sub.id, "canceled");
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription as string;
          const stripeCustomerId = invoice.customer as string;
          log(`[stripe-webhook] invoice.paid — subId=${stripeSubId}, customerId=${stripeCustomerId}, amount=${invoice.amount_paid}`);
          if (stripeSubId) {
            const userId = await findUserByStripeCustomerId(stripeCustomerId);
            const sub = await stripe.subscriptions.retrieve(stripeSubId);
            log(`[stripe-webhook] invoice.paid — userId=${userId ?? "unknown"}, Stripe sub status after payment: ${sub.status}`);
            if (sub.status === "active") {
              const rawEnd = (sub as any).current_period_end
                ?? (sub as any).items?.data?.[0]?.current_period_end
                ?? null;
              const periodEnd = rawEnd && rawEnd > 0
                ? new Date(rawEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              log(`[stripe-webhook] invoice.paid DB UPDATE: sub=${stripeSubId}, user=${userId ?? "unknown"} → active, periodEnd=${periodEnd.toISOString()}`);
              await updateSubscriptionStatus(stripeSubId, "active", periodEnd);
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription as string;
          const stripeCustomerId = invoice.customer as string;
          log(`[stripe-webhook] invoice.payment_failed — subId=${stripeSubId}, customerId=${stripeCustomerId}, attempt=${invoice.attempt_count}`);
          if (stripeSubId) {
            const userId = await findUserByStripeCustomerId(stripeCustomerId);
            const sub = await stripe.subscriptions.retrieve(stripeSubId);
            log(`[stripe-webhook] invoice.payment_failed — userId=${userId ?? "unknown"}, Stripe sub status: ${sub.status}`);
            if (sub.status === "past_due") {
              // skipIfAlreadyInStatus=true: if the row is already past_due (Smart Retry),
              // do NOT reset updated_at — that would extend the 48-hour grace window.
              log(`[stripe-webhook] invoice.payment_failed DB UPDATE: sub=${stripeSubId}, user=${userId ?? "unknown"} → past_due (grace clock preserved if already past_due)`);
              await updateSubscriptionStatus(stripeSubId, "past_due", undefined, true);
            } else {
              const dbStatus = stripeStatusToDb(sub.status);
              log(`[stripe-webhook] invoice.payment_failed DB UPDATE: sub=${stripeSubId}, user=${userId ?? "unknown"} → ${dbStatus} (stripe: ${sub.status})`);
              await updateSubscriptionStatus(stripeSubId, dbStatus);
            }
          }
          break;
        }

        case "invoice.payment_action_required": {
          // Fired when a payment requires customer action (e.g. 3D Secure authentication).
          // Treat identically to payment_failed: mark past_due to start the 48-hour grace
          // clock. skipIfAlreadyInStatus=true preserves the clock if already past_due.
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription as string;
          const stripeCustomerId = invoice.customer as string;
          log(`[stripe-webhook] invoice.payment_action_required — subId=${stripeSubId}, customerId=${stripeCustomerId}`);
          if (stripeSubId) {
            const userId = await findUserByStripeCustomerId(stripeCustomerId);
            log(`[stripe-webhook] invoice.payment_action_required DB UPDATE: sub=${stripeSubId}, user=${userId ?? "unknown"} → past_due (action required; grace clock preserved if already past_due)`);
            await updateSubscriptionStatus(stripeSubId, "past_due", undefined, true);
          }
          break;
        }

        case "invoice.marked_uncollectible": {
          // Stripe has given up collecting this invoice. Block access immediately — no grace
          // period applies because Stripe itself has decided the debt is unrecoverable.
          const invoice = event.data.object as any;
          const stripeSubId = invoice.subscription as string;
          const stripeCustomerId = invoice.customer as string;
          log(`[stripe-webhook] invoice.marked_uncollectible — subId=${stripeSubId}, customerId=${stripeCustomerId}`);
          if (stripeSubId) {
            const userId = await findUserByStripeCustomerId(stripeCustomerId);
            log(`[stripe-webhook] invoice.marked_uncollectible DB UPDATE: sub=${stripeSubId}, user=${userId ?? "unknown"} → canceled (access blocked immediately)`);
            await updateSubscriptionStatus(stripeSubId, "canceled");
          }
          break;
        }

        default:
          log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      }

      log(`[stripe-webhook] Event ${event.id} processed OK`);
      return res.json({ received: true });
    } catch (err: any) {
      log(`[stripe-webhook] Error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/search-profiles", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { data: profiles, error } = await supabase
        .from("search_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.json(profiles ?? []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  const MAX_SEARCH_PROFILES_PER_USER = 4;

  app.post("/api/search-profiles", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { count, error: countErr } = await supabase
        .from("search_profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!countErr && count != null && count >= MAX_SEARCH_PROFILES_PER_USER) {
        return res.status(409).json({
          error: "profile_limit_reached",
          message: "Je kunt maximaal 4 zoekopdrachten aanmaken.",
        });
      }

      const input = req.body;
      if (!input || typeof input !== "object") {
        return res.status(400).json({ error: "Invalid request body" });
      }

      const row: Record<string, unknown> = {
        user_id: user.id,
        city: input.city_name,
        city_name: input.city_name,
        country_code: input.country_code ?? "DE",
        latitude: input.latitude,
        longitude: input.longitude,
        place_id: input.place_id,
        price_min: input.price_min,
        price_max: input.price_max,
        bedrooms_min: input.bedrooms_min,
        size_min: input.size_min,
      };

      if (input.location_mode) row.location_mode = input.location_mode;
      if (input.districts && input.districts.length > 0) row.districts = input.districts;
      if (input.radius_km != null) row.radius_km = input.radius_km;
      if (input.commute_destination) row.commute_destination = input.commute_destination;
      if (input.commute_lat != null) row.commute_lat = input.commute_lat;
      if (input.commute_lng != null) row.commute_lng = input.commute_lng;
      if (input.commute_mode) row.commute_mode = input.commute_mode;
      if (input.commute_minutes != null) row.commute_minutes = input.commute_minutes;
      if (input.furnished) row.furnished = input.furnished;
      if (input.property_types && input.property_types.length > 0) row.property_types = input.property_types;
      if (input.extra_features && input.extra_features.length > 0) row.extra_features = input.extra_features;
      if (input.target_categories && input.target_categories.length > 0) row.target_categories = input.target_categories;
      if (input.send_unclear != null) row.send_unclear = input.send_unclear;
      if (input.price_flexible != null) row.price_flexible = input.price_flexible;
      if (input.search_name) row.search_name = input.search_name;

      const { data, error } = await supabase
        .from("search_profiles")
        .insert(row)
        .select()
        .single();

      if (error) {
        log(`[search-profiles] POST insert error: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }

      const profileId = data.id;
      const profileCity = (data as any).city_name || (data as any).city || "unknown";
      log(`[search-profiles] POST created profile=${profileId} city="${profileCity}" user=${user.id.substring(0, 8)} — awaiting backfill (max 12s)`);

      // Await backfill synchronously so the client receives match data on first refetch.
      // A 12-second timeout prevents the request from hanging on slow DB operations.
      let initialMatchCount = 0;
      let backfillTimedOut = false;
      try {
        const timeoutPromise = new Promise<number>((resolve) => {
          setTimeout(() => { backfillTimedOut = true; resolve(0); }, 12000);
        });
        initialMatchCount = await Promise.race([
          backfillMatchesForSearchProfile(profileId),
          timeoutPromise,
        ]);
        log(`[search-profiles] Backfill ${backfillTimedOut ? "timed out" : "done"}: profile=${profileId} city="${profileCity}" matches=${initialMatchCount}`);
      } catch (e: any) {
        log(`[search-profiles] Backfill error for profile=${profileId}: ${e.message}`);
      }

      return res.status(201).json({ ...data, initial_match_count: initialMatchCount, backfill_timed_out: backfillTimedOut });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/search-profiles/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;

      const { data: profile } = await supabase
        .from("search_profiles")
        .select("user_id")
        .eq("id", id)
        .single();

      if (!profile || profile.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { error } = await supabase
        .from("search_profiles")
        .delete()
        .eq("id", id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  let _searchProfileColumns: Set<string> | null = null;
  async function getSearchProfileColumns(): Promise<Set<string>> {
    if (_searchProfileColumns) return _searchProfileColumns;
    const { data } = await supabase.from("search_profiles").select("*").limit(1);
    if (data && data.length > 0) {
      _searchProfileColumns = new Set(Object.keys(data[0]));
      log(`[search-profiles] Detected columns: ${[..._searchProfileColumns].join(", ")}`);
    } else {
      _searchProfileColumns = new Set(["id", "user_id", "city", "price_min", "price_max", "bedrooms_min", "size_min", "created_at"]);
    }
    return _searchProfileColumns;
  }

  app.put("/api/search-profiles/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileId = req.params.id;
      const { data: existing } = await supabase
        .from("search_profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();

      if (!existing || existing.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const body = req.body;
      const allFields = [
        "city", "city_name", "country_code", "latitude", "longitude", "place_id",
        "price_min", "price_max", "bedrooms_min", "size_min",
        "location_mode", "districts", "radius_km",
        "commute_destination", "commute_lat", "commute_lng", "commute_mode", "commute_minutes",
        "furnished", "property_types", "extra_features", "target_categories",
        "send_unclear", "price_flexible", "search_name",
      ];
      const coreFields = ["city", "price_min", "price_max", "bedrooms_min", "size_min", "search_name"];

      const availableCols = await getSearchProfileColumns();
      const updateRow: Record<string, unknown> = {};
      for (const f of allFields) {
        if ((f in body) && availableCols.has(f)) updateRow[f] = body[f];
      }

      log(`[search-profiles] Updating profile=${profileId} for user=${user.id}, search_name=${JSON.stringify(updateRow.search_name ?? "(not in row)")} fields=${JSON.stringify(Object.keys(updateRow))}`);

      const { error } = await supabase
        .from("search_profiles")
        .update(updateRow)
        .eq("id", profileId)
        .eq("user_id", user.id);

      if (error) {
        log(`[search-profiles] Full update failed: code=${(error as any).code} msg=${error.message}`);
        const coreRow: Record<string, unknown> = {};
        for (const f of coreFields) {
          if (f in body) coreRow[f] = body[f];
        }
        const { error: coreErr } = await supabase
          .from("search_profiles")
          .update(coreRow)
          .eq("id", profileId)
          .eq("user_id", user.id);

        if (coreErr) {
          log(`[search-profiles] Core update also failed: ${coreErr.message}`);
          return res.status(500).json({ error: coreErr.message });
        }
        log(`[search-profiles] Core-only update succeeded for profile=${profileId}`);
        _searchProfileColumns = null;
        return res.json({ success: true, partial: true });
      }

      log(`[search-profiles] Update succeeded for profile=${profileId}`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/search-profiles/backfill", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { searchProfileId } = req.body;
      if (!searchProfileId) return res.status(400).json({ error: "searchProfileId is required" });

      const { data: profile } = await supabase
        .from("search_profiles")
        .select("user_id, city_name, city")
        .eq("id", searchProfileId)
        .single();

      if (!profile || profile.user_id !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const profileCity = (profile as any).city_name || (profile as any).city || "unknown";
      log(`[BACKFILL] Request: user=${user.id.substring(0, 8)} profile=${searchProfileId} city="${profileCity}"`);

      const matchCount = await backfillMatchesForSearchProfile(searchProfileId);

      // Query user_matches count so we can log it for diagnostics
      let userMatchesCount = 0;
      try {
        const umRes = await pgPool.query(
          "SELECT COUNT(*) AS cnt FROM user_matches WHERE user_id = $1",
          [user.id]
        );
        userMatchesCount = parseInt(umRes.rows[0]?.cnt ?? "0", 10);
      } catch {}

      log(`[BACKFILL DONE] user=${user.id.substring(0, 8)} profile=${searchProfileId} city="${profileCity}" inserted=${matchCount} user_matches_total=${userMatchesCount}`);

      if (matchCount > 0) {
        await flushUserAlerts(user.id, supabase);
      }
      return res.json({ matches: matchCount, user_matches_total: userMatchesCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/boost", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileDataPromise = pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1", [user.id])
        .then(r => ({ data: r.rows[0] ?? null }))
        .catch(() => ({ data: null }));

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const notif = notifResult.data ?? { email_enabled: true, phone_e164: null };
      const profileData = profileDataResult.data;
      const searchProfiles = searchProfilesResult.data ?? [];

      const { resolveCompletionStates, calculateBoostScore } = await import("./boost");
      const states = resolveCompletionStates(notif, profileData, searchProfiles, user.email ?? null);
      const result = calculateBoostScore(states);

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/profile-strength", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const profileDataPromise = pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1", [user.id])
        .then(r => ({ data: r.rows[0] ?? null }))
        .catch(() => ({ data: null }));

      const [notifResult, profileDataResult, searchProfilesResult] = await Promise.all([
        supabase.from("user_notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
        profileDataPromise,
        supabase.from("search_profiles").select("id, city, price_min, price_max, bedrooms_min, size_min").eq("user_id", user.id),
      ]);

      const rawNotif = notifResult.data;
      const notif = rawNotif ?? { email_enabled: true, phone_e164: null };
      const profileData = profileDataResult.data;
      const searchProfiles = searchProfilesResult.data ?? [];

      const hasAlertChannel = !!(notif.email_enabled || (rawNotif as any)?.push_enabled);
      const hasSearchBuddy = !!(profileData?.search_buddy_email && profileData.search_buddy_email.trim().length > 0 && profileData.search_buddy_status !== "revoked_by_buddy");

      const hasStrongProfile = searchProfiles.some(p => {
        let filters = 0;
        if (p.price_min > 0 || p.price_max > 0) filters++;
        if (p.bedrooms_min > 0) filters++;
        if (p.size_min > 0) filters++;
        return filters >= 2;
      });
      const hasOptimizedSearch = searchProfiles.length >= 2 || hasStrongProfile;

      const hasApplicationTemplate = !!(profileData?.application_template && profileData.application_template.trim().length > 20);

      const checklist = (profileData?.document_checklist ?? {}) as Record<string, boolean>;
      const checklistValues = Object.values(checklist);
      const checklistDone = checklistValues.filter(Boolean).length;
      const REQUIRED_DOC_COUNT = 6;
      const hasDocuments = checklistDone >= REQUIRED_DOC_COUNT;

      const profilePhone = profileData?.phone;
      const hasPhone = !!(
        (notif.phone_e164 && notif.phone_e164.length > 5) ||
        (profilePhone && typeof profilePhone === "string" && profilePhone.length > 6)
      );

      const hasNetworkDone = !!(profileData?.network_task_done);
      const hasViewingTipsDone = !!(profileData?.viewing_tips_done);
      const hasMultipleProfiles = searchProfiles.length >= 2;

      const hasSearchProfile = searchProfiles.length >= 1;
      const hasProfileDetails = !!(profileData?.first_name && profileData?.last_name && profilePhone);

      const accountTasks = [
        { id: "profile_details", completed: hasProfileDetails, score: 20 },
        { id: "search_profile", completed: hasSearchProfile, score: 20 },
        { id: "notifications", completed: hasAlertChannel, score: 20 },
        { id: "search_buddy", completed: hasSearchBuddy, score: 15 },
        { id: "documents", completed: hasDocuments, score: 15 },
      ];

      const completedPrepSet = new Set<string>(profileData?.completed_prep_steps || []);
      const prepTasks = [
        { id: "tip_documents", completed: completedPrepSet.has("tip_documents"), score: 10 },
        { id: "tip_finances", completed: completedPrepSet.has("tip_finances"), score: 10 },
        { id: "tip_landlord_accounts", completed: completedPrepSet.has("tip_landlord_accounts"), score: 10 },
        { id: "tip_facebook_groups", completed: completedPrepSet.has("tip_facebook_groups"), score: 10 },
        { id: "tip_new_build", completed: completedPrepSet.has("tip_new_build"), score: 10 },
        { id: "tip_network", completed: completedPrepSet.has("tip_network"), score: 10 },
        { id: "tip_viewings", completed: completedPrepSet.has("tip_viewings"), score: 10 },
        { id: "tip_followup", completed: completedPrepSet.has("tip_followup"), score: 10 },
      ];

      const allTasks = [...accountTasks, ...prepTasks];
      const score = allTasks.filter(t => t.completed).reduce((sum, t) => sum + t.score, 0);
      const completedCount = accountTasks.filter(t => t.completed).length;
      const prepCompletedCount = prepTasks.filter(t => t.completed).length;

      const channels = {
        email: !!(notif.email_enabled),
        push: false,
      };

      const speedSteps = [
        { id: "alerts_active", done: hasAlertChannel },
        { id: "letter_ready", done: hasApplicationTemplate },
        { id: "documents_ready", done: hasDocuments },
        { id: "phone_added", done: hasPhone },
      ];

      const speedDone = speedSteps.filter(s => s.done).length;

      const recommendedChannel = notif.email_enabled ? "email" : null;

      return res.json({
        score,
        tasks: accountTasks,
        completedCount,
        totalCount: accountTasks.length,
        prepTasks,
        prepCompletedCount,
        prepTotalCount: prepTasks.length,
        maxScore: allTasks.reduce((s, t) => s + t.score, 0),
        channels,
        speedSteps,
        speedDone,
        speedTotal: speedSteps.length,
        recommendedChannel,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/onboarding-status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows } = await pgPool.query(
        "SELECT onboarding_completed, post_paywall_onboarding_completed FROM user_profile_data WHERE user_id = $1 LIMIT 1",
        [user.id]
      );

      if (rows.length === 0) {
        log(`[onboarding-status] userId=${user.id.substring(0, 8)}... no profile row → onboarding_completed=false`);
        return res.json({ onboarding_completed: false });
      }

      let completed = rows[0].onboarding_completed === true;
      let postPaywallCompleted = rows[0].post_paywall_onboarding_completed === true;

      if (!completed && postPaywallCompleted) {
        log(`[onboarding-status] userId=${user.id.substring(0, 8)}... post_paywall=true but onboarding_completed=false → auto-healing`);
        await pgPool.query(
          "UPDATE user_profile_data SET onboarding_completed = true, updated_at = NOW() WHERE user_id = $1",
          [user.id]
        );
        completed = true;
      }

      if (!completed) {
        const { data: profiles } = await supabase
          .from("search_profiles")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (profiles && profiles.length > 0) {
          log(`[onboarding-status] userId=${user.id.substring(0, 8)}... has search profiles → backfilling onboarding_completed=true`);
          await pgPool.query(
            "UPDATE user_profile_data SET onboarding_completed = true, updated_at = NOW() WHERE user_id = $1",
            [user.id]
          );
          completed = true;
        }
      }

      log(`[onboarding-status] userId=${user.id.substring(0, 8)}... onboarding_completed=${completed} post_paywall=${postPaywallCompleted}`);
      return res.json({ onboarding_completed: completed, post_paywall_onboarding_completed: postPaywallCompleted });
    } catch (err: any) {
      log(`[onboarding-status] Error: ${err.message}`);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/profile-data", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      log(`[profile-data] GET request userId=${user.id.substring(0, 8)}... email=${user.email}`);

      let { rows } = await pgPool.query(
        "SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1",
        [user.id]
      );

      log(`[profile-data] GET pgRow exists=${rows.length > 0} userId=${user.id.substring(0, 8)}...`);

      if (rows.length === 0) {
        const meta = user.user_metadata || {};
        let firstName = meta.first_name || null;
        let lastName = meta.last_name || null;
        if (!firstName && meta.full_name) {
          const parts = (meta.full_name as string).trim().split(/\s+/);
          firstName = parts[0] || null;
          lastName = parts.slice(1).join(" ") || null;
        }
        if (!firstName) firstName = user.email?.split("@")[0] || null;
        const detectedLang = detectLanguageFromHeader(req.headers["accept-language"]);
        try {
          const { rows: created } = await pgPool.query(
            `INSERT INTO user_profile_data (user_id, first_name, last_name, language, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               first_name = COALESCE(user_profile_data.first_name, EXCLUDED.first_name),
               last_name = COALESCE(user_profile_data.last_name, EXCLUDED.last_name),
               language = COALESCE(user_profile_data.language, EXCLUDED.language),
               updated_at = NOW()
             RETURNING *`,
            [user.id, firstName, lastName, detectedLang]
          );
          log(`[profile-data] Auto-created profile row for user=${user.id.substring(0, 8)}... name="${firstName} ${lastName}"`);
          rows = created;
        } catch (bootstrapErr: any) {
          log(`[profile-data] Auto-create failed for user=${user.id.substring(0, 8)}...: ${bootstrapErr.message}`);
        }
      }

      const row = rows[0];
      if (row && !row.language) {
        const detected = detectLanguageFromHeader(req.headers["accept-language"]);
        log(`[LANG AUTO-DETECT] userId=${user.id.substring(0, 8)}... language was NULL, detected="${detected}" from accept-language="${(req.headers["accept-language"] || "").substring(0, 60)}"`);
        pgPool.query(
          "UPDATE user_profile_data SET language = $1, updated_at = NOW() WHERE user_id = $2 AND (language IS NULL OR language = '')",
          [detected, user.id]
        ).then(() => {
          log(`[LANG FIRST SAVE] userId=${user.id.substring(0, 8)}... backfilled language="${detected}" to DB`);
        }).catch((e: any) => {
          log(`[LANG FIRST SAVE] userId=${user.id.substring(0, 8)}... backfill failed: ${e.message}`);
        });
        row.language = detected;
      }

      const defaults = { user_id: user.id, search_buddy_email: null, search_buddy_enabled: false, application_template: null, document_checklist: {} };
      return res.json(row ?? defaults);
    } catch (err: any) {
      console.error("[profile-data] GET error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/flow/complete-step", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { flowId, stepId } = req.body;
      if (!flowId || !stepId) return res.status(400).json({ error: "flowId and stepId required" });

      const PREP_STEP_IDS = new Set([
        "tip_documents", "tip_finances", "tip_landlord_accounts", "tip_facebook_groups",
        "tip_new_build", "tip_network", "tip_viewings", "tip_followup",
      ]);

      const MANUAL_STEP_COLUMNS: Record<string, Record<string, string>> = {
        search: {
          network: "network_task_done",
          viewing_tips: "viewing_tips_done",
        },
      };

      if (flowId === "search" && PREP_STEP_IDS.has(stepId)) {
        await pgPool.query(
          `UPDATE user_profile_data
           SET completed_prep_steps = array_append(
             COALESCE(completed_prep_steps, '{}'),
             $2
           )
           WHERE user_id = $1
             AND NOT ($2 = ANY(COALESCE(completed_prep_steps, '{}')))`,
          [user.id, stepId]
        );
        log(`[flow] Prep step completed: userId=${user.id.substring(0, 8)}... step=${stepId}`);
        return res.json({ success: true });
      }

      const column = MANUAL_STEP_COLUMNS[flowId]?.[stepId];
      if (!column) return res.status(400).json({ error: "Step does not support manual completion" });

      const result = await pgPool.query(
        `UPDATE user_profile_data SET ${column} = true WHERE user_id = $1`,
        [user.id]
      );

      if (result.rowCount === 0) {
        await pgPool.query(
          `INSERT INTO user_profile_data (user_id, ${column}) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET ${column} = true`,
          [user.id]
        );
      }

      log(`[flow] Manual completion: userId=${user.id.substring(0, 8)}... flow=${flowId} step=${stepId} column=${column}`);
      return res.json({ success: true });
    } catch (err: any) {
      log(`[flow] Error completing step: ${err.message}`);
      return res.status(500).json({ error: "Internal server error" });
    }
  });


  app.put("/api/profile-data", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      log(`[profile-data] PUT request userId=${user.id.substring(0, 8)}... email=${user.email} fields=${JSON.stringify(Object.keys(req.body))}`);

      const ALLOWED_FIELDS = [
        "search_buddy_email", "search_buddy_enabled",
        "application_template", "document_checklist",
        "network_task_done", "viewing_tips_done",
        "first_name", "last_name", "birth_date", "phone", "bio",
        "profile_photo_url", "occupation", "monthly_income", "language",
        "onboarding_completed",
        "gender", "living_with", "work_status", "move_reason", "pets_count",
        "post_paywall_onboarding_completed", "onboarding_current_step", "push_test_completed", "paywall_completed",
      ];

      const updates: Record<string, any> = {};
      for (const f of ALLOWED_FIELDS) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }

      if (updates.language !== undefined) {
        const validLangs = ["de", "en", "nl"];
        if (!validLangs.includes(updates.language)) {
          console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... REJECTED invalid language="${updates.language}"`);
          delete updates.language;
        } else {
          console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... saving language="${updates.language}"`);
        }
      }

      if (updates.search_buddy_email !== undefined) {
        delete updates.search_buddy_email;
        console.log(`[profile-data] IGNORED legacy search_buddy_email field for user ${user.id.substring(0, 8)}... — use V2 buddy system`);
      }
      if (updates.search_buddy_enabled !== undefined) {
        delete updates.search_buddy_enabled;
        console.log(`[profile-data] IGNORED legacy search_buddy_enabled field for user ${user.id.substring(0, 8)}... — use V2 buddy system`);
      }
      if (updates.search_buddy_status !== undefined) {
        delete updates.search_buddy_status;
      }
      if (updates.search_buddy_removed_at !== undefined) {
        delete updates.search_buddy_removed_at;
      }

      if (Object.keys(updates).length === 0) {
        const { rows } = await pgPool.query(
          "SELECT * FROM user_profile_data WHERE user_id = $1 LIMIT 1",
          [user.id]
        );
        return res.json(rows[0] ?? { user_id: user.id });
      }

      updates.updated_at = new Date().toISOString();
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
      const insertFields = ["user_id", ...fields];
      const insertPlaceholders = insertFields.map((_, i) => `$${i + 1}`).join(", ");
      const insertValues = [user.id, ...values];

      const query = `
        INSERT INTO user_profile_data (${insertFields.join(", ")})
        VALUES (${insertPlaceholders})
        ON CONFLICT (user_id) DO UPDATE SET ${setClauses}
        RETURNING *
      `;

      const { rows, rowCount } = await pgPool.query(query, insertValues);
      log(`[profile-data] PUT write userId=${user.id.substring(0, 8)}... rowCount=${rowCount} returned=${rows.length > 0} fields=${JSON.stringify(fields)}`);

      if (rows.length === 0) {
        log(`[profile-data] PUT FAILED - no rows returned for userId=${user.id.substring(0, 8)}... query was: ${query.substring(0, 200)}`);
        return res.status(500).json({ error: "Profile save failed - no rows affected" });
      }

      if (updates.language !== undefined) {
        console.log(`[LANG SAVE] userId=${user.id.substring(0, 8)}... CONFIRMED saved language="${rows[0]?.language}" in DB`);
      }

      if (updates.search_buddy_email !== undefined) {
        const newBuddyEmail = rows[0]?.search_buddy_email?.trim() || null;
        if (newBuddyEmail && newBuddyEmail.toLowerCase() !== (oldBuddyEmail || "").toLowerCase()) {
          const inviterName = rows[0]?.first_name || user.email?.split("@")[0] || "Someone";
          const ownerStoredLang = rows[0]?.language;
          // Fire-and-forget: resolve buddy language then send invite
          (async () => {
            // Language priority:
            // 1. Buddy's stored language (if they have an account)
            // 2. Owner's stored language from DB
            // 3. "en" fallback — never "nl" default or request header
            let lang: import("./i18n").ServerLocale = "en";
            try {
              const buddyAccount = await lookupSupabaseUserByEmail(newBuddyEmail);
              const buddyUserId = buddyAccount?.id;
              if (buddyUserId) {
                const buddyStoredLang = await getBuddyLanguage(buddyUserId);
                if (isValidLocale(buddyStoredLang)) {
                  lang = buddyStoredLang;
                  log(`[profile-data] Invite lang from buddy account — lang=${lang}`);
                } else if (isValidLocale(ownerStoredLang)) {
                  lang = ownerStoredLang;
                  log(`[profile-data] Invite lang from owner (buddy has account, no lang) — lang=${lang}`);
                }
              } else if (isValidLocale(ownerStoredLang)) {
                lang = ownerStoredLang;
                log(`[profile-data] Invite lang from owner (no buddy account) — lang=${lang}`);
              }
            } catch {
              if (isValidLocale(ownerStoredLang)) lang = ownerStoredLang;
              log(`[profile-data] Invite lang lookup failed — lang=${lang}`);
            }
            console.log(`[profile-data] Buddy invite email for ${newBuddyEmail} (inviter: ${inviterName}, lang: ${lang})`);
            sendBuddyInvitationEmail(newBuddyEmail, inviterName, lang).catch(err => {
              console.error(`[profile-data] Buddy invite email failed: ${err.message}`);
            });
          })();
        }
      }

      if (updates.phone !== undefined) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        const phoneVal = updates.phone && typeof updates.phone === "string" && e164Regex.test(updates.phone)
          ? updates.phone : null;
        supabase
          .from("user_notification_settings")
          .upsert(
            { user_id: user.id, phone_e164: phoneVal, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          )
          .then(({ error: syncErr }) => {
            if (syncErr) console.error("[profile-data] Phone sync to notification_settings failed:", syncErr.message);
          });
      }

      log(`[profile-data] PUT success userId=${user.id.substring(0, 8)}... saved fields: ${JSON.stringify(Object.fromEntries(fields.filter(f => f !== 'updated_at').map(f => [f, rows[0]?.[f]])))}`);
      return res.json(rows[0]);
    } catch (err: any) {
      log(`[profile-data] PUT ERROR: ${err.message}\n${err.stack}`);
      return res.status(500).json({ error: "Profile save failed. Please try again." });
    }
  });

  app.post("/api/profile-photo", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "No image provided" });

      const matches = image.match(/^data:(image\/[\w+-]+);base64,(.+)$/s);
      if (!matches) return res.status(400).json({ error: "Invalid image format" });

      const contentType = matches[1];
      const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
      const buffer = Buffer.from(matches[2], "base64");

      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Image too large (max 5MB)" });
      }

      const filePath = `profile-photos/${user.id}.${ext}`;

      const extensions = ["jpg", "png", "webp"];
      const oldPaths = extensions.filter(e => e !== ext).map(e => `profile-photos/${user.id}.${e}`);
      await supabase.storage.from("avatars").remove(oldPaths).catch(() => {});
      await supabase.storage.from("avatars").remove([filePath]).catch(() => {});

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error("[profile-photo] Upload error:", uploadError.message);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const photoUrl = urlData.publicUrl + `?t=${Date.now()}`;

      await pgPool.query(
        `INSERT INTO user_profile_data (user_id, profile_photo_url, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = $2, updated_at = $3`,
        [user.id, photoUrl, new Date().toISOString()]
      );

      return res.json({ profile_photo_url: photoUrl });
    } catch (err: any) {
      console.error("[profile-photo] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/profile-photo", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const extensions = ["jpg", "png", "webp", "gif"];
      const filePaths = extensions.map(ext => `profile-photos/${user.id}.${ext}`);
      await supabase.storage.from("avatars").remove(filePaths);

      await pgPool.query(
        `INSERT INTO user_profile_data (user_id, profile_photo_url, updated_at) VALUES ($1, NULL, $2)
         ON CONFLICT (user_id) DO UPDATE SET profile_photo_url = NULL, updated_at = $2`,
        [user.id, new Date().toISOString()]
      );

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/account", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const subStatus = await getSubscriptionStatus(user.id);
      if (subStatus.status === "active" && !subStatus.isTrial) {
        return res.status(400).json({
          error: "active_subscription",
          message: "Du hast ein aktives Abonnement. Bitte kündige dieses zuerst, bevor du dein Konto löschst.",
        });
      }

      await supabase.from("matches").delete().eq("user_id", user.id);
      await supabase.from("search_profiles").delete().eq("user_id", user.id);
      await supabase.from("subscriptions").delete().eq("user_id", user.id);
      await supabase.from("user_notification_settings").delete().eq("user_id", user.id);
      await pgPool.query("DELETE FROM user_profile_data WHERE user_id = $1", [user.id]);

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        log(`[account-delete] Failed to delete auth user ${user.id}: ${deleteError.message}`);
        return res.status(500).json({ error: "Kontodaten gelöscht, aber Authentifizierung konnte nicht entfernt werden. Bitte kontaktiere den Support." });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[account-delete] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  async function getVisibleMatchListingIds(userId: string): Promise<{ validIds: Set<string>; premiumStartedAt: string | null }> {
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("created_at")
      .eq("user_id", userId)
      .single();
    const premiumStartedAt = subRow?.created_at || null;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff = premiumStartedAt
      ? (new Date(premiumStartedAt).getTime() > new Date(ninetyDaysAgo).getTime() ? premiumStartedAt : ninetyDaysAgo)
      : ninetyDaysAgo;

    let dashMatchQuery = supabase
      .from("matches")
      .select("id, listing_id, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoff);
    const { data: matchRows } = await dashMatchQuery;

    if (!matchRows || matchRows.length === 0) {
      return { validIds: new Set(), premiumStartedAt };
    }

    const enriched = matchRows.map((m: any) => ({
      ...m,
      matched_at: m.created_at,
    }));
    enriched.sort((a: any, b: any) =>
      new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
    );

    const dedupedByListing: Record<string, any> = {};
    for (const m of enriched) {
      if (!dedupedByListing[m.listing_id]) {
        dedupedByListing[m.listing_id] = m;
      }
    }
    let uniqueMatches = Object.values(dedupedByListing);

    const listingIds = uniqueMatches.map((m: any) => m.listing_id);
    if (listingIds.length === 0) {
      return { validIds: new Set(), premiumStartedAt };
    }

    const existingListings = await batchedIn<any>(
      "listings", "id", listingIds, "id",
      (q: any) => q.not("title", "is", null)
    );

    const validIds = new Set(existingListings.map((l: any) => l.id));
    return { validIds, premiumStartedAt };
  }

  app.get("/api/profile-stats", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const subStatus = await getSubscriptionStatus(user.id);
      const hasActiveOrTrial = subStatus.status === "active" || subStatus.status === "trial";

      if (!hasActiveOrTrial) {
        return res.json({ matches_received: 0, reactions_sent: 0 });
      }

      const stats = await getUserMatchStats(user.id);
      return res.json({
        matches_received: stats?.total ?? 0,
        reactions_sent: stats?.applied ?? 0,
      });
    } catch (err: any) {
      return res.json({ matches_received: 0, reactions_sent: 0 });
    }
  });

  app.get("/api/referral/info/:code", async (req, res) => {
    try {
      const code = (req.params.code || "").trim().toUpperCase();
      if (!code || code.length < 4) return res.status(400).json({ error: "invalid_code" });

      const { rows } = await pgPool.query(
        "SELECT first_name FROM user_profile_data WHERE referral_code = $1",
        [code]
      );

      if (rows.length === 0) return res.status(404).json({ error: "not_found" });

      const firstName = (rows[0].first_name || "").trim();
      return res.json({ valid: true, firstName, code });
    } catch (err: any) {
      log(`[referrals] GET /info error: ${err.message}`, "referral");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/referrals/me", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { rows: profileRows } = await pgPool.query(
        "SELECT first_name FROM user_profile_data WHERE user_id = $1",
        [user.id]
      );
      const firstName = profileRows[0]?.first_name || null;

      const summary = await getReferralSummary(pgPool, user.id, firstName);
      return res.json(summary);
    } catch (err: any) {
      log(`[referrals] GET /me error: ${err.message}`, "referral");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/referrals/apply", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "missing_code" });
      }

      const result = await applyReferralCode(pgPool, user.id, code);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true });
    } catch (err: any) {
      log(`[referrals] POST /apply error: ${err.message}`, "referral");
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/referrals/validate", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ valid: false, error: "missing_code" });
      }

      const result = await validateReferralCode(pgPool, code, user.id);
      return res.json({ valid: result.valid, error: result.error || null });
    } catch (err: any) {
      log(`[referrals] POST /validate error: ${err.message}`, "referral");
      return res.status(500).json({ valid: false, error: "Internal error" });
    }
  });

  app.patch("/api/matches/:matchListingId/viewed", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      await markViewed(user.id, [matchListingId]);
      return res.json({ listing_id: matchListingId, viewed: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/matches/:matchListingId/saved", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

      const { matchListingId } = req.params;
      const { saved } = req.body;
      if (typeof saved !== "boolean") return res.status(400).json({ error: "saved must be a boolean" });

      const updated = await markSaved(user.id, matchListingId, saved);
      if (!updated) return res.status(404).json({ error: "Match not found in canonical records" });
      return res.json({ listing_id: matchListingId, saved });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/backfill-images", requireAdmin, async (req, res) => {
    try {
      const cheerio = await import("cheerio");
      const UA = "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.com)";

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, source, url")
        .is("image_url", null)
        .limit(50);

      if (error) return res.status(500).json({ error: error.message });
      if (!listings || listings.length === 0) return res.json({ updated: 0, message: "No listings need backfill" });

      let updated = 0;
      let failed = 0;

      function normalizeUrl(raw: string): string | null {
        if (!raw || raw.startsWith("data:") || raw.includes("blank")) return null;
        if (raw.startsWith("http")) return raw;
        if (raw.startsWith("//")) return "https:" + raw;
        return null;
      }

      function extractImgFromEl($: any, selector: string): string | null {
        const img = $(selector).first();
        if (!img.length) return null;
        const src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy") || img.attr("data-original") || "";
        const resolved = normalizeUrl(src);
        if (resolved) return resolved;
        const srcset = img.attr("srcset") || "";
        if (srcset) {
          const first = srcset.split(",")[0]?.trim()?.split(" ")[0] || "";
          const r = normalizeUrl(first);
          if (r) return r;
        }
        return null;
      }

      function extractOgImage($: any): string | null {
        return normalizeUrl($("meta[property='og:image']").attr("content") || "");
      }

      function extractTwitterImage($: any): string | null {
        return normalizeUrl($("meta[name='twitter:image'], meta[property='twitter:image']").attr("content") || "");
      }

      for (const listing of listings) {
        try {
          await new Promise(r => setTimeout(r, 800));
          const resp = await fetch(listing.url, {
            headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" },
            redirect: "follow",
          });
          if (!resp.ok) { failed++; continue; }
          const html = await resp.text();
          const $ = cheerio.load(html);

          let imageUrl: string | null = null;
          if (listing.source === "kleinanzeigen") {
            imageUrl = extractImgFromEl($, "#viewad-image img, .galleryimage-element img, img[src*='img.kleinanzeigen.de'], img[data-src*='img.kleinanzeigen.de']");
            if (imageUrl) imageUrl = imageUrl.replace(/\?rule=\$_\d+\.AUTO/, "?rule=$_35.AUTO");
          } else if (listing.source === "wohnungsboerse") {
            imageUrl = extractImgFromEl($, "img[src*='wohnungsboerse.net/assets'], img[data-src*='wohnungsboerse.net/assets']");
          } else if (listing.source === "wg-gesucht") {
            const { extractWgGesuchtImage } = await import("./ingesters/wg-gesucht");
            const wgResult = extractWgGesuchtImage($);
            if (wgResult) imageUrl = wgResult.url;
          } else if (listing.source === "rentola") {
            const { extractRentolaImage } = await import("./ingesters/rentola-image");
            const rentolaResult = extractRentolaImage($);
            if (rentolaResult) imageUrl = rentolaResult.url;
          } else if (listing.source === "immowelt") {
            imageUrl = extractImgFromEl($, "img[src*='mms.immowelt.de'], img[data-src*='mms.immowelt.de'], [data-testid='gallery'] img, .gallery img");
          }

          if (!imageUrl) imageUrl = extractOgImage($);
          if (!imageUrl) imageUrl = extractTwitterImage($);
          if (!imageUrl) {
            const anyImg = $("article img, .listing img, .detail img, main img").first();
            if (anyImg.length) {
              const src = anyImg.attr("src") || anyImg.attr("data-src") || anyImg.attr("data-lazy") || anyImg.attr("data-original") || "";
              const resolved = normalizeUrl(src);
              if (resolved && !resolved.includes("logo") && !resolved.includes("icon") && !resolved.includes("avatar")) {
                imageUrl = resolved;
              }
              if (!imageUrl) {
                const srcset = anyImg.attr("srcset") || "";
                if (srcset) {
                  const first = srcset.split(",")[0]?.trim()?.split(" ")[0] || "";
                  imageUrl = normalizeUrl(first);
                }
              }
            }
          }

          if (imageUrl) {
            await supabase.from("listings").update({ image_url: imageUrl }).eq("id", listing.id);
            updated++;
            log(`Backfilled image for ${listing.source} listing ${listing.id}`);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      return res.json({ updated, failed, total: listings.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/image-backfill-status", requireAdmin, async (_req, res) => {
    try {
      const {
        isBackfillEnabled, isBackfillRunning, getBackfillBatchSize,
        getEnabledSources, getLastRun, getCumulativeUpdates,
        getRecentRuns, getBackfillStats, getRecoveryStats,
        getSourceRetryLimits, getSourceCooldownHours,
      } = await import("./image-backfill");

      const [recentRuns, stats, recoveryStats] = await Promise.all([
        getRecentRuns(15),
        getBackfillStats(),
        getRecoveryStats(),
      ]);

      res.json({
        enabled: isBackfillEnabled(),
        running: isBackfillRunning(),
        batchSize: getBackfillBatchSize(),
        enabledSources: getEnabledSources(),
        lastRun: getLastRun(),
        cumulativeUpdates: getCumulativeUpdates(),
        dbStats: stats,
        recoveryStats,
        retryLimits: getSourceRetryLimits(),
        cooldownHours: getSourceCooldownHours(),
        recentRuns,
      });
    } catch (err: any) {
      log(`[admin] image-backfill-status error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/image-backfill-config", requireAdmin, async (req, res) => {
    try {
      const {
        setBackfillEnabled, setBackfillBatchSize, setEnabledSources,
        isBackfillEnabled, getBackfillBatchSize, getEnabledSources,
      } = await import("./image-backfill");

      const { enabled, batchSize, sources } = req.body || {};
      if (typeof enabled === "boolean") setBackfillEnabled(enabled);
      if (typeof batchSize === "number") setBackfillBatchSize(batchSize);
      if (Array.isArray(sources)) setEnabledSources(sources);

      log(`[admin] image-backfill config updated: enabled=${isBackfillEnabled()}, batchSize=${getBackfillBatchSize()}, sources=${getEnabledSources().join(",")}`);

      res.json({
        enabled: isBackfillEnabled(),
        batchSize: getBackfillBatchSize(),
        enabledSources: getEnabledSources(),
      });
    } catch (err: any) {
      log(`[admin] image-backfill-config error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/image-backfill-trigger", requireAdmin, async (_req, res) => {
    try {
      const { runImageBackfill, isBackfillRunning } = await import("./image-backfill");
      if (isBackfillRunning()) {
        return res.json({ message: "Backfill already running", results: [] });
      }
      const results = await runImageBackfill();
      res.json({ results });
    } catch (err: any) {
      log(`[admin] image-backfill-trigger error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/backfill-wg-gesucht-images", requireAdmin, async (req, res) => {
    try {
      const { fetchWgGesuchtImage } = await import("./ingesters/wg-gesucht");
      const limit = Math.min(parseInt(req.body?.limit || "50"), 200);

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, source_id, url, title, image_url")
        .eq("source", "wg-gesucht")
        .or("image_url.is.null,image_url.eq.")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return res.status(500).json({ error: error.message });
      if (!listings || listings.length === 0) return res.json({ updated: 0, failed: 0, total: 0, message: "No wg-gesucht listings need image backfill" });

      log(`[admin] wg-gesucht image backfill: processing ${listings.length} listings`);

      let updated = 0;
      let failed = 0;
      const methods: Record<string, number> = {};

      for (const listing of listings) {
        await new Promise(r => setTimeout(r, 1200));
        try {
          const result = await fetchWgGesuchtImage(listing.url);
          if (result) {
            const { error: updateErr } = await supabase
              .from("listings")
              .update({ image_url: result.url })
              .eq("id", listing.id);
            if (!updateErr) {
              updated++;
              methods[result.method] = (methods[result.method] || 0) + 1;
              log(`[admin] wg-gesucht backfill: ${listing.id} → ${result.method}`);
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      log(`[admin] wg-gesucht image backfill done: ${updated}/${listings.length} updated`);
      res.json({ updated, failed, total: listings.length, methods });
    } catch (err: any) {
      log(`[admin] wg-gesucht backfill error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-email-logic", requireAdmin, async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id || typeof user_id !== "string") {
        return res.status(400).json({ error: "user_id is required" });
      }
      const { simulateEmailLogic } = await import("./notifications/buffer");
      const result = await simulateEmailLogic(user_id, supabase);
      res.json(result);
    } catch (err: any) {
      log(`[admin] test-email-logic error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-email-logic/all", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.body?.limit || "20"), 50);
      const { rows } = await pgPool.query(
        "SELECT user_id FROM user_profile_data ORDER BY updated_at DESC NULLS LAST LIMIT $1",
        [limit]
      );
      if (rows.length === 0) {
        return res.json({ results: [], count: 0 });
      }
      const { simulateEmailLogic } = await import("./notifications/buffer");
      const results = [];
      for (const row of rows) {
        try {
          const result = await simulateEmailLogic(row.user_id, supabase);
          results.push(result);
        } catch (err: any) {
          results.push({
            user_id: row.user_id,
            error: err.message,
          });
        }
      }
      res.json({ results, count: results.length });
    } catch (err: any) {
      log(`[admin] test-email-logic/all error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ingest/run", async (req, res) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.INGEST_BEARER_TOKEN;
    if (!expectedToken || !authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const report = await runAllIngesters();
      return res.json(report);
    } catch (err: any) {
      if (err instanceof OverlapError) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/onboarding-drafts", async (req, res) => {
    try {
      const {
        country_code, city_name, latitude, longitude, place_id,
        location_mode, districts, radius_km,
        commute_destination, commute_lat, commute_lng, commute_mode, commute_minutes,
        price_min, price_max, property_type,
      } = req.body;

      if (!city_name || typeof city_name !== "string" || city_name.trim() === "") {
        return res.status(400).json({ error: "city_name is required" });
      }

      const row: Record<string, unknown> = {
        country_code: country_code || "DE",
        city_name: city_name.trim(),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        place_id: place_id ?? null,
        location_mode: location_mode || "city",
        price_min: parseInt(price_min) || 0,
        price_max: parseInt(price_max) || 0,
        property_type: property_type || null,
      };

      if (districts && Array.isArray(districts) && districts.length > 0) row.districts = districts;
      if (radius_km != null) row.radius_km = parseInt(radius_km);
      if (commute_destination) row.commute_destination = commute_destination;
      if (commute_lat != null) row.commute_lat = parseFloat(commute_lat);
      if (commute_lng != null) row.commute_lng = parseFloat(commute_lng);
      if (commute_mode) row.commute_mode = commute_mode;
      if (commute_minutes != null) row.commute_minutes = parseInt(commute_minutes);

      const { data, error } = await supabase
        .from("onboarding_drafts")
        .insert(row)
        .select("id")
        .single();

      if (error) {
        log(`[onboarding-draft] Insert error: ${error.message}`);
        return res.status(500).json({ error: "Failed to save draft" });
      }

      return res.json({ id: data.id });
    } catch (err: any) {
      log(`[onboarding-draft] Error: ${err.message}`);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/onboarding-drafts/:id/claim", async (req, res) => {
    try {
      const { id } = req.params;
      const { user_id } = req.body;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id) || !user_id || !uuidRegex.test(user_id)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      const { data: check, error: checkErr } = await supabase
        .from("onboarding_drafts")
        .select("claimed_by")
        .eq("id", id)
        .single();

      if (checkErr || !check) {
        return res.status(404).json({ error: "Draft not found" });
      }

      if (check.claimed_by && check.claimed_by !== user_id) {
        return res.status(409).json({ error: "Dieser Suchauftrag wurde bereits von jemand anderem verwendet." });
      }

      const { error: updateErr } = await supabase
        .from("onboarding_drafts")
        .update({ claimed_by: user_id, claimed_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) {
        return res.status(500).json({ error: "Claim failed" });
      }

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/onboarding-drafts/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }

      const { data, error } = await supabase
        .from("onboarding_drafts")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Draft not found" });
      }

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  async function requireAdmin(req: any, res: any, next: any) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      log(`[admin] requireAdmin: no token in Authorization header`);
      return res.status(401).json({ error: "Unauthorized — no token provided" });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      log(`[admin] requireAdmin: auth failed — ${authErr?.message || "no user"}`);
      return res.status(401).json({ error: "Unauthorized — invalid session" });
    }
    if (!isAdminEmail(user.email || "")) {
      log(`[admin] requireAdmin: ${user.email} is not an admin`);
      return res.status(403).json({ error: "Forbidden — not an admin" });
    }

    (req as any).adminUser = user;
    next();
  }

  app.post("/api/admin/reset-onboarding", requireAdmin, async (req, res) => {
    try {
      const targetUserId = req.body?.user_id;
      const adminUser = (req as any).adminUser;

      const userId = targetUserId || adminUser.id;

      await pgPool.query(
        "UPDATE user_profile_data SET onboarding_completed = false, updated_at = NOW() WHERE user_id = $1",
        [userId]
      );
      log(`[ADMIN] ${adminUser.email} reset onboarding_completed=false for userId=${userId.substring(0, 8)}...`);
      return res.json({ success: true, user_id: userId, onboarding_completed: false });
    } catch (err: any) {
      log(`[ADMIN] Reset onboarding error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const targetEmail = req.body?.email || "martin.essie87@gmail.com";

      log(`[EMAIL TEST] Admin ${adminUser.email} triggering controlled test email to ${targetEmail}`);

      const { sendControlledTestEmail } = await import("./email");
      const result = await sendControlledTestEmail(targetEmail);

      if (result.success) {
        log(`[EMAIL TEST] Controlled test email accepted by Resend — to=${targetEmail} resend_id=${result.resendId}`);
        return res.json(result);
      } else {
        log(`[EMAIL TEST] Controlled test email FAILED — to=${targetEmail} error=${result.error}`);
        return res.status(500).json(result);
      }
    } catch (err: any) {
      log(`[EMAIL TEST] Error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/test-push", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const rawUserId = req.body?.user_id;
      const targetUserId = (typeof rawUserId === "string" && /^[0-9a-f-]{36}$/i.test(rawUserId)) ? rawUserId : adminUser.id;
      log(`[PUSH TEST] Admin ${adminUser.email} triggering test push for user ${targetUserId.substring(0, 8)}...`);

      const webResult = await sendPushToUser(
        targetUserId,
        {
          title: "HousAlert Test",
          body: "Push notificaties werken! 🏠",
          url: "/dashboard",
        },
        supabase
      );

      const expoResult = await sendExpoTestPush(targetUserId);

      const totalSent = webResult.sent + expoResult.sent;

      if (totalSent > 0) {
        log(`[PUSH TEST] Test push sent: web=${webResult.sent} expo=${expoResult.sent}`);
        return res.json({ success: true, targetUserId, web: webResult, expo: expoResult });
      } else {
        log(`[PUSH TEST] No push sent (web=${webResult.sent}, expo=${expoResult.sent})`);
        return res.json({
          success: false,
          targetUserId,
          web: webResult,
          expo: expoResult,
          message: "No active push subscriptions or Expo tokens found for this user",
        });
      }
    } catch (err: any) {
      log(`[PUSH TEST] Error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/admin/push-debug", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const rawId = req.query.user_id as string | undefined;
      const targetUserId = (rawId && /^[0-9a-f-]{36}$/i.test(rawId)) ? rawId : adminUser.id;
      const sb = getSupabaseAdmin();

      const { data: userData } = await supabase.auth.admin.getUserById(targetUserId);
      const email = userData?.user?.email || "unknown";

      const { data: tokens } = await sb
        .from("expo_push_tokens")
        .select("id, expo_push_token, platform, is_active, created_at, updated_at")
        .eq("user_id", targetUserId)
        .order("updated_at", { ascending: false });

      const { data: webSubs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, created_at")
        .eq("user_id", targetUserId);

      const { data: notifSettings } = await supabase
        .from("user_notification_settings")
        .select("email_enabled, push_enabled")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status, plan, trial_end, current_period_end")
        .eq("user_id", targetUserId)
        .maybeSingle();

      const { data: recentLogs } = await sb
        .from("push_delivery_log")
        .select("id, channel, token_snippet, listing_count, title, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      const activeExpoTokens = (tokens || []).filter((t: any) => t.is_active);
      const maskedTokens = (tokens || []).map((t: any) => ({
        ...t,
        expo_push_token: t.expo_push_token ? t.expo_push_token.substring(0, 30) + "..." : null,
      }));

      return res.json({
        user_id: targetUserId,
        email,
        subscription: subRow || null,
        notification_settings: notifSettings || { email_enabled: true, push_enabled: false },
        push_ready: activeExpoTokens.length > 0 && (notifSettings?.push_enabled ?? false),
        expo_tokens: {
          total: (tokens || []).length,
          active: activeExpoTokens.length,
          tokens: maskedTokens,
        },
        web_push_subscriptions: {
          total: (webSubs || []).length,
          subscriptions: (webSubs || []).map((s: any) => ({
            id: s.id,
            endpoint: s.endpoint?.substring(0, 50) + "...",
            created_at: s.created_at,
          })),
        },
        recent_delivery_logs: recentLogs || [],
        diagnosis: {
          has_active_tokens: activeExpoTokens.length > 0,
          push_enabled_in_settings: notifSettings?.push_enabled ?? false,
          has_active_subscription: subRow?.status === "active" || (subRow?.trial_end && new Date(subRow.trial_end) > new Date()),
          can_receive_push: activeExpoTokens.length > 0 && (notifSettings?.push_enabled ?? false),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-push-to-token", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { expo_push_token, title, body, deep_link } = req.body;

      if (!expo_push_token || typeof expo_push_token !== "string" || !expo_push_token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid expo_push_token — must start with ExponentPushToken[" });
      }

      const pushTitle = title || "HousAlert Test";
      const pushBody = body || "Direct token test push";
      const pushDeepLink = typeof deep_link === "string" && deep_link.startsWith("/") ? deep_link : "/dashboard";

      log(`[PUSH TEST] Admin ${adminUser.email} sending direct push to token ${expo_push_token.substring(0, 30)}...`);

      const { sendWithRetry } = await import("./notifications/expo-push");
      const message = {
        to: expo_push_token,
        sound: "default",
        title: pushTitle,
        body: pushBody,
        data: { url: pushDeepLink, type: "admin_test" },
        priority: "high" as const,
        channelId: "match-alerts",
      };

      const { tickets, error } = await sendWithRetry([message]);

      const ticket = tickets[0];
      const sb = getSupabaseAdmin();
      try {
        await sb.from("push_delivery_log").insert({
          user_id: adminUser.id,
          channel: "expo",
          token_snippet: expo_push_token.substring(0, 30) + "...",
          full_token: expo_push_token,
          listing_ids: [],
          listing_count: 0,
          title: pushTitle,
          body: pushBody,
          status: error ? "api_error" : (ticket?.status === "ok" ? "sent" : "failed"),
          expo_ticket_id: ticket?.id || null,
          error_type: error ? "api_error" : (ticket?.details?.error || null),
          error_message: error || ticket?.message || null,
        });
      } catch {}

      if (error) {
        return res.json({ success: false, error, token: expo_push_token.substring(0, 30) + "..." });
      }

      return res.json({
        success: ticket?.status === "ok",
        ticket,
        payload_sent: {
          title: pushTitle,
          body: pushBody,
          deep_link: pushDeepLink,
          channel: "match-alerts",
        },
        token: expo_push_token.substring(0, 30) + "...",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const DEV_USER_ID = "acb0a5e8-49bc-404e-bdd9-7ed568fdfaed";

    app.get("/api/dev/test-push", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();
        const { data: tokens } = await sb
          .from("expo_push_tokens")
          .select("expo_push_token, platform")
          .eq("user_id", DEV_USER_ID)
          .eq("is_active", true);

        const activeTokens = tokens || [];
        if (activeTokens.length === 0) {
          return res.json({ success: false, tokens_found: 0, tokens_targeted: 0, error: "No active tokens registered" });
        }

        const { sendWithRetry } = await import("./notifications/expo-push");
        const messages = activeTokens.map((t: any) => ({
          to: t.expo_push_token,
          sound: "default",
          title: "HousAlert Dev Test",
          body: `Push test @ ${new Date().toLocaleTimeString("nl-NL")}`,
          data: { url: "/dashboard", type: "dev_test" },
          priority: "high" as const,
          channelId: "match-alerts",
        }));

        const { tickets, error } = await sendWithRetry(messages);
        const ticketIds = (tickets || []).filter((t: any) => t?.id).map((t: any) => t.id);

        return res.json({
          success: !error && tickets.every((t: any) => t?.status === "ok"),
          tokens_found: activeTokens.length,
          tokens_targeted: messages.length,
          push_ticket_ids: ticketIds.length > 0 ? ticketIds : null,
          tickets,
          error: error || null,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    app.get("/api/dev/push-debug", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();

        const { data: tokens } = await sb
          .from("expo_push_tokens")
          .select("expo_push_token, platform, is_active, updated_at")
          .eq("user_id", DEV_USER_ID)
          .eq("is_active", true);

        const activeTokens = tokens || [];
        const masked = activeTokens.map((t: any) => ({
          token: t.expo_push_token.substring(0, 25) + "...]",
          platform: t.platform,
          updated_at: t.updated_at,
        }));

        const { data: logs } = await sb
          .from("push_delivery_log")
          .select("id, channel, token_snippet, title, body, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
          .eq("user_id", DEV_USER_ID)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: settings } = await sb
          .from("notification_settings")
          .select("push_enabled, email_enabled")
          .eq("user_id", DEV_USER_ID)
          .maybeSingle();

        return res.json({
          active_token_count: activeTokens.length,
          masked_tokens: masked,
          push_enabled: settings?.push_enabled ?? null,
          email_enabled: settings?.email_enabled ?? null,
          recent_delivery_logs: logs || [],
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/dev/expo-push-tokens-count", async (_req, res) => {
      try {
        const sb = getSupabaseAdmin();
        const { count: total } = await sb.from("expo_push_tokens").select("*", { count: "exact", head: true });
        const { count: active } = await sb.from("expo_push_tokens").select("*", { count: "exact", head: true }).eq("is_active", true);
        const { data: allTokens } = await sb.from("expo_push_tokens").select("user_id, expo_push_token, platform, is_active, updated_at").order("updated_at", { ascending: false }).limit(20);
        const masked = (allTokens || []).map((t: any) => ({
          user_id: t.user_id.substring(0, 8) + "...",
          token: t.expo_push_token.substring(0, 25) + "...]",
          platform: t.platform,
          is_active: t.is_active,
          updated_at: t.updated_at,
        }));
        return res.json({ total, active, tokens: masked });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/dev/test-email-send", async (req, res) => {
      try {
        const targetEmail = req.body?.email || "martin.essie87@gmail.com";
        log(`[DEV EMAIL TEST] Sending test email to ${targetEmail}`);

        const { sendControlledTestEmail } = await import("./email");
        const result = await sendControlledTestEmail(targetEmail);
        return res.json(result);
      } catch (err: any) {
        log(`[DEV EMAIL TEST] Error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
      }
    });

    app.post("/api/dev/referral-seed", async (req, res) => {
      try {
        const { userId, pending = 1, qualified = 1, rewarded = 1 } = req.body || {};
        if (!userId) return res.status(400).json({ error: "userId required" });

        const code = await ensureUserHasReferralCode(pgPool, userId);

        const statuses = [
          ...Array(Number(pending)).fill("pending"),
          ...Array(Number(qualified)).fill("qualified"),
          ...Array(Number(rewarded)).fill("rewarded"),
        ];

        let seeded = 0;
        for (const status of statuses) {
          const fakeId = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`.slice(0, 36);
          try {
            await pgPool.query(
              `INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status, created_at, updated_at, qualified_at, rewarded_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6)`,
              [
                userId,
                fakeId,
                code,
                status,
                status === "qualified" || status === "rewarded" ? new Date() : null,
                status === "rewarded" ? new Date() : null,
              ]
            );
            seeded++;
          } catch (err: any) {
            log(`[DEV REFERRAL SEED] Insert skipped: ${err.message}`);
          }
        }

        return res.json({ success: true, code, seeded, total: statuses.length });
      } catch (err: any) {
        log(`[DEV REFERRAL SEED] Error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/dev/reset-onboarding", async (req, res) => {
      try {
        const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
        if (!token) return res.status(401).json({ error: "Unauthorized" });
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

        await pgPool.query(
          "UPDATE user_profile_data SET onboarding_completed = false, updated_at = NOW() WHERE user_id = $1",
          [user.id]
        );
        log(`[DEV] Reset onboarding_completed=false for userId=${user.id.substring(0, 8)}...`);
        return res.json({ success: true, user_id: user.id, onboarding_completed: false });
      } catch (err: any) {
        log(`[DEV] Reset onboarding error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
    });

    log("[DEV] Registered /api/dev/test-push, /api/dev/push-debug, /api/dev/expo-push-tokens-count, /api/dev/test-email-send, /api/dev/referral-seed, /api/dev/reset-onboarding (no auth, dev only)");
  }

  app.get("/api/admin/push-delivery-log", requireAdmin, async (req, res) => {
    try {
      const userId = req.query.user_id as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
      const sb = getSupabaseAdmin();

      let q = sb
        .from("push_delivery_log")
        .select("id, user_id, channel, token_snippet, listing_count, title, body, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (userId) q = q.eq("user_id", userId);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      return res.json({ count: data?.length || 0, logs: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/push-tokens", requireAdmin, async (req, res) => {
    try {
      const userId = req.query.user_id as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
      const sb = getSupabaseAdmin();

      let q = sb
        .from("expo_push_tokens")
        .select("id, user_id, expo_push_token, platform, is_active, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (userId) q = q.eq("user_id", userId);

      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      const masked = (data || []).map((t: any) => ({
        ...t,
        expo_push_token: t.expo_push_token
          ? t.expo_push_token.substring(0, 25) + "...]"
          : null,
      }));
      return res.json({ count: masked.length, tokens: masked });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/debug/match-alignment", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const targetUserId = (req.query.user_id as string) || adminUser.id;

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("created_at, status")
        .eq("user_id", targetUserId)
        .single();
      const premiumStartedAt = subRow?.created_at || null;

      let debugMatchQuery = supabase
        .from("matches")
        .select("id, listing_id, search_profile_id, created_at")
        .eq("user_id", targetUserId);
      if (premiumStartedAt) {
        debugMatchQuery = debugMatchQuery.gte("created_at", premiumStartedAt);
      }
      const { data: matchRows } = await debugMatchQuery;

      if (!matchRows || matchRows.length === 0) {
        return res.json({
          user_id: targetUserId,
          subscription: { status: subRow?.status || null, created_at: premiumStartedAt },
          total_match_rows: 0,
          unique_after_dedup: 0,
          after_premium_filter: 0,
          app_visible_count: 0,
          recent_emailed_count: 0,
          mismatch_count: 0,
          emailed_at: null,
          app_visible: [],
          recent_emailed: [],
          emailed_but_not_visible: [],
        });
      }

      const enriched = matchRows.map((m: any) => ({
        ...m,
        matched_at: m.created_at,
      }));
      enriched.sort((a: any, b: any) =>
        new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
      );

      const dedupedByListing: Record<string, any> = {};
      for (const m of enriched) {
        if (!dedupedByListing[m.listing_id]) {
          dedupedByListing[m.listing_id] = m;
        }
      }
      let uniqueMatches = Object.values(dedupedByListing);
      const prePremiumCount = uniqueMatches.length;

      if (premiumStartedAt) {
        const premiumStart = new Date(premiumStartedAt).getTime();
        uniqueMatches = uniqueMatches.filter((m: any) =>
          new Date(m.matched_at).getTime() >= premiumStart
        );
      }

      const allListingIds = uniqueMatches.map((m: any) => m.listing_id);

      const recentEmailed = getRecentEmailedIds(targetUserId);
      const emailedIdList = recentEmailed?.listing_ids || [];

      const allIdsToFetch = [...new Set([...allListingIds, ...emailedIdList])];

      let fullListingMap: Record<string, any> = {};
      if (allIdsToFetch.length > 0) {
        const allListings = await batchedIn<any>(
          "listings", "id", allIdsToFetch,
          "id, title, city, price, source, url"
        );
        for (const l of allListings) fullListingMap[l.id] = l;
      }

      const appVisibleIds = new Set(
        allListingIds.filter(id => fullListingMap[id] && fullListingMap[id].title)
      );

      const emailedSet = new Set(emailedIdList);

      function buildEntry(listingId: string, matchRow: any) {
        const l = fullListingMap[listingId];
        return {
          listing_id: listingId,
          title: l?.title || null,
          city: l?.city || null,
          price: l?.price || null,
          source: l?.source || null,
          url: l?.url || null,
          matched_at: matchRow?.matched_at || null,
          search_profile_id: matchRow?.search_profile_id || null,
        };
      }

      const appVisible = [...appVisibleIds].slice(0, 30).map(id =>
        buildEntry(id, dedupedByListing[id])
      );

      const recentEmailedEntries = emailedIdList.slice(0, 30).map(id =>
        buildEntry(id, dedupedByListing[id])
      );

      const emailedButNotVisible = emailedIdList
        .filter(id => !appVisibleIds.has(id))
        .slice(0, 20)
        .map(id => {
          const matchRow = dedupedByListing[id];
          const l = fullListingMap[id];
          let reason = "unknown";
          if (!l) reason = "listing_deleted";
          else if (!l.title) reason = "null_title";
          else if (!matchRow) reason = "no_match_after_dedup";
          else if (premiumStartedAt && new Date(matchRow.matched_at).getTime() < new Date(premiumStartedAt).getTime())
            reason = "before_premium_start";
          return { ...buildEntry(id, matchRow), exclusion_reason: reason };
        });

      return res.json({
        user_id: targetUserId,
        subscription: { status: subRow?.status || null, created_at: premiumStartedAt },
        total_match_rows: matchRows.length,
        unique_after_dedup: prePremiumCount,
        after_premium_filter: uniqueMatches.length,
        app_visible_count: appVisibleIds.size,
        recent_emailed_count: emailedIdList.length,
        emailed_at: recentEmailed?.timestamp ? new Date(recentEmailed.timestamp).toISOString() : null,
        mismatch_count: emailedButNotVisible.length,
        app_visible: appVisible,
        recent_emailed: recentEmailedEntries,
        emailed_but_not_visible: emailedButNotVisible,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/summary", requireAdmin, async (_req, res) => {
    try {
      const runs = await getRecentRuns(20);
      const status = getLastRunStatus();
      const nextRun = getNextRun();
      res.json({
        running: status.running,
        lastRunAt: status.lastRunAt,
        lastSuccessfulRunAt: status.lastSuccessfulRunAt,
        lastError: status.lastError,
        nextRunAt: nextRun.nextRunAt,
        intervalMinutes: nextRun.intervalMinutes,
        todayFetched: status.todayFetched,
        todayInserted: status.todayInserted,
        runs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/cities", requireAdmin, async (_req, res) => {
    try {
      const cities = await getLatestRunCities();
      res.json({ cities });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/sources", requireAdmin, async (_req, res) => {
    try {
      const sources = await getSourceAggregates();
      const statuses = getSourceStatuses();
      res.json({ sources, statuses });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ingestion/run/:id", requireAdmin, async (req, res) => {
    try {
      const run = await getRunDetail(parseInt(req.params.id, 10));
      if (!run) return res.status(404).json({ error: "Run not found" });
      res.json(run);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/listing-status", requireAdmin, async (_req, res) => {
    try {
      const { getStatusSummary } = await import("./listing-status");
      const summary = await getStatusSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/listing-status/refresh", requireAdmin, async (_req, res) => {
    try {
      const { updateStalenessStatuses } = await import("./listing-status");
      const result = await updateStalenessStatuses();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/listing-status/:listingId", requireAdmin, async (req, res) => {
    try {
      const { getListingStatus } = await import("./listing-status");
      const status = await getListingStatus(req.params.listingId);
      res.json({ listing_id: req.params.listingId, status: status ?? "unknown" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/match-audit", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const { data: profiles } = await supabase
        .from("search_profiles")
        .select("id, city, city_name, price_min, price_max, bedrooms_min, size_min")
        .eq("user_id", userId);

      const stats = await getUserMatchStats(userId);
      const recentMatches = await getRecentUserMatches(userId, 100);
      const fetchRuns = await getRecentFetchRuns(20);

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("status, plan, created_at, current_period_end, trial_end")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: userData } = await supabase.auth.admin.getUserById(userId);

      const { data: notifSettings } = await supabase
        .from("user_notification_settings")
        .select("email_enabled, push_enabled, whatsapp_enabled, sms_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      let lastEmailSentAt: string | null = null;
      let lastPushSentAt: string | null = null;
      if (recentMatches.length > 0) {
        const emailSent = recentMatches.filter(m => m.email_sent && m.email_sent_at);
        if (emailSent.length > 0) {
          lastEmailSentAt = emailSent.sort((a, b) =>
            new Date(b.email_sent_at!).getTime() - new Date(a.email_sent_at!).getTime()
          )[0].email_sent_at;
        }
        const pushSent = recentMatches.filter(m => m.push_sent && m.push_sent_at);
        if (pushSent.length > 0) {
          lastPushSentAt = pushSent.sort((a, b) =>
            new Date(b.push_sent_at!).getTime() - new Date(a.push_sent_at!).getTime()
          )[0].push_sent_at;
        }
      }

      const lastFetchRun = fetchRuns.length > 0 ? fetchRuns[0] : null;

      res.json({
        account: {
          user_id: userId,
          email: userData?.user?.email || "unknown",
          created_at: userData?.user?.created_at,
        },
        subscription: subRow || null,
        notification_settings: notifSettings || { email_enabled: true, push_enabled: false },
        search_profiles: {
          count: profiles?.length || 0,
          profiles: profiles || [],
        },
        stats: stats || { total: 0, new_count: 0, viewed: 0, saved: 0, applied: 0, email_sent: 0, push_sent: 0 },
        timing: {
          last_fetch_run_at: lastFetchRun?.started_at || null,
          last_email_sent_at: lastEmailSentAt,
          last_push_sent_at: lastPushSentAt,
        },
        recent_matches: recentMatches.slice(0, 50),
        fetch_runs: fetchRuns.slice(0, 10),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/match-audit/backfill", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_id, listing_id, search_profile_id, created_at")
        .eq("user_id", userId)
        .gte("created_at", ninetyDaysAgo);

      if (!matchRows || matchRows.length === 0) {
        return res.json({ backfilled: 0, message: "No matches to backfill" });
      }

      const listingIds = [...new Set(matchRows.map(m => m.listing_id))];
      const listingsData = await batchedIn<any>(
        "listings", "id", listingIds,
        "id, title, city, price, source, url, source_id",
        (q: any) => q
      );
      const listingMap: Record<string, any> = {};
      for (const l of listingsData) listingMap[l.id] = l;

      const { data: pushLogs } = await supabase
        .from("push_sent_log")
        .select("listing_id")
        .eq("user_id", userId);
      const pushSentMap: Record<string, Set<string>> = {};
      pushSentMap[userId] = new Set((pushLogs || []).map((r: any) => r.listing_id));

      const count = await backfillFromSupabaseMatches(matchRows, listingMap, pushSentMap);

      res.json({ backfilled: count, total_supabase_matches: matchRows.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/match-audit/recalculate", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const userId = (req.query.user_id as string) || adminUser.id;

      const stats = await getUserMatchStats(userId);
      res.json({ recalculated: true, stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/debug/email-pipeline", requireAdmin, async (_req, res) => {
    try {
      const { getBufferSize } = await import("./notifications/buffer");
      const { getUndeliveredMatches } = await import("./user-matches");

      const bufSize = getBufferSize();
      const undelivered = await getUndeliveredMatches(24);

      const byUser = new Map<string, { count: number; oldest: string | null }>();
      for (const m of undelivered) {
        const existing = byUser.get(m.user_id);
        if (existing) {
          existing.count++;
          if (m.matched_at && (!existing.oldest || m.matched_at < existing.oldest)) {
            existing.oldest = m.matched_at;
          }
        } else {
          byUser.set(m.user_id, { count: 1, oldest: m.matched_at || null });
        }
      }

      const perUserStats = await pgPool.query(`
        SELECT user_id,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE email_sent) as emailed,
          COUNT(*) FILTER (WHERE push_sent) as pushed,
          COUNT(*) FILTER (WHERE NOT email_sent AND NOT push_sent AND visible_in_app AND NOT dismissed) as pending
        FROM user_matches
        GROUP BY user_id
      `);

      res.json({
        alerts_enabled: process.env.ALERTS_ENABLED === "true",
        buffer: bufSize,
        undelivered_24h: {
          total: undelivered.length,
          users: byUser.size,
          per_user: Object.fromEntries(byUser),
        },
        per_user_delivery: perUserStats.rows.map((r: any) => ({
          user_id: r.user_id.substring(0, 8),
          total: Number(r.total),
          emailed: Number(r.emailed),
          pushed: Number(r.pushed),
          pending: Number(r.pending),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

  const _placesRateMap = new Map<string, { count: number; resetAt: number }>();
  const PLACES_RATE_LIMIT = 30;
  const PLACES_RATE_WINDOW = 60_000;

  function checkPlacesRate(ip: string): boolean {
    const now = Date.now();
    const entry = _placesRateMap.get(ip);
    if (!entry || now > entry.resetAt) {
      _placesRateMap.set(ip, { count: 1, resetAt: now + PLACES_RATE_WINDOW });
      return true;
    }
    if (entry.count >= PLACES_RATE_LIMIT) return false;
    entry.count++;
    return true;
  }

  app.get("/api/places/autocomplete", async (req, res) => {
    const input = (req.query.input as string || "").trim();
    const sessionToken = req.query.session_token as string || "";

    if (!input || input.length < 2) {
      return res.json({ suggestions: [] });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkPlacesRate(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded", suggestions: [] });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(503).json({ error: "Google Places not configured", suggestions: [] });
    }

    try {
      const body = {
        input,
        includedRegionCodes: ["de"],
        includedPrimaryTypes: ["locality", "sublocality", "administrative_area_level_3"],
        languageCode: "de",
        sessionToken: sessionToken || undefined,
      };

      const gRes = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => "");
        log(`[google-places] Autocomplete error ${gRes.status}: ${errText}`);
        return res.status(502).json({ error: "Places API error", suggestions: [] });
      }

      const data = await gRes.json();
      const suggestions = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .slice(0, 8)
        .map((s: any) => {
          const p = s.placePrediction;
          const mainText = p.structuredFormat?.mainText?.text || "";
          const secondaryText = p.structuredFormat?.secondaryText?.text || "";
          return {
            place_id: p.placeId || "",
            display_name: p.text?.text || mainText,
            city_name: mainText,
            state: secondaryText,
            country_code: "DE",
          };
        });

      res.json({ suggestions });
    } catch (err: any) {
      log(`[google-places] Autocomplete fetch error: ${err.message}`);
      res.status(500).json({ error: "Internal error", suggestions: [] });
    }
  });

  app.get("/api/places/details", async (req, res) => {
    const placeId = (req.query.place_id as string || "").trim();
    const sessionToken = req.query.session_token as string || "";

    if (!placeId) {
      return res.status(400).json({ error: "place_id required" });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkPlacesRate(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(503).json({ error: "Google Places not configured" });
    }

    try {
      const fields = "id,displayName,formattedAddress,location,addressComponents";
      const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=de`;

      const gRes = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": fields,
          ...(sessionToken ? { "X-Goog-Session-Token": sessionToken } : {}),
        },
      });

      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => "");
        log(`[google-places] Details error ${gRes.status}: ${errText}`);
        return res.status(502).json({ error: "Places API error" });
      }

      const data = await gRes.json();
      const loc = data.location || {};
      const components = data.addressComponents || [];

      let cityName = data.displayName?.text || "";
      let state = "";
      for (const comp of components) {
        const types: string[] = comp.types || [];
        if (types.includes("locality")) {
          cityName = comp.longText || cityName;
        }
        if (types.includes("administrative_area_level_1")) {
          state = comp.longText || "";
        }
      }

      res.json({
        place: {
          place_id: placeId,
          display_name: data.displayName?.text || cityName,
          city_name: cityName,
          state,
          country_code: "DE",
          latitude: loc.latitude ?? null,
          longitude: loc.longitude ?? null,
        },
      });
    } catch (err: any) {
      log(`[google-places] Details fetch error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/places/normalize", (req, res) => {
    const city = (req.query.city as string || "").trim();
    if (!city) {
      return res.status(400).json({ error: "city required" });
    }

    try {
      const result = normalizeCity(city);
      res.json(result);
    } catch (err: any) {
      log(`[city-normalize] Error: ${err.message}`);
      res.status(500).json({ error: "Normalization error" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const { event, metadata } = req.body || {};
      if (!event || typeof event !== "string") {
        return res.status(400).json({ error: "event name required" });
      }

      await trackActivationEvent(user.id, event, metadata || {});
      res.json({ ok: true });
    } catch (err: any) {
      log(`[events] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/activation-status", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const [profilesResult, notifResult, matchResult, appliedResult, totalMatchResult, subResult, eventStatus] = await Promise.all([
        supabase.from("search_profiles").select("id, created_at").eq("user_id", user.id).limit(1),
        supabase.from("user_notification_settings").select("email_enabled, push_enabled").eq("user_id", user.id).maybeSingle(),
        pgPool.query("SELECT 1 FROM user_matches WHERE user_id = $1 AND viewed = true LIMIT 1", [user.id]),
        pgPool.query("SELECT 1 FROM user_matches WHERE user_id = $1 AND applied = true LIMIT 1", [user.id]),
        pgPool.query("SELECT COUNT(*) as c FROM user_matches WHERE user_id = $1", [user.id]),
        supabase.from("subscriptions").select("status, trial_ends_at").eq("user_id", user.id).maybeSingle(),
        getUserActivationStatus(user.id),
      ]);

      const profileCreated = (profilesResult.data?.length ?? 0) > 0;
      const profileCreatedAt = profilesResult.data?.[0]?.created_at || null;
      const notifEnabled = !!(notifResult.data?.email_enabled || notifResult.data?.push_enabled);
      const firstMatchViewed = matchResult.rows.length > 0 || eventStatus.firstMatchViewed;
      const firstReaction = appliedResult.rows.length > 0 || eventStatus.firstReaction;
      const totalMatches = parseInt(totalMatchResult.rows[0]?.c || "0");
      const subData = subResult.data;
      const trialStarted = !!subData?.trial_ends_at || eventStatus.trialStarted;
      const subscriptionStarted = subData?.status === "active" || eventStatus.subscriptionStarted;

      res.json({
        profileCreated,
        profileCreatedAt,
        notificationsEnabled: notifEnabled,
        firstMatchViewed,
        firstReaction,
        trialStarted,
        subscriptionStarted,
        totalMatches,
      });
    } catch (err: any) {
      log(`[activation] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/admin/activation-funnel", requireAdmin, async (_req, res) => {
    try {
      const [eventFunnel, totalUsersResult, withProfileResult, withNotifsResult, withMatchResult, withReactionResult, trialResult, activeSubResult] = await Promise.all([
        getActivationFunnel(),
        supabase.rpc("count_auth_users").then(r => r.data ?? null).catch(() => null),
        supabase.from("search_profiles").select("user_id").then(r => new Set((r.data ?? []).map((d: any) => d.user_id)).size),
        supabase.from("user_notification_settings").select("user_id").or("email_enabled.eq.true,push_enabled.eq.true").then(r => (r.data ?? []).length),
        pgPool.query("SELECT COUNT(DISTINCT user_id) as c FROM user_matches WHERE viewed = true").then(r => parseInt(r.rows[0]?.c || "0")),
        pgPool.query("SELECT COUNT(DISTINCT user_id) as c FROM user_matches WHERE applied = true").then(r => parseInt(r.rows[0]?.c || "0")),
        supabase.from("subscriptions").select("user_id").not("trial_ends_at", "is", null).then(r => (r.data ?? []).length),
        supabase.from("subscriptions").select("user_id").eq("status", "active").then(r => (r.data ?? []).length),
      ]);

      res.json({
        ...eventFunnel,
        sourceOfTruth: {
          totalAuthUsers: totalUsersResult,
          withSearchProfile: withProfileResult,
          withNotifications: withNotifsResult,
          withMatchViewed: withMatchResult,
          withReaction: withReactionResult,
          withTrial: trialResult,
          withActiveSubscription: activeSubResult,
        },
      });
    } catch (err: any) {
      log(`[admin] Activation funnel error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/cancellation-feedback", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Unauthorized" });

      const { reasonType, reasonText } = req.body;
      if (!reasonType || !["found_via_housalert", "found_not_via_housalert", "not_found", "other"].includes(reasonType)) {
        return res.status(400).json({ error: "Invalid reason type" });
      }

      const foundHome = reasonType === "found_via_housalert" ? true
        : reasonType === "found_not_via_housalert" ? true
        : reasonType === "not_found" ? false
        : null;

      await saveCancellationFeedback(user.id, reasonType, reasonText || null, foundHome);
      res.json({ ok: true });
    } catch (err: any) {
      log(`[cancellation] Error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/admin/cancellation-stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await getCancellationStats();
      res.json(stats);
    } catch (err: any) {
      log(`[admin] Cancellation stats error: ${err.message}`);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // =============================================
  // ADMIN PORTAL API
  // =============================================

  app.get("/api/admin/portal/overview", requireAdmin, async (_req, res) => {
    try {
      log(`[admin-portal] Overview request received`);
      const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let totalUsers = 0;
      let activeSubscriptions = 0;
      let trialUsers = 0;
      let allSubs: any[] = [];
      let activeProfiles = 0;
      let listingsToday = 0;
      let matchesToday = 0;
      let listingsWeekVal = 0;
      let matchesWeekVal = 0;
      let signupsTodayVal = 0;
      let signupsWeekVal = 0;
      let emailsTodayVal = 0;
      let pushesTodayVal = 0;
      let sourceHealth: any[] = [];

      try {
        const adminSb = getSupabaseAdmin();
        const { data: allAuthData } = await adminSb.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const allAuthUsers = allAuthData?.users || [];
        totalUsers = allAuthUsers.length;
        const todayDate = new Date(todayStart);
        const weekDate = new Date(weekAgo);
        signupsTodayVal = allAuthUsers.filter((u: any) => new Date(u.created_at) >= todayDate).length;
        signupsWeekVal = allAuthUsers.filter((u: any) => new Date(u.created_at) >= weekDate).length;
        log(`[admin-portal] Overview: auth users OK (total=${totalUsers}, today=${signupsTodayVal}, week=${signupsWeekVal})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: auth.admin.listUsers failed: ${e.message} — falling back to PG`);
        try {
          const pgTotal = await pgPool.query("SELECT COUNT(*) FROM user_profile_data");
          totalUsers = parseInt(pgTotal.rows[0]?.count || "0");
          const signupsTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_profile_data WHERE created_at >= $1", [todayStart]);
          const signupsWeekRes = await pgPool.query("SELECT COUNT(*) FROM user_profile_data WHERE created_at >= $1", [weekAgo]);
          signupsTodayVal = parseInt(signupsTodayRes.rows[0]?.count || "0");
          signupsWeekVal = parseInt(signupsWeekRes.rows[0]?.count || "0");
        } catch (pgErr: any) {
          log(`[admin-portal] Overview: PG signup fallback also failed: ${pgErr.message}`);
        }
      }

      try {
        const [activeSubsRes, trialSubsRes, allSubsRes] = await Promise.all([
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
          supabase.from("subscriptions").select("user_id, status, plan, trial_ends_at, current_period_ends_at"),
        ]);
        activeSubscriptions = activeSubsRes.count ?? 0;
        trialUsers = trialSubsRes.count ?? 0;
        allSubs = allSubsRes.data || [];
        log(`[admin-portal] Overview: subscriptions OK (active=${activeSubscriptions}, trial=${trialUsers}, total=${allSubs.length})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: subscriptions query failed: ${e.message}`);
      }

      try {
        const [profilesRes, listingsTodayRes, matchesTodayRes, listingsWeekRes, matchesWeekRes] = await Promise.all([
          supabase.from("search_profiles").select("id", { count: "exact", head: true }),
          supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
          supabase.from("matches").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
          supabase.from("listings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
          supabase.from("matches").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        ]);
        activeProfiles = profilesRes.count ?? 0;
        listingsToday = listingsTodayRes.count ?? 0;
        matchesToday = matchesTodayRes.count ?? 0;
        listingsWeekVal = listingsWeekRes.count ?? 0;
        matchesWeekVal = matchesWeekRes.count ?? 0;
        log(`[admin-portal] Overview: listings/matches OK (profiles=${activeProfiles}, listingsToday=${listingsToday}, matchesToday=${matchesToday})`);
      } catch (e: any) {
        log(`[admin-portal] Overview: listings/matches query failed: ${e.message}`);
      }

      let emailsSkippedNoSubVal = 0;
      let emailRealFailuresVal = 0;
      try {
        const eRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND matched_at >= $1", [todayStart]);
        emailsTodayVal = parseInt(eRes.rows[0]?.count || "0");

        const now = new Date();
        const activeSubUserIds = new Set<string>();
        for (const s of allSubs) {
          const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
          const isActive = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
          const isPastDue = s.status === "past_due";
          const canceledActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
          if (isTrial || isActive || isPastDue || canceledActive) activeSubUserIds.add(s.user_id);
        }
        const unsent = await pgPool.query(
          `SELECT user_id, COUNT(*) as cnt FROM user_matches WHERE email_sent = false AND matched_at >= $1 AND visible_in_app = true GROUP BY user_id`,
          [todayStart]
        );
        for (const row of unsent.rows) {
          const cnt = parseInt(row.cnt);
          if (activeSubUserIds.has(row.user_id)) {
            emailRealFailuresVal += cnt;
          } else {
            emailsSkippedNoSubVal += cnt;
          }
        }
      } catch (e: any) {
        log(`[admin-portal] Overview: email count failed: ${e.message}`);
      }
      try {
        const pRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE push_sent = true AND matched_at >= $1", [todayStart]);
        pushesTodayVal = parseInt(pRes.rows[0]?.count || "0");
      } catch (e: any) {
        log(`[admin-portal] Overview: push count failed: ${e.message}`);
      }

      let mrr = 0;
      const pricingMap: Record<string, number> = { monthly: 14.99, two_month: 12.49, three_month: 9.99 };
      for (const sub of allSubs) {
        if (sub.status === "active") {
          mrr += pricingMap[sub.plan] || 14.99;
        }
      }

      try {
        const sourceHealthRes = await pgPool.query("SELECT source_reports FROM ingestion_runs ORDER BY started_at DESC LIMIT 1");
        sourceHealth = sourceHealthRes.rows[0]?.source_reports || [];
      } catch (e: any) {
        log(`[admin-portal] Overview: source health failed: ${e.message}`);
      }

      log(`[admin-portal] Overview: responding with data`);
      res.json({
        totalUsers,
        activeSubscriptions,
        trialUsers,
        signupsToday: signupsTodayVal,
        mrr: Math.round(mrr * 100) / 100,
        activeProfiles,
        listingsToday,
        matchesToday,
        emailsToday: emailsTodayVal,
        emailsSkippedNoSub: emailsSkippedNoSubVal,
        emailRealFailures: emailRealFailuresVal,
        pushesToday: pushesTodayVal,
        signupsWeek: signupsWeekVal,
        listingsWeek: listingsWeekVal,
        matchesWeek: matchesWeekVal,
        sourceHealth,
      });
    } catch (err: any) {
      log(`[admin-portal] Overview FATAL error: ${err.message}\n${err.stack}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/users", requireAdmin, async (req, res) => {
    try {
      const search = (req.query.search as string || "").trim().toLowerCase();
      const filter = req.query.filter as string || "all";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      const adminSb = getSupabaseAdmin();
      const { data: authData, error: authListErr } = await adminSb.auth.admin.listUsers({
        page,
        perPage: limit,
      });
      if (authListErr) throw authListErr;

      const authUsers = authData?.users || [];
      const totalUsers = (authData as any)?.total ?? authUsers.length;

      let filteredAuth = authUsers;
      if (search) {
        filteredAuth = authUsers.filter((u: any) => {
          const email = (u.email || "").toLowerCase();
          const meta = u.user_metadata || {};
          const fullName = `${meta.first_name || ""} ${meta.last_name || ""}`.toLowerCase();
          const uid = u.id.toLowerCase();
          return email.includes(search) || fullName.includes(search) || uid.includes(search);
        });
      }

      const userIds = filteredAuth.map((u: any) => u.id);
      if (userIds.length === 0) {
        return res.json({ users: [], total: search ? 0 : totalUsers, page, limit });
      }

      const [profilesRes, subsRes, profilesCountRes, matchCountRes, buddyOwnerRes, buddyBuddyRes] = await Promise.all([
        pgPool.query(`SELECT * FROM user_profile_data WHERE user_id = ANY($1::uuid[])`, [userIds]),
        supabase.from("subscriptions").select("user_id, status, plan, trial_ends_at, current_period_ends_at").in("user_id", userIds),
        supabase.from("search_profiles").select("user_id").in("user_id", userIds),
        pgPool.query(`SELECT user_id, COUNT(*) as cnt FROM user_matches WHERE user_id = ANY($1::uuid[]) GROUP BY user_id`, [userIds]),
        pgPool.query(`SELECT DISTINCT owner_user_id FROM search_profile_buddies WHERE owner_user_id = ANY($1::uuid[]) AND invite_status IN ('pending', 'accepted')`, [userIds]).catch(() => ({ rows: [] })),
        pgPool.query(`SELECT DISTINCT buddy_user_id FROM search_profile_buddies WHERE buddy_user_id = ANY($1::uuid[]) AND invite_status IN ('pending', 'accepted')`, [userIds]).catch(() => ({ rows: [] })),
      ]);

      const profileMap: Record<string, any> = {};
      for (const p of profilesRes.rows) profileMap[p.user_id] = p;

      const subsMap: Record<string, any> = {};
      for (const s of (subsRes.data || [])) subsMap[s.user_id] = s;

      const profileCountMap: Record<string, number> = {};
      for (const p of (profilesCountRes.data || [])) profileCountMap[p.user_id] = (profileCountMap[p.user_id] || 0) + 1;

      const matchCountMap: Record<string, number> = {};
      for (const m of matchCountRes.rows) matchCountMap[m.user_id] = parseInt(m.cnt);

      const ownerSet = new Set<string>();
      for (const r of buddyOwnerRes.rows) ownerSet.add(r.owner_user_id);
      const buddySet = new Set<string>();
      for (const r of buddyBuddyRes.rows) buddySet.add(r.buddy_user_id);

      let users = filteredAuth.map((authUser: any) => {
        const profile = profileMap[authUser.id];
        const meta = authUser.user_metadata || {};
        const isOwner = ownerSet.has(authUser.id) || (profileCountMap[authUser.id] || 0) > 0;
        const isBuddy = buddySet.has(authUser.id);
        const role = isOwner && isBuddy ? "both" : isOwner ? "owner" : isBuddy ? "buddy" : "user";
        return {
          user_id: authUser.id,
          first_name: profile?.first_name || meta.first_name || null,
          last_name: profile?.last_name || meta.last_name || null,
          email: authUser.email || null,
          language: profile?.language || null,
          profile_photo_url: profile?.profile_photo_url || null,
          created_at: profile?.created_at || authUser.created_at,
          has_profile_data: !!profile,
          subscription: subsMap[authUser.id] || null,
          searchProfileCount: profileCountMap[authUser.id] || 0,
          matchCount: matchCountMap[authUser.id] || 0,
          role,
        };
      });

      if (filter === "paid") users = users.filter((u: any) => u.subscription?.status === "active");
      else if (filter === "trial") users = users.filter((u: any) => u.subscription?.status === "trial");
      else if (filter === "canceled") users = users.filter((u: any) => u.subscription?.status === "canceled");
      else if (filter === "expired") users = users.filter((u: any) => u.subscription?.status === "expired");

      res.json({
        users,
        total: search ? filteredAuth.length : totalUsers,
        page,
        limit,
      });
    } catch (err: any) {
      log(`[admin-portal] Users error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/users/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const adminSb = getSupabaseAdmin();
      const [authUserRes, profileRes, subRes, searchProfilesRes, recentMatchesRes] = await Promise.all([
        adminSb.auth.admin.getUserById(userId),
        pgPool.query("SELECT * FROM user_profile_data WHERE user_id = $1", [userId]),
        supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("search_profiles").select("*").eq("user_id", userId),
        pgPool.query("SELECT * FROM user_matches WHERE user_id = $1 ORDER BY matched_at DESC LIMIT 20", [userId]),
      ]);

      let cancellationFeedback = null;
      try {
        const cfRes = await pgPool.query("SELECT * FROM cancellation_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]);
        cancellationFeedback = cfRes.rows[0] || null;
      } catch {}

      const notifsRes = await supabase.from("user_notification_settings").select("*").eq("user_id", userId).maybeSingle();

      let buddyConnections: { asOwner: any; asBuddy: any[] } = { asOwner: null, asBuddy: [] };
      let accountRole: "owner" | "buddy" | "both" | "none" = "none";
      try {
        const ownerRes = await pgPool.query(
          `SELECT spb.*, upd.first_name || ' ' || upd.last_name AS buddy_name
           FROM search_profile_buddies spb
           LEFT JOIN user_profile_data upd ON spb.buddy_user_id = upd.user_id
           WHERE spb.owner_user_id = $1 AND spb.invite_status IN ('pending', 'accepted')
           ORDER BY spb.created_at DESC LIMIT 1`, [userId]
        );
        const buddyRes = await pgPool.query(
          `SELECT spb.*, upd.first_name || ' ' || upd.last_name AS owner_name
           FROM search_profile_buddies spb
           LEFT JOIN user_profile_data upd ON spb.owner_user_id = upd.user_id
           WHERE spb.buddy_user_id = $1 AND spb.invite_status IN ('pending', 'accepted')
           ORDER BY spb.created_at DESC`, [userId]
        );
        buddyConnections.asOwner = ownerRes.rows[0] || null;
        buddyConnections.asBuddy = buddyRes.rows;
        const isOwner = !!buddyConnections.asOwner || (searchProfilesRes.data || []).length > 0;
        const isBuddy = buddyConnections.asBuddy.length > 0;
        accountRole = isOwner && isBuddy ? "both" : isOwner ? "owner" : isBuddy ? "buddy" : "none";
      } catch (e: any) {
        log(`[admin-portal] Buddy connections query failed: ${e.message}`);
      }

      let matchesLast24h = 0;
      let emailsSentLast24h = 0;
      try {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const m24 = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE user_id = $1 AND matched_at >= $2", [userId, dayAgo]);
        matchesLast24h = parseInt(m24.rows[0]?.count || "0");
        const e24 = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE user_id = $1 AND email_sent = true AND email_sent_at >= $2", [userId, dayAgo]);
        emailsSentLast24h = parseInt(e24.rows[0]?.count || "0");
      } catch {}

      const authUser = authUserRes.data?.user || null;
      let pgProfile = profileRes.rows[0] || null;
      const meta = authUser?.user_metadata || {};

      if (!pgProfile && authUser) {
        let firstName = meta.first_name || null;
        let lastName = meta.last_name || null;
        if (!firstName && meta.full_name) {
          const parts = (meta.full_name as string).trim().split(/\s+/);
          firstName = parts[0] || null;
          lastName = parts.slice(1).join(" ") || null;
        }
        if (!firstName) firstName = authUser.email?.split("@")[0] || null;
        try {
          const { rows: created } = await pgPool.query(
            `INSERT INTO user_profile_data (user_id, first_name, last_name, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE SET
               first_name = COALESCE(user_profile_data.first_name, EXCLUDED.first_name),
               last_name = COALESCE(user_profile_data.last_name, EXCLUDED.last_name),
               updated_at = NOW()
             RETURNING *`,
            [authUser.id, firstName, lastName]
          );
          pgProfile = created[0] || null;
          log(`[admin-portal] Auto-bootstrapped profile row for user=${authUser.id.substring(0, 8)}... name="${firstName} ${lastName}"`);
        } catch (bootstrapErr: any) {
          log(`[admin-portal] Auto-bootstrap failed for user=${authUser.id.substring(0, 8)}...: ${bootstrapErr.message}`);
        }
      }

      log(`[admin-portal] User detail userId=${userId.substring(0, 8)}... pgProfile=${!!pgProfile} authUser=${!!authUser} pgPhone=${pgProfile?.phone} pgOccupation=${pgProfile?.occupation} pgUpdatedAt=${pgProfile?.updated_at}`);

      const profile = pgProfile
        ? { ...pgProfile, email: authUser?.email || null }
        : authUser
          ? {
              user_id: authUser.id,
              first_name: meta.first_name || null,
              last_name: meta.last_name || null,
              email: authUser.email || null,
              created_at: authUser.created_at,
              has_profile_data: false,
            }
          : null;

      log(`[admin-portal] User detail response profile.phone=${profile?.phone} profile.occupation=${profile?.occupation} profile.first_name=${profile?.first_name}`);

      let subscription = subRes.data || null;
      if (subscription) {
        const now = new Date();
        const s = subscription as any;
        const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
        const isActiveStatus = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
        const isPastDue = s.status === "past_due";
        const canceledButActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
        const hasAccess = isTrial || isActiveStatus || isPastDue || canceledButActive;
        const computedStatus = hasAccess
          ? (isTrial ? "trial" : (isPastDue ? "past_due" : (canceledButActive ? "canceled" : "active")))
          : "expired";
        subscription = { ...s, computedStatus, hasAccess };
        log(`[admin-portal] User detail sub: DB status=${s.status}, computedStatus=${computedStatus}, hasAccess=${hasAccess}`);
      }

      const legacyBuddyEmail = pgProfile?.search_buddy_email || null;

      res.json({
        profile,
        subscription,
        searchProfiles: searchProfilesRes.data || [],
        recentMatches: recentMatchesRes.rows,
        cancellationFeedback,
        notificationSettings: notifsRes.data || null,
        diagnostics: {
          accountRole,
          buddyConnections,
          matchesLast24h,
          emailsSentLast24h,
          searchProfileCount: (searchProfilesRes.data || []).length,
          legacyBuddyEmail,
        },
      });
    } catch (err: any) {
      log(`[admin-portal] User detail error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/subscriptions", requireAdmin, async (req, res) => {
    try {
      const filter = req.query.filter as string || "all";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      let query = supabase.from("subscriptions").select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      for (const s of (data || [])) statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      log(`[admin-portal] Subscriptions query: total=${count}, returned=${(data || []).length}, filter=${filter}, statuses=${JSON.stringify(statusCounts)}`);

      const userIds = (data || []).map((s: any) => s.user_id).filter(Boolean);
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const usersRes = await pgPool.query(
            `SELECT user_id, first_name, last_name FROM user_profile_data WHERE user_id = ANY($1::uuid[])`,
            [userIds]
          );
          for (const u of usersRes.rows) userMap[u.user_id] = u;
        } catch (pgErr: any) {
          log(`[admin-portal] Subscriptions user enrichment failed (non-fatal): ${pgErr.message}`);
        }
      }

      const now = new Date();
      const enriched = (data || []).map((s: any) => {
        const profile = userMap[s.user_id];
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
          : "Unknown";

        const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
        const isActiveStatus = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
        const isPastDue = s.status === "past_due";
        const canceledButActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
        const hasAccess = isTrial || isActiveStatus || isPastDue || canceledButActive;

        const computedStatus = hasAccess
          ? (isTrial ? "trial" : (isPastDue ? "past_due" : (canceledButActive ? "canceled" : "active")))
          : "expired";

        return { ...s, userName, computedStatus, hasAccess };
      });

      log(`[admin-portal] Subscriptions: returning ${enriched.length} rows, computed statuses: ${JSON.stringify(enriched.reduce((acc: Record<string, number>, s: any) => { acc[s.computedStatus] = (acc[s.computedStatus] || 0) + 1; return acc; }, {}))}`);
      res.json({ subscriptions: enriched, total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Subscriptions error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/search-profiles", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      const { data, count, error } = await supabase.from("search_profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      const userIds = (data || []).map((p: any) => p.user_id).filter(Boolean);
      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const usersRes = await pgPool.query(
            `SELECT user_id, first_name, last_name FROM user_profile_data WHERE user_id = ANY($1::uuid[])`,
            [userIds]
          );
          for (const u of usersRes.rows) userMap[u.user_id] = u;
        } catch (pgErr: any) {
          log(`[admin-portal] Search profiles user enrichment failed (non-fatal): ${pgErr.message}`);
        }
      }

      const enriched = (data || []).map((p: any) => {
        const profile = userMap[p.user_id];
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
          : "Unknown";
        return { ...p, userName };
      });

      res.json({ profiles: enriched, total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Search profiles error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/listings", requireAdmin, async (req, res) => {
    try {
      const source = req.query.source as string || "";
      const city = req.query.city as string || "";
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);

      let query = supabase.from("listings")
        .select("id, title, source, city, price, size_m2, bedrooms, url, created_at, featured, hidden_from_feed, image_url", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (source) query = query.eq("source", source);
      if (city) query = query.ilike("city", `%${city}%`);

      const { data, count, error } = await query;
      if (error) throw error;

      res.json({ listings: data || [], total: count ?? 0, page, limit });
    } catch (err: any) {
      log(`[admin-portal] Listings error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/dynamic-cities", requireAdmin, async (_req, res) => {
    try {
      const cities = await getDynamicCitiesReport(supabase);
      res.json({ cities });
    } catch (err: any) {
      log(`[admin-portal] Dynamic cities error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/sources", requireAdmin, async (_req, res) => {
    try {
      const runsRes = await pgPool.query(
        "SELECT source_reports, started_at, finished_at, duration_sec, status FROM ingestion_runs ORDER BY started_at DESC LIMIT 5"
      );

      const latestRun = runsRes.rows[0] || null;
      const sources = latestRun?.source_reports || [];

      res.json({ sources, latestRun: latestRun ? { started_at: latestRun.started_at, finished_at: latestRun.finished_at, duration_sec: latestRun.duration_sec, status: latestRun.status } : null });
    } catch (err: any) {
      log(`[admin-portal] Sources error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/matches", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1");
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
      const offset = (page - 1) * limit;
      const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

      const matchesRes = await pgPool.query(
        `SELECT um.*, upd.first_name, upd.last_name
         FROM user_matches um
         LEFT JOIN user_profile_data upd ON um.user_id = upd.user_id
         ORDER BY um.matched_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const countRes = await pgPool.query("SELECT COUNT(*) FROM user_matches");
      const emailsTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND matched_at >= $1", [todayStart]);
      const pushesTodayRes = await pgPool.query("SELECT COUNT(*) FROM user_matches WHERE push_sent = true AND matched_at >= $1", [todayStart]);

      let failuresWeek = 0;
      try {
        const failRes = await supabase.from("push_delivery_log").select("id", { count: "exact", head: true }).eq("status", "error").gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        failuresWeek = failRes.count ?? 0;
      } catch {}

      let emailFailuresWeek = 0;
      let emailSkippedNoSubWeek = 0;
      try {
        const now = new Date();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const unsentRes = await pgPool.query(
          `SELECT user_id, COUNT(*) as cnt FROM user_matches WHERE email_sent = false AND matched_at >= $1 AND visible_in_app = true GROUP BY user_id`,
          [weekAgo]
        );
        const subRes = await supabase.from("subscriptions").select("user_id, status, trial_ends_at, current_period_ends_at");
        const activeIds = new Set<string>();
        for (const s of (subRes.data || [])) {
          const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
          const isActive = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
          const canceledActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
          if (isTrial || isActive || canceledActive) activeIds.add(s.user_id);
        }
        for (const row of unsentRes.rows) {
          const cnt = parseInt(row.cnt);
          if (activeIds.has(row.user_id)) emailFailuresWeek += cnt;
          else emailSkippedNoSubWeek += cnt;
        }
      } catch {}

      res.json({
        matches: matchesRes.rows,
        total: parseInt(countRes.rows[0]?.count || "0"),
        page,
        limit,
        stats: {
          emailsToday: parseInt(emailsTodayRes.rows[0]?.count || "0"),
          pushesToday: parseInt(pushesTodayRes.rows[0]?.count || "0"),
          failuresWeek,
          emailFailuresWeek,
          emailSkippedNoSubWeek,
        },
      });
    } catch (err: any) {
      log(`[admin-portal] Matches error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/growth", requireAdmin, async (_req, res) => {
    try {
      const funnelSteps = [
        { key: "landing_viewed", label: "Landing Viewed" },
        { key: "account_created", label: "Signup Started" },
        { key: "profile_created", label: "Search Created" },
        { key: "pricing_viewed", label: "Pricing Viewed" },
        { key: "checkout_started", label: "Checkout Started" },
        { key: "subscription_started", label: "Subscription Started" },
        { key: "first_match_received", label: "First Match Received" },
        { key: "listing_opened", label: "First Listing Viewed" },
        { key: "first_reaction", label: "First Reaction Sent" },
      ];

      const funnelCountsResult = await pgPool.query(
        `SELECT event_name, COUNT(DISTINCT user_id) AS cnt
         FROM activation_events
         WHERE event_name = ANY($1)
         GROUP BY event_name`,
        [funnelSteps.map(s => s.key)]
      );
      const countMap: Record<string, number> = {};
      for (const row of funnelCountsResult.rows) {
        countMap[row.event_name] = parseInt(row.cnt, 10);
      }

      let effectiveStartIndex = 0;
      if ((countMap["landing_viewed"] || 0) === 0 && (countMap["account_created"] || 0) > 0) {
        effectiveStartIndex = 1;
      }

      const activeFunnelSteps = funnelSteps.slice(effectiveStartIndex);

      const funnel = activeFunnelSteps.map((step, i) => {
        const count = countMap[step.key] || 0;
        const prevCount = i > 0 ? (countMap[activeFunnelSteps[i - 1].key] || 0) : 0;
        const conversionPct = i === 0 ? 100 : (prevCount > 0 ? Math.min(100, Math.round((count / prevCount) * 100)) : 0);
        return { ...step, count, conversionPct, prevLabel: i > 0 ? activeFunnelSteps[i - 1].label : null };
      });

      const totalUsersResult = await pgPool.query(`SELECT COUNT(*) AS cnt FROM user_profile_data`);
      const totalUsers = parseInt(totalUsersResult.rows[0]?.cnt || "0", 10);

      const usersWithMatchResult = await pgPool.query(`SELECT COUNT(DISTINCT user_id) AS cnt FROM user_matches`);
      const usersWithMatch = parseInt(usersWithMatchResult.rows[0]?.cnt || "0", 10);

      const listingViewersResult = await pgPool.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'listing_opened'`
      );
      const listingViewers = parseInt(listingViewersResult.rows[0]?.cnt || "0", 10);

      const reactorsResult = await pgPool.query(
        `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'first_reaction'`
      );
      const reactors = parseInt(reactorsResult.rows[0]?.cnt || "0", 10);

      let trialUsers = 0;
      let paidUsers = 0;
      try {
        const { data: subs } = await supabase.from("subscriptions").select("status");
        if (subs) {
          for (const s of subs) {
            if (s.status === "trialing") trialUsers++;
            if (s.status === "active") paidUsers++;
          }
        }
      } catch {}

      const activationRate = totalUsers > 0 ? Math.min(100, Math.round((usersWithMatch / totalUsers) * 100)) : 0;
      const listingViewRate = usersWithMatch > 0 ? Math.min(100, Math.round((listingViewers / usersWithMatch) * 100)) : 0;
      const reactionRate = listingViewers > 0 ? Math.min(100, Math.round((reactors / listingViewers) * 100)) : 0;
      const trialToPaid = trialUsers > 0 ? Math.min(100, Math.round((paidUsers / trialUsers) * 100)) : 0;

      const metrics = { activationRate, listingViewRate, reactionRate, trialToPaid, totalUsers, usersWithMatch, listingViewers, reactors, paidUsers, trialUsers };

      let cityPerformance: any[] = [];
      try {
        const cityResult = await pgPool.query(
          `SELECT
             COALESCE(e.city, 'Unknown') AS city,
             COUNT(DISTINCT e.user_id) AS users,
             0 AS search_profiles,
             0 AS matches,
             0 AS listing_views,
             0 AS reactions
           FROM (
             SELECT user_id, (metadata->>'city') AS city
             FROM activation_events
             WHERE metadata->>'city' IS NOT NULL AND metadata->>'city' != ''
           ) e
           GROUP BY e.city
           ORDER BY users DESC
           LIMIT 20`
        );
        cityPerformance = cityResult.rows;

        for (const row of cityPerformance) {
          const cityLower = row.city.toLowerCase();
          try {
            const { count: spCount } = await supabase
              .from("search_profiles")
              .select("*", { count: "exact", head: true })
              .ilike("city", `%${cityLower}%`);
            row.search_profiles = spCount || 0;
          } catch {}

          try {
            const matchResult = await pgPool.query(
              `SELECT COUNT(*) AS cnt FROM user_matches WHERE LOWER(city) = $1`, [cityLower]
            );
            row.matches = parseInt(matchResult.rows[0]?.cnt || "0", 10);
          } catch {}

          try {
            const viewResult = await pgPool.query(
              `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'listing_opened' AND LOWER(metadata->>'city') = $1`, [cityLower]
            );
            row.listing_views = parseInt(viewResult.rows[0]?.cnt || "0", 10);
          } catch {}

          try {
            const reactResult = await pgPool.query(
              `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events WHERE event_name = 'first_reaction' AND LOWER(metadata->>'city') = $1`, [cityLower]
            );
            row.reactions = parseInt(reactResult.rows[0]?.cnt || "0", 10);
          } catch {}
        }
      } catch (err: any) {
        log(`[admin-portal] City performance query error: ${err.message}`);
      }

      res.json({ funnel, metrics, cityPerformance });
    } catch (err: any) {
      log(`[admin-portal] Growth data error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/retention", requireAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const cancel7Res = await pgPool.query(
        `SELECT COUNT(*) AS cnt FROM cancellation_feedback WHERE created_at >= $1`, [d7]
      );
      const cancel30Res = await pgPool.query(
        `SELECT COUNT(*) AS cnt FROM cancellation_feedback WHERE created_at >= $1`, [d30]
      );
      const cancellations7d = parseInt(cancel7Res.rows[0]?.cnt || "0", 10);
      const cancellations30d = parseInt(cancel30Res.rows[0]?.cnt || "0", 10);

      const avgDaysRes = await pgPool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (cf.created_at - upd.created_at)) / 86400)::int AS avg_days
         FROM cancellation_feedback cf
         JOIN user_profile_data upd ON cf.user_id = upd.user_id
         WHERE upd.created_at IS NOT NULL`
      );
      const avgDaysBeforeCancel = parseInt(avgDaysRes.rows[0]?.avg_days || "0", 10);

      const cancelBeforeMatchRes = await pgPool.query(
        `SELECT COUNT(DISTINCT cf.user_id) AS cnt
         FROM cancellation_feedback cf
         LEFT JOIN user_matches um ON cf.user_id = um.user_id
         WHERE um.user_id IS NULL`
      );
      const cancelBeforeMatch = parseInt(cancelBeforeMatchRes.rows[0]?.cnt || "0", 10);

      const cancelAfterMatchRes = await pgPool.query(
        `SELECT COUNT(DISTINCT cf.user_id) AS cnt
         FROM cancellation_feedback cf
         INNER JOIN user_matches um ON cf.user_id = um.user_id`
      );
      const cancelAfterMatch = parseInt(cancelAfterMatchRes.rows[0]?.cnt || "0", 10);

      const detailRes = await pgPool.query(
        `SELECT cf.user_id, cf.reason_type, cf.reason_text, cf.created_at,
                upd.first_name, upd.last_name,
                EXTRACT(EPOCH FROM (cf.created_at - upd.created_at))::int / 86400 AS days_active,
                (SELECT COUNT(*) FROM user_matches um WHERE um.user_id = cf.user_id) AS match_count
         FROM cancellation_feedback cf
         LEFT JOIN user_profile_data upd ON cf.user_id = upd.user_id
         ORDER BY cf.created_at DESC
         LIMIT 50`
      );

      const cancellations = detailRes.rows.map((r: any) => {
        let city = "—";
        let plan = "—";
        return {
          userId: r.user_id,
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.user_id?.substring(0, 12),
          city,
          plan,
          daysActive: r.days_active ?? 0,
          matchCount: parseInt(r.match_count || "0", 10),
          reason: r.reason_type,
          reasonText: r.reason_text,
          cancelledAt: r.created_at,
        };
      });

      for (const c of cancellations) {
        try {
          const { data: sp } = await supabase.from("search_profiles").select("city").eq("user_id", c.userId).limit(1).maybeSingle();
          if (sp?.city) c.city = sp.city;
        } catch {}
        try {
          const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", c.userId).maybeSingle();
          if (sub?.plan) c.plan = sub.plan;
        } catch {}
      }

      res.json({
        cancellations7d,
        cancellations30d,
        avgDaysBeforeCancel,
        cancelBeforeMatch,
        cancelAfterMatch,
        cancellations,
      });
    } catch (err: any) {
      log(`[admin-portal] Retention error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/source-performance", requireAdmin, async (_req, res) => {
    try {
      const runRes = await pgPool.query(
        `SELECT source_reports FROM ingestion_runs ORDER BY finished_at DESC LIMIT 10`
      );

      const sourceMap: Record<string, { source: string; city: string; listings: number; matches: number }> = {};
      for (const row of runRes.rows) {
        if (!Array.isArray(row.source_reports)) continue;
        for (const sr of row.source_reports) {
          const rawName = sr.name || sr.source || "";
          const cityMatch = rawName.match(/\(([^)]+)\)/);
          const city = cityMatch ? cityMatch[1] : "Unknown";
          const sourceName = rawName.replace(/\s*\([^)]+\)/, "").trim();
          const key = `${sourceName}|${city}`;
          if (!sourceMap[key]) {
            sourceMap[key] = { source: sourceName, city, listings: 0, matches: 0 };
          }
          sourceMap[key].listings += (sr.found || 0);
          sourceMap[key].matches += (sr.matches || 0);
        }
      }

      const sources = Object.values(sourceMap);

      for (const s of sources) {
        try {
          const vRes = await pgPool.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events
             WHERE event_name = 'listing_opened' AND LOWER(metadata->>'city') = $1`,
            [s.city.toLowerCase()]
          );
          (s as any).listingViews = parseInt(vRes.rows[0]?.cnt || "0", 10);
        } catch {
          (s as any).listingViews = 0;
        }

        try {
          const rRes = await pgPool.query(
            `SELECT COUNT(DISTINCT user_id) AS cnt FROM activation_events
             WHERE event_name = 'first_reaction' AND LOWER(metadata->>'city') = $1`,
            [s.city.toLowerCase()]
          );
          (s as any).reactions = parseInt(rRes.rows[0]?.cnt || "0", 10);
        } catch {
          (s as any).reactions = 0;
        }
      }

      sources.sort((a: any, b: any) => (b.reactions || 0) - (a.reactions || 0));

      res.json({ sources });
    } catch (err: any) {
      log(`[admin-portal] Source performance error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/alerts", requireAdmin, async (_req, res) => {
    try {
      const alerts: Array<{ type: string; severity: string; message: string; timestamp: string }> = [];
      const now = new Date();

      try {
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
        const scraperRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM ingestion_runs WHERE finished_at >= $1 AND total_found > 0`,
          [fourHoursAgo]
        );
        const hasRecentCompletedRun = parseInt(scraperRes.rows[0]?.cnt || "0", 10) > 0;

        const currentlyRunning = isRunning();
        const lastActivity = getLastActivityAt();
        const activityRecent = lastActivity && new Date(lastActivity).getTime() > now.getTime() - 4 * 60 * 60 * 1000;

        if (!hasRecentCompletedRun) {
          if (currentlyRunning && activityRecent) {
            alerts.push({
              type: "scraper_stale",
              severity: "info",
              message: `Ingestion cycle in progress (last activity: ${lastActivity}) — no completed run in last 4 hours yet`,
              timestamp: now.toISOString(),
            });
          } else {
            alerts.push({
              type: "scraper_stale",
              severity: "critical",
              message: currentlyRunning && !activityRecent
                ? "Ingestion cycle appears stuck — running but no activity in last 4 hours"
                : "No listings scraped in the last 4 hours",
              timestamp: now.toISOString(),
            });
          }
        }
      } catch {}

      try {
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        const todayMatchRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM user_matches WHERE matched_at >= $1`, [todayStart.toISOString()]
        );
        const yesterdayMatchRes = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM user_matches WHERE matched_at >= $1 AND matched_at < $2`,
          [yesterdayStart.toISOString(), todayStart.toISOString()]
        );
        const todayMatches = parseInt(todayMatchRes.rows[0]?.cnt || "0", 10);
        const yesterdayMatches = parseInt(yesterdayMatchRes.rows[0]?.cnt || "0", 10);
        if (yesterdayMatches > 0 && todayMatches < yesterdayMatches * 0.5) {
          alerts.push({
            type: "match_drop",
            severity: "warning",
            message: `Matches dropped >50%: today ${todayMatches} vs yesterday ${yesterdayMatches}`,
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      try {
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const activeSubUserIds = new Set<string>();
        try {
          const subRes = await supabase.from("subscriptions").select("user_id, status, trial_ends_at, current_period_ends_at");
          for (const s of (subRes.data || [])) {
            const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
            const isActive = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
            const isPastDue = s.status === "past_due";
            const canceledActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
            if (isTrial || isActive || isPastDue || canceledActive) activeSubUserIds.add(s.user_id);
          }
        } catch {}

        const emailMetricsRes = await pgPool.query(
          `SELECT user_id, email_sent FROM user_matches WHERE matched_at >= $1 AND visible_in_app = true`,
          [todayStart.toISOString()]
        );
        let emailsSent = 0;
        let skippedNoSub = 0;
        let realFailures = 0;
        for (const row of emailMetricsRes.rows) {
          if (row.email_sent) {
            emailsSent++;
          } else if (!activeSubUserIds.has(row.user_id)) {
            skippedNoSub++;
          } else {
            realFailures++;
          }
        }
        const totalMatches = emailMetricsRes.rows.length;

        if (realFailures > 0) {
          alerts.push({
            type: "email_failure",
            severity: realFailures > 5 ? "critical" : "warning",
            message: `${realFailures} real email delivery failure${realFailures !== 1 ? "s" : ""} today (provider errors)`,
            timestamp: now.toISOString(),
          });
        }

        if (skippedNoSub > 0) {
          alerts.push({
            type: "email_skipped",
            severity: "info",
            message: `${skippedNoSub} match email${skippedNoSub !== 1 ? "s" : ""} skipped (no active subscription) · ${emailsSent} sent successfully`,
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      try {
        const recentErrors = await pgPool.query(
          `SELECT COUNT(*) AS cnt FROM ingestion_runs
           WHERE finished_at >= $1 AND status = 'failed'`,
          [new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()]
        );
        if (parseInt(recentErrors.rows[0]?.cnt || "0", 10) > 0) {
          alerts.push({
            type: "ingestion_failure",
            severity: "warning",
            message: "One or more ingestion runs failed in the last 24 hours",
            timestamp: now.toISOString(),
          });
        }
      } catch {}

      res.json({ alerts });
    } catch (err: any) {
      log(`[admin-portal] Alerts error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/system-status", requireAdmin, async (_req, res) => {
    try {
      const checks: Record<string, any> = {};

      try {
        const { getUncachableStripeClient } = await import("./stripe/stripeClient");
        const stripe = await getUncachableStripeClient();
        await stripe.products.list({ limit: 1 });
        checks.stripe = { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.stripe = { status: "error", message: e.message?.substring(0, 100) };
      }

      const placesKey = process.env.GOOGLE_PLACES_API_KEY;
      checks.placesApi = placesKey
        ? { status: "operational", message: "API key configured" }
        : { status: "warning", message: "No API key — using Nominatim fallback" };

      const schedulerEnabled = process.env.ENABLE_INGEST_SCHEDULER === "true";
      let lastRun: any = null;
      try {
        const lastRunRes = await pgPool.query("SELECT started_at, status FROM ingestion_runs ORDER BY started_at DESC LIMIT 1");
        lastRun = lastRunRes.rows[0] || null;
      } catch {}
      checks.ingestionScheduler = {
        status: schedulerEnabled ? "operational" : "disabled",
        message: schedulerEnabled
          ? `Enabled — last run: ${lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString() : "never"} (${lastRun?.status || "unknown"})`
          : "Disabled (ENABLE_INGEST_SCHEDULER != true)",
      };

      let emailStatus = { status: "warning", message: "No Resend API key" };
      try {
        const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
        if (hostname) {
          const xReplitToken = process.env.REPL_IDENTITY
            ? "repl " + process.env.REPL_IDENTITY
            : process.env.WEB_REPL_RENEWAL
            ? "depl " + process.env.WEB_REPL_RENEWAL
            : null;
          if (xReplitToken) {
            const connRes = await fetch(
              "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
              { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
            ).then(r => r.json());
            if (connRes?.items?.[0]?.settings?.api_key) {
              emailStatus = { status: "operational", message: "Resend configured (via connector)" };
            }
          }
        }
        if (emailStatus.status === "warning" && process.env.RESEND_API_KEY) {
          emailStatus = { status: "operational", message: "Resend configured (via env var)" };
        }
      } catch {}
      checks.email = emailStatus;

      const vapidKey = process.env.VAPID_PRIVATE_KEY;
      if (vapidKey) {
        try {
          const sb = getSupabaseAdmin();
          const [webRes, expoRes] = await Promise.all([
            sb.from("push_subscriptions").select("id", { count: "exact", head: true }),
            sb.from("expo_push_tokens").select("id", { count: "exact", head: true }).eq("is_active", true),
          ]);
          const webCount = webRes.count ?? 0;
          const expoCount = expoRes.count ?? 0;
          const total = webCount + expoCount;
          checks.pushNotifications = {
            status: "operational",
            message: `VAPID configured · ${total} active device${total !== 1 ? "s" : ""} (${webCount} web, ${expoCount} Expo)`,
          };
        } catch {
          checks.pushNotifications = { status: "operational", message: "VAPID keys configured" };
        }
      } else {
        checks.pushNotifications = { status: "warning", message: "No VAPID keys — push disabled" };
      }

      try {
        await pgPool.query("SELECT 1");
        checks.replitDb = { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.replitDb = { status: "error", message: e.message?.substring(0, 100) };
      }

      try {
        const { error } = await supabase.from("subscriptions").select("id").limit(1);
        checks.supabaseDb = error
          ? { status: "error", message: error.message }
          : { status: "operational", message: "Connected" };
      } catch (e: any) {
        checks.supabaseDb = { status: "error", message: e.message?.substring(0, 100) };
      }

      res.json(checks);
    } catch (err: any) {
      log(`[admin-portal] System status error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Image Coverage Audit ───────────────────────────────────────
  app.get("/api/admin/portal/image-audit", requireAdmin, async (req, res) => {
    try {
      const sourceFilter = (req.query.source as string) || "";
      const cityFilter = (req.query.city as string) || "";
      const daysBack = parseInt(req.query.days as string || "0");

      const allListings: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let keepGoing = true;

      while (keepGoing) {
        let q = supabase
          .from("listings")
          .select("id, title, source, city, url, image_url, created_at")
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);

        if (sourceFilter) q = q.eq("source", sourceFilter);
        if (cityFilter) q = q.ilike("city", `%${cityFilter}%`);
        if (daysBack > 0) {
          const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
          q = q.gte("created_at", cutoff);
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) {
          keepGoing = false;
        } else {
          allListings.push(...data);
          from += batchSize;
          if (data.length < batchSize) keepGoing = false;
        }
      }

      log(`[admin-portal] Image audit: fetched ${allListings.length} listings from Supabase`);

      const isPlaceholder = (url: string) =>
        /placeholder|default|noimage|no-image|blank/i.test(url);
      const isRelativeUrl = (url: string) =>
        url && !url.startsWith("http") && !url.startsWith("//");
      const isProtocolRelative = (url: string) =>
        url && url.startsWith("//");
      const hasImage = (url: string | null | undefined) =>
        !!url && url.trim() !== "";

      const sourceMap: Record<string, {
        total: number; with_image: number; without_image: number;
        placeholder_only: number; relative_url: number; protocol_relative: number;
      }> = {};

      for (const l of allListings) {
        const src = l.source || "unknown";
        if (!sourceMap[src]) {
          sourceMap[src] = { total: 0, with_image: 0, without_image: 0, placeholder_only: 0, relative_url: 0, protocol_relative: 0 };
        }
        const s = sourceMap[src];
        s.total++;
        const img = l.image_url;
        if (hasImage(img)) {
          s.with_image++;
          if (isPlaceholder(img)) s.placeholder_only++;
          if (isRelativeUrl(img)) s.relative_url++;
          if (isProtocolRelative(img)) s.protocol_relative++;
        } else {
          s.without_image++;
        }
      }

      const sources = Object.entries(sourceMap)
        .map(([source, s]) => ({
          source,
          ...s,
          coverage_pct: s.total > 0 ? Math.round(1000 * s.with_image / s.total) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const totalAll = sources.reduce((sum, r) => sum + r.total, 0);
      const withImageAll = sources.reduce((sum, r) => sum + r.with_image, 0);
      const withoutImageAll = sources.reduce((sum, r) => sum + r.without_image, 0);

      const topWorst = [...sources]
        .filter(s => s.total >= 5)
        .sort((a, b) => a.coverage_pct - b.coverage_pct)
        .slice(0, 5);

      const SOURCE_IMPORTANCE: Record<string, number> = {
        immowelt: 10, kleinanzeigen: 9, "wg-gesucht": 8, immoscout: 8,
        wohnungsboerse: 6, rentola: 5, nestpick: 4, immonet: 4,
      };
      const topPriority = [...sources]
        .map(s => ({
          ...s,
          importance: SOURCE_IMPORTANCE[s.source] || 3,
          impact_score: (SOURCE_IMPORTANCE[s.source] || 3) * s.without_image,
        }))
        .sort((a, b) => b.impact_score - a.impact_score)
        .slice(0, 5);

      const samplesBySource: Record<string, any[]> = {};
      const missingImageListings = allListings.filter(l => !hasImage(l.image_url));
      for (const row of missingImageListings) {
        const src = row.source || "unknown";
        if (!samplesBySource[src]) samplesBySource[src] = [];
        if (samplesBySource[src].length < 5) {
          samplesBySource[src].push({
            id: row.id,
            title: row.title,
            source: row.source,
            url: row.url,
            image_url: row.image_url || null,
            city: row.city,
            created_at: row.created_at,
            likely_reason: "no_image_extracted",
          });
        }
      }

      const failureReasonSummary: Record<string, number> = {};
      for (const s of sources) {
        if (s.without_image > 0) failureReasonSummary[`no_image_extracted_${s.source}`] = s.without_image;
        if (s.placeholder_only > 0) failureReasonSummary[`placeholder_only_${s.source}`] = s.placeholder_only;
        if (s.relative_url > 0) failureReasonSummary[`relative_url_${s.source}`] = s.relative_url;
        if (s.protocol_relative > 0) failureReasonSummary[`protocol_relative_${s.source}`] = s.protocol_relative;
      }

      const backfillCandidates = sources.map(s => ({
        source: s.source,
        no_image: s.without_image,
        placeholder: s.placeholder_only,
        suspicious_url: s.relative_url + s.protocol_relative,
        total_candidates: s.without_image + s.placeholder_only + s.relative_url + s.protocol_relative,
      }));
      const backfillTotal = backfillCandidates.reduce((sum, c) => sum + c.total_candidates, 0);

      res.json({
        summary: {
          total_listings: totalAll,
          with_image: withImageAll,
          without_image: withoutImageAll,
          overall_coverage_pct: totalAll > 0 ? Math.round(1000 * withImageAll / totalAll) / 10 : 0,
        },
        per_source: sources.map(s => ({
          source: s.source,
          total: s.total,
          with_image: s.with_image,
          without_image: s.without_image,
          coverage_pct: s.coverage_pct,
          placeholder_only: s.placeholder_only,
          relative_url: s.relative_url,
          protocol_relative: s.protocol_relative,
          priority: (SOURCE_IMPORTANCE[s.source] || 3) >= 7 ? "high" : (SOURCE_IMPORTANCE[s.source] || 3) >= 5 ? "medium" : "low",
        })),
        top_5_worst: topWorst.map(s => ({
          source: s.source, coverage_pct: s.coverage_pct, total: s.total, without_image: s.without_image,
        })),
        top_5_priority: topPriority.map(s => ({
          source: s.source, coverage_pct: s.coverage_pct, total: s.total, without_image: s.without_image,
          importance: s.importance, impact_score: s.impact_score,
        })),
        failure_reasons: failureReasonSummary,
        samples: samplesBySource,
        backfill: { total_candidates: backfillTotal, per_source: backfillCandidates },
        filters: { source: sourceFilter || null, city: cityFilter || null, days: daysBack || null },
      });
    } catch (err: any) {
      log(`[admin-portal] Image audit error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/portal/listings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, price, image_url, featured, hidden_from_feed } = req.body || {};
      const updates: any = {};
      if (typeof title === "string") updates.title = title;
      if (typeof price === "number" || price === null) updates.price = price;
      if (typeof image_url === "string" || image_url === null) updates.image_url = image_url;
      if (typeof featured === "boolean") updates.featured = featured;
      if (typeof hidden_from_feed === "boolean") updates.hidden_from_feed = hidden_from_feed;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
      const { error } = await supabase.from("listings").update(updates).eq("id", id);
      if (error) throw error;
      log(`[admin] Listing ${id} updated: ${JSON.stringify(updates)}`);
      res.json({ success: true });
    } catch (err: any) {
      log(`[admin] Listing update error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/portal/listings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await supabase.from("matches").delete().eq("listing_id", id);
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
      log(`[admin] Listing ${id} deleted`);
      res.json({ success: true });
    } catch (err: any) {
      log(`[admin] Listing delete error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/listings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      log(`[admin] Listing detail error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/listings/:id/retry-image", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: listing, error: fetchErr } = await supabase.from("listings").select("id, source, url").eq("id", id).single();
      if (fetchErr || !listing) return res.status(404).json({ error: "Listing not found" });
      if (!listing.url || !listing.url.startsWith("http")) return res.status(400).json({ error: "Invalid listing URL" });

      const cheerio = await import("cheerio");
      const UA = "HousAlert/1.0 (rental alert app; polite single-page fetch; contact: support@housalert.com)";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const resp = await fetch(listing.url, {
          headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" },
          redirect: "follow",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) return res.status(400).json({ error: `Fetch failed: ${resp.status}` });
        const html = await resp.text();
        const $ = cheerio.load(html);

        let imageUrl: string | null = null;
        const ogImg = $("meta[property='og:image']").attr("content");
        if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
        if (!imageUrl) {
          const mainImg = $("article img, .listing img, .detail img, main img").first();
          const src = mainImg.attr("src") || mainImg.attr("data-src") || mainImg.attr("data-lazy") || "";
          if (src.startsWith("http") && !src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) imageUrl = src;
        }

        if (imageUrl) {
          await supabase.from("listings").update({ image_url: imageUrl }).eq("id", id);
          log(`[admin] Retry image for ${id}: found ${imageUrl}`);
          res.json({ success: true, image_url: imageUrl });
        } else {
          res.json({ success: false, message: "No image found on page" });
        }
      } catch (fetchError: any) {
        clearTimeout(timeout);
        return res.status(400).json({ error: `Fetch error: ${fetchError.message}` });
      }
    } catch (err: any) {
      log(`[admin] Retry image error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/users/:userId/update-plan", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, plan, trialDaysExtend } = req.body || {};

      if (trialDaysExtend && typeof trialDaysExtend === "number") {
        const { data: sub } = await supabase.from("subscriptions").select("*").eq("user_id", userId).single();
        if (sub) {
          const currentEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
          currentEnd.setDate(currentEnd.getDate() + trialDaysExtend);
          await supabase.from("subscriptions").update({
            trial_ends_at: currentEnd.toISOString(),
            status: "trial",
          }).eq("user_id", userId);
          log(`[admin] Extended trial for ${userId} by ${trialDaysExtend} days`);
          return res.json({ success: true, action: "trial_extended" });
        }
      }

      if (status) {
        await supabase.from("subscriptions").update({ status }).eq("user_id", userId);
        log(`[admin] Updated user ${userId} status to ${status}`);
      }
      if (plan) {
        await supabase.from("subscriptions").update({ plan }).eq("user_id", userId);
        log(`[admin] Updated user ${userId} plan to ${plan}`);
      }

      res.json({ success: true });
    } catch (err: any) {
      log(`[admin] User plan update error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/users/:userId/deactivate", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      await supabase.from("subscriptions").update({ status: "canceled" }).eq("user_id", userId);
      log(`[admin] Deactivated user ${userId}`);
      res.json({ success: true });
    } catch (err: any) {
      log(`[admin] User deactivate error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  const ADMIN_PROTECTED_EMAIL = "martin.essie87@gmail.com";

  /**
   * Permanently removes a user and ALL related data.
   *
   * Fully defensive — each step tolerates missing records (deactivated, partially
   * cleaned-up, or already-deleted users). Only the Supabase Auth deletion at the
   * end can bubble a fatal error, and even that treats "user not found" as success.
   *
   * Uses the service-role Supabase client (getSupabaseAdmin()) for ALL Supabase
   * table operations so RLS policies never block the deletion.
   *
   * Deletion order (FK-safe):
   *  1. user_matches (pgPool) — match-delivery tracking
   *  2. matches referencing this user's search profiles (Supabase) — cross-user buddy matches
   *  3. matches owned by this user (Supabase) — before search_profiles due to FK
   *  4. search_profiles (Supabase)
   *  5. subscriptions (Supabase)
   *  6. user_notification_settings (Supabase, no cascade — must pre-delete before auth)
   *  7. push_subscriptions (Supabase)
   *  8. onboarding_drafts (Supabase)
   *  9. search_profile_buddies (pgPool) — both directions (cascades buddy_actions)
   * 10. referrals (pgPool) — both referrer and referred
   * 11. cancellation_feedback, favorites, activation_events (pgPool)
   * 12. user_profile_data (pgPool)
   * 13. auth.admin.deleteUser — last; triggers remaining ON DELETE CASCADE rules
   */
  async function permanentlyDeleteUser(userId: string): Promise<{ steps: string[]; authWasPresent: boolean }> {
    const adminSb = getSupabaseAdmin();
    const steps: string[] = [];

    function step(label: string, ok: boolean, note?: string) {
      const entry = ok ? `✓ ${label}${note ? ` (${note})` : ""}` : `✗ ${label}: ${note}`;
      steps.push(entry);
      log(`[admin-delete] ${entry}`);
    }

    // Check auth user existence upfront (for logging; does NOT block deletion)
    let authWasPresent = false;
    try {
      const { data: authCheck } = await adminSb.auth.admin.getUserById(userId);
      authWasPresent = !!authCheck?.user?.id;
      step("auth.check", true, authWasPresent ? "found" : "already missing");
    } catch (e: any) { step("auth.check", false, e.message); }

    // 1. user_matches (pgPool)
    try {
      const r = await pgPool.query("DELETE FROM user_matches WHERE user_id = $1", [userId]);
      step("user_matches", true, `${r.rowCount ?? 0} rows`);
    } catch (e: any) { step("user_matches", false, e.message); }

    // 2. matches referencing this user's search profiles (buddy cross-user matches)
    //    Needed when this user is an owner and a buddy's matches point to their search profiles.
    try {
      const spRes = await adminSb.from("search_profiles").select("id").eq("user_id", userId);
      const spIds = (spRes.data || []).map((r: any) => r.id).filter(Boolean);
      if (spIds.length > 0) {
        const { error } = await adminSb.from("matches").delete().in("search_profile_id", spIds);
        if (error) throw error;
        step("matches(via_search_profiles)", true, `sp_ids=${spIds.length}`);
      } else {
        step("matches(via_search_profiles)", true, "no search profiles");
      }
    } catch (e: any) { step("matches(via_search_profiles)", false, e.message); }

    // 3. matches owned by this user
    try {
      const { error } = await adminSb.from("matches").delete().eq("user_id", userId);
      if (error) throw error;
      step("matches(user)", true);
    } catch (e: any) { step("matches(user)", false, e.message); }

    // 4. search_profiles
    try {
      const { error } = await adminSb.from("search_profiles").delete().eq("user_id", userId);
      if (error) throw error;
      step("search_profiles", true);
    } catch (e: any) { step("search_profiles", false, e.message); }

    // 5. subscriptions
    try {
      const { error } = await adminSb.from("subscriptions").delete().eq("user_id", userId);
      if (error) throw error;
      step("subscriptions", true);
    } catch (e: any) { step("subscriptions", false, e.message); }

    // 6. user_notification_settings (no cascade — must pre-delete or auth delete will FK-fail)
    try {
      const { error } = await adminSb.from("user_notification_settings").delete().eq("user_id", userId);
      if (error) throw error;
      step("user_notification_settings", true);
    } catch (e: any) { step("user_notification_settings", false, e.message); }

    // 7. push_subscriptions (has cascade but explicit for immediate push stop)
    try {
      await adminSb.from("push_subscriptions").delete().eq("user_id", userId);
      step("push_subscriptions", true);
    } catch (e: any) { step("push_subscriptions", false, e.message); }

    // 8. onboarding_drafts (Supabase)
    try {
      await adminSb.from("onboarding_drafts").delete().eq("claimed_by", userId);
      step("onboarding_drafts", true);
    } catch (e: any) { step("onboarding_drafts", false, e.message); }

    // 9. search_profile_buddies — both directions; buddy_actions cascades automatically
    try {
      const r = await pgPool.query(
        "DELETE FROM search_profile_buddies WHERE owner_user_id = $1 OR buddy_user_id = $1",
        [userId]
      );
      step("search_profile_buddies", true, `${r.rowCount ?? 0} rows`);
    } catch (e: any) { step("search_profile_buddies", false, e.message); }

    // 10. referrals (pgPool) — both referrer and referred
    try {
      await pgPool.query(
        "DELETE FROM referrals WHERE referrer_user_id = $1 OR referred_user_id = $1",
        [userId]
      );
      step("referrals", true);
    } catch (e: any) { step("referrals", false, e.message); }

    // 11a. cancellation_feedback
    try {
      await pgPool.query("DELETE FROM cancellation_feedback WHERE user_id = $1", [userId]);
      step("cancellation_feedback", true);
    } catch (e: any) { step("cancellation_feedback", false, e.message); }

    // 11b. favorites
    try {
      await pgPool.query("DELETE FROM favorites WHERE user_id = $1", [userId]);
      step("favorites", true);
    } catch (e: any) { step("favorites", false, e.message); }

    // 11c. activation_events
    try {
      await pgPool.query("DELETE FROM activation_events WHERE user_id = $1", [userId]);
      step("activation_events", true);
    } catch (e: any) { step("activation_events", false, e.message); }

    // 12. user_profile_data (pgPool)
    try {
      await pgPool.query("DELETE FROM user_profile_data WHERE user_id = $1", [userId]);
      step("user_profile_data", true);
    } catch (e: any) { step("user_profile_data", false, e.message); }

    // 13. Supabase Auth — MUST be last so CASCADE rules on auth.users fire last
    if (!authWasPresent) {
      step("auth.deleteUser", true, "skipped — already missing");
    } else {
      const { error: deleteErr } = await adminSb.auth.admin.deleteUser(userId);
      if (deleteErr) {
        const isNotFound =
          deleteErr.message?.toLowerCase().includes("not found") ||
          deleteErr.message?.toLowerCase().includes("does not exist") ||
          deleteErr.message?.toLowerCase().includes("user not found");
        if (isNotFound) {
          step("auth.deleteUser", true, "already missing");
        } else {
          step("auth.deleteUser", false, deleteErr.message);
          throw new Error(`Auth delete failed: ${deleteErr.message}`);
        }
      } else {
        step("auth.deleteUser", true);
      }
    }

    return { steps, authWasPresent };
  }

  app.delete("/api/admin/portal/users/:userId/permanent-delete", requireAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
      const adminSb = getSupabaseAdmin();
      // Look up email for protected-account check and logging
      let email = "";
      try {
        const { data: authData } = await adminSb.auth.admin.getUserById(userId);
        email = authData?.user?.email || "";
      } catch {}
      if (email && email.toLowerCase() === ADMIN_PROTECTED_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: `Account ${ADMIN_PROTECTED_EMAIL} is protected and cannot be deleted.` });
      }
      log(`[admin-delete] Starting permanent delete of ${userId} (${email || "auth-missing"})`);
      const { steps, authWasPresent } = await permanentlyDeleteUser(userId);
      log(`[admin-delete] Completed: ${userId} authWasPresent=${authWasPresent}`);
      res.json({ success: true, deleted: email || userId, authWasPresent, steps });
    } catch (err: any) {
      log(`[admin-delete] FAILED for ${userId}: ${err.message}`);
      res.status(500).json({ error: err.message, failedStep: err.message.split(":")[0] });
    }
  });

  app.post("/api/admin/portal/users/bulk-delete-except-protected", requireAdmin, async (req, res) => {
    try {
      const adminSb = getSupabaseAdmin();
      let allUsers: any[] = [];
      let page = 1;
      while (true) {
        const { data, error } = await adminSb.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        allUsers = [...allUsers, ...(data.users || [])];
        if (!data.users || data.users.length < 1000) break;
        page++;
      }
      const usersToDelete = allUsers.filter(u => u.email?.toLowerCase() !== ADMIN_PROTECTED_EMAIL.toLowerCase());
      const protectedPreserved = allUsers.some(u => u.email?.toLowerCase() === ADMIN_PROTECTED_EMAIL.toLowerCase());
      let deleted = 0, skipped = 0;
      const errorLog: string[] = [];
      for (const authUser of usersToDelete) {
        try {
          const steps = await permanentlyDeleteUser(authUser.id);
          log(`[admin-bulk-delete] Deleted ${authUser.email || authUser.id} (${steps.length} steps)`);
          deleted++;
        } catch (err: any) {
          log(`[admin-bulk-delete] Failed ${authUser.email || authUser.id}: ${err.message}`);
          errorLog.push(`${authUser.email || authUser.id}: ${err.message}`);
          skipped++;
        }
      }
      log(`[admin-bulk-delete] Done — deleted=${deleted}, skipped=${skipped}, protected_preserved=${protectedPreserved}`);
      res.json({ success: true, deleted, skipped, protectedPreserved, protectedEmail: ADMIN_PROTECTED_EMAIL, errors: errorLog.slice(0, 10) });
    } catch (err: any) {
      log(`[admin-bulk-delete] Error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/backfill-source", requireAdmin, async (req, res) => {
    try {
      const { source, limit: batchLimit } = req.body || {};
      if (!source) return res.status(400).json({ error: "Source required" });
      const fetchLimit = Math.min(parseInt(batchLimit || "50"), 200);

      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, source, url, image_url")
        .eq("source", source)
        .or("image_url.is.null,image_url.eq.")
        .order("created_at", { ascending: false })
        .limit(fetchLimit);

      if (error) throw error;
      if (!listings || listings.length === 0) return res.json({ updated: 0, failed: 0, total: 0 });

      const cheerio = await import("cheerio");
      const UA = "HousAlert/1.0";
      let updated = 0, failed = 0;

      for (const listing of listings) {
        if (!listing.url || !listing.url.startsWith("http")) { failed++; continue; }
        try {
          await new Promise(r => setTimeout(r, 800));
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(listing.url, {
            headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" },
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(fetchTimeout);
          if (!resp.ok) { failed++; continue; }
          const html = await resp.text();
          const $ = cheerio.load(html);
          let imageUrl: string | null = null;
          const ogImg = $("meta[property='og:image']").attr("content");
          if (ogImg && ogImg.startsWith("http")) imageUrl = ogImg;
          if (!imageUrl) {
            const mainImg = $("article img, .listing img, .detail img, main img").first();
            const src = mainImg.attr("src") || mainImg.attr("data-src") || mainImg.attr("data-lazy") || "";
            if (src.startsWith("http") && !src.includes("logo") && !src.includes("icon") && !src.includes("avatar")) imageUrl = src;
          }
          if (imageUrl) {
            await supabase.from("listings").update({ image_url: imageUrl }).eq("id", listing.id);
            updated++;
          } else {
            failed++;
          }
        } catch { failed++; }
      }

      log(`[admin] Source backfill ${source}: ${updated}/${listings.length} updated`);
      res.json({ updated, failed, total: listings.length });
    } catch (err: any) {
      log(`[admin] Source backfill error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/settings", requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pgPool.query("SELECT key, value FROM admin_settings");
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;
      res.json({ settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/portal/settings", requireAdmin, async (req, res) => {
    try {
      const ALLOWED_KEYS: Record<string, "number" | "boolean"> = {
        free_matches_limit: "number",
        show_blurred_locked: "boolean",
      };
      const { settings } = req.body || {};
      if (!settings || typeof settings !== "object") return res.status(400).json({ error: "settings object required" });
      for (const [key, value] of Object.entries(settings)) {
        if (!ALLOWED_KEYS[key]) continue;
        const type = ALLOWED_KEYS[key];
        if (type === "number" && (isNaN(Number(value)) || Number(value) < 0)) continue;
        if (type === "boolean" && value !== "true" && value !== "false" && typeof value !== "boolean") continue;
        await pgPool.query(
          "INSERT INTO admin_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
          [key, String(value)]
        );
      }
      log(`[admin] Settings updated: ${JSON.stringify(settings)}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/source-overrides", requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pgPool.query("SELECT source_name, enabled FROM admin_source_overrides");
      const overrides: Record<string, boolean> = {};
      for (const r of rows) overrides[r.source_name] = r.enabled;
      const { getSourceStatuses } = await import("./ingesters/index");
      const sources = getSourceStatuses().map(s => ({
        name: s.name,
        systemStatus: s.status,
        note: s.note || null,
        adminEnabled: overrides[s.name] !== undefined ? overrides[s.name] : true,
      }));
      res.json({ sources, overrides });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/source-toggle", requireAdmin, async (req, res) => {
    try {
      const { source, enabled } = req.body || {};
      if (!source || typeof enabled !== "boolean") return res.status(400).json({ error: "source and enabled required" });
      await pgPool.query(
        "INSERT INTO admin_source_overrides (source_name, enabled, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (source_name) DO UPDATE SET enabled = $2, updated_at = NOW()",
        [source, enabled]
      );
      const { rows } = await pgPool.query("SELECT source_name FROM admin_source_overrides WHERE enabled = false");
      const { setDisabledSourceOverrides } = await import("./ingesters/index");
      setDisabledSourceOverrides(new Set(rows.map((r: any) => r.source_name)));
      log(`[admin] Source ${source} ${enabled ? "enabled" : "disabled"}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/test-alert", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { type, email, userId } = req.body || {};

      if (type === "email") {
        const targetEmail = email || adminUser.email;
        const timestamp = new Date().toISOString();
        const { sendControlledTestEmail } = await import("./email");
        const result = await sendControlledTestEmail(targetEmail);
        log(`[admin] Test email to ${targetEmail}: ${result.success ? "OK resend_id=" + result.resendId : "FAILED error=" + result.error}`);
        return res.json({
          success: result.success,
          type: "email",
          sentTo: result.to,
          from: result.from,
          replyTo: result.replyTo,
          resendId: result.resendId || null,
          timestamp,
          error: result.error || null,
        });
      }

      if (type === "push") {
        let _step = "resolve-target";
        try {

        // 1. Resolve target user ID
        const rawInput = (typeof userId === "string" ? userId : "").trim();
        log(`[PUSH TEST] Admin ${adminUser?.email} — raw target: "${rawInput || "(blank → self)"}"`);

        if (!adminUser?.id) {
          return res.status(500).json({ error: "adminUser.id missing — session may be invalid", step: "resolve-target" });
        }

        let targetUserId: string;
        let resolvedVia: string;

        if (!rawInput) {
          targetUserId = adminUser.id;
          resolvedVia = "blank → admin self";
        } else if (rawInput.includes("@")) {
          _step = "lookup-email";
          const found = await lookupSupabaseUserByEmail(rawInput);
          if (!found) {
            return res.status(404).json({
              success: false,
              error: "user_not_found",
              message: `No Supabase user found with email: ${rawInput}`,
            });
          }
          targetUserId = found.id;
          resolvedVia = `email → ${found.email}`;
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawInput)) {
          targetUserId = rawInput;
          resolvedVia = "uuid → direct";
        } else {
          return res.status(400).json({
            success: false,
            error: "invalid_target",
            message: `Target must be blank (uses your own account), a valid UUID, or an email address. Got: "${rawInput}"`,
          });
        }

        log(`[PUSH TEST] Resolved userId=${targetUserId.substring(0, 8)}... via ${resolvedVia}`);

        // 2. VAPID check
        _step = "vapid-check";
        if (!isPushInitialized()) {
          const vapidPub = process.env.VITE_VAPID_PUBLIC_KEY;
          const vapidPriv = process.env.VAPID_PRIVATE_KEY;
          log(`[PUSH TEST] Aborting — VAPID not initialized (public=${vapidPub ? "set" : "MISSING"} private=${vapidPriv ? "set" : "MISSING"})`);
          return res.json({
            success: false,
            targetUserId,
            error: "vapid_not_configured",
            message: `Web Push VAPID keys not configured. VITE_VAPID_PUBLIC_KEY=${vapidPub ? "set" : "MISSING"}, VAPID_PRIVATE_KEY=${vapidPriv ? "set" : "MISSING"}.`,
          });
        }

        // 3. Pre-flight subscription count
        _step = "preflight-subs";
        const adminSb = getSupabaseAdmin();
        const { data: webSubs, error: webSubErr } = await adminSb.from("push_subscriptions").select("id").eq("user_id", targetUserId);
        if (webSubErr) log(`[PUSH TEST] push_subscriptions query error: ${webSubErr.message}`);
        const { data: expoTokensRows, error: expoErr } = await adminSb.from("expo_push_tokens").select("id").eq("user_id", targetUserId).eq("is_active", true);
        if (expoErr) log(`[PUSH TEST] expo_push_tokens query error: ${expoErr.message}`);
        const webSubCount = webSubs?.length ?? 0;
        const expoTokenCount = expoTokensRows?.length ?? 0;
        log(`[PUSH TEST] userId=${targetUserId.substring(0, 8)}...: web_subs=${webSubCount} active_expo_tokens=${expoTokenCount} (webSubErr=${webSubErr?.message ?? "none"} expoErr=${expoErr?.message ?? "none"})`);

        if (webSubCount === 0 && expoTokenCount === 0) {
          return res.json({
            success: false,
            targetUserId,
            error: "no_subscriptions",
            message: "No active push subscriptions or Expo tokens found for this user. Ask them to enable push notifications in their account preferences.",
            webSubs: webSubCount,
            expoTokens: expoTokenCount,
            dbErrors: [webSubErr?.message, expoErr?.message].filter(Boolean),
          });
        }

        // 4. Send
        _step = "send-web-push";
        const webResult = await sendPushToUser(targetUserId, {
          title: "HousAlert Test",
          body: "Push notifications work! 🏠",
          url: "/dashboard",
        }, supabase);
        _step = "send-expo-push";
        const expoResult = await sendExpoTestPush(targetUserId);
        log(`[PUSH TEST] userId=${targetUserId.substring(0, 8)}...: web_sent=${webResult.sent} web_failed=${webResult.failed} web_removed=${webResult.removed} expo_sent=${expoResult.sent}`);
        if (webResult.errors?.length) {
          log(`[PUSH TEST] Provider errors: ${JSON.stringify(webResult.errors)}`);
        }

        const totalSent = webResult.sent + expoResult.sent;
        const success = totalSent > 0;

        if (!success) {
          const firstErr = webResult.errors?.length ? webResult.errors[0] : null;
          const isVapidMismatch = firstErr?.statusCode === 401 ||
            (firstErr?.statusCode === 403 && (
              firstErr?.body?.includes("BadJwtToken") ||
              firstErr?.message?.includes("BadJwtToken")
            ));
          const repairNeeded = firstErr && (isVapidMismatch || firstErr.statusCode === 410 || firstErr.statusCode === 404);
          return res.json({
            success: false,
            targetUserId,
            error: "provider_rejected",
            message: firstErr?.message || "Provider rejected all push attempts. No notifications delivered.",
            webSubs: webSubCount,
            expoTokens: expoTokenCount,
            web: webResult,
            expo: expoResult,
            ...(firstErr && {
              diagnosis: {
                statusCode: firstErr.statusCode,
                message: firstErr.message,
                endpoint: firstErr.endpoint,
                body: firstErr.body,
                repairNeeded: !!repairNeeded,
                repairInstructions: repairNeeded
                  ? isVapidMismatch
                    ? "VAPID key mismatch detected. The stale subscription has been removed automatically. The user must re-enable push notifications to create a fresh subscription with the current key."
                    : "Push subscription expired or unregistered. The stale subscription has been removed. The user must re-enable push notifications."
                  : undefined,
              },
            }),
          });
        }

        return res.json({
          success: true,
          type: "push",
          targetUserId,
          totalSent,
          webSubs: webSubCount,
          expoTokens: expoTokenCount,
          web: webResult,
          expo: expoResult,
        });

        } catch (pushErr: any) {
          const msg = pushErr instanceof Error ? pushErr.message : (typeof pushErr === "string" ? pushErr : JSON.stringify(pushErr));
          const stack = pushErr?.stack || "(no stack)";
          log(`[PUSH TEST] *** EXCEPTION at step="${_step}": ${msg}\n${stack}`);
          return res.status(500).json({
            error: msg || "Internal push error",
            step: _step,
            errorType: pushErr?.constructor?.name || typeof pushErr,
          });
        }
      }

      return res.status(400).json({ error: "type must be 'email' or 'push'" });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : JSON.stringify(err));
      log(`[admin] Test alert outer error: ${msg}\n${err?.stack || ""}`);
      res.status(500).json({ error: msg || "Internal error", errorType: err?.constructor?.name || typeof err });
    }
  });

  app.get("/api/admin/portal/vapid-debug", requireAdmin, (_req, res) => {
    const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
    const privateKey = process.env.VAPID_PRIVATE_KEY || "";
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@housalert.com";
    return res.json({
      initialized: isPushInitialized(),
      subject,
      backendPublicKeyConfigured: !!publicKey,
      backendPrivateKeyConfigured: !!privateKey,
      backendPublicKeyPrefix: publicKey ? publicKey.substring(0, 12) + "..." : null,
      backendPublicKeyLength: publicKey.length || null,
    });
  });

  app.post("/api/admin/portal/clear-push-subs", requireAdmin, async (req, res) => {
    try {
      const adminUser = (req as any).adminUser;
      const { userId } = req.body || {};
      const rawInput = (typeof userId === "string" ? userId : "").trim();

      let targetUserId: string;
      let resolvedVia: string;

      if (!rawInput) {
        targetUserId = adminUser.id;
        resolvedVia = "blank → admin self";
      } else if (rawInput.includes("@")) {
        const found = await lookupSupabaseUserByEmail(rawInput);
        if (!found) {
          return res.status(404).json({
            success: false,
            error: "user_not_found",
            message: `No user found with email: ${rawInput}`,
          });
        }
        targetUserId = found.id;
        resolvedVia = `email → ${found.email}`;
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawInput)) {
        targetUserId = rawInput;
        resolvedVia = "uuid → direct";
      } else {
        return res.status(400).json({
          success: false,
          error: "invalid_target",
          message: `Target must be blank, a valid UUID, or an email address. Got: "${rawInput}"`,
        });
      }

      const adminSb = getSupabaseAdmin();
      const { data: existing } = await adminSb
        .from("push_subscriptions")
        .select("id, endpoint")
        .eq("user_id", targetUserId);
      const count = existing?.length ?? 0;

      if (count > 0) {
        await adminSb.from("push_subscriptions").delete().eq("user_id", targetUserId);
      }

      log(`[PUSH] Admin ${adminUser.email} cleared ${count} push subscription(s) for userId=${targetUserId.substring(0, 8)}... via ${resolvedVia}`);

      return res.json({
        success: true,
        targetUserId,
        deleted: count,
        message: count > 0
          ? `Removed ${count} push subscription(s). The user must re-enable push notifications to create a fresh subscription with the current VAPID key.`
          : "No push subscriptions found for this user.",
      });
    } catch (err: any) {
      log(`[admin] clear-push-subs error: ${err.message}`);
      res.status(500).json({ error: err.message || "Internal error" });
    }
  });

  app.post("/api/admin/portal/resend-matches/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { data: sub } = await supabase.from("subscriptions").select("status").eq("user_id", userId).single();
      if (!sub || (sub.status !== "active" && sub.status !== "trial")) {
        return res.status(400).json({ error: "User does not have an active subscription" });
      }

      const undelivered = await pgPool.query(
        "SELECT id, listing_id, listing_title, listing_url, listing_city, listing_price FROM user_matches WHERE user_id = $1 AND email_sent = false ORDER BY matched_at DESC LIMIT 20",
        [userId]
      );
      if (undelivered.rows.length === 0) return res.json({ success: true, resent: 0, message: "No undelivered matches" });

      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const userEmail = authUser?.user?.email;
      if (!userEmail) return res.status(400).json({ error: "User email not found" });

      const { sendBatchMatchAlert } = await import("./email");
      const { getUserLanguage } = await import("./notifications/buffer");
      const lang = await getUserLanguage(userId);
      const listings = undelivered.rows.map((m: any) => ({
        title: m.listing_title || "Listing",
        url: m.listing_url || "",
        city: m.listing_city || "",
        price: m.listing_price || 0,
        bedrooms: 0,
        size_m2: 0,
      }));

      const success = await sendBatchMatchAlert(userEmail, listings, lang);
      if (success) {
        const ids = undelivered.rows.map((m: any) => m.id);
        await pgPool.query(
          "UPDATE user_matches SET email_sent = true, email_sent_at = NOW() WHERE id = ANY($1)",
          [ids]
        );
      }
      log(`[admin] Resend matches to ${userId.substring(0, 8)}: ${undelivered.rows.length} matches, success=${success}`);
      res.json({ success, resent: undelivered.rows.length });
    } catch (err: any) {
      log(`[admin] Resend matches error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/alert-activity", requireAdmin, async (_req, res) => {
    try {
      const recentEmails = await pgPool.query(
        `SELECT um.user_id, um.listing_title, um.email_sent_at, um.push_sent_at, upd.email
         FROM user_matches um
         LEFT JOIN user_profile_data upd ON um.user_id::text = upd.user_id::text
         WHERE um.email_sent = true OR um.push_sent = true
         ORDER BY COALESCE(um.email_sent_at, um.push_sent_at) DESC
         LIMIT 50`
      );

      const emailsToday = await pgPool.query(
        "SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND email_sent_at >= CURRENT_DATE"
      );
      const pushToday = await pgPool.query(
        "SELECT COUNT(*) FROM user_matches WHERE push_sent = true AND push_sent_at >= CURRENT_DATE"
      );
      const unsentWeek = await pgPool.query(
        "SELECT user_id, COUNT(*) as cnt FROM user_matches WHERE email_sent = false AND matched_at >= NOW() - INTERVAL '7 days' AND visible_in_app = true GROUP BY user_id"
      );

      let realFailures7d = 0;
      let skippedNoSub7d = 0;
      try {
        const now = new Date();
        const subRes = await supabase.from("subscriptions").select("user_id, status, trial_ends_at, current_period_ends_at");
        const activeIds = new Set<string>();
        for (const s of (subRes.data || [])) {
          const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
          const isActive = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
          const isPastDue = s.status === "past_due";
          const canceledActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
          if (isTrial || isActive || isPastDue || canceledActive) activeIds.add(s.user_id);
        }
        for (const row of unsentWeek.rows) {
          const cnt = parseInt(row.cnt);
          if (activeIds.has(row.user_id)) realFailures7d += cnt;
          else skippedNoSub7d += cnt;
        }
      } catch {
        for (const row of unsentWeek.rows) {
          realFailures7d += parseInt(row.cnt);
        }
      }

      res.json({
        recentActivity: recentEmails.rows.map((r: any) => ({
          userId: r.user_id,
          email: r.email || null,
          title: r.listing_title || "—",
          emailSentAt: r.email_sent_at,
          pushSentAt: r.push_sent_at,
          channel: r.email_sent_at ? "email" : "push",
        })),
        stats: {
          emailsToday: parseInt(emailsToday.rows[0].count),
          pushToday: parseInt(pushToday.rows[0].count),
          undelivered7d: realFailures7d,
          skippedNoSub7d,
        },
      });
    } catch (err: any) {
      log(`[admin] Alert activity error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/email-diagnostics", requireAdmin, async (_req, res) => {
    try {
      const apiKey = process.env.RESEND_API_KEY || "";
      const fromEmail = process.env.RESEND_FROM_EMAIL || "";
      const replyTo = process.env.RESEND_REPLY_TO || "";

      const apiKeyConfigured = !!apiKey;
      const fromConfigured = !!fromEmail;

      let apiStatus: "operational" | "misconfigured" | "missing" = "missing";
      let apiError: string | null = null;
      let domainsLimited = false;
      if (apiKeyConfigured && fromConfigured) {
        try {
          const { Resend } = await import("resend");
          const client = new Resend(apiKey);
          const domainsRes = await client.domains.list();
          const domainErr = (domainsRes as any).error;
          if (domainErr) {
            const isRestrictedKey =
              domainErr.name === "restricted_api_key" ||
              domainErr.statusCode === 401 ||
              (typeof domainErr.message === "string" && domainErr.message.toLowerCase().includes("restricted"));
            if (isRestrictedKey) {
              apiStatus = "operational";
              domainsLimited = true;
            } else {
              apiStatus = "misconfigured";
              apiError = domainErr.message || "API key invalid";
            }
          } else {
            apiStatus = "operational";
          }
        } catch (e: any) {
          apiStatus = "misconfigured";
          apiError = e.message;
        }
      } else {
        apiError = !apiKey ? "RESEND_API_KEY not set" : "RESEND_FROM_EMAIL not set";
      }

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

      let lastSuccessfulSend: string | null = null;
      let totalSent7d = 0;
      let totalSentToday = 0;
      try {
        const lastSent = await pgPool.query(
          "SELECT email_sent_at FROM user_matches WHERE email_sent = true ORDER BY email_sent_at DESC LIMIT 1"
        );
        lastSuccessfulSend = lastSent.rows[0]?.email_sent_at || null;
        const sent7d = await pgPool.query(
          "SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND email_sent_at >= $1", [weekAgo]
        );
        totalSent7d = parseInt(sent7d.rows[0]?.count || "0");
        const sentToday = await pgPool.query(
          "SELECT COUNT(*) FROM user_matches WHERE email_sent = true AND email_sent_at >= $1", [todayStart.toISOString()]
        );
        totalSentToday = parseInt(sentToday.rows[0]?.count || "0");
      } catch {}

      let queueDepth = 0;
      let deliveryRate7d: number | null = null;
      try {
        const subRes = await supabase.from("subscriptions").select("user_id, status, trial_ends_at, current_period_ends_at");
        const activeIds = new Set<string>();
        for (const s of (subRes.data || [])) {
          const isTrial = s.status === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) > now;
          const isActive = s.status === "active" && (!s.current_period_ends_at || new Date(s.current_period_ends_at) > now);
          const isPastDue = s.status === "past_due";
          const canceledActive = s.status === "canceled" && s.current_period_ends_at && new Date(s.current_period_ends_at) > now;
          if (isTrial || isActive || isPastDue || canceledActive) activeIds.add(s.user_id);
        }

        const unsentRes = await pgPool.query(
          `SELECT user_id FROM user_matches WHERE email_sent = false AND matched_at >= $1 AND visible_in_app = true`, [weekAgo]
        );
        let realFailures7d = 0;
        for (const row of unsentRes.rows) {
          if (activeIds.has(row.user_id)) { realFailures7d++; queueDepth++; }
        }
        if (totalSent7d + realFailures7d > 0) {
          deliveryRate7d = Math.round((totalSent7d / (totalSent7d + realFailures7d)) * 100);
        }
      } catch {}

      res.json({
        apiStatus,
        apiKeyConfigured,
        fromConfigured,
        fromEmail: fromConfigured ? fromEmail : null,
        replyTo: replyTo || null,
        apiError,
        domainsLimited,
        lastSuccessfulSend,
        totalSent7d,
        totalSentToday,
        queueDepth,
        deliveryRate7d,
      });
    } catch (err: any) {
      log(`[admin] Email diagnostics error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/user-pipeline-diagnostic", requireAdmin, async (req, res) => {
    try {
      const email = (req.query.email as string || "").trim().toLowerCase();
      const userId = (req.query.user_id as string || "").trim();
      if (!email && !userId) return res.status(400).json({ error: "Provide ?email= or ?user_id=" });

      const adminSb = getSupabaseAdmin();
      let resolvedUserId = userId;
      let resolvedEmail = email;

      if (email && !resolvedUserId) {
        const { data: found } = await adminSb.auth.admin.listUsers();
        const match = (found?.users || []).find((u: any) => u.email?.toLowerCase() === email);
        if (!match) return res.status(404).json({ error: `No user found with email: ${email}` });
        resolvedUserId = match.id;
        resolvedEmail = match.email || email;
      } else if (resolvedUserId && !resolvedEmail) {
        const { data: u } = await adminSb.auth.admin.getUserById(resolvedUserId);
        resolvedEmail = u?.user?.email || resolvedUserId;
      }

      const [profilesRes, subRes, notifRes] = await Promise.all([
        supabase.from("search_profiles").select("*").eq("user_id", resolvedUserId),
        supabase.from("subscriptions").select("*").eq("user_id", resolvedUserId).maybeSingle(),
        supabase.from("user_notification_settings").select("*").eq("user_id", resolvedUserId).maybeSingle(),
      ]);

      const profileIds = (profilesRes.data || []).map((p: any) => p.id);
      let matchStatsByProfile: Record<string, any> = {};
      if (profileIds.length > 0) {
        const rows = await pgPool.query(
          `SELECT search_profile_id,
             COUNT(*)::int as total_matches,
             COUNT(*) FILTER (WHERE email_sent = true)::int as email_sent,
             COUNT(*) FILTER (WHERE matched_at >= NOW() - INTERVAL '7 days')::int as matched_7d,
             COUNT(*) FILTER (WHERE matched_at >= NOW() - INTERVAL '24 hours')::int as matched_24h,
             MAX(matched_at) as last_match_at,
             MAX(email_sent_at) as last_email_at
           FROM user_matches
           WHERE user_id = $1 AND search_profile_id = ANY($2::uuid[])
           GROUP BY search_profile_id`,
          [resolvedUserId, profileIds]
        );
        for (const r of rows.rows) matchStatsByProfile[r.search_profile_id] = r;
      }

      const recentRuns = await pgPool.query(
        `SELECT started_at, status, total_found, total_inserted, total_matches, total_errors, duration_sec
         FROM ingestion_runs ORDER BY started_at DESC LIMIT 5`
      );

      const userMatchSummary = await pgPool.query(
        `SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE email_sent = true)::int as emailed,
           COUNT(*) FILTER (WHERE matched_at >= NOW() - INTERVAL '24 hours')::int as matched_24h,
           COUNT(*) FILTER (WHERE matched_at >= NOW() - INTERVAL '7 days')::int as matched_7d,
           MAX(matched_at) as last_match, MAX(email_sent_at) as last_email
         FROM user_matches WHERE user_id = $1`,
        [resolvedUserId]
      );

      const profiles = (profilesRes.data || []).map((p: any) => ({
        ...p,
        match_stats: matchStatsByProfile[p.id] || { total_matches: 0, email_sent: 0, matched_7d: 0, matched_24h: 0 },
      }));

      res.json({
        user: { id: resolvedUserId, email: resolvedEmail },
        subscription: subRes.data || null,
        notification_settings: notifRes.data || null,
        search_profiles: profiles,
        match_summary: userMatchSummary.rows[0] || null,
        recent_ingest_runs: recentRuns.rows,
      });
    } catch (err: any) {
      log(`[admin] user-pipeline-diagnostic error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Pipeline Monitoring ────────────────────────────────────────────────────

  app.get("/api/admin/portal/source-health", requireAdmin, async (_req, res) => {
    try {
      const rows = await getSourceHealthSummary();
      res.json({ sources: rows });
    } catch (err: any) {
      log(`[admin] source-health error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/pipeline-alerts", requireAdmin, async (req, res) => {
    try {
      const mode = (req.query.mode as string) || "open";
      const alerts = mode === "all" ? await getRecentAlerts(100) : await getOpenAlerts();
      res.json({ alerts, count: alerts.length });
    } catch (err: any) {
      log(`[admin] pipeline-alerts error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/pipeline-alerts/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid alert id" });
      const resolved = await resolveAlertById(id);
      res.json({ resolved });
    } catch (err: any) {
      log(`[admin] resolve-alert error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/listing-trace", requireAdmin, async (req, res) => {
    try {
      const listingId = (req.query.listing_id as string || "").trim();
      if (!listingId) return res.status(400).json({ error: "Provide ?listing_id=" });

      const adminSb = getSupabaseAdmin();

      const [listingRes, freshnessRes] = await Promise.all([
        // Try to select all fields including migration-031 columns; fall back to base set if they don't exist yet
        adminSb.from("listings").select("id, title, city, price, url, source, created_at, image_url, listing_cluster_id, district, latitude, longitude, coordinate_precision, postcode, street").eq("id", listingId).single()
          .then(r => r.error ? adminSb.from("listings").select("id, title, city, price, url, source, created_at, image_url, district, latitude, longitude, coordinate_precision").eq("id", listingId).single() : r),
        adminSb.from("listing_freshness").select("listing_id, source, source_id, first_seen_at, last_seen_at").eq("listing_id", listingId).single(),
      ]);

      const listing = (listingRes as any).data;
      const freshness = freshnessRes.data;

      // Fetch cluster siblings if this listing has a cluster_id (requires migration 031)
      let clusterSiblings: any[] = [];
      if (listing?.listing_cluster_id) {
        const { data: siblings } = await adminSb
          .from("listings")
          .select("id, source, title, price, url, created_at, coordinate_precision")
          .eq("listing_cluster_id", listing.listing_cluster_id)
          .neq("id", listingId)
          .order("created_at", { ascending: true })
          .limit(20);
        clusterSiblings = siblings ?? [];
      }

      const { rows: matchRows } = await pgPool.query(
        `SELECT user_id, search_profile_id, matched_at, listing_title, listing_city, listing_price,
                email_sent, email_sent_at, push_sent, push_sent_at, viewed_at, applied_at
         FROM user_matches WHERE listing_id = $1 ORDER BY matched_at ASC`,
        [listingId]
      );

      let nearestRun: any = null;
      if (freshness?.first_seen_at) {
        const { rows: runRows } = await pgPool.query(
          `SELECT id, started_at, finished_at, total_found, total_inserted, total_matches, status
           FROM ingestion_runs
           WHERE ABS(EXTRACT(EPOCH FROM (finished_at - $1::timestamptz))) < 600
           ORDER BY ABS(EXTRACT(EPOCH FROM (finished_at - $1::timestamptz))) ASC
           LIMIT 1`,
          [freshness.first_seen_at]
        );
        nearestRun = runRows[0] ?? null;
      }

      res.json({
        listing: listing ?? null,
        freshness: freshness ?? null,
        matches: matchRows,
        ingestion_run: nearestRun,
        cluster: listing?.listing_cluster_id
          ? { id: listing.listing_cluster_id, size: clusterSiblings.length + 1, siblings: clusterSiblings }
          : null,
        timeline: [
          freshness?.first_seen_at ? { event: "first_scraped", at: freshness.first_seen_at } : null,
          listing?.created_at ? { event: "inserted_to_db", at: listing.created_at } : null,
          ...matchRows.map(m => ({ event: "matched", at: m.matched_at, user_id: m.user_id })),
          ...matchRows.filter(m => m.email_sent_at).map(m => ({ event: "email_sent", at: m.email_sent_at, user_id: m.user_id })),
          ...matchRows.filter(m => m.push_sent_at).map(m => ({ event: "push_sent", at: m.push_sent_at, user_id: m.user_id })),
          ...matchRows.filter(m => m.viewed_at).map(m => ({ event: "viewed", at: m.viewed_at, user_id: m.user_id })),
        ].filter(Boolean).sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime()),
      });
    } catch (err: any) {
      log(`[admin] listing-trace error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Dedup audit — cross-source duplicate statistics
  app.get("/api/admin/portal/dedup-audit", requireAdmin, async (req, res) => {
    try {
      const adminSb = getSupabaseAdmin();
      const days = parseInt((req.query.days as string) || "7", 10);
      const city = (req.query.city as string || "Berlin").trim();
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Fetch listings for analysis (fields available without migration 031)
      const { data: listings, error: lErr } = await adminSb
        .from("listings")
        .select("id, source, price, size_m2, bedrooms, district, latitude, longitude, coordinate_precision, listing_cluster_id")
        .eq("city", city)
        .gte("created_at", since)
        .limit(5000);

      if (lErr) throw new Error(lErr.message);
      const rows: any[] = listings ?? [];

      const hasClusterCol = rows.length > 0 && "listing_cluster_id" in rows[0];
      const totalListings = rows.length;

      // Count clustered listings (cluster_id assigned and not solo)
      const clusterGroups: Record<string, any[]> = {};
      if (hasClusterCol) {
        for (const r of rows) {
          if (r.listing_cluster_id) {
            if (!clusterGroups[r.listing_cluster_id]) clusterGroups[r.listing_cluster_id] = [];
            clusterGroups[r.listing_cluster_id].push(r);
          }
        }
      }

      const multiSourceClusters = Object.entries(clusterGroups)
        .filter(([, members]) => {
          const srcs = new Set(members.map((m: any) => m.source));
          return srcs.size > 1;
        });

      // Haversine helper
      const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6_371_000, d2r = Math.PI / 180;
        const dLat = (lat2 - lat1) * d2r, dLng = (lng2 - lng1) * d2r;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      // Run price-based candidate pair analysis for false positive rate estimation
      let algoCandidates = 0, coordConfirmed = 0, coordRefuted = 0;
      const pairsBySrc: Record<string, number> = {};
      const exampleDups: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const a = rows[i];
        if (!a.price || !a.bedrooms) continue;
        for (let j = i + 1; j < rows.length; j++) {
          const b = rows[j];
          if (a.source === b.source || !b.price || !b.bedrooms) continue;
          if (a.bedrooms !== b.bedrooms) continue;
          const pd = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
          if (pd > 0.08) continue;
          if (a.size_m2 && b.size_m2 && Math.abs(a.size_m2 - b.size_m2) / Math.max(a.size_m2, b.size_m2) > 0.15) continue;
          algoCandidates++;
          const pk = [a.source, b.source].sort().join(" <-> ");
          pairsBySrc[pk] = (pairsBySrc[pk] || 0) + 1;
          if (a.latitude && a.longitude && b.latitude && b.longitude) {
            const dist = hav(a.latitude, a.longitude, b.latitude, b.longitude);
            if (dist < 200) {
              coordConfirmed++;
              if (exampleDups.length < 5) {
                exampleDups.push({
                  sources: [a.source, b.source],
                  price: [a.price, b.price],
                  bedrooms: a.bedrooms,
                  size_m2: [a.size_m2, b.size_m2],
                  dist_m: Math.round(dist),
                  clustered: hasClusterCol && a.listing_cluster_id && a.listing_cluster_id === b.listing_cluster_id,
                });
              }
            } else {
              coordRefuted++;
            }
          }
        }
      }

      const falsePosRate = algoCandidates > 0 ? ((algoCandidates - coordConfirmed) / algoCandidates * 100).toFixed(1) : null;

      res.json({
        city,
        days,
        total_listings: totalListings,
        sources: Array.from(new Set(rows.map((r: any) => r.source))),
        cluster_column_active: hasClusterCol,
        multi_source_clusters: multiSourceClusters.length,
        coord_coverage_pct: rows.length > 0 ? parseFloat((rows.filter((r: any) => r.latitude).length / rows.length * 100).toFixed(1)) : 0,
        algorithm_candidate_pairs: algoCandidates,
        coord_confirmed_pairs: coordConfirmed,
        coord_refuted_pairs: coordRefuted,
        false_positive_rate_pct: falsePosRate ? parseFloat(falsePosRate) : null,
        pairs_by_source: Object.entries(pairsBySrc)
          .sort((a, b) => b[1] - a[1])
          .map(([pair, count]) => ({ pair, count })),
        example_confirmed_duplicates: exampleDups,
      });
    } catch (err: any) {
      log(`[admin] dedup-audit error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/sla-metrics", requireAdmin, async (_req, res) => {
    try {
      const { rows: emailSla } = await pgPool.query(
        `SELECT
           COUNT(*) FILTER (WHERE email_sent AND email_sent_at IS NOT NULL AND matched_at IS NOT NULL) AS email_count,
           ROUND(AVG(EXTRACT(EPOCH FROM (email_sent_at - matched_at)) / 60)
             FILTER (WHERE email_sent AND email_sent_at IS NOT NULL AND matched_at IS NOT NULL
                       AND matched_at >= NOW() - INTERVAL '7 days'))::int AS avg_match_to_email_min,
           ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (email_sent_at - matched_at)) / 60)
             FILTER (WHERE email_sent AND email_sent_at IS NOT NULL AND matched_at IS NOT NULL
                       AND matched_at >= NOW() - INTERVAL '7 days'))::int AS median_match_to_email_min,
           ROUND(AVG(EXTRACT(EPOCH FROM (push_sent_at - matched_at)) / 60)
             FILTER (WHERE push_sent AND push_sent_at IS NOT NULL AND matched_at IS NOT NULL
                       AND matched_at >= NOW() - INTERVAL '7 days'))::int AS avg_match_to_push_min
         FROM user_matches
         WHERE matched_at >= NOW() - INTERVAL '30 days'`
      );

      const { rows: dailySla } = await pgPool.query(
        `SELECT
           DATE(matched_at) AS day,
           COUNT(*) AS matches,
           COUNT(*) FILTER (WHERE email_sent) AS emails_sent,
           COUNT(*) FILTER (WHERE push_sent) AS push_sent,
           ROUND(AVG(EXTRACT(EPOCH FROM (email_sent_at - matched_at)) / 60)
             FILTER (WHERE email_sent AND email_sent_at IS NOT NULL))::int AS avg_email_min,
           ROUND(AVG(EXTRACT(EPOCH FROM (push_sent_at - matched_at)) / 60)
             FILTER (WHERE push_sent AND push_sent_at IS NOT NULL))::int AS avg_push_min
         FROM user_matches
         WHERE matched_at >= NOW() - INTERVAL '14 days'
         GROUP BY DATE(matched_at)
         ORDER BY day DESC`
      );

      const { rows: ingestSla } = await pgPool.query(
        `SELECT
           DATE(finished_at) AS day,
           COUNT(*) AS runs,
           ROUND(AVG(duration_sec))::int AS avg_duration_sec,
           SUM(total_found) AS total_found,
           SUM(total_inserted) AS total_inserted,
           SUM(total_matches) AS total_matches,
           SUM(total_errors) AS total_errors,
           COUNT(*) FILTER (WHERE status = 'success') AS success_runs,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs
         FROM ingestion_runs
         WHERE finished_at >= NOW() - INTERVAL '14 days'
         GROUP BY DATE(finished_at)
         ORDER BY day DESC`
      );

      const { rows: openAlertCounts } = await pgPool.query(
        `SELECT severity, COUNT(*) AS count FROM admin_alerts WHERE status = 'open' GROUP BY severity`
      );

      res.json({
        summary: emailSla[0] ?? {},
        daily: dailySla,
        ingest_daily: ingestSla,
        open_alert_counts: openAlertCounts,
      });
    } catch (err: any) {
      log(`[admin] sla-metrics error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/source-registry", requireAdmin, async (_req, res) => {
    try {
      const healthRows = await getSourceHealthSummary();
      const healthMap = new Map(healthRows.map(h => [`${h.source_name}:${h.city}`, h]));

      const registry = SOURCE_REGISTRY.map(entry => {
        const healthEntries = healthRows.filter(h => h.source_name.toLowerCase() === entry.name.toLowerCase());
        const anyHealthy = healthEntries.some(h => h.status === "healthy");
        const lastSuccess = healthEntries.reduce((best: string | null, h) => {
          if (!h.last_success_at) return best;
          if (!best) return h.last_success_at;
          return h.last_success_at > best ? h.last_success_at : best;
        }, null);
        return { ...entry, health_entries: healthEntries, any_healthy: anyHealthy, last_success_global: lastSuccess };
      });

      res.json({ registry });
    } catch (err: any) {
      log(`[admin] source-registry error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/portal/rejection-trace", requireAdmin, async (req, res) => {
    try {
      const email = (req.query.email as string || "").trim().toLowerCase();
      const userId = (req.query.user_id as string || "").trim();
      if (!email && !userId) return res.status(400).json({ error: "Provide ?email= or ?user_id=" });

      const adminSb = getSupabaseAdmin();
      let resolvedUserId = userId;

      if (email && !resolvedUserId) {
        const result = await lookupSupabaseUserByEmail(adminSb, email);
        if (!result) return res.status(404).json({ error: "User not found" });
        resolvedUserId = result.id;
      }

      const { data: profiles } = await adminSb
        .from("search_profiles")
        .select("*")
        .eq("user_id", resolvedUserId)
        .eq("is_active", true);

      if (!profiles || profiles.length === 0) {
        return res.json({ profiles: [], traces: [], message: "No active profiles found" });
      }

      const cities = [...new Set(profiles.map((p: any) => p.city_name || p.city).filter(Boolean))];
      const traces: any[] = [];

      for (const city of cities) {
        const { data: recentListings } = await adminSb
          .from("listings")
          .select("id, title, city, price, rooms, size_sqm, source, url, created_at, extra_features")
          .ilike("city", city)
          .order("created_at", { ascending: false })
          .limit(15);

        if (!recentListings || recentListings.length === 0) continue;

        for (const listing of recentListings) {
          const profileResults: any[] = [];
          for (const profile of profiles) {
            if ((profile.city_name || profile.city || "").toLowerCase() !== city.toLowerCase()) continue;
            try {
              const explanation = explainMatchInternal(listing as any, profile as any);
              profileResults.push({
                profile_id: profile.id,
                profile_summary: `€${profile.max_rent ?? "?"} | ${profile.min_rooms ?? "?"}+ rooms | r=${profile.max_radius_km ?? "?"}km`,
                matched: explanation.matched,
                score: explanation.score,
                reasons: explanation.reasons,
                rejections: explanation.rejections,
              });
            } catch {
              profileResults.push({ profile_id: profile.id, matched: false, score: 0, reasons: [], rejections: ["Engine error"] });
            }
          }
          traces.push({
            listing_id: listing.id,
            title: listing.title,
            city: listing.city,
            price: listing.price,
            rooms: listing.rooms,
            source: listing.source,
            created_at: listing.created_at,
            profiles: profileResults,
          });
        }
      }

      res.json({ profiles, traces, cities });
    } catch (err: any) {
      log(`[admin] rejection-trace error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Alert Engine Simulation (admin-only, non-destructive) ─────────────────

  const SIM_SOURCE = "sim-source";
  const SIM_CITY   = "SimCity";
  const SIM_KEY    = `${SIM_SOURCE}:${SIM_CITY}`;

  app.post("/api/admin/portal/simulate-failure", requireAdmin, async (_req, res) => {
    try {
      // 1. Clean up any leftover sim data from a previous run
      await pgPool.query(`DELETE FROM source_health WHERE source_name = $1 AND city = $2`, [SIM_SOURCE, SIM_CITY]);
      await pgPool.query(`UPDATE admin_alerts SET status = 'resolved', resolved_at = NOW() WHERE alert_key LIKE $1 AND status = 'open'`, [`%${SIM_KEY}%`]);

      // 2. Plant a fake source_health row that looks like it's been failing for 35 minutes
      const fakeLastSuccess = new Date(Date.now() - 35 * 60 * 1000);
      await pgPool.query(
        `INSERT INTO source_health
          (source_name, city, last_started_at, last_success_at, last_failure_at,
           duration_ms, found_count, inserted_count, duplicate_count, error_count,
           last_error, status, consecutive_failures, consecutive_zeros, total_runs)
         VALUES ($1, $2, NOW(), $3, NOW(), 1200, 0, 0, 0, 3,
                 '[SIMULATION] HTTP 429 Too Many Requests — bot protection triggered',
                 'degraded', 5, 5, 8)`,
        [SIM_SOURCE, SIM_CITY, fakeLastSuccess.toISOString()]
      );

      // 3. Build a fake IngestionReport with this source erroring out
      const fakeReport = {
        sources: [{
          name: `${SIM_SOURCE} (${SIM_CITY})`,
          found: 0,
          inserted: 0,
          duplicates: 0,
          matches: 0,
          errors: 3,
          errorMessage: "[SIMULATION] HTTP 429 Too Many Requests — bot protection triggered",
          durationMs: 1200,
        }],
        cityReports: [],
        total: { found: 0, inserted: 0, duplicates: 0, matches: 0, errors: 3 },
        cities: [SIM_CITY],
        durationSec: 1.2,
      };

      // 4. Run the alert engine — this should create a source_down alert + send email
      await evaluateAlertRules(fakeReport as any, new Date(), "partial");

      // 5. Fetch what was created
      const { rows: alertRows } = await pgPool.query(
        `SELECT * FROM admin_alerts WHERE alert_key LIKE $1 ORDER BY created_at DESC LIMIT 5`,
        [`%${SIM_KEY}%`]
      );
      const { rows: healthRows } = await pgPool.query(
        `SELECT * FROM source_health WHERE source_name = $1 AND city = $2`,
        [SIM_SOURCE, SIM_CITY]
      );

      const createdAlert = alertRows.find((a: any) => a.status === "open");
      const resendConfigured = !!process.env.RESEND_API_KEY;
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e: string) => e.trim()).filter(Boolean);

      res.json({
        success: true,
        phase: "failure_simulated",
        summary: {
          source: `${SIM_SOURCE} (${SIM_CITY})`,
          minutes_since_last_success: 35,
          consecutive_failures: 5,
          alert_created: !!createdAlert,
          alert_id: createdAlert?.id ?? null,
          alert_type: createdAlert?.alert_type ?? null,
          alert_severity: createdAlert?.severity ?? null,
          email_attempted: resendConfigured && adminEmails.length > 0,
          email_recipients: adminEmails,
          notification_count: createdAlert?.notification_count ?? 0,
          last_notified_at: createdAlert?.last_notified_at ?? null,
          resend_configured: resendConfigured,
        },
        alert: createdAlert ?? null,
        health_row: healthRows[0] ?? null,
        next_step: "POST /api/admin/portal/simulate-recovery to verify auto-resolution and clean up",
      });
    } catch (err: any) {
      log(`[simulate-failure] error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/portal/simulate-recovery", requireAdmin, async (_req, res) => {
    try {
      // 1. Check if there's an open alert to resolve
      const { rows: beforeRows } = await pgPool.query(
        `SELECT * FROM admin_alerts WHERE alert_key LIKE $1 AND status = 'open'`,
        [`%${SIM_KEY}%`]
      );
      const alertWasOpen = beforeRows.length > 0;

      // 2. Run the alert engine with a successful report — triggers auto-resolution
      const fakeSuccessReport = {
        sources: [{
          name: `${SIM_SOURCE} (${SIM_CITY})`,
          found: 18,
          inserted: 4,
          duplicates: 14,
          matches: 2,
          errors: 0,
          errorMessage: undefined,
          durationMs: 980,
        }],
        cityReports: [],
        total: { found: 18, inserted: 4, duplicates: 14, matches: 2, errors: 0 },
        cities: [SIM_CITY],
        durationSec: 0.98,
      };
      await evaluateAlertRules(fakeSuccessReport as any, new Date(), "success");

      // 3. Verify the alert was resolved
      const { rows: afterRows } = await pgPool.query(
        `SELECT * FROM admin_alerts WHERE alert_key LIKE $1 ORDER BY updated_at DESC LIMIT 5`,
        [`%${SIM_KEY}%`]
      );

      // 4. Clean up the fake source_health row
      await pgPool.query(`DELETE FROM source_health WHERE source_name = $1 AND city = $2`, [SIM_SOURCE, SIM_CITY]);

      const resolvedAlert = afterRows.find((a: any) => a.status === "resolved" && beforeRows.some((b: any) => b.id === a.id));
      const allResolved = afterRows.every((a: any) => a.status === "resolved");

      res.json({
        success: true,
        phase: "recovery_simulated",
        summary: {
          source: `${SIM_SOURCE} (${SIM_CITY})`,
          alert_was_open_before: alertWasOpen,
          alert_auto_resolved: !!resolvedAlert || allResolved,
          alert_resolved_at: resolvedAlert?.resolved_at ?? afterRows[0]?.resolved_at ?? null,
          sim_health_row_cleaned_up: true,
        },
        alerts: afterRows,
        message: allResolved
          ? "✓ Full cycle verified: failure detected → alert created → email sent → recovery detected → auto-resolved → cleaned up"
          : "⚠ Some alerts may still be open — check admin_alerts table manually",
      });
    } catch (err: any) {
      log(`[simulate-recovery] error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/portal/simulate-cleanup", requireAdmin, async (_req, res) => {
    try {
      await pgPool.query(`DELETE FROM source_health WHERE source_name = $1`, [SIM_SOURCE]);
      await pgPool.query(`UPDATE admin_alerts SET status = 'resolved', resolved_at = NOW() WHERE alert_key LIKE $1 AND status = 'open'`, [`%${SIM_KEY}%`]);
      res.json({ success: true, message: "Simulation data cleaned up" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── End Pipeline Monitoring ────────────────────────────────────────────────

  app.get("/api/support/notifications", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");
      if (!token) return res.json({ notifications: [] });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.json({ notifications: [] });
      const { rows } = await pgPool.query(
        `SELECT id, ticket_id, title, body, read_at, created_at
         FROM support_notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [user.id]
      );
      res.json({ notifications: rows });
    } catch (err: any) {
      log(`[support] Error fetching notifications: ${err.message}`);
      res.json({ notifications: [] });
    }
  });

  app.patch("/api/support/notifications/:id/read", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      await pgPool.query(
        `UPDATE support_notifications SET read_at = NOW()
         WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
        [id, user.id]
      );
      res.json({ ok: true });
    } catch (err: any) {
      log(`[support] Error marking notification read: ${err.message}`);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/support/my-tickets", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.json({ tickets: [] });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.json({ tickets: [] });
      const { rows } = await pgPool.query(
        `SELECT st.id, st.subject, st.status, st.created_at, st.updated_at, st.has_unread_admin_reply, st.last_message_at,
                lm.message as last_message, lm.sender_type as last_sender_type
         FROM support_tickets st
         LEFT JOIN LATERAL (
           SELECT message, sender_type FROM support_ticket_messages WHERE ticket_id = st.id ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         WHERE st.user_id = $1
         ORDER BY COALESCE(st.last_message_at, st.created_at) DESC
         LIMIT 20`,
        [user.id]
      );
      res.json({ tickets: rows });
    } catch (err: any) {
      log(`[support] Error fetching my-tickets: ${err.message}`);
      res.json({ tickets: [] });
    }
  });

  app.get("/api/support/tickets/:id/thread", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const { rows: tickets } = await pgPool.query(
        `SELECT id, subject, status, created_at, updated_at FROM support_tickets WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      if (!tickets[0]) return res.status(404).json({ error: "Ticket not found" });
      const { rows: rawMessages } = await pgPool.query(
        `SELECT id, ticket_id, sender_type, message, faq_title, faq_url, created_at,
          original_body, original_language, translations, translation_status
         FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      await pgPool.query(`UPDATE support_tickets SET has_unread_admin_reply = FALSE WHERE id = $1`, [id]);
      const userLang = await getUserPreferredLanguage(user.id);
      const messages = await applyDisplayBodies(rawMessages, userLang);
      res.json({ ...tickets[0], messages });
    } catch (err: any) {
      log(`[support] Error fetching thread: ${err.message}`);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/support/tickets/:id/reply", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: "message required" });
      const { rows: tickets } = await pgPool.query(
        `SELECT id, status FROM support_tickets WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      const ticket = tickets[0];
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.status === "closed") return res.status(400).json({ error: "Ticket is closed" });
      const { rows: msgRows } = await pgPool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_user_id, message, original_body) VALUES ($1, 'user', $2, $3, $3) RETURNING *`,
        [id, user.id, message.trim()]
      );
      const newStatus = ticket.status === "resolved" ? "open" : ticket.status;
      await pgPool.query(
        `UPDATE support_tickets SET status = $1, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [newStatus, id]
      );
      if (ticket.status === "resolved") {
        log(`[support] Ticket #${id} reopened by user reply`);
      }
      detectAndStoreLanguage(msgRows[0].id, message.trim()).catch(() => {});
      res.json({ ok: true, message: msgRows[0], new_status: newStatus });
    } catch (err: any) {
      log(`[support] Error posting user reply: ${err.message}`);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/support/faq-suggestions", async (req, res) => {
    try {
      const { subject, message, customSubject } = req.body;
      if (!subject || !message) return res.json({ suggestions: [] });
      const suggestions = await getFaqSuggestions(subject, message, customSubject);
      log(`[support-faq] suggestions for subject="${subject}" → ${suggestions.length} results`);
      res.json({ suggestions });
    } catch (err: any) {
      log(`[support-faq] Error: ${err.message}`);
      res.json({ suggestions: [] });
    }
  });

  app.post("/api/support/faq-deflected", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");
      let userId: string | null = null;
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }
      const { faqId, subject } = req.body;
      log(`[support-faq] deflected — faqId=${faqId} subject="${subject}" user=${userId?.substring(0, 8) || "anon"}`);
      res.json({ ok: true });
    } catch (err: any) {
      log(`[support-faq] deflect log error: ${err.message}`);
      res.json({ ok: true });
    }
  });

  app.post("/api/support/tickets", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");
      let userId: string | null = null;
      let email: string | null = null;
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) { userId = user.id; email = user.email || null; }
      }
      const { subject, message } = req.body;
      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({ error: "subject and message are required" });
      }
      const result = await pgPool.query(
        `INSERT INTO support_tickets (user_id, email, subject, message, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'open', NOW(), NOW()) RETURNING id, created_at`,
        [userId, email, subject.trim(), message.trim()]
      );
      const ticketId = result.rows[0].id;
      const { rows: firstMsgRows } = await pgPool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_user_id, message, original_body) VALUES ($1, 'user', $2, $3, $3) RETURNING id`,
        [ticketId, userId, message.trim()]
      );
      await pgPool.query(`UPDATE support_tickets SET last_message_at = NOW() WHERE id = $1`, [ticketId]);
      detectAndStoreLanguage(firstMsgRows[0].id, message.trim()).catch(() => {});
      log(`[support] Ticket created id=${ticketId} user=${userId || "anonymous"}`);
      res.json({ id: ticketId, created_at: result.rows[0].created_at });
    } catch (err: any) {
      log(`[support] Error creating ticket: ${err.message}`);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.get("/api/admin/support/tickets", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "100"), 200);
      const offset = parseInt(req.query.offset as string || "0");
      const where = status ? "WHERE status = $1" : "";
      const params: any[] = status ? [status] : [];
      const countRes = await pgPool.query(
        `SELECT COUNT(*) FROM support_tickets ${where}`, params
      );
      const rows = await pgPool.query(
        `SELECT id, user_id, email, subject, message, status, created_at, updated_at, resolved_notified_at, has_unread_admin_reply, last_message_at
         FROM support_tickets ${where}
         ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      res.json({ tickets: rows.rows, total: parseInt(countRes.rows[0].count) });
    } catch (err: any) {
      log(`[support] Error fetching tickets: ${err.message}`);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.patch("/api/admin/support/tickets/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const { rows: before } = await pgPool.query(
        "SELECT status, user_id, email, subject, resolved_notified_at FROM support_tickets WHERE id = $1",
        [id]
      );
      const ticket = before[0];
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      await pgPool.query(
        "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2",
        [status, id]
      );

      const wasNotResolved = ticket.status !== "resolved";
      const nowResolved = status === "resolved";
      const notYetNotified = !ticket.resolved_notified_at;

      const notifResult = { push: false, email: false, inApp: false, emailError: null as string | null, alreadyNotified: false };

      if (wasNotResolved && nowResolved && notYetNotified) {
        log(`[support] Sending resolved notifications — ticket #${id}, user=${ticket.user_id?.substring(0, 8) || "anon"}`);

        // ── 1. Push notification ──────────────────────────────────────────────
        if (ticket.user_id) {
          try {
            const pushRes = await sendPushToUser(
              ticket.user_id,
              { title: "Je supportvraag is opgelost", body: "We hebben je vraag gemarkeerd als opgelost. Bedankt voor je bericht.", url: "/support" },
              supabase
            );
            notifResult.push = (pushRes.sent ?? 0) > 0;
            if (notifResult.push) {
              log(`[support] Push sent to user ${ticket.user_id.substring(0, 8)} (${pushRes.sent} endpoint(s))`);
            } else {
              log(`[support] Push not sent — no subscriptions or VAPID not initialized (user ${ticket.user_id.substring(0, 8)})`);
            }
          } catch (pushErr: any) {
            log(`[support] Push error: ${pushErr.message}`);
          }
        } else {
          log(`[support] Push skipped — ticket #${id} has no user_id (anonymous ticket)`);
        }

        // ── 2. Email notification ─────────────────────────────────────────────
        const apiKey = process.env.RESEND_API_KEY;
        const notifEmail = ticket.email;
        if (!apiKey) {
          log(`[support] Email skipped — RESEND_API_KEY not configured`);
        } else if (!notifEmail) {
          log(`[support] Email skipped — ticket #${id} has no email address`);
        } else {
          try {
            const { Resend } = await import("resend");
            const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@housalert.com";
            const resend = new Resend(apiKey);
            await resend.emails.send({
              from: `HousAlert <${fromEmail}>`,
              to: notifEmail,
              subject: "Je supportvraag is opgelost",
              html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
                <h2 style="font-size:20px;font-weight:700;color:#111111;margin-bottom:8px">Je supportvraag is opgelost</h2>
                <p style="font-size:15px;color:#555555;line-height:1.6">We hebben je vraag "<strong>${ticket.subject}</strong>" gemarkeerd als opgelost. Bedankt voor je bericht.</p>
                <p style="font-size:15px;color:#555555;line-height:1.6">Heb je nog vragen? Je kunt altijd een nieuw bericht sturen via de app.</p>
                <p style="font-size:13px;color:#999999;margin-top:32px">HousAlert Team</p>
              </div>`,
              text: `Je supportvraag is opgelost.\n\nWe hebben je vraag "${ticket.subject}" gemarkeerd als opgelost. Bedankt voor je bericht.\n\nHousAlert Team`,
            });
            notifResult.email = true;
            log(`[support] Email sent to ${notifEmail}`);
          } catch (emailErr: any) {
            notifResult.emailError = emailErr.message;
            log(`[support] Email FAILED to ${notifEmail} — ${emailErr.message}`);
          }
        }

        // ── 3. In-app notification (always attempted — guaranteed channel) ────
        if (ticket.user_id) {
          try {
            await pgPool.query(
              `INSERT INTO support_notifications (user_id, ticket_id, title, body)
               VALUES ($1, $2, $3, $4)`,
              [
                ticket.user_id,
                id,
                "Je supportvraag is opgelost",
                `We hebben je vraag "${ticket.subject}" gemarkeerd als opgelost.`,
              ]
            );
            notifResult.inApp = true;
            log(`[support] In-app notification created for user ${ticket.user_id.substring(0, 8)}`);
          } catch (inAppErr: any) {
            log(`[support] In-app notification FAILED: ${inAppErr.message}`);
          }
        } else {
          log(`[support] In-app notification skipped — no user_id on ticket #${id}`);
        }

        // ── 4. Mark notified only after at least one channel succeeded ────────
        if (notifResult.inApp || notifResult.push || notifResult.email) {
          await pgPool.query(
            "UPDATE support_tickets SET resolved_notified_at = NOW() WHERE id = $1",
            [id]
          );
        } else {
          log(`[support] WARNING: all notification channels failed for ticket #${id} — resolved_notified_at NOT set, will retry on next resolve`);
        }

        log(`[support] Notification summary #${id}: push=${notifResult.push} email=${notifResult.email} inApp=${notifResult.inApp}${notifResult.emailError ? ` emailError="${notifResult.emailError}"` : ""}`);

      } else if (!notYetNotified) {
        notifResult.alreadyNotified = true;
        log(`[support] Ticket #${id} already notified at ${ticket.resolved_notified_at} — skipping`);
      }

      res.json({ ok: true, notif: notifResult });
    } catch (err: any) {
      log(`[support] Error updating ticket: ${err.message}`);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  app.get("/api/admin/support/tickets/:id/messages", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminUser = (req as any).adminUser;
      const adminLang = adminUser?.id ? await getUserPreferredLanguage(adminUser.id) : "nl";
      const { rows } = await pgPool.query(
        `SELECT id, ticket_id, sender_type, sender_user_id, message, faq_title, faq_url, created_at,
          original_body, original_language, translations, translation_status
         FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [id]
      );
      const messages = await applyDisplayBodies(rows, adminLang);
      res.json({ messages });
    } catch (err: any) {
      log(`[support] Error fetching messages: ${err.message}`);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.post("/api/admin/support/tickets/:id/reply", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { message, faq_title, faq_url } = req.body;
      if (!message?.trim() && !faq_title) return res.status(400).json({ error: "message or faq required" });
      const { rows: before } = await pgPool.query(
        "SELECT id, user_id, email, subject, status FROM support_tickets WHERE id = $1",
        [id]
      );
      const ticket = before[0];
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.status === "closed") return res.status(400).json({ error: "Cannot reply to closed ticket" });
      const { rows: msgRows } = await pgPool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, message, faq_title, faq_url, original_body) VALUES ($1, 'admin', $2, $3, $4, $2) RETURNING *`,
        [id, message?.trim() || "", faq_title || null, faq_url || null]
      );
      const newStatus = ticket.status === "open" ? "in_progress" : ticket.status;
      await pgPool.query(
        `UPDATE support_tickets SET status = $1, has_unread_admin_reply = TRUE, last_message_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [newStatus, id]
      );
      if (message?.trim()) {
        detectAndStoreLanguage(msgRows[0].id, message.trim()).catch(() => {});
      }
      if (ticket.user_id) {
        pgPool.query(
          `INSERT INTO support_notifications (user_id, ticket_id, title, body) VALUES ($1, $2, $3, $4)`,
          [ticket.user_id, id, "Nieuwe reactie van HousAlert", "We hebben gereageerd op je supportvraag."]
        ).catch((e: any) => log(`[support] In-app notif failed: ${e.message}`));
        sendPushToUser(ticket.user_id, {
          title: "Nieuwe reactie van HousAlert",
          body: "We hebben gereageerd op je supportvraag.",
          url: `/support/${id}`,
        }, supabase).then((r: any) => {
          log(`[support] Admin reply push: sent=${r.sent} user=${ticket.user_id?.substring(0, 8)}`);
        }).catch((e: any) => log(`[support] Admin reply push error: ${e.message}`));
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey && ticket.email) {
          (async () => {
            try {
              const { Resend } = await import("resend");
              const resend = new Resend(apiKey);
              await resend.emails.send({
                from: `HousAlert <${process.env.RESEND_FROM_EMAIL || "alerts@housalert.com"}>`,
                to: ticket.email,
                subject: "Nieuwe reactie van HousAlert",
                html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px"><h2 style="font-size:20px;font-weight:700;color:#111111;margin-bottom:8px">Nieuwe reactie van HousAlert</h2><p style="font-size:15px;color:#555555;line-height:1.6">We hebben gereageerd op je vraag "<strong>${ticket.subject}</strong>". Open de app om het antwoord te lezen.</p><p style="font-size:13px;color:#999999;margin-top:32px">HousAlert Team</p></div>`,
                text: `Nieuwe reactie op je supportvraag "${ticket.subject}". Open de app om het te lezen.\n\nHousAlert Team`,
              });
              log(`[support] Admin reply email sent to ${ticket.email}`);
            } catch (e: any) {
              log(`[support] Admin reply email FAILED to ${ticket.email}: ${e.message}`);
            }
          })();
        } else if (!apiKey) {
          log(`[support] Admin reply email skipped — RESEND_API_KEY not set`);
        }
      }
      log(`[support] Admin reply #${id}: status=${newStatus} faq=${!!faq_title}`);
      res.json({ ok: true, message: msgRows[0], new_status: newStatus });
    } catch (err: any) {
      log(`[support] Error posting admin reply: ${err.message}`);
      res.status(500).json({ error: "Failed" });
    }
  });

  app.get("/api/admin/portal/email-preview", requireAdmin, async (_req, res) => {
    try {
      const { generateSampleEmailHtml } = await import("./email");
      const html = generateSampleEmailHtml("en");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.send(html);
    } catch (err: any) {
      log(`[admin] Email preview error: ${err.message}`);
      res.status(500).send(`<html><body style="font-family:sans-serif;padding:24px;color:#e11d48;"><h3>Preview failed</h3><p>${err.message}</p></body></html>`);
    }
  });

  return httpServer;
}
