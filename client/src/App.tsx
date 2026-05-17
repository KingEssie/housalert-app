import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, isRecoveryMode } from "@/lib/auth";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/lib/theme-provider";
import { apiFetch } from "@/lib/api-base";
import { isNativePlatform } from "@/lib/capacitor";
import { useBuddyConnections, isBuddyMode } from "@/lib/buddy";

const IS_NATIVE = isNativePlatform();

// ─── Critical path — loaded eagerly (needed before first paint) ───────────────
import WelcomePage from "@/pages/welcome";
import NotFound from "@/pages/not-found";
import AuthCallbackPage from "@/pages/auth-callback";

// ─── Lazy pages — loaded only when their route is first visited ───────────────
// Each lazy chunk is downloaded + parsed only on demand, keeping the initial
// bundle small so Android V8 has far less JS to JIT-compile on startup.

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const AppSearchWizard = lazy(() => import("@/pages/app-search-wizard"));
const ListingDetailPage = lazy(() => import("@/pages/listing-detail"));
const ApplicationLetterPage = lazy(() => import("@/pages/application-letter"));
const ViewingTipsPage = lazy(() => import("@/pages/viewing-tips"));
const ProfileDetailsPage = lazy(() => import("@/pages/profile-details"));
const ProfileEditPage = lazy(() => import("@/pages/profile-edit"));

// Named exports — wrap in .then to satisfy lazy()'s default-export requirement
const ImpressumPage = lazy(() => import("@/pages/legal").then(m => ({ default: m.ImpressumPage })));
const DatenschutzPage = lazy(() => import("@/pages/legal").then(m => ({ default: m.DatenschutzPage })));
const TermsPage = lazy(() => import("@/pages/legal").then(m => ({ default: m.TermsPage })));

const SubscriptionDetailPage = lazy(() => import("@/pages/subscription-detail"));
const PaymentMethodPage = lazy(() => import("@/pages/payment-method"));
const SubscriptionCancelConfirmPage = lazy(() => import("@/pages/subscription-cancel").then(m => ({ default: m.SubscriptionCancelConfirmPage })));
const SubscriptionCancelledPage = lazy(() => import("@/pages/subscription-cancel").then(m => ({ default: m.SubscriptionCancelledPage })));

const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));

const OnboardingSetup = lazy(() => import("@/pages/onboarding/setup"));
const OnboardingEmbedPage = lazy(() => import("@/pages/onboarding-embed"));
const OnboardingLocationNew = lazy(() => import("@/pages/onboarding/location"));
const OnboardingFiltersNew = lazy(() => import("@/pages/onboarding/filters"));
const OnboardingNameNew = lazy(() => import("@/pages/onboarding/name"));
const OnboardingEmailNew = lazy(() => import("@/pages/onboarding/email"));
const OnboardingPasswordNew = lazy(() => import("@/pages/onboarding/password"));
const OnboardingPreferencesNew = lazy(() => import("@/pages/onboarding/preferences"));
const ContinueDraftPage = lazy(() => import("@/pages/continue-draft"));

const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const EmbedSuccessPage = lazy(() => import("@/pages/embed-success"));
const SubscriptionSuccessPage = lazy(() => import("@/pages/subscription-success"));
const PaywallPage = lazy(() => import("@/pages/paywall"));
const DeleteAccountPage = lazy(() => import("@/pages/delete-account"));

// Admin pages — never needed by regular users
const AdminIngestionPage = lazy(() => import("@/pages/admin-ingestion"));
const AdminPortalPage = lazy(() => import("@/pages/admin-portal"));
const AdminMatchAuditPage = lazy(() => import("@/pages/admin-match-audit"));
const AdminActivationPage = lazy(() => import("@/pages/admin-activation"));
const AdminImageAuditPage = lazy(() => import("@/pages/admin-image-audit"));

