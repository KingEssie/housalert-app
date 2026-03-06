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

### Typography System
- CSS utility classes defined in `client/src/index.css` under `@layer utilities`:
  - `.text-page-title` — 26px, weight 700, #0F172A (for page headings)
  - `.text-section-title` — 20px, weight 700, #0F172A (for section headings)
  - `.text-row-section-title` — 20px, weight 700, #0F172A (for list section headings)
  - `.text-row-title` — 16px, weight 600, #0F172A (for list row primary text)
  - `.text-row-subtitle` — 15px, weight 500, #6B7280 (for list row secondary text)
  - `.text-subtitle` — 15px, weight 500, #6B7280 (for subtitles)
  - `.text-muted-body` — 14px, weight 500, #6B7280 (for secondary/muted text)
- Color tokens: primary text #0F172A (navy), secondary text #6B7280, divider #E5E7EB
- Old muted colors #9BA5B7 and #72839A have been globally replaced with #6B7280
- Old navy #1B2A4A replaced with #0F172A across main tab components (Home, Matches, Boost, Filters, Profile)

### Shared List Components
- `client/src/components/list-section.tsx` — Reusable menu/settings row components:
  - `ListSection` — wrapper with optional title (uses `.text-row-section-title`)
  - `ListRow` — full-width row with icon slot, title/subtitle, trailing/chevron, disabled prop
  - `ListDivider` — 1px #E5E7EB separator
  - `ListSectionTitle` — standalone section title
- Used by: Profile tab (settings, account), Home tab (status), notification-settings page (channels, phone)

### Market Config
- `config/market.ts` — Centralized market configuration for Germany (DE)
  - `defaultCountry = "DE"`, `defaultCities` (30 German cities with lat/lng), `cityDistricts` (8 major cities)
  - `defaultSearchProfile` (Berlin, max €2000, 1 room, 30m²), `dateLocale = "de-DE"`
  - Used by onboarding-location, dashboard, and smoke tests

### Matching Engine
- `server/matching/engine.ts` — Central matching module with two main exports:
  - `matchListingAgainstProfiles(listingId)` — called after each new listing is inserted during ingestion
  - `backfillMatchesForSearchProfile(searchProfileId)` — called after a new search profile is created
- `shared/match-score.ts` — also exports `getMatchReasons(details)` which returns top 2-3 Dutch match reason labels (locatie, prijs, kamers, grootte) for sub-scores >= 70% of their max. Used by both `/api/matches` and `/api/listings/:id` endpoints.
- `server/ingesters/matching.ts` — Ingestion pipeline (dedup, insert, delegates to engine for matching)
- `server/log.ts` — Shared `log()` utility (extracted from index.ts to avoid circular deps)
- `shared/match-score.ts` — Deterministic match scoring (0–100) based on city fit (30pts), price fit (30pts), bedrooms fit (20pts), size fit (20pts). Labels: Perfecte match (90+), Sterke match (75–89), Goede match (60–74), Mogelijke match (40–59). Used by `/api/matches` and `/api/listings/:id`.
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
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (5 tabs: Home, Matches, Boost, Filters, Profiel). Mobile-first BlaBlaCar design. Match cards with image placeholders (city-based gradients), save/bookmark toggle, "Reageer" opens ApplySheet (bottom sheet with letter preview, copy, view listing, mark applied). Matches page has sub-tabs: Nieuw, Bekeken, Opgeslagen, Gereageerd — status tracked in localStorage (keys: `stekkies_match_viewed`, `stekkies_match_saved`, `stekkies_match_applied`). HomeTab includes SpeedBanner (readiness indicator). ProfielTab includes NotificationSummaryCard (channel status + recommended fastest channel) and SpeedReadinessCard (4-step checklist). Subscription CTA for expired users.
- `client/src/components/apply-sheet.tsx` — Reusable bottom sheet for instant apply flow: shows pre-filled application letter, copy, view listing, mark as applied. Used by MatchCard and ListingDetailPage.
- `client/src/pages/listing-detail.tsx` — Full listing detail page at `/listing/:id`. Shows title, city/district, price, bedrooms, size, source, freshness badge, "Kopieer aanmeldingsbrief" button, and "Bekijk originele advertentie" CTA.
- `client/src/pages/new-search.tsx` — 6-step wizard to create a search profile at `/dashboard/searches/new`. Steps: property type, location (city+districts), budget, basic requirements (bedrooms/size), extra preferences, additional filters. Dynamic estimate badge. Max 4 profiles.
- `client/src/pages/notification-settings.tsx` — Notification preferences (email/SMS/WhatsApp toggles)
- `client/src/pages/application-letter.tsx` — Application letter template editor at `/application-letter`. Edit/save/reset template with Dutch placeholders ([[ADRES]], [[STAD]], [[NAAM]], etc.)
- `client/src/pages/viewing-tips.tsx` — Dedicated viewing tips page at `/tips/bezichtiging`. Five sections: Voor/Tijdens/Wat meenemen/Na de bezichtiging/Rode vlaggen. CTA to mark as completed.
- `client/src/pages/legal.tsx` — Legal pages: `/impressum`, `/datenschutz`, `/terms` (German placeholder content)
- `client/src/pages/paywall.tsx` — Subscription paywall with Stripe checkout; shows friendly message if Stripe not configured

