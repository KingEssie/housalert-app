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
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (4 tabs: Home, Matches, Filters, Profiel). Mobile-first BlaBlaCar design. Gradient CTA cards, match cards with freshness badges, search profile management, user settings.
- `client/src/pages/new-search.tsx` — Form to create a new search profile (max 4 per user)
- `client/src/pages/notification-settings.tsx` — Notification preferences (email/SMS/WhatsApp toggles)

### API Endpoints
- `GET /api/estimate?city=&minPrice=&maxPrice=&minRooms=&minSize=` — Returns `{ perWeekEstimate, last7dCount }` based on Supabase listings
- `POST /api/checkout` — Creates Stripe checkout session (requires auth, `{ priceId }`)
- `GET /api/stripe/publishable-key` — Returns Stripe publishable key
- `GET /api/matches` — Returns user's matches with listing details (auth required)
- `GET /api/search-profiles` — Returns user's search profiles (auth required)
- `DELETE /api/search-profiles/:id` — Deletes a search profile (auth required, ownership check)
- `POST /api/search-profiles/backfill` — Triggers backfill matching for a search profile

### Stripe Config
- `server/stripe/stripeClient.ts` — Stripe client via Replit connector
- Plan IDs map to env vars: `STRIPE_PRICE_1_MONTH`, `STRIPE_PRICE_2_MONTHS`, `STRIPE_PRICE_3_MONTHS`

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

## Design System (BlaBlaCar-style)

- Primary blue: `#2D6CDF`, hover: `#2560C8`
- Heading navy: `#0B1F44`
- Page background: `#FFFFFF` (pure white)
- Input style: row-based with bottom borders `#E8EDF2` (no box inputs in onboarding)
- Secondary text / icons: `#6B7280`
- Card: `bg-white rounded-[20px] shadow-[0_10px_25px_rgba(0,0,0,0.06)] p-5`
- Row separator: `border-bottom: 1px solid #E8EDF2`
- Font: Inter
- Buttons: blue `#2D6CDF`, rounded-xl, h-[52px], inside card (not fixed footer)
- Active tab underline: blue
- Progress bars: blue fill on `#E8EDF2` track
- Header: white with thin bottom border `#E8EDF2`
- Max 4 search profiles per user