const ApplyPage = lazy(() => import("@/pages/apply"));
const TipDetailPage = lazy(() => import("@/pages/tip-detail"));
const TipsFlowPage = lazy(() => import("@/pages/tips-flow"));
const FlowPage = lazy(() => import("@/pages/flow-page"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const PreferencesPage = lazy(() => import("@/pages/preferences"));
const HousingSituationPage = lazy(() => import("@/pages/housing-situation"));
const ReferralLandingPage = lazy(() => import("@/pages/referral-landing"));
const BuddyAcceptPage = lazy(() => import("@/pages/buddy-accept"));
const ZoekbuddyPage = lazy(() => import("@/pages/zoekbuddy"));
const SupportPage = lazy(() => import("@/pages/support"));
const SupportThreadPage = lazy(() => import("@/pages/support-thread"));

// Guide pages (all named exports from one file — share the same chunk)
const DocumentenGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.DocumentenGuidePage })));
const SchufaGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.SchufaGuidePage })));
const ZoekstrategieGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.ZoekstrategieGuidePage })));
const NetwerkGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.NetwerkGuidePage })));
const FinancienGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.FinancienGuidePage })));
const VerhuurdersGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.VerhuurdersGuidePage })));
const FacebookGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.FacebookGuidePage })));
const NieuwbouwGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.NieuwbouwGuidePage })));
const OpvolgingGuidePage = lazy(() => import("@/pages/guide").then(m => ({ default: m.OpvolgingGuidePage })));

function ProtectedRoute({ component: Component, skipOnboardingCheck }: { component: React.ComponentType; skipOnboardingCheck?: boolean }) {
  const { user, session, loading } = useAuth();
  const [checking, setChecking] = useState(!skipOnboardingCheck);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (loading || !user || skipOnboardingCheck) return;
    let cancelled = false;

    const token = session?.access_token;
    if (!token) {
      setChecking(false);
      return;
    }

    apiFetch("/api/onboarding-status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          const completed = data.onboarding_completed === true || data.post_paywall_onboarding_completed === true;
          console.log(`[ONBOARDING CHECK] userId=${user.id?.substring(0, 8)}... completed=${completed} (onboarding=${data.onboarding_completed}, postPaywall=${data.post_paywall_onboarding_completed})`);
          setNeedsOnboarding(!completed);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          console.log("[ONBOARDING CHECK] API call failed — fail-open, allowing access");
          setNeedsOnboarding(false);
          setChecking(false);
        }
      });
    return () => { cancelled = true; };
  }, [user, session, loading, skipOnboardingCheck]);

  if (loading) return null;
  if (!user) {
    return <Redirect to="/" />;
  }
  if (!skipOnboardingCheck && checking) return null;
  if (!skipOnboardingCheck && needsOnboarding) return <Redirect to="/onboarding/setup" />;
  return <Component />;
}

function BuddyProtectedRoute({ component: Component, skipOnboardingCheck }: { component: React.ComponentType; skipOnboardingCheck?: boolean }) {
  const buddyConns = useBuddyConnections();
  const inBuddyMode = isBuddyMode(buddyConns.data);

  if (buddyConns.isLoading) return null;
  if (inBuddyMode) return <Redirect to="/home" />;
  return <ProtectedRoute component={Component} skipOnboardingCheck={skipOnboardingCheck} />;
}

function RootRoute() {
  const { user, loading } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const hasRef = !!urlParams.get("ref");

  if (loading) return null;
  if (isRecoveryMode()) return <Redirect to="/reset-password" />;
  if (hasRef && !user) return <ReferralLandingPage />;
  if (!user) return <WelcomePage />;

  const pendingBuddyToken = localStorage.getItem("housalert_buddy_accept_token");
  if (pendingBuddyToken) {
    return <Redirect to={`/buddy/accept?token=${encodeURIComponent(pendingBuddyToken)}`} />;
  }

  return <Redirect to="/dashboard?tab=matches" />;
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, session, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !session?.access_token) {
      setChecking(false);
      return;
    }
    apiFetch("/api/onboarding-status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const completed = data.onboarding_completed === true || data.post_paywall_onboarding_completed === true;
        setDestination(completed ? "/dashboard?tab=matches" : "/onboarding/setup");
        setChecking(false);
      })
      .catch(() => {
        setDestination("/dashboard?tab=matches");
        setChecking(false);
      });
  }, [user, session, loading]);

  if (loading || (user && checking)) return null;
  if (user && destination) return <Redirect to={destination} />;
  return <Component />;
}

function QueryPreservingRedirect({ to }: { to: string }) {
  const [location] = useLocation();
  const qIdx = location.indexOf("?");
  const search = qIdx >= 0 ? location.slice(qIdx) : "";
  return <Redirect to={`${to}${search}`} />;
}

function WebFunnelRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, session, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !session?.access_token) {
      setChecking(false);
      return;
    }
    apiFetch("/api/onboarding-status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const completed = data.onboarding_completed === true || data.post_paywall_onboarding_completed === true;
        setDestination(completed ? "/dashboard?tab=matches" : "/onboarding/setup");
        setChecking(false);
      })
      .catch(() => {
        setDestination("/onboarding/setup");
        setChecking(false);
      });
  }, [user, session, loading]);

  if (loading || (user && checking)) return null;
  if (user && destination) return <Redirect to={destination} />;
  return <Component />;
}


function DeepLinkHandler() {
  const [, navigate] = useLocation();

  useEffect(() => {
    let cleanupDeepLink: (() => void) | null = null;
    let cleanupBrowserFinished: (() => void) | null = null;

    function handleDeepLinkUrl(url: string) {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname + parsed.search;
        console.log("[deep-link] App Link received — navigating to:", path);
        navigate(path);
      } catch (err) {
        console.warn("[deep-link] Could not parse App Link URL:", url, err);
      }
    }

    function handleBrowserFinished(sessionId: string | null) {
      if (!sessionId) {
        console.log("[checkout-browser] Browser closed with no pending session (user cancelled)");
        return;
      }
      const destination = `/checkout/success?session_id=${encodeURIComponent(sessionId)}&native=1`;
      console.log("[checkout-browser] Browser finished — navigating to:", destination);
      navigate(destination);
    }

    (async () => {
      const { setupDeepLinkListener, setupBrowserFinishedListener } = await import("./lib/capacitor");
      cleanupDeepLink = await setupDeepLinkListener(handleDeepLinkUrl);
      cleanupBrowserFinished = await setupBrowserFinishedListener(handleBrowserFinished);
    })();

    return () => {
      cleanupDeepLink?.();
      cleanupBrowserFinished?.();
    };
  }, []);

  return null;
}

