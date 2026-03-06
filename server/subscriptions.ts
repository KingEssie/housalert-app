import { createClient } from "@supabase/supabase-js";
import { log } from "./log";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SubscriptionRow {
  id: string;
  user_id: string;
  status: "trial" | "active" | "canceled" | "expired";
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
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
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

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
      isActive: false,
      isTrial: false,
      isExpired: true,
    };
  }

  const row = data as SubscriptionRow;
  const now = new Date();

  const isTrial = row.status === "trial" && row.trial_ends_at !== null && new Date(row.trial_ends_at) > now;
  const isActive = row.status === "active" && (
    row.current_period_ends_at === null || new Date(row.current_period_ends_at) > now
  );
  const hasAccess = isTrial || isActive;
  const isExpired = !hasAccess;

  return {
    status: row.status,
    plan: row.plan,
    trial_ends_at: row.trial_ends_at,
    current_period_ends_at: row.current_period_ends_at,
    isActive: hasAccess,
    isTrial,
    isExpired,
  };
}

export async function updateSubscriptionFromCheckout(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  plan: string,
  currentPeriodEnd: Date
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      status: "active",
      plan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_ends_at: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) {
    log(`[subscriptions] Error updating from checkout user=${userId}: ${error.message}`);
  } else {
    log(`[subscriptions] Activated subscription for user=${userId} plan=${plan}`);
  }
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: "active" | "canceled" | "expired",
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
