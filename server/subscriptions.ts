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
  isExpired: boolean;
  cancelAtPeriodEnd: boolean;
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
        const rawEnd = stripeSub.current_period_end;
        const newPeriodEnd = rawEnd && rawEnd > 0
          ? new Date(rawEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        healStatus = "active";
        healData.status = "active";
        healData.current_period_ends_at = newPeriodEnd.toISOString();
        healData.cancel_at_period_end = !!stripeSub.cancel_at_period_end;
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
  const canceledButStillActive = row.status === "canceled" && row.current_period_ends_at !== null && new Date(row.current_period_ends_at) > now;
  const hasAccess = isTrial || isActiveStatus || isPastDue || canceledButStillActive;
  const isExpired = !hasAccess;
  const cancelAtPeriodEnd = row.status === "canceled" || row.cancel_at_period_end === true;

  log(`[getSubscriptionStatus] user=${userId} DB row: status=${row.status}, trial_ends=${row.trial_ends_at}, period_ends=${row.current_period_ends_at}, cancel_at_period_end=${row.cancel_at_period_end} → computed: isTrial=${isTrial}, isPastDue=${isPastDue}, isActive=${hasAccess}, isExpired=${isExpired}`);

  return {
    status: row.status,
    plan: row.plan,
    trial_ends_at: row.trial_ends_at,
    current_period_ends_at: row.current_period_ends_at,
    created_at: row.created_at,
    isActive: hasAccess,
    isTrial,
    isPastDue,
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
  currentPeriodEnd?: Date
): Promise<void> {
  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (currentPeriodEnd) {
    updateData.current_period_ends_at = currentPeriodEnd.toISOString();
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) {
    log(`[subscriptions] Error updating status for stripe_sub=${stripeSubscriptionId}: ${error.message}`);
  } else {
    log(`[subscriptions] Updated subscription ${stripeSubscriptionId} to status=${status}`);
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
