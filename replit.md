# HousAlert — Rental Alert App

A BlaBlaCar-inspired Dutch-language rental alert application for the German market. Users can sign up, log in, and manage saved rental search profiles. Listings are matched against profiles and shown as matches. Rebranded from "Stekkies" to "HousAlert".

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — most tables: `search_profiles`, `listings`, `matches`, `subscriptions`, `user_notification_settings`. Replit PostgreSQL (via `pg` pool) — `user_profile_data`, `listing_freshness`, `match_timestamps`, `onboarding_drafts`
- **Backend:** Express (minimal — auth + data handled by Supabase)
- **Payments:** Stripe (sandbox, via Replit connector)

## Architecture

### Onboarding Flow (Unified)
- **Single onboarding path**: Search profiles are ONLY created in the post-auth onboarding wizard (`/onboarding`). The pre-auth funnel pages (landing → location → filters → estimate → signup) are a marketing funnel only — they do NOT create search profiles.
- `client/src/pages/landing.tsx` — Landing page at `/` with hero, features, how-it-works
- `client/src/pages/onboarding-location.tsx` — Pre-auth funnel Step 1: City selection at `/onboarding/location`
- `client/src/pages/onboarding-filters.tsx` — Pre-auth funnel Step 2: Filters at `/onboarding/filters`
- `client/src/pages/onboarding-estimate.tsx` — Pre-auth funnel Step 3: Estimate display at `/onboarding/estimate`
- `client/src/pages/signup.tsx` — Account creation at `/signup` (creates account + trial only, NO search profile)
- `client/src/pages/onboarding.tsx` — Post-auth onboarding wizard at `/onboarding`. 4-step wizard: Welcome → City (LocationModeSelector) → Budget → Property type → Alerts. Creates full search profile via `createSearchProfile()` with all location data (city, districts, radius, commute). This is the ONLY place search profiles are created for new users.
- `client/src/pages/paywall.tsx` — Subscription plans at `/paywall` (Stripe checkout)
- **Flow**: Signup → `/onboarding` → (wizard creates profile) → `/dashboard`. Login → `/dashboard` → ProtectedRoute checks profiles → redirects to `/onboarding` if 0 profiles.

### City Picker & Location Mode Selector
- `client/src/components/city-picker.tsx` — Reusable city autocomplete with Nominatim geocoding + Leaflet map preview (standalone)
- `client/src/components/location-mode-selector.tsx` — 3-tab location selection (Wijken/Radius/Reistijd)
  - **Wijken tab**: city search + multi-select dropdown for districts from `config/market.ts` (8 cities have districts); selected districts shown as removable chips below dropdown; shows "binnenkort beschikbaar" for cities without district data
  - **Radius tab**: city search + radius km selector (2/5/10/15/25/50 km) + Leaflet Circle overlay on map
  - **Reistijd tab**: Nominatim destination search + transport mode (auto/OV/fiets) + max travel time (15/30/45/60/90 min) + destination pin on map
  - Returns `LocationData` object; validated via `isLocationValid()`
  - Accepts `mapMaxHeight` prop (e.g. `"40vh"`) for mobile viewport constraint
  - Used in: `onboarding.tsx` (LocationStep), `new-search.tsx` (step 1)
  - Dependencies: `leaflet`, `react-leaflet@4`, `@types/leaflet`
- **Location mode columns (migration 012)**: `location_mode`, `districts`, `radius_km`, `commute_destination`, `commute_lat`, `commute_lng`, `commute_mode`, `commute_minutes`

### Embeddable Onboarding Widget
- `client/src/pages/onboarding-embed.tsx` — Compact single-page search widget at `/onboarding-embed`
  - No country step — country inferred from selected place (defaults to DE)
  - Location-first: LocationModeSelector (Wijken/Radius/Reistijd) with live map
  - Inline property type chips (Alles/Appartement/Studio/Kamer/Gedeeld)
  - Inline budget fields (min/max side by side)
  - EstimateBlock: fetches `/api/estimate` and shows "~X matches per week"
  - Helper strip: "Voeg tot 4 zoekopdrachten toe."
  - CTA: "Plaats zoekopdracht"
  - On submit: saves draft to `onboarding_drafts` table (Supabase), returns `draft_id`
  - Completion screen with "Ga verder in browser" and "Download de app"
- `client/src/pages/continue-draft.tsx` — Draft handoff at `/continue?draft=<id>`
  - Loads draft from backend, redirects to signup if not authed, creates search profile if authed
