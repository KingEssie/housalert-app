import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView, type WebViewNavigation } from "react-native-webview";

const WEB_APP_URL = "https://rental-alert-ui.replit.app";

const INJECTED_JS = `
  (function() {
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.documentElement.style.webkitUserSelect = 'none';
    document.documentElement.style.userSelect = 'none';
    window.__HOUSALERT_NATIVE__ = true;
    window.__HOUSALERT_PLATFORM__ = '${Platform.OS}';
    true;
  })();
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleNavChange = useCallback((nav: WebViewNavigation) => {
    if (nav.url && !nav.url.startsWith(WEB_APP_URL) && !nav.url.startsWith("about:")) {
      webViewRef.current?.stopLoading();
    }
  }, []);

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Geen verbinding</Text>
          <Text style={styles.errorMsg}>
            Kan de app niet laden. Controleer je internetverbinding en probeer het opnieuw.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Text style={styles.retryTxt}>Opnieuw proberen</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        injectedJavaScript={INJECTED_JS}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        onNavigationStateChange={handleNavChange}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        pullToRefreshEnabled
        mediaPlaybackRequiresUserAction={false}
      />
      {loading && (
        <View style={styles.overlay}>
          <Text style={styles.logo}>HousAlert</Text>
          <ActivityIndicator size="large" color="#0D6EFD" style={{ marginBottom: 12 }} />
          <Text style={styles.loadTxt}>Laden...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  logo: { fontSize: 28, fontWeight: "800", color: "#0D6EFD", marginBottom: 24 },
  loadTxt: { fontSize: 15, color: "#6B7280" },
  errorBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 22, fontWeight: "700", color: "#111C3D", marginBottom: 8 },
  errorMsg: { fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  retryBtn: { backgroundColor: "#0D6EFD", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 },
  retryTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
