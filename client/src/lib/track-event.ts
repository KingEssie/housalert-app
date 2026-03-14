import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";

let pendingEvents: Array<{ eventName: string; metadata?: Record<string, any> }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function getToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function trackEvent(eventName: string, metadata?: Record<string, any>) {
  const token = await getToken();
  if (!token) return;

  try {
    await apiFetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event: eventName, metadata: metadata || {} }),
    });
  } catch {
  }
}

export function trackEventLazy(eventName: string, metadata?: Record<string, any>) {
  pendingEvents.push({ eventName, metadata });
  if (!flushTimer) {
    flushTimer = setTimeout(flushPending, 2000);
  }
}

async function flushPending() {
  flushTimer = null;
  const batch = pendingEvents.splice(0);
  for (const evt of batch) {
    await trackEvent(evt.eventName, evt.metadata);
  }
}
