import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
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

console.log("[BOOT] HousAlert push v6 — production-ready");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("match-alerts", {
    name: "Woningmeldingen",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0D6EFD",
    sound: "default",
  }).catch(() => {});
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[PUSH] Not a physical device — skipping");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
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
    console.warn("[PUSH] No valid Expo projectId — run `npx eas init`");
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
  console.log("[PUSH] Registering token with backend...");
  console.log("[PUSH] POST", `${API_BASE}/api/expo-push-token`);
  console.log("[PUSH] Token:", expoPushToken.substring(0, 30) + "...");
  console.log("[PUSH] Platform:", Platform.OS);
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

    const bodyText = await res.text();
    console.log("[PUSH] Response status:", res.status);
    console.log("[PUSH] Response body:", bodyText);

    if (!res.ok) {
      console.error("[PUSH] Backend rejected:", res.status, bodyText);
      return false;
    }

    let json: any = {};
    try { json = JSON.parse(bodyText); } catch {}

    if (json.ok && json.persisted) {
      console.log("[PUSH] Token registered and PERSISTED on backend. Active tokens:", json.active_token_count);
      return true;
    } else if (json.ok) {
      console.warn("[PUSH] Backend returned ok but persistence not confirmed:", bodyText);
      return true;
    } else {
      console.error("[PUSH] Backend returned failure:", bodyText);
      return false;
    }
  } catch (err: any) {
    console.error("[PUSH] Network error:", err?.message || err);
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
    console.error("[PUSH] Failed to deactivate:", err);
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

interface AuthPayload {
  user_id: string;
  access_token: string;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const pushTokenRef = useRef<string | null>(null);
  const authRef = useRef<AuthPayload | null>(null);
  const registeredForUserRef = useRef<string | null>(null);
  const registeredTokenRef = useRef<string | null>(null);

  const navigateWebView = useCallback((path: string) => {
    if (!webViewRef.current) return;
    const targetUrl = `${WEB_APP_URL}${path.startsWith("/") ? path : "/" + path}`;
    const js = `
      (function() {
        try {
          if (window.__HOUSALERT_NATIVE__ && window.location.hash !== undefined) {
            window.location.hash = '#${path}';
          } else {
            window.location.href = '${targetUrl}';
          }
        } catch(e) {
          window.location.href = '${targetUrl}';
        }
        true;
      })();
    `;
    webViewRef.current.injectJavaScript(js);
    console.log("[NAV] Navigated WebView to:", path);
  }, []);

  const tryRegister = useCallback(async () => {
    const auth = authRef.current;
    const token = pushTokenRef.current;

    if (!auth || !token) {
      console.log("[PUSH] tryRegister — waiting for", !auth ? "auth" : "token");
      return;
    }

    if (registeredForUserRef.current === auth.user_id && registeredTokenRef.current === token) {
      return;
    }

    const success = await sendTokenToBackend(auth.access_token, token);
    if (success) {
      registeredForUserRef.current = auth.user_id;
      registeredTokenRef.current = token;
    } else {
      console.log("[PUSH] Will retry in 10s");
      setTimeout(() => tryRegister(), 10000);
    }
  }, []);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      pushTokenRef.current = token;
      console.log("[PUSH] Token ready:", token ? "yes" : "no");
      if (token) tryRegister();
    });
  }, [tryRegister]);

  useEffect(() => {
    const tokenRefreshSub = Notifications.addPushTokenListener((event) => {
      const newToken = event.data;
      console.log("[PUSH] Token refreshed:", newToken);
      if (newToken !== pushTokenRef.current) {
        pushTokenRef.current = newToken;
        registeredTokenRef.current = null;
        tryRegister();
      }
    });

    return () => tokenRefreshSub.remove();
  }, [tryRegister]);

  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const url = response.notification.request.content.data?.url;
        if (url && typeof url === "string") {
          console.log("[NAV] App opened from notification — deep link:", url);
          setPendingDeepLink(url);
        }
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url && typeof url === "string") {
        console.log("[NAV] Notification tapped — deep link:", url);
        if (!loading) {
          navigateWebView(url);
        } else {
          setPendingDeepLink(url);
        }
      }
    });

    return () => responseSub.remove();
  }, [loading, navigateWebView]);

  useEffect(() => {
    const appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
    });

    Notifications.setBadgeCountAsync(0).catch(() => {});

    return () => appStateSub.remove();
  }, []);

  const handleWebViewMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const parsed = JSON.parse(event.nativeEvent.data);

        if (parsed.type === "SUPABASE_SESSION") {
          const userId = parsed.user_id;
          const accessToken = parsed.access_token;

          if (!userId || !accessToken) {
            console.log("[AUTH] Session message — no active user (logged out)");
            const prevAuth = authRef.current;
            if (prevAuth && pushTokenRef.current) {
              await deactivateTokenOnBackend(prevAuth.access_token, pushTokenRef.current);
            }
            authRef.current = null;
            registeredForUserRef.current = null;
            registeredTokenRef.current = null;
            return;
          }

          console.log(`[AUTH] Session received from WebView — user: ${userId.substring(0, 8)}...`);

          const prevAuth = authRef.current;
          if (prevAuth && prevAuth.user_id !== userId && pushTokenRef.current) {
            await deactivateTokenOnBackend(prevAuth.access_token, pushTokenRef.current);
            registeredForUserRef.current = null;
            registeredTokenRef.current = null;
          }

          authRef.current = { user_id: userId, access_token: accessToken };
          await tryRegister();
          return;
        }
      } catch (err) {
        console.error("[BRIDGE] Parse error:", err);
      }
    },
    [tryRegister]
  );

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setHasError(false);
    console.log("[WEBVIEW] Page loaded");

    if (pendingDeepLink) {
      setTimeout(() => {
        navigateWebView(pendingDeepLink!);
        setPendingDeepLink(null);
      }, 500);
    }
  }, [pendingDeepLink, navigateWebView]);

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
