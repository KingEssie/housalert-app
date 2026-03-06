# Stekkies — Rental Alert App

A BlaBlaCar-inspired Dutch rental alert application. Users can sign up, log in, and manage saved rental search profiles. Listings are matched against profiles and shown as matches.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — `search_profiles`, `listings`, `matches` tables
- **Backend:** Express (minimal — auth + data handled by Supabase)
- **Payments:** Stripe (sandbox, via Replit connector)

## Architecture

### Onboarding Funnel (Phase 1)
- `client/src/pages/landing.tsx` — Landing page at `/` with hero, features, how-it-works
- `client/src/pages/onboarding-location.tsx` — Step 1: City selection at `/onboarding/location`
- `client/src/pages/onboarding-filters.tsx` — Step 2: Filters at `/onboarding/filters`
- `client/src/pages/onboarding-estimate.tsx` — Step 3: Estimate display at `/onboarding/estimate`
- `client/src/pages/signup.tsx` — Account creation at `/signup` (creates search profile)
- `client/src/pages/paywall.tsx` — Subscription plans at `/paywall` (Stripe placeholder)

### Market Config
- `config/market.ts` — Centralized market configuration for Germany (DE)
  - `defaultCountry = "DE"`, `defaultCities` (30 German cities with lat/lng), `cityDistricts` (8 major cities)
  - `defaultSearchProfile` (Berlin, max €2000, 1 room, 30m²), `dateLocale = "de-DE"`
  - Used by onboarding-location, dashboard, and smoke tests

### Matching Engine
- `server/matching/engine.ts` — Central matching module with two main exports:
  - `matchListingAgainstProfiles(listingId)` — called after each new listing is inserted during ingestion
  - `backfillMatchesForSearchProfile(searchProfileId)` — called after a new search profile is created
- `server/ingesters/matching.ts` — Ingestion pipeline (dedup, insert, delegates to engine for matching)
- `server/log.ts` — Shared `log()` utility (extracted from index.ts to avoid circular deps)
- City matching uses case-insensitive substring inclusion (e.g. "Berlin" matches "Berlin-Mitte")
- Duplicate prevention: checks `unique(user_id, search_profile_id, listing_id)` before insert
- Backfill triggered via `POST /api/search-profiles/backfill` (auth required)
- Test script: `scripts/test-matching-engine.ts` — run with `npx tsx scripts/test-matching-engine.ts`

### Core Libraries
- `client/src/lib/supabase.ts` — Supabase client with session persistence enabled
- `client/src/lib/auth.tsx` — `AuthProvider` context + `useAuth()` hook
- `client/src/lib/search-profiles.ts` — CRUD functions for `search_profiles` table
- `client/src/lib/listings.ts` — Listings CRUD, matches CRUD, and client-side matching logic

### Existing Pages
- `client/src/pages/login.tsx` — Auth page with "Inloggen" / "Account aanmaken" tabs
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (4 tabs: Home, Matches, Filters, Profiel). Mobile-first BlaBlaCar design. Match cards link to `/listing/:id`. Subscription CTA for expired users in ProfielTab.
- `client/src/pages/listing-detail.tsx` — Full listing detail page at `/listing/:id`. Shows title, city/district, price, bedrooms, size, source, freshness badge, "Kopieer aanmeldingsbrief" button, and "Bekijk originele advertentie" CTA.
- `client/src/pages/new-search.tsx` — 6-step wizard to create a search profile at `/dashboard/searches/new`. Steps: property type, location (city+districts), budget, basic requirements (bedrooms/size), extra preferences, additional filters. Dynamic estimate badge. Max 4 profiles.
- `client/src/pages/notification-settings.tsx` — Notification preferences (email/SMS/WhatsApp toggles)
- `client/src/pages/application-letter.tsx` — Application letter template editor at `/application-letter`. Edit/save/reset template with Dutch placeholders ([[ADRES]], [[STAD]], [[NAAM]], etc.)
- `client/src/pages/viewing-tips.tsx` — Dedicated viewing tips page at `/tips/bezichtiging`. Five sections: Voor/Tijdens/Wat meenemen/Na de bezichtiging/Rode vlaggen. CTA to mark as completed.
- `client/src/pages/legal.tsx` — Legal pages: `/impressum`, `/datenschutz`, `/terms` (German placeholder content)
- `client/src/pages/paywall.tsx` — Subscription paywall with Stripe checkout; shows friendly message if Stripe not configured

