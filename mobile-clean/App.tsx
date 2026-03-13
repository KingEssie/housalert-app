import { useCallback, useEffect, useRef, useState } from "react";
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
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

const WEB_APP_URL = "https://rental-alert-ui.replit.app";
const API_BASE = "https://rental-alert-ui.replit.app";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[PUSH] Not a physical device — skipping push registration");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    console.log("[PUSH] Requesting push permission...");
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[PUSH] Permission denied");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null;

  if (!projectId || projectId === "YOUR_PROJECT_ID") {
    console.warn(
      "[PUSH] No valid Expo projectId configured. " +
      "Run `npx eas init` in mobile-clean/ to generate one, " +
      "then restart the app. Push notifications are disabled until then."
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[PUSH] Expo push token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.warn("[PUSH] Could not obtain push token:", err);
    return null;
  }
}

async function sendTokenToBackend(
  accessToken: string,
  expoPushToken: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/expo-push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        expo_push_token: expoPushToken,
        platform: Platform.OS,
      }),
    });

    if (res.ok) {
      console.log("[PUSH] Token registered on backend");
      return true;
    } else {
      const body = await res.text();
      console.error("[PUSH] Backend rejected token:", res.status, body);
      return false;
    }
  } catch (err) {
    console.error("[PUSH] Failed to send token to backend:", err);
    return false;
  }
}

async function deactivateTokenOnBackend(
  accessToken: string,
  expoPushToken: string
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/expo-push-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
    console.log("[PUSH] Token deactivated on backend");
  } catch (err) {
    console.error("[PUSH] Failed to deactivate token:", err);
  }
}

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

interface AuthMessage {
  type: "AUTH_STATE";
  user_id: string | null;
  access_token: string | null;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const pushTokenRef = useRef<string | null>(null);
  const authRef = useRef<{ user_id: string; access_token: string } | null>(null);
  const registeredForUserRef = useRef<string | null>(null);

  const tryRegister = useCallback(async () => {
    const auth = authRef.current;
    const token = pushTokenRef.current;

    if (!auth || !token) return;

    if (registeredForUserRef.current === auth.user_id) {
      return;
    }

    const success = await sendTokenToBackend(auth.access_token, token);
    if (success) {
      registeredForUserRef.current = auth.user_id;
      console.log("[PUSH] Registration complete for user", auth.user_id.substring(0, 8) + "...");
    }
  }, []);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      pushTokenRef.current = token;
      console.log("[PUSH] Token ready:", token ? "yes" : "no");
      if (token) tryRegister();
    });
  }, [tryRegister]);

  const handleWebViewMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const msg: AuthMessage = JSON.parse(event.nativeEvent.data);
        if (msg.type !== "AUTH_STATE") return;

        console.log(
          "[BRIDGE] Auth state received — user:",
          msg.user_id ? msg.user_id.substring(0, 8) + "..." : "null"
        );

        const prevAuth = authRef.current;

        if (!msg.user_id || !msg.access_token) {
          if (prevAuth && pushTokenRef.current) {
            await deactivateTokenOnBackend(prevAuth.access_token, pushTokenRef.current);
          }
          authRef.current = null;
          registeredForUserRef.current = null;
          console.log("[PUSH] User logged out — token deactivated");
          return;
        }

        if (prevAuth && prevAuth.user_id !== msg.user_id && pushTokenRef.current) {
          await deactivateTokenOnBackend(prevAuth.access_token, pushTokenRef.current);
          registeredForUserRef.current = null;
          console.log("[PUSH] Account switched — old token deactivated");
        }

        authRef.current = { user_id: msg.user_id, access_token: msg.access_token };
        await tryRegister();
      } catch (err) {
        console.error("[BRIDGE] Failed to parse message:", err);
      }
    },
    [tryRegister]
  );

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
    if (
      nav.url &&
      !nav.url.startsWith(WEB_APP_URL) &&
      !nav.url.startsWith("about:")
    ) {
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
            Kan de app niet laden. Controleer je internetverbinding en probeer
            het opnieuw.
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
        onMessage={handleWebViewMessage}
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
          <ActivityIndicator
            size="large"
            color="#0D6EFD"
            style={{ marginBottom: 12 }}
          />
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
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0D6EFD",
    marginBottom: 24,
  },
  loadTxt: { fontSize: 15, color: "#6B7280" },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111C3D",
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#0D6EFD",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  retryTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
