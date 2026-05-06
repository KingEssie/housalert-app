import { createClient } from "@supabase/supabase-js";
import { log } from "./log";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SubscriptionRow {
  id: string;
  user_id: string;
  status: "trial" | "active" | "past_due" | "canceled" | "expired";
  plan: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionStatus {
  status: string;
  plan: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  created_at: string | null;
  isActive: boolean;
  isTrial: boolean;
  isPastDue: boolean;
  inGracePeriod: boolean;
  gracePeriodEndsAt: string | null;
  isExpired: boolean;
  cancelAtPeriodEnd: boolean;
}

const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

/**
 * Centralized Stripe → HousAlert DB status mapping.
 *
 * Stripe status        │ HousAlert DB status │ Access rule
 * ─────────────────────┼─────────────────────┼──────────────────────────────────────────
 * active               │ active              │ full access while period current
 * trialing             │ (trial path)        │ handled separately via updateSubscriptionFromCheckout
 * past_due             │ past_due            │ 48-hour grace from first invoice.payment_failed
 * canceled             │ canceled            │ access until current_period_end, then blocked
 * unpaid               │ canceled            │ no access (Stripe exhausted all retries)
 * incomplete           │ expired             │ no access (initial payment never completed)
 * incomplete_expired   │ expired             │ no access
 * (any other/unknown)  │ expired             │ no access (safe default)
 *
 * Note: "trialing" is intentionally absent — callers that receive it must use
 * updateSubscriptionFromCheckout() to also persist trial_ends_at.
 */
export function stripeStatusToDb(
  stripeStatus: string
): "active" | "past_due" | "canceled" | "expired" {
  switch (stripeStatus) {
    case "active":            return "active";
    case "past_due":          return "past_due";
    case "canceled":
    case "unpaid":            return "canceled";
    case "incomplete":
    case "incomplete_expired":
    default:                  return "expired";
  }
}

export async function ensureTrialSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    log(`[subscriptions] Trial already exists for user=${userId}`);
    return existing as SubscriptionRow;
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      status: "trial",
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();

  if (error) {
    log(`[subscriptions] Error creating trial for user=${userId}: ${error.message}`);
    return null;
  }

  log(`[subscriptions] Trial created for user=${userId}, ends_at=${trialEndsAt}`);
  return data as SubscriptionRow;
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return {
      status: "none",
      plan: null,
      trial_ends_at: null,
      current_period_ends_at: null,
      created_at: null,
      isActive: false,
      isTrial: false,
      isPastDue: false,
      inGracePeriod: false,
      gracePeriodEndsAt: null,
      isExpired: true,
      cancelAtPeriodEnd: false,
    };
  }

  let row = data as SubscriptionRow & { cancel_at_period_end?: boolean };
  const now = new Date();

  const periodExpired = row.current_period_ends_at !== null && new Date(row.current_period_ends_at) <= now;
  const dbLooksExpired = row.status === "active" && periodExpired && row.stripe_subscription_id;

  if (dbLooksExpired) {
    try {
      const { getUncachableStripeClient } = await import("./stripe/stripeClient");
      const stripe = await getUncachableStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id!);
      log(`[getSubscriptionStatus] SYNC from Stripe for user=${userId}: stripe status=${stripeSub.status}, current_period_end=${stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : "null"}`);

      let healStatus: string | null = null;
      let healData: Record<string, any> = { updated_at: new Date().toISOString() };

      if (stripeSub.status === "active" || stripeSub.status === "trialing") {
        const rawEnd = stripeSub.current_period_end
          ?? (stripeSub as any).items?.data?.[0]?.current_period_end
          ?? null;
        const newPeriodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        healStatus = "active";
        healData.status = "active";
        healData.current_period_ends_at = newPeriodEnd.toISOString();
      } else if (stripeSub.status === "past_due") {
        healStatus = "past_due";
        healData.status = "past_due";
      } else if (stripeSub.status === "canceled" || stripeSub.status === "unpaid") {
        healStatus = "canceled";
        healData.status = "canceled";
      } else {
        healStatus = "expired";
        healData.status = "expired";
      }

      if (healStatus) {
        const { error: healErr } = await supabase
          .from("subscriptions")
          .update(healData)
          .eq("user_id", userId);

        if (healErr) {
          log(`[getSubscriptionStatus] DB HEAL FAILED for user=${userId}: ${healErr.message}`);
        } else {
          log(`[getSubscriptionStatus] DB HEALED: user=${userId} → ${healStatus}${healData.current_period_ends_at ? `, periodEnd=${healData.current_period_ends_at}` : ""}`);
          row = { ...row, ...healData } as typeof row;
        }
      }
    } catch (syncErr: any) {
      log(`[getSubscriptionStatus] Stripe sync failed for user=${userId}: ${syncErr.message}`);
    }
  }

  const isTrial = row.status === "trial" && row.trial_ends_at !== null && new Date(row.trial_ends_at) > now;
  const isActiveStatus = row.status === "active" && (
    row.current_period_ends_at === null || new Date(row.current_period_ends_at) > now
  );
  const isPastDue = row.status === "past_due";
  const gracePeriodEndsAt = isPastDue
    ? new Date(new Date(row.updated_at).getTime() + GRACE_PERIOD_MS)
    : null;
  const inGracePeriod = isPastDue && gracePeriodEndsAt !== null && gracePeriodEndsAt > now;
  const canceledButStillActive = row.status === "canceled" && row.current_period_ends_at !== null && new Date(row.current_period_ends_at) > now;
  const hasAccess = isTrial || isActiveStatus || inGracePeriod || canceledButStillActive;
  const isExpired = !hasAccess;
  const cancelAtPeriodEnd = row.status === "canceled" || row.cancel_at_period_end === true;

  log(`[getSubscriptionStatus] user=${userId} DB row: status=${row.status}, trial_ends=${row.trial_ends_at}, period_ends=${row.current_period_ends_at}, updated_at=${row.updated_at} → computed: isTrial=${isTrial}, isPastDue=${isPastDue}, inGracePeriod=${inGracePeriod}, gracePeriodEndsAt=${gracePeriodEndsAt?.toISOString() ?? null}, isActive=${hasAccess}, isExpired=${isExpired}`);

  return {
    status: row.status,
    plan: row.plan,
    trial_ends_at: row.trial_ends_at,
    current_period_ends_at: row.current_period_ends_at,
    created_at: row.created_at,
    isActive: hasAccess,
    isTrial,
    isPastDue,
    inGracePeriod,
    gracePeriodEndsAt: gracePeriodEndsAt?.toISOString() ?? null,
    isExpired,
    cancelAtPeriodEnd,
  };
}

