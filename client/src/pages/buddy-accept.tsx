import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAcceptInvite } from "@/lib/buddy";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { clearAllUserData } from "@/lib/queryClient";
import { Loader2, Users, CheckCircle2, XCircle, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

interface InviteInfo {
  invite_email: string;
  invite_status: string;
  owner_name: string | null;
  account_exists: boolean;
}

export default function BuddyAcceptPage() {
  const { t } = useTranslation();
  const { user, session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const acceptMutation = useAcceptInvite();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");

  const [status, setStatus] = useState<"loading" | "auth" | "ready" | "accepting" | "accepted" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const autoAcceptingRef = useRef(false);

  const effectiveToken = token || localStorage.getItem("housalert_buddy_accept_token") || "";

  useEffect(() => {
    if (!effectiveToken) {
      setInviteLoading(false);
      setInviteError("no_token");
      setStatus("error");
      setErrorMsg(t("buddyV2.acceptError"));
      return;
    }

    localStorage.setItem("housalert_buddy_accept_token", effectiveToken);

    if (!token && effectiveToken) {
      window.history.replaceState({}, "", `/buddy/accept?token=${encodeURIComponent(effectiveToken)}`);
    }

    apiFetch(`/api/buddy/invite-info?token=${encodeURIComponent(effectiveToken)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setInviteError(data.error);
          setStatus("error");
          setErrorMsg(t("buddyV2.acceptError"));
        } else {
          setInviteInfo(data);
          setAuthMode(data.account_exists ? "login" : "signup");
          if (data.invite_status === "revoked") {
            setStatus("error");
            setErrorMsg(t("buddyV2.acceptRevoked"));
          } else if (data.invite_status === "accepted") {
            setStatus("error");
            setErrorMsg(t("buddyV2.acceptAlready"));
          }
        }
        setInviteLoading(false);
      })
      .catch(() => {
        setInviteError("fetch_failed");
        setInviteLoading(false);
        setStatus("error");
        setErrorMsg(t("buddyV2.acceptError"));
      });
  }, [effectiveToken]);

  useEffect(() => {
    if (authLoading || inviteLoading || inviteError || !inviteInfo) return;
    if (inviteInfo.invite_status !== "pending") return;

    if (!user || !session) {
      setStatus("auth");
      return;
    }

    const userEmail = user.email?.toLowerCase().trim();
    const inviteEmail = inviteInfo.invite_email.toLowerCase().trim();

    if (userEmail && userEmail !== inviteEmail) {
      setStatus("error");
      setErrorMsg(t("buddyV2.acceptEmailMismatch"));
      return;
    }

    if (autoAcceptingRef.current) return;
    autoAcceptingRef.current = true;
    doAccept();
  }, [authLoading, inviteLoading, inviteInfo, user, session]);

  async function doAccept() {
    setStatus("accepting");
    try {
      await acceptMutation.mutateAsync(effectiveToken);
      localStorage.removeItem("housalert_buddy_accept_token");
      setStatus("accepted");
      toast({ title: t("buddyV2.acceptSuccess") });
      setTimeout(() => navigate("/home"), 2000);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("different email")) {
        setErrorMsg(t("buddyV2.acceptEmailMismatch"));
      } else if (msg.includes("Already accepted")) {
        setErrorMsg(t("buddyV2.acceptAlready"));
      } else {
        setErrorMsg(msg || t("buddyV2.acceptError"));
      }
      setStatus("error");
    }
  }

  async function handleSignup() {
    if (!inviteInfo || authSubmitting) return;
    if (!firstName.trim()) {
      setAuthError(t("buddyV2.authFirstNameRequired"));
      return;
    }
    if (password.length < 6) {
      setAuthError(t("buddyV2.authPasswordTooShort"));
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");
    clearAllUserData();

    try {
      const fullName = firstName.trim();
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteInfo.invite_email, password, fullName }),
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.error === "user_exists") {
          setAuthMode("login");
          setAuthError(t("buddyV2.authAccountExists"));
        } else {
          setAuthError(result.message || result.error || t("buddyV2.authSignupFailed"));
        }
        setAuthSubmitting(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo.invite_email,
        password,
      });

      if (signInError) {
        setAuthError(signInError.message);
        setAuthSubmitting(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        try {
          await apiFetch("/api/profile-data", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ onboarding_completed: true }),
          });
        } catch {}
      }
    } catch (err: any) {
      setAuthError(err.message || t("buddyV2.authSignupFailed"));
      setAuthSubmitting(false);
    }
  }

  async function handleLogin() {
    if (!inviteInfo || authSubmitting) return;
    if (!password) {
      setAuthError(t("buddyV2.authPasswordRequired"));
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: inviteInfo.invite_email,
        password,
      });

      if (error) {
        setAuthError(t("buddyV2.authLoginFailed"));
        setAuthSubmitting(false);
        return;
      }
    } catch (err: any) {
      setAuthError(err.message || t("buddyV2.authLoginFailed"));
      setAuthSubmitting(false);
    }
  }

  if (inviteLoading || authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />
      </div>
    );
  }

  if (status === "accepting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-ha-primary mx-auto mb-4" />
          <p className="text-[15px] text-[#334855]">{t("buddyV2.acceptingInvite")}</p>
        </div>
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-5">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-[22px] font-bold text-[#111111] mb-2" data-testid="text-accept-success">{t("buddyV2.acceptSuccess")}</h1>
          <p className="text-[15px] text-[#334855] leading-relaxed">
            {inviteInfo?.owner_name ? t("buddyV2.modeBanner").replace("{name}", inviteInfo.owner_name) : ""}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-5">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[22px] font-bold text-[#111111] mb-2">{errorMsg}</h1>
          <button
            onClick={() => navigate("/home")}
            className="mt-6 h-[48px] px-8 rounded-[16px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
            data-testid="button-accept-go-home"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "auth" && inviteInfo) {
    const isLogin = authMode === "login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-5">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#2D3748] flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-[24px] font-bold text-[#111111] mb-2 leading-tight" data-testid="text-accept-title">
              {t("buddyV2.acceptTitle")}
            </h1>
            {inviteInfo.owner_name && (
              <p className="text-[15px] text-[#334855]" data-testid="text-accept-owner">
                {t("buddyV2.acceptBodyShort").replace("{name}", inviteInfo.owner_name)}
              </p>
            )}
          </div>

          <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-5 mb-5">
            <div className="space-y-3">
              <div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
                  <input
                    type="email"
                    value={inviteInfo.invite_email}
                    readOnly
                    className="w-full h-[56px] pl-11 pr-4 rounded-[16px] border border-[#D1D5DB] bg-[#F3F4F6] text-[15px] text-[#6B7280] cursor-not-allowed"
                    data-testid="input-buddy-email"
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t("buddyV2.authFirstNamePlaceholder")}
                      className="w-full h-[56px] pl-11 pr-4 rounded-[16px] border border-[#D1D5DB] bg-white text-[15px] text-[#111111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20 focus:border-ha-primary transition-colors"
                      data-testid="input-buddy-firstname"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("buddyV2.authPasswordPlaceholder")}
                    className="w-full h-[56px] pl-11 pr-12 rounded-[16px] border border-[#D1D5DB] bg-white text-[15px] text-[#111111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20 focus:border-ha-primary transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        isLogin ? handleLogin() : handleSignup();
                      }
                    }}
                    data-testid="input-buddy-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#334855] hover:text-[#111111]"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>
            </div>

            {authError && (
              <p className="mt-3 text-[13px] text-red-600 text-center" data-testid="text-auth-error">{authError}</p>
            )}
          </div>

          <button
            onClick={isLogin ? handleLogin : handleSignup}
            disabled={authSubmitting}
            className="w-full h-[56px] rounded-[16px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-buddy-auth-submit"
          >
            {authSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              t("buddyV2.authLoginCta")
            ) : (
              t("buddyV2.authSignupCta")
            )}
          </button>

          <button
            onClick={() => navigate("/")}
            className="w-full h-[48px] mt-3 text-[15px] font-medium text-[#334855] hover:text-[#111111] transition-colors"
            data-testid="button-accept-decline"
          >
            {t("buddyV2.acceptDecline")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] px-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#2D3748] flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-[24px] font-bold text-[#111111] mb-3 leading-tight" data-testid="text-accept-title">
            {t("buddyV2.acceptTitle")}
          </h1>
          {inviteInfo?.owner_name && (
            <p className="text-[15px] text-[#334855]" data-testid="text-accept-owner">
              {t("buddyV2.acceptBodyShort").replace("{name}", inviteInfo.owner_name)}
            </p>
          )}
        </div>

        <button
          onClick={doAccept}
          disabled={acceptMutation.isPending}
          className="w-full h-[56px] rounded-[16px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-accept-invite"
        >
          {acceptMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t("buddyV2.acceptCta")
          )}
        </button>

        <button
          onClick={() => navigate("/home")}
          className="w-full h-[48px] mt-3 text-[15px] font-medium text-[#334855] hover:text-[#111111] transition-colors"
          data-testid="button-accept-decline"
        >
          {t("buddyV2.acceptDecline")}
        </button>
      </div>
    </div>
  );
}