- **Backend**: `POST /api/onboarding-drafts` (create), `GET /api/onboarding-drafts/:id` (read)
- **Iframe**: `Content-Security-Policy: frame-ancestors *` set for `/onboarding-embed` route
- **Embed HTML**: `<iframe src="https://YOUR_DOMAIN/onboarding-embed" width="100%" height="700" frameborder="0"></iframe>`
- **Table**: `onboarding_drafts` in Replit DB (not Supabase) — draft data stored locally
- **CRITICAL PENDING MIGRATION**: `server/migrations/PENDING_RUN_IN_SUPABASE.sql` must be run in Supabase SQL Editor (includes migrations 008, 010, 011, 012, 013, 014, 015, 016, 017). The `search_profiles` table currently only has 8 core columns (id, user_id, city, price_min, price_max, bedrooms_min, size_min, created_at). Without running these migrations, advanced features (location mode, districts, radius, commute, furnished, extra features, target categories) cannot be persisted — the backend will fall back to core-only updates. Run the full migration file in Supabase SQL Editor to enable all features.

### Design System (YoungOnes-inspired)
- **Primary CTA**: Teal `var(--yo-teal)` #2DD4BF, hover `var(--yo-teal-hover)` #25BBA8 — CTA buttons ONLY (BLACK text, not white), active nav indicator, selection controls
- **Accent/Links**: Pink `var(--yo-pink)` #FF2E8A — all text links, action text, source labels, progress bars
- **Badges/Chips**: Neutral `var(--yo-chip-bg)` #F3F4F6 with `var(--yo-dark)` text — all badges, status pills, count indicators
- **Icon backgrounds**: `var(--yo-chip-bg)` #F3F4F6 with `var(--yo-dark)` icons (NOT teal)
- **Logo icon**: `var(--yo-dark)` #1A1A1A background with white icon
- **City gradients**: Dark `from-[#1A1A1A] to-[#333333]` — no teal gradients
- **Text**: primary #1A1A1A (--yo-dark), body #333333 (--yo-text), muted #9CA3AF (--yo-muted, disabled only)
- **Backgrounds**: white #FFFFFF (--yo-bg), surface #F8F9FA (--yo-surface)
- **Borders/dividers**: #EEEEEE (--yo-divider)
- **Buttons**: bg var(--yo-teal), BLACK text, rounded-lg (8px), h-[56px], font-bold
- **Inputs**: bg var(--yo-surface), border var(--yo-divider), rounded-lg (8px)
- **Cards**: white bg, very subtle shadow, rounded-lg (8px)
- **Border radius**: Standardized to `rounded-lg` (8px) everywhere
- **Page titles**: UPPERCASE, font-weight 800, letter-spacing 0.02em
- **Bottom nav**: Flat white bar (not floating pill), teal top-line active indicator
- **Bottom sheets**: Rounded top 24px, dimmed backdrop, uppercase bold title
- **CSS variables**: All colors defined as `--yo-*` in `client/src/index.css` (:root)
  - `--yo-teal`, `--yo-teal-hover`, `--yo-teal-light`, `--yo-teal-dark`
  - `--yo-pink` (#FF2E8A), `--yo-pink-light`
  - `--yo-dark`, `--yo-text`, `--yo-muted`
  - `--yo-bg`, `--yo-surface`, `--yo-divider`, `--yo-border`
  - `--yo-chip-bg` (#F3F4F6), `--yo-chip-text` (#1A1A1A)
  - `--yo-input-border`, `--yo-tag-dark`, `--yo-success`
- **NEVER use**: old purple (#673DE5, #5B30D6, #DCDBFA), old lime (#CBFF02, #8BEA63), hardcoded teal hex (use CSS vars), teal for text links (use pink)

### Typography System
- CSS utility classes defined in `client/src/index.css` under `@layer utilities`:
  - `.text-page-title` — 22px, weight 800, uppercase, letter-spacing 0.02em, color var(--yo-dark) (for page headings)
  - `.text-section-title` — 18px, weight 700, color var(--yo-dark) (for section headings)
  - `.text-row-section-title` — 18px, weight 700, color var(--yo-dark)
  - `.text-row-title` — 16px, weight 600, color var(--yo-dark)
  - `.text-row-subtitle` — 15px, weight 500, color var(--yo-muted)
  - `.text-subtitle` — 15px, weight 500, color var(--yo-muted)
  - `.text-muted-body` — 14px, weight 500, color var(--yo-muted)
- Color tokens: primary text var(--yo-dark), secondary text var(--yo-muted), divider var(--yo-divider)

### Reusable PageHeader
- `client/src/components/ui/page-header.tsx` — Floating back button (fixed top-left, 44px circle, white + shadow-md) + large uppercase title in content flow
- Props: `title` (string), `onBack?` (callback, defaults to history.back()), `trailing?` (ReactNode), `closeButton?` (X icon instead of arrow)
- Style: fixed position back button respects safe-area-inset-top; title rendered in max-w-xl centered content container with top padding to clear the floating button
- Used on ALL subpages: subscription-detail, payment-method, cancel flow, notification-settings, application-letter, viewing-tips, profile-details, profile-edit, delete-account, guide pages, change-password
- `listing-detail.tsx` uses its own `FloatingBackButton` component (same 44px style, but with backdrop-blur for hero image overlay)
- NOT used on main navigation screens: dashboard (Home/Matches/Boost/Filters/Profile), or wizard flows (new-search)

### Notifications
- **Channels**: Email only (via Resend). Push planned but not yet implemented (toggle shown as disabled with "Binnenkort beschikbaar")
- **Removed channels**: SMS and WhatsApp fully disabled — Twilio sending code removed, UI toggles removed, DB columns still exist but always set to `false`
- **Sending logic**: `server/notifications/index.ts` — only sends email via `sendEmailMatchAlert`
- **Settings UI**: `client/src/pages/notification-settings.tsx` — email toggle + disabled push toggle
- **Settings API**: `GET/PUT /api/notifications/settings` — only accepts `email_enabled`, forces `sms_enabled=false`, `whatsapp_enabled=false`

### Ingestion Pipeline
- **Scheduler**: `server/scheduler.ts` — runs every 10 min when `ENABLE_INGEST_SCHEDULER=true`
- **Orchestrator**: `server/ingesters/index.ts` — gets active cities, runs all source ingesters per city
- **Sources** (8 total, 6 active): wg-gesucht ✅, kleinanzeigen ✅, immowelt ✅, wohnungsboerse ✅, rentola ✅, nestpick ✅, immoscout ❌ (401 bot-blocked), immonet ❌ (410 gone)
- **Image sources**: wg-gesucht, kleinanzeigen, immowelt, wohnungsboerse extract images; rentola/nestpick/immoscout/immonet do not
- **Matching**: `server/ingesters/matching.ts` — dedup by source+source_id then URL, insert into Supabase `listings`, trigger match engine
- **City matching fields**: listings.city matched against search_profiles.city using `.ilike()` query; `doesListingMatchProfile()` uses `profile.city_name || profile.city` for comparison; city normalization is toLowerCase().trim() with substring matching
- **Freshness**: `server/freshness.ts` — tracks listing_freshness and match_timestamps in Supabase (gracefully disabled if tables missing)
- **City coverage**: Germany-wide — 20 base cities in `GERMAN_CITIES` array (Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Dresden, Hannover, Nürnberg, Bremen, Bochum, Bonn, Mannheim, Karlsruhe, Wiesbaden, Münster, Augsburg, Freiburg) merged with cities from active search profiles. 2s inter-city delay for rate protection. Per-city logging (found/inserted/dup/err per city). Overlap protection via `_running` flag
- **Debug endpoint**: `GET /api/ingest/debug` — returns test mode status, scheduler info, last run details, today's stats, DB counts, source categorization (active/broken/gone with notes), last source errors
- **Pending migration**: `server/migrations/PENDING_RUN_IN_SUPABASE.sql` — must be run in Supabase SQL Editor. Adds: listing_freshness table, match_timestamps table, search_profiles.city_name + geo columns, onboarding_drafts table, match dedup index, profile limit trigger, filter columns

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
  - **Furnished filter** (phase 1 advanced filter): decoupled from other advanced columns — works independently once `furnished` column exists on `listings` table. Handles "furnished" (listing.furnished must be true), "unfurnished" (must be false), "any"/"no_preference"/empty/null (skipped). Strict: null/unknown = rejected.
  - **Districts filter** (phase 2 advanced filter): decoupled from other advanced columns — works independently once `district` column exists on `listings` table. Bi-directional case-insensitive substring matching. Strict: null/empty district = rejected when filter is active. Only applied when `location_mode === "districts"` or not set (backward compat). Extracted from wg-gesucht (title), immowelt (address), kleinanzeigen (location element + title). Config-based ingesters (wohnungsboerse, rentola, nestpick) do not extract district.
  - **Pets_allowed filter** (phase 3 advanced filter): Dutch→English mapping in engine (`huisdieren` → `pets_allowed`, `balkon` → `balcony`). All 3 custom ingesters detect `NO_PETS_PATTERNS` first (→ false), then `PETS_PATTERNS` (→ true), else null. Strict: null/unknown = rejected when filter active. Config-based ingesters always return null for pets_allowed.
- `shared/match-score.ts` — also exports `getMatchReasons(details)` which returns top 2-3 Dutch match reason labels (locatie, prijs, kamers, grootte) for sub-scores >= 70% of their max. Used by both `/api/matches` and `/api/listings/:id` endpoints.
- `server/ingesters/matching.ts` — Ingestion pipeline (dedup, insert, delegates to engine for matching). `furnished` and `district` columns checked independently from other advanced columns (`checkFurnishedColumn()`, `checkDistrictColumn()`)
- `server/log.ts` — Shared `log()` utility (extracted from index.ts to avoid circular deps)
- `shared/match-score.ts` — Deterministic match scoring (0–100) based on city fit (30pts), price fit (30pts), bedrooms fit (20pts), size fit (20pts). Labels: Perfecte match (90+), Sterke match (75–89), Goede match (60–74), Mogelijke match (40–59). Used by `/api/matches` and `/api/listings/:id`.
- City matching uses case-insensitive substring inclusion (e.g. "Berlin" matches "Berlin-Mitte")
- City pre-filter: matching engine pre-filters search profiles by city (ilike) before running full match logic; falls back to full scan if filter fails or city is too short (<3 chars)
- Duplicate prevention: checks `unique(user_id, search_profile_id, listing_id)` before insert
- Phone sync: `PUT /api/profile-data` with `phone` field also syncs to `user_notification_settings.phone_e164` (E.164 validated)
- Notification delivery: per-channel failure logging in `sendMatchAlerts` (logs false returns and rejections)
- Backfill triggered via `POST /api/search-profiles/backfill` (auth required)
- Test script: `scripts/test-matching-engine.ts` — run with `npx tsx scripts/test-matching-engine.ts`

### Auth & Trial Subscription Flow
- **Trial creation**: `ensureTrialForCurrentUser()` in `client/src/lib/auth.tsx` — shared idempotent helper called from signup, login, and auth-callback. Calls `POST /api/subscription/ensure-trial` which checks for existing subscription before creating a 14-day trial. Returns 500 if creation fails (not silent 200).
- **Signup** (`signup.tsx`): After `signUp()`, checks for active session. Case A (session exists, email confirmation disabled): calls `ensureTrialForCurrentUser()` → redirects to `/onboarding`. Case B (no session, email confirmation enabled): shows "Bevestig je e-mailadres" confirmation UI with email address and link to login.
- **Login** (`login.tsx`): After `signInWithPassword()`, calls `ensureTrialForCurrentUser()` (catches users who signed up with email confirmation but never got a trial) → redirects to `/dashboard`.
- **Auth callback** (`auth-callback.tsx`): After `exchangeCodeForSession()`, calls `ensureTrialForCurrentUser()` (catches email-confirmed users) → redirects to `/dashboard`.
- **ProtectedRoute** (`App.tsx`): Checks search profiles → redirects to `/onboarding` if 0 profiles. This ensures users always go through the onboarding wizard regardless of entry point.

### Admin Ingestion Dashboard
- **Route**: `/admin/ingestion` — admin-only monitoring page for the ingestion pipeline
- **Access control**: `ADMIN_EMAILS` env var (comma-separated, case-insensitive). Server middleware validates Supabase JWT + email against allowlist. Returns 403 for non-admins.
- **Backend**: `server/admin.ts` — `isAdminEmail()`, `persistIngestionRun()`, `getRecentRuns()`, `getRunDetail()`, `getLatestRunCities()`, `getSourceAggregates()`
- **API endpoints** (all require admin auth):
  - `GET /api/admin/ingestion/summary` — running status, last run time, today's stats, recent runs
  - `GET /api/admin/ingestion/cities` — per-city breakdown from latest run
  - `GET /api/admin/ingestion/sources` — per-source aggregates + platform statuses
  - `GET /api/admin/ingestion/run/:id` — detailed single run data
- **Frontend**: `client/src/pages/admin-ingestion.tsx` — stat cards, latest run summary, per-city table, per-source table, run history, auto-refresh every 30s
- **Storage**: `ingestion_runs` table in Replit PostgreSQL (id, started_at, finished_at, duration_sec, cities_count, totals, city_reports JSONB, source_reports JSONB, status)

### Core Libraries
- `client/src/lib/supabase.ts` — Supabase client with session persistence enabled
- `client/src/lib/auth.tsx` — `AuthProvider` context + `useAuth()` hook + `ensureTrialForCurrentUser()` helper
- `client/src/lib/search-profiles.ts` — CRUD functions for `search_profiles` table
- `client/src/lib/listings.ts` — Listings CRUD, matches CRUD, and client-side matching logic

### Existing Pages
- `client/src/pages/onboarding.tsx` — New user onboarding flow at `/onboarding`. 4-step wizard: Welcome screen → City selection (autocomplete) → Budget (min/max price) → Property type → Alerts activation. Creates search profile, enables email notifications, triggers backfill, redirects to dashboard. ProtectedRoute automatically redirects users with no search profiles to onboarding. Property type is collected but not yet persisted (matching engine doesn't support it yet — same as new-search.tsx).
- `client/src/pages/login.tsx` — Clean login page (login-only, no tabs). "Wachtwoord vergeten?" link triggers Supabase password reset. "Account aanmaken" button navigates to /signup.
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (5 tabs: Home, Matches, Tips, Filters, Profiel). Mobile-first BlaBlaCar design. Match cards with image placeholders (city-based gradients), save/bookmark toggle, "Reageer" opens ApplySheet (bottom sheet with letter preview, copy, view listing, mark applied). Matches page has sub-tabs: Nieuw, Bekeken, Opgeslagen, Gereageerd — status tracked in localStorage (keys: `housalert_match_viewed`, `housalert_match_saved`, `housalert_match_applied`). HomeTab includes AccountCompletionCard + SearchPreparationCard (circular progress indicators) and RecenteMatchesSection (5 newest matches). ProfielTab includes NotificationSummaryCard (channel status + recommended fastest channel) and SpeedReadinessCard (4-step checklist). Subscription CTA for expired users.
- `client/src/components/apply-sheet.tsx` — Reusable bottom sheet for instant apply flow: shows pre-filled application letter, copy, view listing, mark as applied. Used by MatchCard and ListingDetailPage.
- `client/src/pages/listing-detail.tsx` — Full listing detail page at `/listing/:id`. Hero image (260px), match score badge, title, price, location, details grid (bedrooms/size/source/time), "Waarom deze match?" section with green checkmark reasons. CTA: "Reageer direct" (opens ApplySheet) + "Open originele advertentie" (external link). External site ONLY opens from this detail page.
- `client/src/pages/new-search.tsx` — 5-step wizard for search profiles at `/dashboard/searches/new` (create) or `/dashboard/searches/edit/:id` (edit). Floating back button top-left, step indicator top-right, floating round green FAB bottom-right for navigation (no bottom "Vorige" bar). Steps: 1) Locatie (LocationModeSelector), 2) Vereisten (rent/bedrooms/size/furnished dropdowns), 3) Extra eigenschappen (BlaBlaCar checkbox list), 4) Doelgroepen & categorieën (Stekkies-style target groups), 5) Review screen "Controleer je zoekopdracht" with edit buttons per section. Edit mode loads existing profile data via `getSearchProfile()` and updates via `updateSearchProfile()`. Max 4 profiles.
- `client/src/pages/delete-account.tsx` — Full-screen account deletion at `/account/delete`. Calls `DELETE /api/account` which deletes all user data (matches, search profiles, subscriptions, notification settings, profile data) and Supabase auth user. Blocks deletion if user has active paid subscription (shows warning with link to subscription settings).
- `client/src/pages/notification-settings.tsx` — Notification preferences (email/SMS/WhatsApp toggles)
- `client/src/pages/application-letter.tsx` — Application letter template editor at `/application-letter`. Edit/save/reset template with Dutch placeholders ([[ADRES]], [[STAD]], [[NAAM]], etc.)
- `client/src/pages/viewing-tips.tsx` — Dedicated viewing tips page at `/tips/bezichtiging`. Five sections: Voor/Tijdens/Wat meenemen/Na de bezichtiging/Rode vlaggen. CTA to mark as completed.
- `client/src/pages/legal.tsx` — Legal pages: `/impressum`, `/datenschutz`, `/terms` (German placeholder content)
- `client/src/pages/paywall.tsx` — Subscription paywall with Stripe checkout. Dynamic price validation at startup (validates env var price IDs, falls back to Stripe API lookup by nickname/interval). No static fallback messages — errors shown as toasts.
- `client/src/pages/subscription-success.tsx` — Stripe payment success page at `/subscription-success?session_id=...`. Calls `POST /api/checkout/verify` to sync subscription from Stripe checkout session, then polls `/api/subscription/status` for up to ~16s until active. Shows spinner during sync, then success message. Auto-redirects to dashboard after activation. Invalidates subscription/stats/matches caches.
- `client/src/pages/subscription-detail.tsx` — Subscription detail page at `/account/subscription`. Shows plan type, status (green badge), price, start/renewal dates, billing frequency, auto-renew, payment method (mock). Actions: wijzigen → /paywall, betaalmethode → /account/payment-method, opzeggen → /account/subscription/cancel.
- `client/src/pages/payment-method.tsx` — Payment method management at `/account/payment-method`. Shows current card (mock Visa ****4242), add/remove actions.
- `client/src/pages/subscription-cancel.tsx` — Two-step cancel flow: `/account/subscription/cancel` (confirm with renewal date) and `/account/subscription/cancelled` (confirmation). Exports `SubscriptionCancelConfirmPage` and `SubscriptionCancelledPage`.
- `client/src/pages/change-password.tsx` — In-app password change at `/account/change-password`. Three fields: current password, new password (min 8 chars), confirm. Verifies current via `signInWithPassword`, updates via `updateUser`. No email sent. Success screen with green checkmark.

