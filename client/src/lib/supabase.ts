import { createClient } from "@supabase/supabase-js";
import { createCapacitorStorage } from "./capacitor-storage";

// Build stamp — injected at build time via script/build.ts define.
// Useful for confirming Android is running the latest bundle.
const BUILD_STAMP: string = (import.meta.env.VITE_BUILD_STAMP as string) || "dev";

// ---------------------------------------------------------------------------
// Supabase connection values
// These are PUBLIC client-side config (not secrets). The fallbacks guarantee
// the Android/PWA app connects to Supabase even when the bundle was built
// without .env vars being present (e.g. stale CI artifact or old cap sync).
// ---------------------------------------------------------------------------
const FALLBACK_URL  = "https://gextfztfnklwqfwkxbtl.supabase.co";
const FALLBACK_KEY  = "PASTE_MY_PUBLIC_SUPABASE_ANON_KEY_HERE";

const supabaseUrl =
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || "")
    .replace(/\/$/, "") || FALLBACK_URL;

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_KEY;

// Log which source of config is being used — never log the actual key.
const urlSource  = (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ? "env" : "fallback";
const keySource  = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ? "env" : "fallback";
console.log(`[Supabase] build=${BUILD_STAMP} url=${urlSource} key=${keySource}`);

// Only throw if both env AND fallback are unusable.
if (!supabaseUrl || supabaseUrl === FALLBACK_URL.replace(/\/$/, "") && FALLBACK_URL === "MISSING") {
  throw new Error(
    "Supabase URL is not set and no fallback is configured.\n" +
    "Add VITE_SUPABASE_URL to .env or update the FALLBACK_URL in supabase.ts."
  );
}
if (!supabaseAnonKey || supabaseAnonKey === "PASTE_MY_PUBLIC_SUPABASE_ANON_KEY_HERE") {
  console.error(
    "[Supabase] WARNING: anon key is using the placeholder value — " +
    "replace FALLBACK_KEY in client/src/lib/supabase.ts with your real public anon key."
  );
}

const isNative = (window as any).Capacitor?.isNativePlatform?.() === true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isNative,
    storageKey: "housalert-auth",
    storage: createCapacitorStorage(),
  },
});
