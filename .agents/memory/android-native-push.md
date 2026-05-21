---
name: Android native push registration
description: How the two native paths work (Expo WebView vs Capacitor), detection approach, and why the original fix failed
---

## The two native contexts

### 1. Expo WebView (mobile-clean/App.tsx) — what Martin runs on Samsung
- React Native WebView loading https://app.housalert.com?native=1
- Injects window.__HOUSALERT_NATIVE__ = true via injectedJavaScriptBeforeContentLoaded
- NO window.Capacitor — no Capacitor bridge in this context
- Push registration done automatically by App.tsx native layer (expo-notifications)
- Token sent to POST /api/expo-push-token on startup with user access_token
- Web UI push toggle ONLY needs to flip push_enabled via PUT /api/notifications/settings

### 2. Capacitor native (android/ folder)
- Capacitor WebView — window.Capacitor IS available
- Push via @capacitor/push-notifications plugin
- registerNativePush() → Expo token → POST /api/expo-push-token

## Why original fix failed (three stacked failures)
1. window.Capacitor doesn't exist in Expo WebView → first check returns false
2. injectedJavaScriptBeforeContentLoaded unreliable on Android — React bundle can run before injection
3. Wouter router strips ?native=1 from URL when navigating (to /dashboard, /preferences) → URL param check fails at toggle time

## The fix (in capacitor.ts)
- detectNativeOnStartup() runs at MODULE LOAD TIME (not component mount, not event handler)
  before React renders, before any routing — caches result to localStorage("ha_native_v1")
- isCapacitorNative(): window.Capacitor.isNativePlatform() === true only
- isExpoWebView(): checks __HOUSALERT_NATIVE__ || localStorage cache, AND no Capacitor
- localStorage cache survives SPA navigation that strips query params
- isNativePlatform(): union of both (backward compat)
- registerNativePush(): guarded by isCapacitorNative() not isNativePlatform()

## Push toggle three-way branch (dashboard.tsx, preferences.tsx)
1. isExpoWebView() → PUT /api/notifications/settings {push_enabled} — no Capacitor APIs
2. isCapacitorNative() → registerNativePush() → POST /api/expo-push-token
3. else → web push (VAPID/serviceWorker)

## Debug panel (preferences.tsx)
Visible when isAndroidNative OR ?debug=1 OR localStorage.ha_debug=1.
The catch-22 fix: even if detection fails, navigate to /preferences?debug=1
to see: platform, push path, expo/cap flags, __NATIVE__, window.Capacitor, tokens.

## Admin test push
POST /api/admin/portal/test-alert {type:"push", userId:"email@..."} 
Accepts UUID or email. Shows Expo token count + provider response.

## Key files
- client/src/lib/capacitor.ts — detectNativeOnStartup, isCapacitorNative, isExpoWebView
- client/src/pages/dashboard.tsx — three-way push toggle
- client/src/pages/preferences.tsx — three-way push toggle + debug panel
- mobile-clean/App.tsx — Expo native layer, handles token registration
- server/routes.ts — POST /api/expo-push-token (auto-sets push_enabled=true), POST /api/push/test
- server/notifications/expo-push.ts — sendExpoMatchPush, sendExpoTestPush