### Profile Page (ProfielTab)
- Layout: BlaBlaCar-style two-tab profile layout ("Over jou" / "Account") on #F7F7F7 background
- Sticky tab bar at top with animated sliding blue indicator (3px height, translateX transition)
- "Over jou" tab: profile header card (avatar/photo + display name + "Woningzoeker" role + chevron → /profile/details), stats card (matches + reactions with blue icon circles), action links card (Persoonlijke gegevens bewerken, Profielfoto bewerken), verified profile card (email + phone with blue checks), reactiebrief card
- "Account" tab sections: Instellingen (Meldingsinstellingen, Zoekvoorkeuren, Adresinstellingen, Opgeslagen woningen), Abonnement (status + beheren), Account (Accountgegevens, Wachtwoord en beveiliging, Uitloggen, Account verwijderen), Ondersteuning (Privacy, Hulp & support, Algemene voorwaarden)
- All sections in white rounded-2xl cards with subtle shadow on gray bg
- Profile name: first_name + last_name from user_profile_data, fallback to auth metadata full_name, fallback to email prefix
- Biography removed entirely from the app

### Profile Photo Upload
- `POST /api/profile-photo`: Accepts base64 image, uploads to Supabase Storage (avatars bucket), saves URL in user_profile_data.profile_photo_url
- `DELETE /api/profile-photo`: Removes photo from storage and clears profile_photo_url
- Frontend: ProfilePhotoSheet bottom sheet in dashboard.tsx — upload, replace, remove actions
- Max file size: 5MB; accepted formats: JPEG, PNG, WebP
- JSON body limit increased to 10mb in server/index.ts

