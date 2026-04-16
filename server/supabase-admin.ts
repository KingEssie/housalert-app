import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    _client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

/**
 * Look up a Supabase auth user by email.
 *
 * WHY this exists:
 * The @supabase/auth-js listUsers() SDK method accepts a `filter` param in its
 * TypeScript signature, but the implementation silently IGNORES it — only
 * `page` and `per_page` are forwarded to the GoTrue REST API. Passing
 * `{ filter: 'email.eq.x' }` therefore returns ALL users (page 1, default
 * per_page), making `users.length > 0` always true and breaking any
 * account-existence check.
 *
 * This function bypasses the SDK wrapper and calls the GoTrue admin REST
 * endpoint directly, where the `filter` query parameter IS honoured.
 *
 * Returns the matching user object, or null if not found / on error.
 */
export async function lookupSupabaseUserByEmail(
  email: string
): Promise<{ id: string; email: string } | null> {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

    const normalised = email.toLowerCase().trim();
    const url =
      `${SUPABASE_URL}/auth/v1/admin/users` +
      `?page=1&per_page=1&filter=${encodeURIComponent(`email.eq.${normalised}`)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const user = data?.users?.[0];
    if (!user?.id || !user?.email) return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}
