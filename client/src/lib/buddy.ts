import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";

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
  owner_name?: string | null;
  owner_sub_active?: boolean;
}

export interface BuddyConnections {
  asOwner: BuddyRelation | null;
  asBuddy: BuddyRelation[];
}

export interface BuddyAction {
  id: string;
  buddy_relation_id: string;
  actor_user_id: string;
  actor_role: "owner" | "buddy";
  action_type: "responded" | "favorited" | "recommended";
  listing_id: string;
  note?: string;
  created_at: string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function useBuddyConnections() {
  const { session } = useAuth();
  return useQuery<BuddyConnections>({
    queryKey: ["/api/buddy/connections"],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/connections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch buddy connections");
      return res.json();
    },
    enabled: !!session?.access_token,
    staleTime: 30_000,
  });
}

export function useBuddyInvites() {
  const { session } = useAuth();
  return useQuery<{ invites: (BuddyRelation & { owner_name?: string })[] }>({
    queryKey: ["/api/buddy/invites"],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/invites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
    staleTime: 30_000,
  });
}

export function useInviteBuddy() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/invite", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
    },
  });
}

export function useAcceptInvite() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/accept", {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
      qc.invalidateQueries({ queryKey: ["/api/buddy/invites"] });
    },
  });
}

export function useRevokeBuddy() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relationId: string) => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/revoke", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ relationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
    },
  });
}

export function useUpdateBuddyPreferences() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      relationId: string;
      email_notifications_enabled?: boolean;
      push_notifications_enabled?: boolean;
    }) => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/preferences", {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
    },
  });
}

export function useBuddyAction() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      listingId: string;
      actionType: "responded" | "favorited" | "recommended";
      note?: string;
    }) => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch("/api/buddy/action", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/buddy/actions", variables.listingId] });
    },
  });
}

export function useBuddyActionsForListing(listingId: string) {
  const { session } = useAuth();
  return useQuery<{ actions: BuddyAction[] }>({
    queryKey: ["/api/buddy/actions", listingId],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const res = await apiFetch(`/api/buddy/actions/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { actions: [] };
      return res.json();
    },
    enabled: !!session?.access_token && !!listingId,
    staleTime: 30_000,
  });
}

export function isBuddyMode(connections: BuddyConnections | undefined): boolean {
  return !!connections?.asBuddy?.length && connections.asBuddy.some(b => b.invite_status === "accepted");
}

export function getActiveBuddyRelation(connections: BuddyConnections | undefined): BuddyRelation | null {
  if (!connections?.asBuddy?.length) return null;
  return connections.asBuddy.find(b => b.invite_status === "accepted") || null;
}

export function isOwnerSubActive(connections: BuddyConnections | undefined): boolean {
  const rel = getActiveBuddyRelation(connections);
  return rel?.owner_sub_active ?? false;
}

const BUDDY_ACTIVE_KEY = "ha_buddy_was_active";

/**
 * Detects when a user transitions from buddy mode → standalone.
 * While the user is in buddy mode, we store a flag in localStorage.
 * When connections load and the user is no longer in buddy mode,
 * but the flag exists, we surface `wasUnlinked = true` once.
 */
export function useBuddyUnlinkedDetection(): { wasUnlinked: boolean; dismiss: () => void } {
  const { data: connections, isLoading } = useBuddyConnections();
  const [wasUnlinked, setWasUnlinked] = useState(false);

  useEffect(() => {
    if (isLoading || !connections) return;
    const inBuddyMode = isBuddyMode(connections);
    if (inBuddyMode) {
      // User is currently a buddy — set the flag
      localStorage.setItem(BUDDY_ACTIVE_KEY, "1");
    } else {
      // User is not a buddy — check if they were recently
      const wasBuddy = localStorage.getItem(BUDDY_ACTIVE_KEY) === "1";
      if (wasBuddy) {
        localStorage.removeItem(BUDDY_ACTIVE_KEY);
        setWasUnlinked(true);
      }
    }
  }, [connections, isLoading]);

  function dismiss() {
    setWasUnlinked(false);
  }

  return { wasUnlinked, dismiss };
}
