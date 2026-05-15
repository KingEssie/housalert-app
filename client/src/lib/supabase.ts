import { createClient } from "@supabase/supabase-js";
import { createCapacitorStorage } from "./capacitor-storage";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (import.meta.env.DEV || import.meta.env.MODE === "production") {
  console.log("[supabase] VITE_SUPABASE_URL:", supabaseUrl ? "✓ present" : "✗ MISSING");
  console.log("[supabase] VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✓ present" : "✗ MISSING");
}

if (!supabaseUrl) {
  throw new Error(
    "VITE_SUPABASE_URL is not set.\n" +
    "For local Android builds: create .env in the project root with VITE_SUPABASE_URL=<your-url>, " +
    "then run `npm run mobile:android:sync` before opening Android Studio."
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_ANON_KEY is not set.\n" +
    "For local Android builds: create .env in the project root with VITE_SUPABASE_ANON_KEY=<your-key>, " +
    "then run `npm run mobile:android:sync` before opening Android Studio."
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
