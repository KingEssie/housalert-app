import { apiFetch } from "@/lib/api-base";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { clearAllUserData, setLastAuthUserId, getLastAuthUserId } from "./queryClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

const _authTimers: ReturnType<typeof setTimeout>[] = [];

function notifyNativeAuth(session: Session | null) {
  for (const t of _authTimers) clearTimeout(t);
  _authTimers.length = 0;

  const userId = session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;

  console.log(`[WEBAUTH] Session detected — user=${userId?.substring(0, 8) ?? "null"}`);

  const payload = JSON.stringify({
    type: "SUPABASE_SESSION",
    user_id: userId,
    access_token: accessToken,
  });

  const delays = [0, 500, 1500, 3000, 5000, 8000, 12000];
  for (let i = 0; i < delays.length; i++) {
    const timer = setTimeout(() => {
      try {
        const w = window as any;
        if (w.ReactNativeWebView && typeof w.ReactNativeWebView.postMessage === "function") {
          w.ReactNativeWebView.postMessage(payload);
          console.log(`[WEBAUTH] Sending session to ReactNative (#${i + 1}, +${delays[i]}ms)`);
        } else {
          console.log(`[WEBAUTH] ReactNativeWebView not available yet (#${i + 1}, +${delays[i]}ms)`);
        }
      } catch (e: any) {
        console.error(`[WEBAUTH] postMessage error (#${i + 1}):`, e?.message);
      }
    }, delays[i]);
    _authTimers.push(timer);
  }
}

function handleUserChange(newUserId: string | null, event: string) {
  const prevUserId = getLastAuthUserId();
  if (prevUserId && newUserId && prevUserId !== newUserId) {
    console.warn(`[IDENTITY] User changed: ${prevUserId.substring(0, 8)}→${newUserId.substring(0, 8)} (event=${event}). Clearing ALL cached data.`);
    clearAllUserData();
  } else if (prevUserId && !newUserId) {
    console.log(`[IDENTITY] User signed out (was ${prevUserId.substring(0, 8)}). Clearing ALL cached data.`);
    clearAllUserData();
  } else if (!prevUserId && newUserId) {
    console.log(`[IDENTITY] User signed in: ${newUserId.substring(0, 8)}, email=${event}`);
  }
  setLastAuthUserId(newUserId);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[WEBAUTH] AuthProvider mounted");

    console.log("[WEBAUTH] getSession() starting");
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? "unknown";
      console.log(`[WEBAUTH] getSession() result: session ${session ? "yes" : "no"}, user=${uid?.substring(0, 8) ?? "null"}, email=${email}`);
      console.log(`[IDENTITY] App load — user.id=${uid ?? "null"}, email=${email}, name=${session?.user?.user_metadata?.full_name ?? "null"}`);
      handleUserChange(uid, `initial:${email}`);
      setSession(session);
      setLoading(false);
      notifyNativeAuth(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? "unknown";
      console.log(`[WEBAUTH] onAuthStateChange fired: ${event}, user=${uid?.substring(0, 8) ?? "null"}, email=${email}`);
      console.log(`[IDENTITY] Auth event=${event} — user.id=${uid ?? "null"}, email=${email}, name=${session?.user?.user_metadata?.full_name ?? "null"}`);

      if (event === "SIGNED_OUT") {
        console.log("[IDENTITY] SIGNED_OUT event — clearing all user data");
        clearAllUserData();
      } else {
        handleUserChange(uid, event);
      }

      setSession(session);
      setLoading(false);
      notifyNativeAuth(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("[IDENTITY] signOut() called — clearing all cached data before Supabase sign-out");
    clearAllUserData();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function ensureTrialForCurrentUser(): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) {
    console.warn("[auth] ensureTrialForCurrentUser: no session token");
    return false;
  }

  try {
    const res = await apiFetch("/api/subscription/ensure-trial", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[auth] Trial creation failed:", res.status, text);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[auth] Trial creation error:", err.message);
    return false;
  }
}