export async function updateSubscriptionFromCheckout(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  plan: string,
  currentPeriodEnd: Date | null,
  trialEndsAt: Date | null = null
): Promise<void> {
  const isTrialing = trialEndsAt !== null && currentPeriodEnd === null;
  const upsertData: Record<string, any> = {
    user_id: userId,
    status: isTrialing ? "trial" : "active",
    plan,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    updated_at: new Date().toISOString(),
  };

  if (isTrialing) {
    upsertData.trial_ends_at = trialEndsAt!.toISOString();
  } else if (currentPeriodEnd) {
    upsertData.current_period_ends_at = currentPeriodEnd.toISOString();
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(upsertData, { onConflict: "user_id" });

  if (error) {
    log(`[subscriptions] Error updating from checkout user=${userId}: ${error.message} code=${error.code} details=${error.details}`);
    throw new Error(`Failed to activate subscription: ${error.message}`);
  } else {
    log(`[subscriptions] ${isTrialing ? "Trial started" : "Activated subscription"} for user=${userId} plan=${plan}`);
  }
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: "active" | "past_due" | "canceled" | "expired",
  currentPeriodEnd?: Date,
  skipIfAlreadyInStatus = false
): Promise<void> {
  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (currentPeriodEnd) {
    updateData.current_period_ends_at = currentPeriodEnd.toISOString();
  }

  // When skipIfAlreadyInStatus=true the update is a no-op if the row is already
  // in the target status. This is critical for past_due: Stripe Smart Retries fire
  // multiple invoice.payment_failed events, and each one would otherwise reset
  // updated_at, extending the 48-hour grace window indefinitely.
  let query = supabase
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (skipIfAlreadyInStatus) {
    query = (query as any).neq("status", status);
  }

  const { error } = await query;
  if (error) {
    log(`[subscriptions] DB ERROR updating stripe_sub=${stripeSubscriptionId} → ${status}: ${error.message}`);
  } else {
    log(`[subscriptions] stripe_sub=${stripeSubscriptionId} → ${status}${skipIfAlreadyInStatus ? " (no-op if already in status)" : ""}`);
  }
}

export async function findUserByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  return data?.user_id ?? null;
}