### Profile Strength & Account Completion
- `client/src/components/profile-strength.tsx` — ProfileStrengthCard (score/100 with status label), AccountCompletionCard (expandable task list), TaskModal (flows for each task)
- `GET /api/profile-strength` — Returns score, tasks array with completion status, completedCount, totalCount
- `GET /api/profile-data` — Returns user's profile data (search_buddy_email, application_template, document_checklist)
- `PUT /api/profile-data` — Upserts profile data fields
- Table: `user_profile_data` in Supabase (user_id PK, search_buddy_email, application_template, document_checklist JSONB)
- Migration: `server/migrations/003_profile_data.sql` (must be applied manually in Supabase SQL editor)
- Account tasks: Alerts (+20), Search buddy (+10), Search optimization (+20), Application template (+15), Documents (+20), Phone (+15)
- Prep tasks: Introductiebrief (+10), Extra zoekopdracht (+15), Gebruik je netwerk (+5), Bezichtigingtips (+5)
- Max score: 135 total (both groups combined)
- Migration: `server/migrations/004_search_prep_flags.sql` adds `network_task_done` and `viewing_tips_done` columns

### Application Letter System
- `client/src/lib/application-letter.ts` — Default Dutch template, placeholder definitions, `fillTemplate()` function
- Placeholders: [[ADRES]], [[STAD]], [[NAAM]], [[EMAIL]], [[TELEFOON]], [[BEROEP]], [[INKOMEN]], [[PRIJS]]
- Fallback chain: listing.address → listing.title → "deze woning in [[STAD]]"
- Copy from listing detail: loads user template (or default), fills placeholders with listing data, copies to clipboard

### Subscriptions
- `server/subscriptions.ts` — Subscription helpers: `ensureTrialSubscription`, `getSubscriptionStatus`, `updateSubscriptionFromCheckout`, `updateSubscriptionStatus`, `findUserByStripeCustomerId`
- `client/src/lib/subscription.ts` — `useSubscription()` hook (fetches `/api/subscription/status`)
- `client/src/components/subscription-gate.tsx` — Soft paywall component (blurs content + CTA overlay)
- Table: `subscriptions` in Supabase (id, user_id, status, plan, trial_ends_at, current_period_ends_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at)
- Status values: `trial`, `active`, `canceled`, `expired`
- Plan values: `monthly`, `two_month`, `three_month`
- Trial: 7-day free trial auto-created on signup via `POST /api/subscription/ensure-trial`
- Soft paywall: matches tab blurred when expired; trial/expired banners on home tab; real status in profiel tab

### API Endpoints
- `GET /api/listings/:id` — Returns full listing detail with freshness data (public endpoint)
- `GET /api/estimate?city=&minPrice=&maxPrice=&minRooms=&minSize=` — Returns `{ perWeekEstimate, last7dCount }` based on Supabase listings
- `POST /api/checkout/session` — Creates Stripe checkout session (requires auth, `{ plan: "monthly"|"two_month"|"three_month" }`)
- `POST /api/checkout` — Legacy checkout endpoint (maps old plan IDs to new ones)
- `GET /api/stripe/publishable-key` — Returns Stripe publishable key
- `POST /api/stripe/webhook` — Stripe webhook (handles checkout.session.completed, subscription created/updated/deleted)
- `POST /api/subscription/ensure-trial` — Creates trial subscription row if none exists (auth required)
- `GET /api/subscription/status` — Returns subscription state with isActive/isTrial/isExpired booleans (auth required)
- `GET /api/matches` — Returns user's matches with listing details (auth required)
- `GET /api/search-profiles` — Returns user's search profiles (auth required)
- `DELETE /api/search-profiles/:id` — Deletes a search profile (auth required, ownership check)
- `POST /api/search-profiles/backfill` — Triggers backfill matching for a search profile