### Profile Page (ProfielTab)
- Layout: BlaBlaCar-style list-based settings layout (not card-wrapped)
- Helper components (in dashboard.tsx): `ProfileListItem` (title + optional subtitle + chevron/trailing), `ProfileDivider` (#F1F1F1 1px), `ProfileSectionTitle` (20px/600)
- Typography: titles 16px/500 #111, subtitles 14px/500 #6B7280, section titles 20px/600 #111
- Sections: user avatar header, ReactiesnelheidCard (card), ReactieklaarCard (card), "Instellingen" list (notifications + subscription), "Account" list (logout)
- NotificationSummaryCard removed from ProfielTab (was redundant with notification settings row)

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

### Boost Tab
- `shared/boost-config.ts` — Structured task config: `BOOST_TASKS` array with id, weight, label, description; `BOOST_MAX_SCORE` constant (100)
- `server/boost.ts` — Score calculation utility: `resolveCompletionStates()` derives task status from Supabase data, `calculateBoostScore()` computes weighted score
- `client/src/pages/boost.tsx` — Dedicated Boost page: BoostScoreCard, RecommendedSection, ReadinessSection, AllTasksSection, EmptyState, HighProgressState, TaskModal
- `GET /api/boost` — Returns `boostScore` (0-100), `tasks` array, `recommendations` (top 3 incomplete sorted by weight), `speedSteps`, `speedDone`, `speedTotal`
- Bottom nav tab: 5th tab (between Matches and Filters) with Zap icon, label "Boost"
- TabKey type: `"home" | "matches" | "filters" | "boost" | "profiel"`
- Score weights (total = 100): income_documents_uploaded 20, alerts_active 15, id_document_uploaded 15, reaction_letter_ready 15, phone_number_added 10, housing_preferences_completed 10, search_buddy_added 5, profile_info_completed 5, profile_photo_added 5
- Completion derivation: income docs from document_checklist (income_proof, payslips, employment_contract, etc. >= 2), ID docs from document_checklist (id_copy, photo >= 1), alerts from notification_settings, letter from application_template, phone from phone_e164, preferences from search_profiles, search_buddy from search_buddy_email, profile_info from email+phone, profile_photo from profile_photo_url
- Task actions: alerts_active/phone_number_added/profile_info_completed → /settings/notifications, housing_preferences_completed → /dashboard/searches/new, reaction_letter_ready → /application-letter, income_documents_uploaded/id_document_uploaded → inline document checklist modals, search_buddy_added → inline email modal, profile_photo_added → placeholder (TODO: implement upload)
- Migration: `server/migrations/006_profile_photo.sql` adds `profile_photo_url` column to `user_profile_data`

### Recommendation System ("Aanbevolen voor jou")
- `shared/boost-recommendations.ts` — Per-task metadata: subtitle (supportive microcopy), ctaLabel, route, modal flag
- Backend logic: `server/boost.ts` `calculateBoostScore()` selects top 3 incomplete tasks sorted by weight desc
- Frontend: `RecommendedSection` in `boost.tsx` renders cards with icon, title, points badge, supportive subtitle, and explicit CTA button
- Navigation: tasks with `modal: false` + route navigate directly (alerts, phone, letter, preferences, profile info); tasks with `modal: true` open inline TaskModal (documents, search buddy, profile photo)

### Populair Vandaag
- `client/src/components/populair-vandaag.tsx` — Horizontal scrolling section showing trending listings
- Backend: `GET /api/listings/popular` in `server/routes.ts` — ranks listings by match count (cross-user) within last 7 days, fallback to newest 6 if no match data
- Response shape: `PopularListing` (listing_id, title, price, size_m2, bedrooms, city, source, url, image_url, first_seen_at, fresh_label, match_count)
- Frontend: `PopulairVandaagSection` renders horizontally scrollable card carousel (220px wide cards, snap-x)
- Placement: HomeTab, between BoostTeaserCard and SpeedBanner
- Returns null if no listings available; skeleton loading state with 3 placeholder cards
- TODO: Improve ranking with real engagement data (clicks, views, apply actions) instead of match count

### Reactiesnelheid Card
- `client/src/components/reactiesnelheid-card.tsx` — Motivational speed indicator card
- Logic: `calculateReactiesnelheid(done, total)` returns SpeedLevel (`fast`/`almost`/`building`), label, subtitle, fraction
- Thresholds: 100% = "Snelle reageerder" (green), >=60% = "Bijna klaar" (blue), <60% = "Goed bezig" (gray)
- Data: reuses `/api/boost` speedSteps (same query key as ReactieklaarCard — deduplicated by TanStack Query)
- Props: `onTap` (optional click handler), `done`/`total` (optional overrides; if omitted, fetches from API)
- Used on: Profile tab (dashboard.tsx ProfielTab)
- Future upgrade: replace readiness-based fraction with real response-time metrics (e.g., median time from match notification to first apply action)

### Reactieklaar Card
- `client/src/components/reactieklaar-card.tsx` — Reusable readiness status card showing 5 checklist items
- Items: Alerts actief, Zoekbuddy toegevoegd, Documenten klaar, Telefoonnummer toegevoegd, Reactiebrief klaar
- Data source: `/api/boost` speedSteps (derived from existing Supabase tables)
- Props: `navigate` (required), `steps`/`done`/`total` (optional overrides; if omitted, fetches from API)
- Used on: Profile tab (dashboard.tsx ProfielTab), Boost tab (boost.tsx)
- Replaces: old `SpeedReadinessCard` from profile-strength.tsx (still exported but unused)
- Clickable incomplete items navigate to relevant settings pages

### Application Letter System & Quick-Apply ("Reageer nu")
- `client/src/lib/application-letter.ts` — Default Dutch template, placeholder definitions, `fillTemplate()` function
- Placeholders: [[ADRES]], [[STAD]], [[NAAM]], [[EMAIL]], [[TELEFOON]], [[BEROEP]], [[INKOMEN]], [[PRIJS]]
- Fallback chain: listing.address → listing.title → "deze woning in [[STAD]]"
- `client/src/components/apply-sheet.tsx` — Quick-apply bottom sheet with:
  - Prefilled letter preview using listing data + user profile
  - Readiness indicators (reactiebrief, telefoonnummer, documenten) from profile-data + notification-settings
  - Primary CTA: "Kopieer en reageer" (copies letter + opens listing URL in one tap)
  - Secondary: "Alleen kopiëren" and "Markeer gereageerd"
  - "Klaar om te versturen" badge when all readiness items are done
- `client/src/pages/listing-detail.tsx` — "Reageer nu" is the primary blue CTA; "Bekijk" is secondary outline button
- Listing detail page delegates all apply logic to ApplySheet (no local letter generation)

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
