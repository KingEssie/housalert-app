# HousAlert — Rental Alert App

A mobile-first rental alert application for the German market, allowing users to manage rental search profiles and receive matched listings.

## Run & Operate

- **Run Dev Server:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen:** `npm run codegen`
- **DB Push (migrations):** `npx prisma db push` (for local Supabase instance)

**Environment Variables:**
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key
- `INGEST_BEARER_TOKEN`: Bearer token for ingestion endpoint
- `INGEST_INTERVAL_MINUTES`: Scheduler interval (default: 5)
- `ENABLE_INGEST_SCHEDULER`: Set to `true` to enable automatic scheduler
- `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: Web Push VAPID keys
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe API keys and webhook secret.
- `GOOGLE_PLACES_API_KEY`: Google Places API key (optional, falls back to Nominatim)
- `ADMIN_EMAILS`: Comma-separated list of admin emails for portal access.
- `APP_PUBLIC_BASE_URL`: Base URL for the application.

## Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL), Replit PostgreSQL (via `pg` pool)
- **Backend:** Express
- **Payments:** Stripe
- **Mobile:** Expo (WebView wrapper), Capacitor (Native build)
- **ORM:** _Populate as you build_
- **Validation:** _Populate as you build_
- **Build Tool:** Vite

## Where things live

- **Frontend Source:** `client/src/`
- **Backend Source:** `server/`
- **Shared Utilities:** `shared/`
- **DB Schema (Supabase):** `supabase/migrations/` (and inline SQL in `Supabase Tables` section of this doc)
- **DB Schema (Replit PG):** `server/migrations/`
- **API Contracts:** Defined implicitly by `server/routes.ts` and client-side API calls.
- **Theme/Design System:** `client/src/index.css`, `client/src/lib/theme.ts`
- **Internationalization:** `client/src/i18n/locales/{de,en,nl}.ts` (frontend), `server/i18n.ts` (backend)
- **Task Flow Config:** `client/src/lib/task-flows.ts`
- **Feature Flags:** `client/src/lib/feature-flags.ts`
- **Market Configuration:** `config/market.ts`

## Architecture decisions

- **Dual Database Strategy:** Supabase PostgreSQL for core user/listing data (with RLS), Replit PostgreSQL for more dynamic/audit/profile data (direct access via `pg` pool). This was chosen due to DDL access constraints on Supabase for certain tables.
- **Provider Abstraction for Mapping/Geocoding:** Map rendering (Leaflet/Mapbox) and place search (Google/Nominatim/Mapbox) are abstracted to allow switching providers via feature flags without refactoring consuming components.
- **Canonical Match Tracking (`user_matches` table):** A dedicated `user_matches` table in Replit PG serves as the single source of truth for all user-listing match states, enabling robust deduplication and accurate statistics for all notification channels and UI displays.
- **Multi-Channel Notification Buffer with Recovery:** Match alerts are buffered and flushed per-city and globally, with a robust recovery mechanism to re-process undelivered matches on startup or failure, ensuring no match alerts are lost.
- **Stripe Auto-Sync for Subscriptions:** The system periodically checks Stripe for the true status of subscriptions to heal any discrepancies with the local database, preventing user lockouts due to missed webhooks.
- **Mobile WebView Wrapper with Capacitor:** The mobile app leverages a Capacitor-wrapped WebView of the existing web application, enabling native features like push notifications while maintaining a single codebase for the core UI.

## Product

- **Rental Search Profiles:** Users can create and manage detailed search profiles including location (city, radius, commute), price, bedrooms, size, and other property features.
- **Listing Matching & Alerts:** Listings are continuously matched against user profiles, and users receive alerts via email, web push, and native mobile push notifications.
- **Application Flow:** Users can manage application templates and quickly apply to listings through a dedicated "quick-apply" bottom sheet.
- **Onboarding & Guided Flows:** Structured onboarding and guided task flows assist users in setting up their profile, maximizing their chances of finding a rental, and exploring application tips.
- **Subscription & Paywall:** A subscription model with a free trial provides premium features, managed through Stripe for payments.
- **Admin Portal:** An interactive portal for administrators to monitor system health, manage users, listings, subscriptions, and analyze ingestion/activation metrics.

## Local Android Build (Windows / Android Studio)

Clone the repo and follow these steps exactly. Every step is required — skipping any one of them causes a blank screen or "supabaseUrl is required" crash.

### 1. Prerequisites
- Node.js 20+, Git, Android Studio (with Android SDK 34+)
- Java 17+ (for Gradle)

### 2. Clone & install
```bash
git clone https://github.com/KingEssie/housalert-app.git
cd housalert-app
npm install
```

### 3. Create `.env` in the project root
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
> Copy `.env.example` as a starting point. The file **must** be named `.env` and placed in the project root (same folder as `package.json`). Do **not** commit it.

### 4. Build & sync to Android
```bash
npm run mobile:android:sync
```
This runs `npm run build` (Vite → `dist/public`) then `npx cap sync android` (copies web assets into `android/app/src/main/assets/public`). The build will print `✓ set` for each env var — if you see `✗ MISSING`, stop and fix `.env` before continuing.

### 5. Open in Android Studio
```bash
npm run cap:android
# or manually: open the `android/` folder in Android Studio
```

### 6. Run on device or emulator
Press **Run** in Android Studio. The app must be rebuilt and re-synced (`npm run mobile:android:sync`) after any code change.

### Verified paths
| What | Where |
|------|-------|
| Vite build output | `dist/public/` |
| Capacitor `webDir` | `dist/public` (matches `capacitor.config.ts`) |
| Android web assets | `android/app/src/main/assets/public/` |
| Required env file | `.env` (project root, gitignored) |
| Template | `.env.example` |

## User preferences

- _Populate as you build_

## Gotchas

- **Supabase Migrations:** Critical Supabase migrations (e.g., `server/migrations/PENDING_RUN_IN_SUPABASE.sql`) must be run **manually** in the Supabase SQL Editor. Failing to do so will result in missing database columns and broken features.
- **Legacy Buddy System:** The legacy buddy system is fully removed from the backend, but some frontend UI elements might still reference `search_buddy_email` as read-only.
- **Deployment:** After changing **any** environment variables or code, a redeploy (publish) is mandatory for changes to take effect in production.
- **No `district` column on `listings` table:** Do not attempt to query or reference a `district` column directly on the `listings` table in Supabase. District information is handled within the matching engine logic or as part of the `extra_features` array.
- **Stripe Price IDs:** Ensure Stripe price IDs are correctly configured in environment variables (`STRIPE_PRICE_MONTHLY`, etc.). Missing IDs will cause checkout failures.

## Pointers

- **Stripe Documentation:** [https://stripe.com/docs](https://stripe.com/docs)
- **Supabase Documentation:** [https://supabase.com/docs](https://supabase.com/docs)
- **Tailwind CSS Documentation:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **React Documentation:** [https://react.dev/](https://react.dev/)
- **Vite Documentation:** [https://vitejs.dev/](https://vitejs.dev/)
- **Capacitor Documentation:** [https://capacitorjs.com/docs](https://capacitorjs.com/docs)
- **Expo Documentation:** [https://docs.expo.dev/](https://docs.expo.dev/)
- **Web Push API:** [https://developer.mozilla.org/en-US/docs/Web/API/Push_API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- **Nominatim API Policy:** [https://operations.osmfoundation.org/policies/nominatim/](https://operations.osmfoundation.org/policies/nominatim/)