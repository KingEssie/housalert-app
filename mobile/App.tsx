// HousAlert Mobile — Expo WebView wrapper
// Loads the production web app inside a full-screen WebView.
// This approach lets us ship to iOS/Android quickly while
// keeping all UI logic in the existing React web app.

import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView, WebViewNavigation } from "react-native-webview";

// Production URL — change this if your domain changes
const WEB_APP_URL = "https://housalert.replit.app";

// JavaScript injected into the WebView to disable long-press
// context menus and make the web app feel more native
const INJECTED_JS = `
  (function() {
    // Disable context menu (long-press)
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // Disable text selection for a more native feel
    document.documentElement.style.webkitUserSelect = 'none';
    document.documentElement.style.userSelect = 'none';

    // Tell the web app it's running inside the native shell
    window.__HOUSALERT_NATIVE__ = true;
    window.__HOUSALERT_PLATFORM__ = '${Platform.OS}';

    true; // Required by react-native-webview
  })();
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Handle WebView load completion
  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setHasError(false);
  }, []);

  // Handle WebView load errors (network down, server error, etc.)
  const handleError = useCallback(() => {
    setLoading(false);
    setHasError(true);
  }, []);

  // Retry loading the web app after an error
  const handleRetry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // Prevent navigation to external URLs — open only internal routes
  const handleNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    if (nav.url && !nav.url.startsWith(WEB_APP_URL) && !nav.url.startsWith("about:")) {
      webViewRef.current?.stopLoading();
    }
  }, []);

  return (
    <SafeAreaProvider>
      {/* Status bar: light text on blue background matches the brand */}
      <StatusBar style="dark" />

      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Error state — shown when the web app fails to load */}
        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Geen verbinding</Text>
            <Text style={styles.errorMessage}>
              Kan de app niet laden. Controleer je internetverbinding en probeer
              het opnieuw.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Opnieuw proberen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* WebView — renders the full production web app */}
            <WebView
              ref={webViewRef}
              source={{ uri: WEB_APP_URL }}
              style={styles.webview}
              injectedJavaScript={INJECTED_JS}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleError}
              onNavigationStateChange={handleNavigationStateChange}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
              allowsBackForwardNavigationGestures
              sharedCookiesEnabled
              // Pull-to-refresh for a native feel
              pullToRefreshEnabled
              // Allow media playback without user gesture
              mediaPlaybackRequiresUserAction={false}
              // Scroll behavior
              overScrollMode="never"
              bounces={false}
            />

            {/* Loading overlay — shown on initial load */}
            {loading && (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingContent}>
                  <Text style={styles.loadingLogo}>HousAlert</Text>
                  <ActivityIndicator
                    size="large"
                    color="#0D6EFD"
                    style={styles.spinner}
                  />
                  <Text style={styles.loadingText}>Laden...</Text>
                </View>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingLogo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0D6EFD",
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  spinner: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    backgroundColor: "#FFFFFF",
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111C3D",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#0D6EFD",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
