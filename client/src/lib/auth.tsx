import { apiFetch } from "@/lib/api-base";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

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
  const w = window as any;
  if (!w.ReactNativeWebView || typeof w.ReactNativeWebView?.postMessage !== "function") {
    return;
  }

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
        if (w.ReactNativeWebView && typeof w.ReactNativeWebView.postMessage === "function") {
          w.ReactNativeWebView.postMessage(payload);
          console.log(`[WEBAUTH] Sending session to ReactNative (#${i + 1}, +${delays[i]}ms)`);
        }
      } catch {}
    }, delays[i]);
    _authTimers.push(timer);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      notifyNativeAuth(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      notifyNativeAuth(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
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
