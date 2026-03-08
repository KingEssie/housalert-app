# Stekkies — Rental Alert App

A BlaBlaCar-inspired Dutch rental alert application. Users can sign up, log in, and manage saved rental search profiles. Listings are matched against profiles and shown as matches.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — most tables: `search_profiles`, `listings`, `matches`, `subscriptions`, `user_notification_settings`. Replit PostgreSQL (via `pg` pool) — `user_profile_data`, `listing_freshness`, `match_timestamps`, `onboarding_drafts`
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

### City Picker & Location Mode Selector
- `client/src/components/city-picker.tsx` — Reusable city autocomplete with Nominatim geocoding + Leaflet map preview (standalone)
- `client/src/components/location-mode-selector.tsx` — 3-tab location selection (Wijken/Radius/Reistijd)
  - **Wijken tab**: city search + multi-select districts from `config/market.ts` (8 cities have districts); shows "binnenkort beschikbaar" for cities without district data
  - **Radius tab**: city search + radius km selector (2/5/10/15/25/50 km) + Leaflet Circle overlay on map
  - **Reistijd tab**: Nominatim destination search + transport mode (auto/OV/fiets) + max travel time (15/30/45/60/90 min) + destination pin on map
  - Returns `LocationData` object; validated via `isLocationValid()`
  - Used in: `onboarding.tsx` (LocationStep), `new-search.tsx` (step 2)
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
- **PENDING MIGRATION**: `server/migrations/PENDING_RUN_IN_SUPABASE.sql` must be run in Supabase SQL Editor (includes migrations 008, 010, 011, 012, 013)

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
- `client/src/components/ui/page-header.tsx` — Sticky top header with back button + title
- Props: `title` (string), `onBack?` (callback, defaults to history.back()), `trailing?` (ReactNode)
- Style: sticky top-0, white bg, border-bottom, h-[56px], max-w-xl centered
- Used on ALL subpages: subscription-detail, payment-method, cancel flow, notification-settings, application-letter, viewing-tips, profile-details, profile-edit, listing-detail
- NOT used on main navigation screens: dashboard (Home/Matches/Boost/Filters/Profile), or wizard flows (new-search)

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
- `client/src/pages/onboarding.tsx` — New user onboarding flow at `/onboarding`. 4-step wizard: Welcome screen → City selection (autocomplete) → Budget (min/max price) → Property type → Alerts activation. Creates search profile, enables email notifications, triggers backfill, redirects to dashboard. ProtectedRoute automatically redirects users with no search profiles to onboarding. Property type is collected but not yet persisted (matching engine doesn't support it yet — same as new-search.tsx).
- `client/src/pages/login.tsx` — Auth page with "Inloggen" / "Account aanmaken" tabs
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (5 tabs: Home, Matches, Boost, Filters, Profiel). Mobile-first BlaBlaCar design. Match cards with image placeholders (city-based gradients), save/bookmark toggle, "Reageer" opens ApplySheet (bottom sheet with letter preview, copy, view listing, mark applied). Matches page has sub-tabs: Nieuw, Bekeken, Opgeslagen, Gereageerd — status tracked in localStorage (keys: `stekkies_match_viewed`, `stekkies_match_saved`, `stekkies_match_applied`). HomeTab includes SpeedBanner (readiness indicator). ProfielTab includes NotificationSummaryCard (channel status + recommended fastest channel) and SpeedReadinessCard (4-step checklist). Subscription CTA for expired users.
- `client/src/components/apply-sheet.tsx` — Reusable bottom sheet for instant apply flow: shows pre-filled application letter, copy, view listing, mark as applied. Used by MatchCard and ListingDetailPage.
- `client/src/pages/listing-detail.tsx` — Full listing detail page at `/listing/:id`. Hero image (260px), match score badge, title, price, location, details grid (bedrooms/size/source/time), "Waarom deze match?" section with green checkmark reasons. CTA: "Reageer direct" (opens ApplySheet) + "Open originele advertentie" (external link). External site ONLY opens from this detail page.
- `client/src/pages/new-search.tsx` — 6-step wizard to create a search profile at `/dashboard/searches/new`. Steps: property type, location (city+districts), budget, basic requirements (bedrooms/size), extra preferences, additional filters. Dynamic estimate badge. Max 4 profiles.
- `client/src/pages/notification-settings.tsx` — Notification preferences (email/SMS/WhatsApp toggles)
- `client/src/pages/application-letter.tsx` — Application letter template editor at `/application-letter`. Edit/save/reset template with Dutch placeholders ([[ADRES]], [[STAD]], [[NAAM]], etc.)
- `client/src/pages/viewing-tips.tsx` — Dedicated viewing tips page at `/tips/bezichtiging`. Five sections: Voor/Tijdens/Wat meenemen/Na de bezichtiging/Rode vlaggen. CTA to mark as completed.
- `client/src/pages/legal.tsx` — Legal pages: `/impressum`, `/datenschutz`, `/terms` (German placeholder content)
- `client/src/pages/paywall.tsx` — Subscription paywall with Stripe checkout; shows friendly message if Stripe not configured
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

### Boost Tab
- `shared/boost-config.ts` — Structured task config: `BOOST_TASKS` array with id, weight, label, description; `BOOST_MAX_SCORE` constant (100)
- `server/boost.ts` — Score calculation utility: `resolveCompletionStates()` derives task status from Supabase data, `calculateBoostScore()` computes weighted score
- `client/src/pages/boost.tsx` — Dedicated Boost page: BoostScoreCard, RecommendedSection, ReadinessSection, AllTasksSection, EmptyState, HighProgressState, TaskModal
- `GET /api/boost` — Returns `boostScore` (0-100), `tasks` array, `recommendations` (top 3 incomplete sorted by weight), `speedSteps`, `speedDone`, `speedTotal`
- Bottom nav tab: 5th tab (between Matches and Filters) with Zap icon, label "Boost"
- TabKey type: `"home" | "matches" | "filters" | "boost" | "profiel"`
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
  city_name text,
  country_code text DEFAULT 'DE',
  latitude double precision,
  longitude double precision,
  place_id text,
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