### Personal Details Pages
- `/profile/details` (client/src/pages/profile-details.tsx): Clean list of personal fields (Voornaam, Achternaam, Geboortedatum, E-mailadres, Mobiele nummer, Beroep, Maandelijks inkomen). Each editable field tappable → opens edit screen. Email is read-only.
- `/profile/edit/:field` (client/src/pages/profile-edit.tsx): Single-field edit screen. All profile fields save to `PUT /api/profile-data` with exact DB column name as key.
- `GET /api/profile-stats`: Returns { matches_received, reactions_sent } counts from matches table

### Profile Schema — `user_profile_data` Table
- **Table**: `user_profile_data` in Replit PostgreSQL (NOT Supabase — moved due to DDL access constraints)
- **Primary key**: `user_id` (UUID, references Supabase auth.users.id)
- **Access**: via `pg` pool (`server/pg-pool.ts`) — no RLS, auth verified via Supabase JWT in route handlers
- **Columns & which screens write to them**:
  - `first_name` TEXT — profile-edit (`/profile/edit/first_name`)
  - `last_name` TEXT — profile-edit (`/profile/edit/last_name`)
  - `birth_date` TEXT — profile-edit (`/profile/edit/birth_date`)
  - `phone` TEXT — profile-edit (`/profile/edit/phone`)
  - `bio` TEXT — profile-edit (`/profile/edit/bio`)
  - `occupation` TEXT — profile-edit (`/profile/edit/occupation`)
  - `monthly_income` INTEGER — profile-edit (`/profile/edit/monthly_income`)
  - `profile_photo_url` TEXT — profile-photo upload
  - `search_buddy_email` TEXT — dashboard speed task
  - `application_template` TEXT — application-letter page
  - `document_checklist` JSONB — dashboard speed task
  - `network_task_done` BOOLEAN — dashboard speed task
  - `viewing_tips_done` BOOLEAN — viewing-tips page
