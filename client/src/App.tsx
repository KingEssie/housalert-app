import { useState, useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, isRecoveryMode } from "@/lib/auth";
import { I18nProvider } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { isNativePlatform } from "@/lib/capacitor";

const IS_NATIVE = isNativePlatform();
import WelcomePage from "@/pages/welcome";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import OnboardingLocationPage from "@/pages/onboarding-location";
import OnboardingFiltersPage from "@/pages/onboarding-filters";
import OnboardingEstimatePage from "@/pages/onboarding-estimate";
import OnboardingPreferencesPage from "@/pages/onboarding-preferences";
import OnboardingValuePage from "@/pages/onboarding-value";
import PaywallPage from "@/pages/paywall";
import DashboardPage from "@/pages/dashboard";
import NewSearchPage from "@/pages/new-search";
import NotFound from "@/pages/not-found";
import ListingDetailPage from "@/pages/listing-detail";
import ApplicationLetterPage from "@/pages/application-letter";
import ViewingTipsPage from "@/pages/viewing-tips";
import ProfileDetailsPage from "@/pages/profile-details";
import ProfileEditPage from "@/pages/profile-edit";
import { ImpressumPage, DatenschutzPage, TermsPage } from "@/pages/legal";
import SubscriptionDetailPage from "@/pages/subscription-detail";
import PaymentMethodPage from "@/pages/payment-method";
import { SubscriptionCancelConfirmPage, SubscriptionCancelledPage } from "@/pages/subscription-cancel";
import ChangePasswordPage from "@/pages/change-password";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import PostLoginFunnel from "@/pages/post-login-funnel";
import OnboardingIntroPage from "@/pages/onboarding-intro";
import OnboardingPage from "@/pages/onboarding";
import OnboardingEmbedPage from "@/pages/onboarding-embed";
import ContinueDraftPage from "@/pages/continue-draft";
import AuthCallbackPage from "@/pages/auth-callback";
import { DocumentenGuidePage, SchufaGuidePage, ZoekstrategieGuidePage, NetwerkGuidePage } from "@/pages/guide";
import DeleteAccountPage from "@/pages/delete-account";
import V2WelcomePage from "@/pages/v2/welcome";
import V2OnboardingIntroPage from "@/pages/v2/onboarding-intro";
import V2OnboardingLocationPage from "@/pages/v2/onboarding-location";
import { V2OnboardingProvider } from "@/lib/v2-onboarding-store";
import SubscriptionSuccessPage from "@/pages/subscription-success";
import EmbedSuccessPage from "@/pages/embed-success";
import AdminIngestionPage from "@/pages/admin-ingestion";
import AdminPortalPage from "@/pages/admin-portal";
import AdminMatchAuditPage from "@/pages/admin-match-audit";
import AdminActivationPage from "@/pages/admin-activation";
import ApplyPage from "@/pages/apply";
import TipDetailPage from "@/pages/tip-detail";
import DocumentsPage from "@/pages/documents";

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
          const completed = data.onboarding_completed === true;
          console.log(`[ONBOARDING CHECK] userId=${user.id?.substring(0, 8)}... completed=${completed}`);
          setNeedsOnboarding(!completed);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          console.log("[ONBOARDING CHECK] API call failed — fail-closed, requiring onboarding");
          setNeedsOnboarding(true);
          setChecking(false);
        }
      });
    return () => { cancelled = true; };
  }, [user, session, loading, skipOnboardingCheck]);

  if (loading) return null;
  if (!user) {
    const currentPath = window.location.hash
      ? window.location.hash.replace("#", "")
      : window.location.pathname;
    const returnTo = currentPath && currentPath !== "/" && currentPath !== "/login"
      ? `/login?returnTo=${encodeURIComponent(currentPath)}`
      : "/login";
    return <Redirect to={returnTo} />;
  }
  if (!skipOnboardingCheck && checking) return null;
  if (!skipOnboardingCheck && needsOnboarding) return <Redirect to="/onboarding/setup" />;
  return <Component />;
}

function RootRedirect() {
  const { user, session, loading } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (isRecoveryMode()) { setDestination("/reset-password"); return; }
    if (!user) { setDestination("/welcome"); return; }

    const token = session?.access_token;
    if (!token) { setDestination("/dashboard"); return; }

    apiFetch("/api/onboarding-status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const completed = data.onboarding_completed === true;
        console.log(`[ROOT] onboarding_completed=${completed}`);
        setDestination(completed ? "/dashboard" : "/onboarding/setup");
      })
      .catch(() => setDestination("/onboarding/setup"));
  }, [user, session, loading]);

  if (loading || !destination) return null;
  return <Redirect to={destination} />;
}

