import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    storageKey: "housalert-auth",
    storage: localStorage,
  },
});