- **API endpoints**:
  - `GET /api/profile-data` — returns row for auth user (defaults if missing)
  - `PUT /api/profile-data` — upsert with `onConflict: "user_id"`, logs Supabase errors to console
- **IMPORTANT**: Frontend field key in FIELD_CONFIG matches `dbField` which matches the exact Supabase column name. No field name translation needed.
- Migration: `server/migrations/003_profile_data.sql` (must be applied manually in Supabase SQL editor)
- Account tasks: Alerts (+20), Search buddy (+10), Search optimization (+20), Application template (+15), Documents (+20), Phone (+15)
- Prep tasks: Introductiebrief (+10), Extra zoekopdracht (+15), Gebruik je netwerk (+5), Bezichtigingtips (+5)
- Max score: 135 total (both groups combined)
- Migration: `server/migrations/004_search_prep_flags.sql` adds `network_task_done` and `viewing_tips_done` columns

### Tips Tab (formerly Boost)
- `client/src/pages/tips.tsx` — Tips page with 6 guide card links (Bezichtigingtips, Aanmeldingsbrief, Documenten, SCHUFA, Zoekstrategie, Netwerk)
- `client/src/pages/guide.tsx` — Guide page component for 4 content guides (documenten, schufa, zoekstrategie, netwerk) at `/tips/<id>`
- `shared/boost-config.ts` — Structured task config: `BOOST_TASKS` array with id, weight, label, description; `BOOST_MAX_SCORE` constant (100)
- `server/boost.ts` — Score calculation utility: `resolveCompletionStates()` derives task status from Supabase data, `calculateBoostScore()` computes weighted score
- `client/src/pages/boost.tsx` — Legacy Boost page (task modals still used by profile-strength components)
- `GET /api/boost` — Returns `boostScore` (0-100), `tasks` array, `recommendations` (top 3 incomplete sorted by weight), `speedSteps`, `speedDone`, `speedTotal`
- Bottom nav tab: 3rd tab (between Matches and Filters) with Zap icon, label "Tips"
- TabKey type: `"home" | "matches" | "filters" | "tips" | "profiel"`
- Score weights (total = 100): income_documents_uploaded 20, alerts_active 15, id_document_uploaded 15, reaction_letter_ready 15, phone_number_added 10, housing_preferences_completed 10, search_buddy_added 5, profile_info_completed 5, profile_photo_added 5
- Completion derivation: income docs from document_checklist (income_proof, payslips, employment_contract, etc. >= 2), ID docs from document_checklist (id_copy, photo >= 1), alerts from notification_settings, letter from application_template, phone from phone_e164, preferences from search_profiles, search_buddy from search_buddy_email, profile_info from email+phone, profile_photo from profile_photo_url
- Task actions: alerts_active/phone_number_added/profile_info_completed → /settings/notifications, housing_preferences_completed → /dashboard/searches/new, reaction_letter_ready → /application-letter, income_documents_uploaded/id_document_uploaded → inline document checklist modals, search_buddy_added → inline email modal, profile_photo_added → navigates to profile tab (photo upload via bottom sheet)
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

