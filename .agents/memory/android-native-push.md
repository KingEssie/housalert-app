---
name: Android native push registration
description: How Capacitor/native push token registration works and why web push APIs fail on native
---

## Rule
Never call isPushSupported() / subscribeToPush() on native platforms.
Web Push APIs (serviceWorker, PushManager, Notification) do not exist in Capacitor native WebViews.

## How to apply
In any push toggle UI:
1. Check isNativePlatform() first
2. If native: call registerNativePush() from client/src/lib/capacitor.ts → returns Expo token string
3. POST token to POST /api/expo-push-token (backend auto-sets push_enabled=true)
4. Update local state from the response (active_token_count)
5. Fall through to isPushSupported() / subscribeToPush() only for non-native

## Why
On native Android, isPushSupported() returns false (no Web Push APIs — function returns "no-push-manager").
The push toggle used to exit immediately with "Push not supported" toast.
registerNativePush() calls @capacitor/push-notifications → gets FCM/Expo token.
Server sends via Expo Push API (exp.host/--/api/v2/push/send), not VAPID.

## Key files
- Client: client/src/lib/capacitor.ts — registerNativePush()
- Client toggle: dashboard.tsx and preferences.tsx (isNativePlatform branch)
- Backend token endpoint: POST /api/expo-push-token (auto-sets push_enabled=true)
- Backend test: POST /api/push/test (user self-test, any auth user)
- Sending: server/notifications/expo-push.ts — sendExpoMatchPush()
- Suppression: "no_token" added to buffer.ts when push_enabled=true but no tokens