### Stripe Config
- `server/stripe/stripeClient.ts` — Stripe client with dual initialization: tries Replit connector first, falls back to `STRIPE_SECRET_KEY` env var. Throws clear error if neither available.
- Publishable key: from Replit connector or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Plan IDs map to env vars: `STRIPE_PRICE_MONTHLY` (or `STRIPE_PRICE_1_MONTH`), `STRIPE_PRICE_TWO_MONTH` (or `STRIPE_PRICE_2_MONTHS`), `STRIPE_PRICE_THREE_MONTH` (or `STRIPE_PRICE_3_MONTHS`)
- Webhook secret: `STRIPE_WEBHOOK_SECRET`
- Base URL: `APP_PUBLIC_BASE_URL` (used for checkout success/cancel URLs)
- Checkout success URL: `APP_PUBLIC_BASE_URL/dashboard?payment=success`
- Checkout cancel URL: `APP_PUBLIC_BASE_URL/paywall`
- Startup config check: logs missing env vars, checks Stripe availability. Checkout returns 503 `stripe_not_configured` if Stripe or price IDs are missing.

### Test Scripts
- `scripts/test-subscriptions.ts` — 19 tests covering trial creation, duplicate prevention, status logic, activation, and endpoint auth. Run with `npx tsx scripts/test-subscriptions.ts`
- `scripts/test-matching-engine.ts` — Matching engine tests. Run with `npx tsx scripts/test-matching-engine.ts`

## Required Secrets