### Listings Table (Supabase)
- Columns: `id`, `source`, `source_id`, `url`, `title`, `city`, `price`, `bedrooms`, `size_m2`, `image_url`, `created_at`
- **No `district` column** — the `district` column does NOT exist on the `listings` table. Do not query or reference it.
- Image sources: wg-gesucht provides `image_url` most reliably; kleinanzeigen, immowelt, wohnungsboerse have partial coverage
- Backfill script: `server/scripts/backfill-images.ts` — fetches og:image from listing URLs for listings without images (batches IDs in groups of 50)

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
- Trial: 14-day free trial via Stripe `trial_period_days: 14` on checkout. Stripe `trialing` status maps to DB `trial`. Trial also auto-created on signup via `POST /api/subscription/ensure-trial`
- Soft paywall: matches tab blurred when expired; trial/expired banners on home tab; real status in profiel tab
- Match filtering: matches only include listings matched after subscription `created_at` (premium access start date)

### API Endpoints
- `GET /api/listings/:id` — Returns full listing detail with freshness data (public endpoint)
- `GET /api/estimate?city=&minPrice=&maxPrice=&minRooms=&minSize=` — Returns `{ perWeekEstimate, last7dCount }` based on Supabase listings
- `POST /api/checkout/session` — Creates Stripe checkout session with 14-day trial (requires auth, `{ plan: "monthly"|"two_month"|"three_month" }`)
- `POST /api/checkout` — Legacy checkout endpoint (maps old plan IDs to new ones)
- `POST /api/checkout/verify` — Verifies Stripe checkout session (handles both `trialing` and `paid` status) and syncs subscription to DB (requires auth, `{ session_id }`)
- `GET /api/stripe/publishable-key` — Returns Stripe publishable key
- `POST /api/stripe/webhook` — Stripe webhook (handles checkout.session.completed, subscription created/updated/deleted)
- `POST /api/subscription/ensure-trial` — Creates trial subscription row if none exists (auth required)
- `GET /api/subscription/status` — Returns subscription state with isActive/isTrial/isExpired booleans (auth required)
- **Stripe period_end guard**: All code paths that read `current_period_end` from Stripe handle null/0 by falling back to now + 30 days (test-mode Stripe subscriptions may return null)
- `GET /api/matches` — Returns user's matches with listing details (auth required)
- `PATCH /api/matches/:listingId/applied` — Sets applied status on a match (auth required, `{ applied: boolean }`)
- `GET /api/matches/applied` — Returns listing IDs the user has marked as applied (auth required)
- `GET /api/search-profiles` — Returns user's search profiles (auth required)
- `DELETE /api/search-profiles/:id` — Deletes a search profile (auth required, ownership check)
- `POST /api/search-profiles/backfill` — Triggers backfill matching for a search profile (requires `{ searchProfileId }`)
- **Migration 014**: Unique index on `matches(user_id, search_profile_id, listing_id)` — prevents duplicate matches

