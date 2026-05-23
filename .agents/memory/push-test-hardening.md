---
name: Push test 500 hardening
description: sendPushToUser and sendExpoTestPush must each have independent try/catch at call site to prevent provider throws from surfacing as 500.
---

## The Rule
In the `/api/admin/portal/test-alert` (type=push) handler, each provider call must be individually wrapped in try/catch with a fallback result. Do NOT let a throw from either provider propagate to the inner catch block (which returns 500).

**Why:** sendExpoTestPush internally calls logDelivery (Supabase insert) and sendWithRetry (Expo API). A network failure or Supabase error can throw past sendWithRetry's own try/catch in edge cases, bubbling up to the inner catch → HTTP 500.

**Pattern:**
```typescript
let webResult: PushSendResult;
try { webResult = await sendPushToUser(...); }
catch (e: any) { webResult = { sent: 0, failed: 1, removed: 0, errors: [{ message: `threw: ${e.message}` }] }; }

let expoResult: { sent: number; failed: number; tokens: number };
try { expoResult = await sendExpoTestPush(...); }
catch (e: any) { expoResult = { sent: 0, failed: 1, tokens: 0 }; }
```

Both log the exception. The overall endpoint always returns 200 JSON with structured error details.