function OldOnboardingRedirect() {
  console.log("[ROUTE] Old /onboarding route hit → redirecting to /onboarding/setup");
  return <Redirect to="/onboarding/setup" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/welcome" component={WelcomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/onboarding-embed" component={OnboardingEmbedPage} />
      <Route path="/continue" component={ContinueDraftPage} />
      <Route path="/onboarding/intro" component={OnboardingIntroPage} />
      <Route path="/onboarding/setup" component={() => <ProtectedRoute component={PostLoginFunnel} skipOnboardingCheck />} />
      <Route path="/onboarding/location" component={OnboardingLocationPage} />
      <Route path="/onboarding/filters" component={OnboardingFiltersPage} />
      <Route path="/onboarding/estimate" component={OnboardingEstimatePage} />
      <Route path="/onboarding/preferences" component={OnboardingPreferencesPage} />
      <Route path="/onboarding/value" component={OnboardingValuePage} />
      <Route path="/onboarding" component={OldOnboardingRedirect} />
      <Route path="/paywall" component={PaywallPage} />
      <Route path="/subscription-success" component={() => <ProtectedRoute component={SubscriptionSuccessPage} skipOnboardingCheck />} />
      <Route path="/embed-success" component={EmbedSuccessPage} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/dashboard/searches/new" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/dashboard/searches/edit/:id" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/listing/:id" component={() => <ProtectedRoute component={ListingDetailPage} />} />
      <Route path="/apply/:id" component={() => <ProtectedRoute component={ApplyPage} />} />
      <Route path="/documents" component={() => <ProtectedRoute component={DocumentsPage} />} />
      <Route path="/application-letter" component={() => <ProtectedRoute component={ApplicationLetterPage} />} />
      <Route path="/profile/details" component={() => <ProtectedRoute component={ProfileDetailsPage} />} />
      <Route path="/profile/edit/:field" component={() => <ProtectedRoute component={ProfileEditPage} />} />
      <Route path="/tip/:id" component={() => <ProtectedRoute component={TipDetailPage} />} />
      <Route path="/tips/bezichtiging" component={() => <ProtectedRoute component={ViewingTipsPage} />} />
      <Route path="/tips/documenten" component={() => <ProtectedRoute component={DocumentenGuidePage} />} />
      <Route path="/tips/schufa" component={() => <ProtectedRoute component={SchufaGuidePage} />} />
      <Route path="/tips/zoekstrategie" component={() => <ProtectedRoute component={ZoekstrategieGuidePage} />} />
      <Route path="/tips/netwerk" component={() => <ProtectedRoute component={NetwerkGuidePage} />} />
      <Route path="/account/subscription" component={() => <ProtectedRoute component={SubscriptionDetailPage} />} />
      <Route path="/account/subscription/cancel" component={() => <ProtectedRoute component={SubscriptionCancelConfirmPage} />} />
      <Route path="/account/subscription/cancelled" component={() => <ProtectedRoute component={SubscriptionCancelledPage} />} />
      <Route path="/account/payment-method" component={() => <ProtectedRoute component={PaymentMethodPage} />} />
      <Route path="/account/change-password" component={() => <ProtectedRoute component={ChangePasswordPage} />} />
      <Route path="/account/delete" component={() => <ProtectedRoute component={DeleteAccountPage} />} />
      <Route path="/admin/portal" component={() => <ProtectedRoute component={AdminPortalPage} skipOnboardingCheck />} />
      <Route path="/admin/ingestion" component={AdminIngestionPage} />
      <Route path="/admin/match-audit" component={() => <ProtectedRoute component={AdminMatchAuditPage} />} />
      <Route path="/admin/activation" component={() => <ProtectedRoute component={AdminActivationPage} />} />
      <Route path="/impressum" component={ImpressumPage} />
      <Route path="/datenschutz" component={DatenschutzPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/v2/welcome" component={V2WelcomePage} />
      <Route path="/v2/onboarding/intro" component={V2OnboardingIntroPage} />
      <Route path="/v2/onboarding/location" component={V2OnboardingLocationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <V2OnboardingProvider>
              <Toaster />
              <Router />
            </V2OnboardingProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

function App() {
  console.log(`[APP BOOT] HousAlert v2.1 — IS_NATIVE=${IS_NATIVE} — ${new Date().toISOString()}`);
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