function Router() {
  return (
    <>
      {IS_NATIVE && <DeepLinkHandler />}
      <Suspense fallback={null}>
        <Switch>
          <Route path="/" component={RootRoute} />
          <Route path="/login" component={() => <GuestRoute component={WelcomePage} />} />
          <Route path="/welcome" component={() => <GuestRoute component={WelcomePage} />} />
          <Route path="/auth/callback" component={AuthCallbackPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/onboarding-embed" component={OnboardingEmbedPage} />
          <Route path="/continue" component={ContinueDraftPage} />
          <Route path="/new-search" component={() => <QueryPreservingRedirect to="/onboarding-embed" />} />
          <Route path="/onboarding/intro" component={() => <QueryPreservingRedirect to="/onboarding/start" />} />
          <Route path="/onboarding/city" component={() => <QueryPreservingRedirect to="/onboarding/start" />} />
          <Route path="/onboarding/start" component={() => <WebFunnelRoute component={OnboardingLocationNew} />} />
          <Route path="/onboarding/location" component={() => <WebFunnelRoute component={OnboardingLocationNew} />} />
          <Route path="/onboarding/filters" component={() => <WebFunnelRoute component={OnboardingFiltersNew} />} />
          <Route path="/onboarding/name" component={() => <WebFunnelRoute component={OnboardingNameNew} />} />
          <Route path="/onboarding/email" component={() => <WebFunnelRoute component={OnboardingEmailNew} />} />
          <Route path="/onboarding/password" component={() => <WebFunnelRoute component={OnboardingPasswordNew} />} />
          <Route path="/onboarding/preferences" component={() => <WebFunnelRoute component={OnboardingPreferencesNew} />} />
          <Route path="/onboarding/setup" component={() => <ProtectedRoute component={OnboardingSetup} skipOnboardingCheck />} />
          <Route path="/onboarding" component={() => <QueryPreservingRedirect to="/onboarding/start" />} />
          <Route path="/paywall" component={PaywallPage} />
          <Route path="/subscription-success" component={() => <ProtectedRoute component={SubscriptionSuccessPage} skipOnboardingCheck />} />
          <Route path="/checkout/success" component={CheckoutSuccessPage} />
          <Route path="/embed-success" component={EmbedSuccessPage} />
          <Route path="/home" component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/dashboard/searches/new" component={() => <BuddyProtectedRoute component={AppSearchWizard} skipOnboardingCheck />} />
          <Route path="/dashboard/searches/edit/:id" component={() => <BuddyProtectedRoute component={AppSearchWizard} skipOnboardingCheck />} />
          <Route path="/listing/:id" component={ListingDetailPage} />
          <Route path="/apply/:id" component={() => <ProtectedRoute component={ApplyPage} />} />
          <Route path="/flow/:flowId/:stepId" component={() => <ProtectedRoute component={FlowPage} />} />
          <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} />} />
          <Route path="/application-letter" component={() => <ProtectedRoute component={ApplicationLetterPage} />} />
          <Route path="/profile/details" component={() => <ProtectedRoute component={ProfileDetailsPage} />} />
          <Route path="/profile/edit/:field" component={() => <ProtectedRoute component={ProfileEditPage} />} />
          <Route path="/tips/flow" component={() => <ProtectedRoute component={TipsFlowPage} />} />
          <Route path="/tip/:id" component={() => <ProtectedRoute component={TipDetailPage} />} />
          <Route path="/tips/bezichtiging" component={() => <ProtectedRoute component={ViewingTipsPage} />} />
          <Route path="/tips/documenten" component={() => <ProtectedRoute component={DocumentenGuidePage} />} />
          <Route path="/tips/schufa" component={() => <ProtectedRoute component={SchufaGuidePage} />} />
          <Route path="/tips/zoekstrategie" component={() => <ProtectedRoute component={ZoekstrategieGuidePage} />} />
          <Route path="/tips/netwerk" component={() => <ProtectedRoute component={NetwerkGuidePage} />} />
          <Route path="/tips/financien" component={() => <ProtectedRoute component={FinancienGuidePage} />} />
          <Route path="/tips/verhuurders" component={() => <ProtectedRoute component={VerhuurdersGuidePage} />} />
          <Route path="/tips/facebook" component={() => <ProtectedRoute component={FacebookGuidePage} />} />
          <Route path="/tips/nieuwbouw" component={() => <ProtectedRoute component={NieuwbouwGuidePage} />} />
          <Route path="/tips/opvolging" component={() => <ProtectedRoute component={OpvolgingGuidePage} />} />
          <Route path="/settings" component={() => <Redirect to="/dashboard?tab=profile" />} />
          <Route path="/settings/preferences" component={() => <ProtectedRoute component={PreferencesPage} />} />
          <Route path="/settings/housing" component={() => <BuddyProtectedRoute component={HousingSituationPage} />} />
          <Route path="/account/subscription" component={() => <BuddyProtectedRoute component={SubscriptionDetailPage} />} />
          <Route path="/account/subscription/cancel" component={() => <BuddyProtectedRoute component={SubscriptionCancelConfirmPage} />} />
          <Route path="/account/subscription/cancelled" component={() => <BuddyProtectedRoute component={SubscriptionCancelledPage} />} />
          <Route path="/account/payment-method" component={() => <BuddyProtectedRoute component={PaymentMethodPage} />} />
          <Route path="/account/change-password" component={() => <ProtectedRoute component={ChangePasswordPage} />} />
          <Route path="/account/delete" component={() => <ProtectedRoute component={DeleteAccountPage} />} />
          <Route path="/admin/portal" component={() => <ProtectedRoute component={AdminPortalPage} skipOnboardingCheck />} />
          <Route path="/admin/ingestion" component={AdminIngestionPage} />
          <Route path="/admin/match-audit" component={() => <ProtectedRoute component={AdminMatchAuditPage} />} />
          <Route path="/admin/activation" component={() => <ProtectedRoute component={AdminActivationPage} />} />
          <Route path="/admin/image-audit" component={() => <ProtectedRoute component={AdminImageAuditPage} />} />
          <Route path="/support" component={() => <ProtectedRoute component={SupportPage} skipOnboardingCheck />} />
          <Route path="/support/:id" component={() => <ProtectedRoute component={SupportThreadPage} skipOnboardingCheck />} />
          <Route path="/profile/search-buddy" component={() => <BuddyProtectedRoute component={ZoekbuddyPage} />} />
          <Route path="/buddy/accept" component={BuddyAcceptPage} />
          <Route path="/subscription" component={() => <Redirect to="/account/subscription" />} />
          <Route path="/housing-situation" component={() => <Redirect to="/settings/housing" />} />
          <Route path="/impressum" component={ImpressumPage} />
          <Route path="/datenschutz" component={DatenschutzPage} />
          <Route path="/terms" component={TermsPage} />

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function AppShell() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Router />
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

function App() {
  console.log(`[APP BOOT] HousAlert v2.2 — IS_NATIVE=${IS_NATIVE} — ${new Date().toISOString()}`);
  if (IS_NATIVE) {
    return (
      <WouterRouter hook={useHashLocation}>
        <AppShell />
      </WouterRouter>
    );
  }
  return <AppShell />;
}

export default App;
