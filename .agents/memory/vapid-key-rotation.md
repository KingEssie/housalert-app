---
name: VAPID key rotation pitfall
description: When rotating VAPID keys, a shared env var with the same name silently shadows the secret — must delete the env var first.
---

## The Rule
Before updating `VITE_VAPID_PUBLIC_KEY` or any key that exists as BOTH a shared env var and a secret, delete the shared env var first. Otherwise the old env var value silently wins and the new secret is never used.

**Why:** Replit env var/secret resolution order: shared env vars take precedence over secrets of the same name. Node.js `process.env` picks up the env var, ignoring the secret.

**How to apply:**
1. Run `viewEnvVars({ type: "all", keys: ["VITE_VAPID_PUBLIC_KEY"] })` to detect conflicts.
2. If the key appears in both `envVars.shared` and `secrets`, call `deleteEnvVars({ keys: ["VITE_VAPID_PUBLIC_KEY"], environment: "shared" })` first.
3. Then restart the workflow and confirm via `GET /api/push/vapid-key` that the new value is served.

## Rotation procedure (full)
1. Generate new matched pair: `node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log(k.publicKey, k.privateKey)"`
2. Delete conflicting shared env var if present
3. `requestEnvVar` for both `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
4. Restart workflow; confirm `/api/push/vapid-key` returns new public key
5. Old browser subscriptions (tied to old public key) will auto-delete on first 403 — user must re-enable push in browser
6. Redeploy to production