### Stripe Config
- `server/stripe/stripeClient.ts` — Stripe client with dual initialization: tries Replit connector first, falls back to `STRIPE_SECRET_KEY` env var. Throws clear error if neither available.
- Publishable key: from Replit connector or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Pricing: monthly €14,99/1mo, two_month €24,99/2mo (€12,50/mo), three_month €29,99/3mo (€10,00/mo)
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
  city_name text,
  country_code text DEFAULT 'DE',
  latitude double precision,
  longitude double precision,
  place_id text,
  price_min integer DEFAULT 0,
  price_max integer DEFAULT 0,
  bedrooms_min integer DEFAULT 0,
  size_min integer DEFAULT 0,
  furnished text,
  property_types text[],
  extra_features text[],
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
  image_url text,
  furnished boolean,
  pets_allowed boolean,
  balcony boolean,
  elevator boolean,
  district text,
  latitude double precision,
  longitude double precision,
  extra_features text[],
  target_categories text[],
  created_at timestamptz DEFAULT now(),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select listings" ON listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert listings" ON listings FOR INSERT TO authenticated WITH CHECK (true);
```

**Advanced filter columns** (migration 015): furnished, pets_allowed, balcony, elevator, district, latitude, longitude, extra_features, target_categories. These are populated by ingesters (wg-gesucht, immowelt, kleinanzeigen) and checked by the match engine.

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
- **Email** — via Resend integration (`sendEmailMatchAlert` for single, `sendBatchMatchAlert` for digest)
- **SMS** — via Twilio (`sendSmsMatchAlert`); requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`
- **WhatsApp** — via Twilio (`sendWhatsappMatchAlert`); requires `TWILIO_WHATSAPP_FROM`
- **Batched alerts**: Matching engine buffers alerts via `server/notifications/buffer.ts` (`bufferMatchAlert`). At end of ingestion cycle, `flushMatchAlertBuffer` sends one digest email per user. Dedup by `listing_id` prevents duplicate listings. Backfill uses `flushUserAlerts` for user-scoped flush. Guards: subscription check (engine + flush), alerts-disabled check at buffer entry + flush, settings-read-error = skip, flush mutex, listing existence verification, max 20 listings per email. Alerts only sent to users with active subscription (trial or paid).
- `sendMatchAlerts(userId, email, listing, supabase)` — legacy single-listing alert function (still available for direct use); reads `user_notification_settings` from Supabase, dispatches to enabled channels; skips all notifications on settings read failure
- **Email alert eligibility**: Same truth source as `GET /api/matches` — subscription check, listing existence, dedup by listing_id. Engine checks sub before buffering; flush re-checks sub + verifies listings exist in DB with non-null title.

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
- `wg-gesucht.ts` — WG-Gesucht scraper factory, city-parameterized via `createWgGesuchtIngester(city)`
- `kleinanzeigen.ts` — Kleinanzeigen scraper factory, city-parameterized via `createKleinanzeigenIngester(city)`
- `immowelt.ts` — Immowelt scraper factory, city-parameterized via `createImmoweltIngester(city)`
- `city-slugs.ts` — City→URL slug mappings for all scrapers (34 German cities); WG-Gesucht city codes, Kleinanzeigen location codes, Immowelt/generic slugs
- `html-config.ts` — Generic config-driven ingester engine: fetches a page, parses cards via CSS selectors, extracts fields via regex
- `config/sources.ts` — Source templates with `buildSourcesForCity(city, slug)` factory; each run generates city-specific configs
  - Current configs: `wohnungsboerse`, `immoscout` (bot-blocked), `rentola`, `nestpick`, `immonet` (410 gone, graceful)
  - Config fields: name, baseUrl, searchUrl, city, source, cardSelector, fields (title/url/price/size_m2/bedrooms), sourceIdRegex, botBlockPatterns, rateLimitMs
- `index.ts` — Multi-city ingestion orchestrator: queries active cities from `search_profiles`, builds per-city ingesters, runs them sequentially with overlap lock

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

All freshness data is stored in Supabase (migrated from local PostgreSQL):
- `listing_freshness` table: `listing_id (PK)`, `source`, `source_id`, `first_seen_at`, `last_seen_at`
- `match_timestamps` table: `match_id (PK)`, `matched_at`
- `server/freshness.ts` — Functions: `trackListingSeen()`, `getListingFreshness()`, `trackMatchCreated()`, `getMatchTimestamps()` — all use Supabase client
- Migration: `server/migrations/008_freshness_tables.sql` (must be applied in Supabase SQL editor)
- Migration: `server/migrations/009_occupation_income.sql` adds `occupation TEXT`, `monthly_income INTEGER` to `user_profile_data` (must be applied in Supabase SQL editor)

Behavior:
- New listing inserted → `first_seen_at = now()`, `last_seen_at = now()`
- Duplicate listing found → only `last_seen_at = now()` updated (via insert + conflict update)
- Match created → `matched_at = now()` tracked in Supabase
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
