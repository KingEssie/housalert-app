import { useEffect, useState } from "react";
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
import WelcomePage from "@/pages/welcome";
import DashboardPage from "@/pages/dashboard";
import AppSearchWizard from "@/pages/app-search-wizard";
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
import OnboardingSetup from "@/pages/onboarding/setup";
import OnboardingEmbedPage from "@/pages/onboarding-embed";
import OnboardingLocationNew from "@/pages/onboarding/location";
import OnboardingFiltersNew from "@/pages/onboarding/filters";
import OnboardingNameNew from "@/pages/onboarding/name";
import OnboardingEmailNew from "@/pages/onboarding/email";
import OnboardingPasswordNew from "@/pages/onboarding/password";
import OnboardingPreferencesNew from "@/pages/onboarding/preferences";
import ContinueDraftPage from "@/pages/continue-draft";
import AuthCallbackPage from "@/pages/auth-callback";
import { DocumentenGuidePage, SchufaGuidePage, ZoekstrategieGuidePage, NetwerkGuidePage, FinancienGuidePage, VerhuurdersGuidePage, FacebookGuidePage, NieuwbouwGuidePage, OpvolgingGuidePage } from "@/pages/guide";
import DeleteAccountPage from "@/pages/delete-account";
import SubscriptionSuccessPage from "@/pages/subscription-success";
import CheckoutSuccessPage from "@/pages/checkout-success";
import EmbedSuccessPage from "@/pages/embed-success";
import PaywallPage from "@/pages/paywall";
import AdminIngestionPage from "@/pages/admin-ingestion";
import AdminPortalPage from "@/pages/admin-portal";
import AdminMatchAuditPage from "@/pages/admin-match-audit";
import AdminActivationPage from "@/pages/admin-activation";
import AdminImageAuditPage from "@/pages/admin-image-audit";
import ApplyPage from "@/pages/apply";
import TipDetailPage from "@/pages/tip-detail";
import TipsFlowPage from "@/pages/tips-flow";
import FlowPage from "@/pages/flow-page";
import DocumentsPage from "@/pages/documents";
import SettingsPage from "@/pages/settings";
import PreferencesPage from "@/pages/preferences";
import HousingSituationPage from "@/pages/housing-situation";
import ReferralLandingPage from "@/pages/referral-landing";
import BuddyAcceptPage from "@/pages/buddy-accept";
import ZoekbuddyPage from "@/pages/zoekbuddy";
import SupportPage from "@/pages/support";
import SupportThreadPage from "@/pages/support-thread";

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


function Router() {
  return (
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
