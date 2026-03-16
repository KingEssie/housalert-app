import { useState, useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/i18n";
import { getSearchProfiles } from "@/lib/search-profiles";
import { isNativePlatform } from "@/lib/capacitor";

const IS_NATIVE = isNativePlatform();
import LandingPage from "@/pages/landing";
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
import NotificationSettingsPage from "@/pages/notification-settings";
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
import OnboardingPage from "@/pages/onboarding";
import OnboardingEmbedPage from "@/pages/onboarding-embed";
import ContinueDraftPage from "@/pages/continue-draft";
import AuthCallbackPage from "@/pages/auth-callback";
import { DocumentenGuidePage, SchufaGuidePage, ZoekstrategieGuidePage, NetwerkGuidePage } from "@/pages/guide";
import DeleteAccountPage from "@/pages/delete-account";
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
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(!skipOnboardingCheck);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (loading || !user || skipOnboardingCheck) return;
    let cancelled = false;
    getSearchProfiles()
      .then((profiles) => {
        if (!cancelled) {
          setNeedsOnboarding(profiles.length === 0);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [user, loading, skipOnboardingCheck]);

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
  if (!skipOnboardingCheck && needsOnboarding) return <Redirect to="/onboarding" />;
  return <Component />;
}

function NativeAwareRoot() {
  const { user, loading } = useAuth();
  const native = isNativePlatform();
  console.log("[NativeAwareRoot]", {
    native,
    loading,
    hasUser: !!user,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    __HOUSALERT_NATIVE__: (window as any).__HOUSALERT_NATIVE__,
  });
  if (native) {
    if (loading) return null;
    const target = user ? "/dashboard" : "/login";
    console.log("[NativeAwareRoot] Native redirect →", target);
    return <Redirect to={target} />;
  }
  console.log("[NativeAwareRoot] Web → LandingPage");
  return <LandingPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={NativeAwareRoot} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/onboarding-embed" component={OnboardingEmbedPage} />
      <Route path="/continue" component={ContinueDraftPage} />
      <Route path="/onboarding/location" component={OnboardingLocationPage} />
      <Route path="/onboarding/filters" component={OnboardingFiltersPage} />
      <Route path="/onboarding/estimate" component={OnboardingEstimatePage} />
      <Route path="/onboarding/preferences" component={OnboardingPreferencesPage} />
      <Route path="/onboarding/value" component={OnboardingValuePage} />
      <Route path="/paywall" component={PaywallPage} />
      <Route path="/subscription-success" component={() => <ProtectedRoute component={SubscriptionSuccessPage} skipOnboardingCheck />} />
      <Route path="/embed-success" component={EmbedSuccessPage} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} skipOnboardingCheck />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/dashboard/searches/new" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/dashboard/searches/edit/:id" component={() => <ProtectedRoute component={NewSearchPage} />} />
      <Route path="/settings/notifications" component={() => <ProtectedRoute component={NotificationSettingsPage} />} />
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
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

function App() {
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
