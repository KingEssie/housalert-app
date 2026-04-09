import { apiFetch } from "@/lib/api-base";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export interface SubscriptionState {
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

async function fetchSubscriptionStatus(): Promise<SubscriptionState> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) {
    return { status: "none", plan: null, trial_ends_at: null, current_period_ends_at: null, created_at: null, isActive: false, isTrial: false, isPastDue: false, isExpired: true, cancelAtPeriodEnd: false };
  }

  const res = await apiFetch("/api/subscription/status", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return { status: "none", plan: null, trial_ends_at: null, current_period_ends_at: null, created_at: null, isActive: false, isTrial: false, isPastDue: false, isExpired: true, cancelAtPeriodEnd: false };
  }

  return res.json();
}

export function useSubscription() {
  const query = useQuery<SubscriptionState>({
    queryKey: ["/api/subscription/status"],
    queryFn: fetchSubscriptionStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    ...query.data,
    loading: query.isLoading,
    refetch: query.refetch,
    status: query.data?.status ?? "none",
    plan: query.data?.plan ?? null,
    isActive: query.data?.isActive ?? false,
    isTrial: query.data?.isTrial ?? false,
    isPastDue: query.data?.isPastDue ?? false,
    isExpired: query.data?.isExpired ?? true,
    cancelAtPeriodEnd: query.data?.cancelAtPeriodEnd ?? false,
    trialEndsAt: query.data?.trial_ends_at ?? null,
    currentPeriodEndsAt: query.data?.current_period_ends_at ?? null,
    created_at: query.data?.created_at ?? null,
  };
}
