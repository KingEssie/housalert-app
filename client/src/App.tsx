import { useEffect, useState } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
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

const IS_NATIVE = isNativePlatform();
import WelcomePage from "@/pages/welcome";
import SignupPage from "@/pages/signup";
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
import OnboardingSetup from "@/pages/onboarding/setup";
import OnboardingEmbedPage from "@/pages/onboarding-embed";
import OnboardingIntroNew from "@/pages/onboarding/intro";
import OnboardingCityNew from "@/pages/onboarding/city";
import OnboardingLocationNew from "@/pages/onboarding/location";
import OnboardingFiltersNew from "@/pages/onboarding/filters";
import OnboardingNameNew from "@/pages/onboarding/name";
import OnboardingEmailNew from "@/pages/onboarding/email";
import OnboardingPasswordNew from "@/pages/onboarding/password";
import OnboardingPreferencesNew from "@/pages/onboarding/preferences";
import ContinueDraftPage from "@/pages/continue-draft";
import AuthCallbackPage from "@/pages/auth-callback";
import { DocumentenGuidePage, SchufaGuidePage, ZoekstrategieGuidePage, NetwerkGuidePage } from "@/pages/guide";
import DeleteAccountPage from "@/pages/delete-account";
import SubscriptionSuccessPage from "@/pages/subscription-success";
import CheckoutSuccessPage from "@/pages/checkout-success";
import EmbedSuccessPage from "@/pages/embed-success";
import PaywallPage from "@/pages/paywall";
import OnboardingSlideshow from "@/pages/onboarding-slideshow";
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
  if (!skipOnboardingCheck && needsOnboarding) return <Redirect to="/onboarding/intro" />;
  return <Component />;
}

function RootRoute() {
  const { user, loading } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const hasRef = !!urlParams.get("ref");

  if (loading) return null;
  if (isRecoveryMode()) return <Redirect to="/reset-password" />;
  if (hasRef && !user) return <ReferralLandingPage />;
  if (!user) return <OnboardingSlideshow />;
  return <Redirect to="/home" />;
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
        setDestination(completed ? "/home" : "/onboarding/intro");
        setChecking(false);
      })
      .catch(() => {
        setDestination("/home");
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
      <Route path="/signup" component={SignupPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/onboarding-embed" component={OnboardingEmbedPage} />
      <Route path="/continue" component={ContinueDraftPage} />
      <Route path="/onboarding/intro" component={OnboardingIntroNew} />
      <Route path="/onboarding/city" component={OnboardingCityNew} />
      <Route path="/onboarding/location" component={OnboardingLocationNew} />
      <Route path="/onboarding/filters" component={OnboardingFiltersNew} />
      <Route path="/onboarding/name" component={OnboardingNameNew} />
      <Route path="/onboarding/email" component={OnboardingEmailNew} />
      <Route path="/onboarding/password" component={OnboardingPasswordNew} />
      <Route path="/onboarding/setup" component={() => <ProtectedRoute component={OnboardingSetup} skipOnboardingCheck />} />
      <Route path="/onboarding/continue" component={() => <Redirect to="/onboarding/setup" />} />
      <Route path="/onboarding/estimate" component={() => <Redirect to="/onboarding/intro" />} />
      <Route path="/onboarding/preferences" component={OnboardingPreferencesNew} />
      <Route path="/onboarding/value" component={() => <Redirect to="/onboarding/intro" />} />
      <Route path="/onboarding" component={() => <Redirect to="/onboarding/intro" />} />
      <Route path="/paywall" component={PaywallPage} />
      <Route path="/subscription-success" component={() => <ProtectedRoute component={SubscriptionSuccessPage} skipOnboardingCheck />} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/embed-success" component={EmbedSuccessPage} />
      <Route path="/home" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/dashboard/searches/new" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/dashboard/searches/edit/:id" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/listing/:id" component={() => <ProtectedRoute component={ListingDetailPage} />} />
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
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/settings/preferences" component={() => <ProtectedRoute component={PreferencesPage} />} />
      <Route path="/settings/housing" component={() => <ProtectedRoute component={HousingSituationPage} />} />
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
      <Route path="/admin/image-audit" component={() => <ProtectedRoute component={AdminImageAuditPage} />} />
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
