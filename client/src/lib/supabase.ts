import { createClient } from "@supabase/supabase-js";
import { createCapacitorStorage } from "./capacitor-storage";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