- `VITE_SUPABASE_URL` — Supabase project URL (e.g. https://xxx.supabase.co)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Supabase Tables

### search_profiles

```sql
CREATE TABLE search_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  city text NOT NULL,
  price_min integer DEFAULT 0,
  price_max integer DEFAULT 0,
  bedrooms_min integer DEFAULT 0,
  size_min integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE search_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profiles" ON search_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profiles" ON search_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own profiles" ON search_profiles FOR DELETE USING (auth.uid() = user_id);
```

### listings

```sql
CREATE TABLE listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text DEFAULT 'manual',
  source_id text DEFAULT '',
  url text,
  title text NOT NULL,
  city text NOT NULL,
  price integer DEFAULT 0,
  bedrooms integer DEFAULT 0,
  size_m2 integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select listings" ON listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert listings" ON listings FOR INSERT TO authenticated WITH CHECK (true);
```

**Optional migration** (if `source_id` column was not created with the table):
```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS source_id text DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS listings_source_source_id_idx ON listings (source, source_id) WHERE source_id != '';
```

### matches

```sql
CREATE TABLE matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  search_profile_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches" ON matches FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Notifications

Multi-channel notification system in `server/notifications/index.ts`:
- **Email** — via Resend integration (`sendEmailMatchAlert`)
- **SMS** — via Twilio (`sendSmsMatchAlert`); requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`
- **WhatsApp** — via Twilio (`sendWhatsappMatchAlert`); requires `TWILIO_WHATSAPP_FROM`
- `sendMatchAlerts(userId, email, listing, supabase)` — reads `user_notification_settings` from Supabase, dispatches to enabled channels; skips all notifications on settings read failure

### Supabase table: `user_notification_settings`
```sql
-- Created via server/migrations/002_notification_settings.sql
user_id uuid PK, phone_e164 text, whatsapp_enabled bool, sms_enabled bool, email_enabled bool, created_at, updated_at
-- RLS: users can select/update/insert own row; service_role has full access
```

### API Endpoints
- `GET /api/notifications/settings` — returns user's notification prefs (auth required)
- `PUT /api/notifications/settings` — upserts notification prefs with E.164 phone validation (auth required)
- `POST /api/match-alert` — send test email alert (auth required)

## Ingestion System

Modular ingestion runner at `server/ingesters/`:
- `types.ts` — Common `Ingester` interface: `{ name, run() → {found, inserted, duplicates, matches, errors} }`
- `matching.ts` — Shared Supabase client, matching logic, and `insertAndMatchListings()` used by all ingesters
- `wg-gesucht.ts` — WG-Gesucht Berlin scraper (polite: 1 request per run, descriptive User-Agent)
- `kleinanzeigen.ts` — Kleinanzeigen Berlin rentals scraper (polite: 1 request per run)
- `immowelt.ts` — Immowelt Berlin rentals scraper (polite: single page, follows redirects)
- `html-config.ts` — Generic config-driven ingester engine: fetches a page, parses cards via CSS selectors, extracts fields via regex
- `config/sources.ts` — Array of `SourceConfig` entries; add new sources here without writing code
  - Current configs: `wohnungsboerse`, `immoscout` (bot-blocked), `rentola`, `nestpick`, `immonet` (410 gone, graceful)
  - Config fields: name, baseUrl, searchUrl, city, source, cardSelector, fields (title/url/price/size_m2/bedrooms), sourceIdRegex, botBlockPatterns, rateLimitMs
- `index.ts` — Registry combining hardcoded + config-driven ingesters; shared overlap lock, status tracking, `OverlapError`

Scheduler (`server/scheduler.ts`):
- `setInterval`-based, runs `runAllIngesters()` every `INGEST_INTERVAL_MINUTES` (default 10)
- Gated by `ENABLE_INGEST_SCHEDULER=true`; first run 5s after startup
- Overlap-safe: if a run is already in progress, the scheduled tick is skipped (via `OverlapError`)
- Exports `getNextRun()` → `{ nextRunAt, intervalMinutes }`

Endpoints:
- `GET /api/ingest/health` — Returns `{ ok: true, sourcesEnabled: [...], time: <iso> }` (no auth)
- `GET /api/ingest/status` — Returns `{ lastRunAt, lastResult, lastError, running }` (no auth)
- `GET /api/ingest/next-run` — Returns `{ nextRunAt, intervalMinutes }` (no auth)
- `POST /api/ingest/run` — Runs all ingesters; requires `Authorization: Bearer <INGEST_BEARER_TOKEN>`
  - Returns `{ sources: [{name, found, inserted, duplicates, matches, errors}], total: {...} }`
  - Returns 401 if token missing/wrong
  - Returns 409 if another run is already in progress

Env vars:
- `INGEST_BEARER_TOKEN` — bearer token for the `/api/ingest/run` endpoint
- `INGEST_INTERVAL_MINUTES` — scheduler interval in minutes (default: 10)
- `ENABLE_INGEST_SCHEDULER` — set to `true` to enable the automatic scheduler

## Freshness Tracking

> **TODO (Low priority — acceptable for MVP): Move freshness tracking to Supabase**
> Currently `first_seen_at` and `last_seen_at` are stored in Replit's local PostgreSQL,
> while listings themselves live in Supabase. Risk: local DB resets could lose freshness
> history. Future improvement: add `first_seen_at` and `last_seen_at` columns directly
> to the Supabase `listings` table and remove the local freshness database entirely.

Uses Replit's local PostgreSQL database (not Supabase) for tracking:
- `listing_freshness` table: `listing_id (PK)`, `source`, `source_id`, `first_seen_at`, `last_seen_at`
- `match_timestamps` table: `match_id (PK)`, `matched_at`
- `server/freshness.ts` — Functions: `trackListingSeen()`, `getListingFreshness()`, `trackMatchCreated()`, `getMatchTimestamps()`

Behavior:
- New listing inserted → `first_seen_at = now()`, `last_seen_at = now()`
- Duplicate listing found → only `last_seen_at = now()` updated (via `ON CONFLICT ... DO UPDATE`)
- Match created → `matched_at = now()` tracked in local DB
- `POST /api/freshness` endpoint accepts `{ listingIds, matchIds }` and returns freshness data
- `GET /api/listings/fresh` — returns newest 50 listings ordered by `first_seen_at DESC` with computed `fresh_label` (net_binnen / nieuw / vandaag / ouder)
- `GET /api/matches` — returns logged-in user's 50 newest matches (auth via Supabase JWT), ordered by `matched_at DESC`, with listing details and `fresh_label`

UI features:
- "Nieuw" green badge on match cards if `first_seen_at` (or fallback `created_at`) within last 60 minutes
- Relative time label in Dutch ("zojuist", "3 min geleden", "2 uur geleden", "1 dag geleden")

## Matching Logic (client-side in `listings.ts`)

When a listing is created via the test modal:
1. Compare against each of the user's search profiles
2. Match criteria: city (case-insensitive contains), price within range (0 = not set), bedrooms >= min, size >= min
3. Insert a match record for each matching profile (dedup by user/profile/listing)

## Routes

- `/` → redirects to `/dashboard`
- `/login` — Login/signup page (Dutch UI)
- `/dashboard` — Protected; shows search profiles + matches + test listing modal
- `/dashboard/searches/new` — Protected; create new search profile

## Test Suite

`scripts/test-all.ts` — single-command full end-to-end verification.

Run: `npx tsx scripts/test-all.ts`

Sections:
- **A. ENV CHECK** — verifies required/optional env vars
- **B. API HEALTH** — hits `/api/ingest/health`, `/status`, `/next-run`, `/listings/fresh`, `/notifications/settings`
- **C. AUTH + SETTINGS** — signs in test user, writes/reads notification settings via PUT/GET
- **D. MATCH + ALERT** — creates profile + listings, runs matching logic, verifies match/no-match, reports alert channel status
- **E. CLEANUP** — deletes all test rows

Env vars: `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_PHONE_E164`, `TEST_BASE_URL` (defaults to `http://localhost:5000`)

## Design System (BlaBlaCar-style, v2)

### Colors
- Primary blue: `#0066FF`, hover: `#0052CC`
- Primary light bg: `#EDF2FF`
- Heading navy: `#1B2A4A`
- Secondary text: `#72839A`
- Muted/helper text: `#9BA5B7`
- Page background: `#FFFFFF` (true white)
- Card surface: `#FFFFFF`
- Input/field background: `#F3F4F8` (soft cool gray, no border)
- Border: `#EAEFF5`
- Row separator: `#F0F2F5`
- Hover surface: `#F2F5F8`
- Success: `#22c55e`

### Typography (Poppins)
- Font: Poppins (weights 400–800)
- Page title: `text-[32px] font-[800] text-[#1B2A4A] tracking-[-0.03em] leading-[1.1]`
- Hero title (landing): `text-[40px] md:text-[56px] font-[800] tracking-[-0.03em] leading-[1.05]`
- Tab heading: `text-[26px] font-[700] tracking-[-0.02em] leading-[1.15]`
- Wizard step title: `text-[28px] font-[800] tracking-[-0.03em] leading-[1.1]`
- Modal title: `text-[20px] font-[700] tracking-[-0.02em]`
- Section heading: `text-[18px] font-[700] tracking-[-0.01em]`
- Section label (form): `text-[16px] font-[700] text-[#1B2A4A] mb-3` — used for field groups like "Stad", "Minimale huur", "Slaapkamers"
- Card title: `text-[16px] font-semibold text-[#1B2A4A]`
- Body: `text-[15px] text-[#72839A]`
- Small/helper: `text-[13px] text-[#9BA5B7]`
- Form field label (login/signup): `text-[14px] font-semibold text-[#1B2A4A]` — used for traditional form labels

### Surfaces
- Card shadow: `shadow-[0_2px_12px_rgba(0,0,0,0.04)]`
- Elevated shadow: `shadow-[0_4px_20px_rgba(0,0,0,0.06)]`
- Cards: `rounded-2xl`
- Buttons: `rounded-xl`
- Inputs: `rounded-xl`, `h-[52px]`, borderless `bg-[#F3F4F8]`, `font-medium`, focus ring `ring-[#0066FF]/15` + `bg-[#FAFBFC]`, placeholder `text-[#7A8599] font-normal`, icon color `text-[#7A8599]`
- Modals: `rounded-t-[24px] sm:rounded-[24px]`

### Buttons
- Primary CTA: `h-[56px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-[16px] font-semibold`
- Secondary: `h-[48px] rounded-xl border-[#EAEFF5] text-[#1B2A4A]`

### Layout
- Font: Poppins
- Header: `h-[60px]`, subtle border `#EAEFF5`
- Page padding: `px-6`
- Card padding: `p-6`
- Bottom nav: active `#0066FF`, inactive `#9BA5B7`, icons `w-[22px] h-[22px]`, `py-3`
- Max 4 search profiles per user
