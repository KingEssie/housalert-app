# HousAlert — Rental Alert App

A mobile-first rental alert application for the German market. Users can sign up, log in, and manage saved rental search profiles. Listings are matched against profiles and shown as matches. Rebranded from "Stekkies" to "HousAlert". Supports three languages: German (de), English (en), Dutch (nl). Default/fallback: English (en).

## Theme System (Dual Light/Dark)
- **Architecture**: CSS custom properties (`--ha-*`) in `client/src/index.css` with RGB triplet format (e.g., `--ha-primary: 233 30 99;`). Light mode in `:root`, dark mode via `@media (prefers-color-scheme: dark)`.
- **Tailwind integration**: `darkMode: "media"` in `tailwind.config.ts`. All `ha.*` colors use `rgb(var(--ha-*) / <alpha-value>)` format for full opacity modifier support (e.g., `bg-ha-primary/10`, `text-ha-text/70`).
- **Primary color**: Pink `#E91E63` (HousAlert brand) — all CTAs, active states, links use `bg-ha-primary`/`text-ha-primary`.
- **Token naming**: `bg-ha-bg`, `bg-ha-card`, `bg-ha-surface`, `border-ha-card-border`, `text-ha-text`, `text-ha-text-secondary`, `text-ha-text-muted`, `bg-ha-primary`, `bg-ha-primary-hover`, `bg-ha-primary-light`, `bg-ha-success`, `text-ha-danger`, `text-ha-warning`, `bg-ha-input-bg`, `bg-ha-nav-bg`, `bg-ha-badge-bg`, `shadow-ha-card`.
- **Pre-defined opacity tokens**: `--ha-primary-light`, `--ha-success-light`, `--ha-warning-light`, `--ha-danger-light` use rgba with fixed opacity (light: 0.08, dark: 0.15). These stay as raw CSS values (not RGB triplets).
- **Inline styles**: When using ha tokens in `style={{}}` attributes, wrap in `rgb()`: `style={{ color: "rgb(var(--ha-primary))" }}`.
- **theme.ts**: `client/src/lib/theme.ts` — all colors reference CSS variables for runtime theme consistency.
- **Excluded from tokenization**: `admin-*.tsx` pages, `v2/` pages/components (these have their own design systems). Google logo SVG colors, city gradient overlays, and amber warning banners (`#FEF3C7`/`#92400E`) remain hardcoded as semantic/brand colors.
- **text-white rule**: `text-white` is preserved on elements with colored backgrounds (buttons with `bg-ha-primary`, success badges, hero image overlays). All other white text uses `text-ha-text`.
- **Page background**: `bg-ha-bg` (#F3F3F5 light) — slightly darker grey for card/page contrast separation.
- **Cards**: White `bg-ha-card`, subtle `border-ha-card-border`, `rounded-[6px]`, `shadow-ha-card` (none in dark mode).
- **Buttons**: All buttons use `rounded-[6px]`. Only small badges/tags keep `rounded-full` pill shape.
- **Inputs**: All inputs use `rounded-[6px]`.
- **Listing cards**: Unified single-card structure — image on top, white content section below, all inside one `rounded-[6px] overflow-hidden bg-ha-card` wrapper.
- **Profile header**: Dark purple `bg-ha-profile-header` (#1E1B4B), no avatar, left-aligned name+member since, settings gear button on right. Compact height (pt-8 pb-6), mb-4 below.
- **Profile tab structure**: Header → progress blocks (complete account + tips) → upgrade CTA (if applicable) → notification toggles → "Einstellungen" button. All menu items moved to `/settings` page.
- **Settings page** (`/settings`): Contains search profiles, reaction letter, zoekbuddy, HousAlert Plus, personal info, language, privacy, help, terms, invite friends, logout, delete account.
- **Admin button**: Floating `rounded-[8px]`, `px-4 py-2.5`, dark purple bg, white text, reduced shadow `shadow-[0_2px_10px_rgba(30,27,75,0.2)]`, positioned above tab bar.
- **Bottom tab bar**: `bg-ha-bg` background, `border-t border-ha-card-border`, active icons use `text-ha-primary`.
- **Typography**: Page titles use `text-ha-text`, section labels use `text-ha-text-muted`.

### Multi-Language System
- **Frontend i18n**: `client/src/i18n/index.tsx` with translation keys in `client/src/i18n/locales/{de,en,nl}.ts`. Fallback chain: current locale → de → nl.
- **Server-side i18n**: `server/i18n.ts` — centralized translation map for email/push strings. `t(lang, key, params?)` function, `detectLanguage(req, userLang?)` helper, `getUserLanguage(userLang?)` helper.
- **User language column**: `user_profile_data.language` (TEXT, nullable, values: "de"/"en"/"nl"). Stored in Replit PG.
- **Language priority**: user.language → accept-language header → "de" fallback.
- **Language selector**: Profile tab bottom sheet with Deutsch/English/Nederlands. Changes update backend + switch UI locale immediately.
- **Emails**: All email templates in `server/email.ts` use `t()` from `server/i18n.ts`. Language passed through entire notification pipeline (buffer → email/push).
- **Push notifications**: Both web push (`server/notifications/push.ts`) and Expo push (`server/notifications/expo-push.ts`) accept `lang` parameter and use centralized translations.

## V2 Frontend Flow (In Development)
- **Status**: Phase 1 complete — isolated V2 flow, not replacing production yet
- **Routes**: `/v2/welcome`, `/v2/onboarding/intro`, `/v2/onboarding/location` (more in Phase 2)
- **Design**: Dark background (#1A1A2E), Rentbird-inspired conversion flow
- **Layout components**: `client/src/components/v2/` — V2DarkScreenLayout, V2DarkHeader, V2DarkContent, V2ProgressHeader, V2BottomCTA, V2FormField components (TextInput, PasswordInput, Select, SegmentedControl, ChipGroup, Slider, Toggle, Textarea)
- **State store**: `client/src/lib/v2-onboarding-store.tsx` — React context preserving onboarding data across V2 steps (language, city, lat/lng, radius, filters, preferences)
- **Pages**: `client/src/pages/v2/` — welcome.tsx, onboarding-intro.tsx, onboarding-location.tsx
- **i18n keys**: Under `v2.*` namespace in all 3 locale files (de/en/nl)
- **Auth**: V2 welcome page uses existing Supabase auth (signInWithPassword), same as old login
- **Planned Phase 2**: /v2/onboarding/filters, /v2/onboarding/preferences, /v2/onboarding/value, /v2/signup, /v2/paywall, /v2/profile steps, /v2/success

## Post-Login Onboarding Funnel
- **Route**: `/onboarding/setup` — 9-step funnel (paywall → objection → push → personalInfo → housing → extras → letter → buddy → success)
- **Component**: `client/src/pages/post-login-funnel.tsx`
- **Onboarding flag**: `user_profile_data.onboarding_completed` (BOOLEAN, default false). Set true when user finishes the funnel success step.
- **API**: `GET /api/onboarding-status` — returns `{ onboarding_completed: bool }`. Auto-backfills `true` for existing users who already have search profiles.
- **Auth guard**: `ProtectedRoute` in App.tsx checks `/api/onboarding-status`. If `onboarding_completed=false`, redirects to `/onboarding/setup`. Skipped for routes with `skipOnboardingCheck`.
- **Login redirect**: Login page checks onboarding status and redirects to `/onboarding/setup` if not completed, otherwise `/dashboard`.
- **Signup redirect**: After signup → `/onboarding/setup`.
- **Existing users**: Automatically marked as completed if they have any search profiles (backfill in onboarding-status API).
- **i18n**: `funnel.*` keys in all 3 locale files (nl/de/en).
- **Data persistence**: Each funnel step saves via `PUT /api/profile-data` (personal info, housing situation, extras, application letter, buddy email). Paywall uses `POST /api/checkout/session`.

## Search Buddy Feature
- **What**: Users can add a "Zoekbuddy" (search buddy) email so a partner/friend also receives match alerts
- **Simple rule**: buddy email present = ON, buddy email removed = OFF. No separate toggle in UI.
- **Data**: `user_profile_data` table in Replit PG has `search_buddy_email` (TEXT) and `search_buddy_enabled` (BOOLEAN, auto-synced)
- **UI**: Dashboard shows buddy email + "Ontvangt automatisch match-mails" helper text. Edit page explains automatic behavior.
- **Admin portal**: User list shows "Buddy" badge + email. User detail view shows Search Buddy status + email.
- **Notification pipeline**: `server/notifications/buffer.ts` makes independent recipient decisions:
  - Main user: subscription active + `email_enabled` = true
  - Buddy: subscription active + buddy email exists + not same as main email
- **Anti-retroactive**: Buddy follows same anti-retroactive rules (premiumStartedAt filter)
- **Duplicate prevention**: If buddy email = main user email, only one email is sent
- **Logging**: All buddy decisions logged with clear skip reasons

## Referral System
- **Database**: `referrals` table in Replit PG + `referral_code`, `referred_by_code`, `referral_applied_at` columns on `user_profile_data`
- **Backend**: `server/referrals.ts` — generateReferralCode, ensureUserHasReferralCode, validateReferralCode, applyReferralCode, getReferralSummary
- **API endpoints**: GET `/api/referrals/me`, POST `/api/referrals/apply`, POST `/api/referrals/validate`
- **Code format**: `{NAME}{4-digit-random}` e.g. MARTIN4821 — auto-generated from user's first_name with collision handling
- **Referral statuses**: pending → qualified → rewarded (or cancelled). MVP stores as pending on creation.
- **Frontend**: `ReferralPromoCard` and `ReferralCodeModal` components. Card placed on Tips page. Referral code input on signup page (optional, collapsible).
- **i18n**: Dutch + German translations in `referral` namespace
- **Reward logic**: Data model prepared with reward_type/reward_value fields; actual payout not automated yet (MVP)

## Brand Assets
- **Canonical logo**: `attached_assets/5B9D5117-02CB-4353-8AF3-6CCA9249F824_1773839918481.png` (1024x1024 blue house icon with notification dot)
- **Reusable component**: `client/src/components/housalert-logo.tsx` — `<HousAlertLogo size={28} showText={true} />` renders logo image + "HousAlert" text. All pages use this component.
- **Public assets**: `client/public/favicon.png` (64x64), `icon-192.png` (192x192), `icon-512.png` (512x512), `apple-touch-icon.png` (180x180)
- **Email logo**: `server/logo-data.ts` — 200x200 base64-encoded PNG served via `/housalert-logo.png` route. Email header shows 36x36 icon + "HousAlert" text.
- **Colors**: Blue `#0D6EFD`, Navy `#111C3D`

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — most tables: `search_profiles`, `listings`, `matches`, `subscriptions`, `user_notification_settings`, `push_sent_log`, `push_subscriptions`, `expo_push_tokens` (native push tokens), `push_delivery_log` (delivery audit). Replit PostgreSQL (via `pg` pool) — `user_profile_data`, `user_matches` (canonical match tracking), `fetch_runs` (ingestion audit), `listing_freshness`, `match_timestamps`, `onboarding_drafts`, `ingestion_runs`
- **Backend:** Express (minimal — auth + data handled by Supabase)
- **Payments:** Stripe (sandbox, via Replit connector)
- **Mobile:** Expo (WebView wrapper) in `mobile-clean/` — wraps production web app URL for iOS/Android distribution via Expo Go or EAS Build. Includes native push notification registration via expo-notifications.

## Architecture

### Onboarding Flow (4-Step Funnel)
- **Pre-auth funnel (4 steps)**: All anonymous, state persisted via URL query params across steps.
  - Step 1: `/onboarding/location` — City selection with districts/radius/commute modes (4-dot progress)
  - Step 2: `/onboarding/filters` — Price range, bedrooms, min size (preserves all upstream params)
  - Step 3: `/onboarding/preferences` — Furnished, housing type, target group, extra wishes
  - Step 4: `/signup` — Account creation (name, email, password). On submit: creates account + saves search profile from steps 1-3 via `createSearchProfile()` + ensures trial.
- **Post-signup pages**:
  - `/onboarding/value` — Value explanation page ("Waarom HousAlert werkt") with 3 benefit cards
  - `/paywall` — Subscription plans (Stripe checkout)
- **Flow**: Landing → Location → Filters → Preferences → Signup (creates profile) → Value → Paywall → Dashboard
- **Fallback onboarding**: `/onboarding` (post-auth wizard) still exists for users who sign up without the funnel or have 0 profiles. ProtectedRoute redirects to `/onboarding` if 0 profiles.
- **State persistence**: All funnel data (city, lat, lng, locationMode, districts, radiusKm, commuteAddress, commuteTime, commuteMode, minPrice, maxPrice, minRooms, minSize, furnished, propertyTypes, targetGroup) travels via URL search params. Back navigation preserves all params.

### City Picker & Location Mode Selector
- **Google Places integration**: City search uses Google Places Autocomplete (New API) with Nominatim fallback when API key is absent
  - Backend proxy: `/api/places/autocomplete` and `/api/places/details` (server-side, key never exposed to frontend)
  - Session tokens used for cost control (autocomplete + details = 1 session)
  - Env var: `GOOGLE_PLACES_API_KEY` — app works gracefully without it, falling back to Nominatim
  - Frontend hook: `client/src/hooks/use-places-autocomplete.ts` — debounced search, session token management, `isAvailable` flag for fallback
- **City normalization layer**: `shared/city-normalize.ts` + `client/src/lib/city-support.ts`
  - Converts any city name → internal model with `display_name`, `normalized_city`, `scraper_city_key`, `support_status`, `tier_source`
  - Handles German umlauts, English aliases (Munich→München, Cologne→Köln)
  - Backend endpoint: `/api/places/normalize?city=<name>` returns full normalization result
  - Client-side: `getCitySupport(cityName)` returns `{ status, tier }` for UI badges
- **City support status badges**: shown after city selection
  - supported (tier1/tier2): no badge (normal flow)
  - dynamic (tier3/scraper-supported but not in tier1/2): blue info badge "wordt automatisch gemonitord"
  - unsupported: amber warning badge "wordt nog niet actief gemonitord" — non-blocking, profile still saved
- `client/src/components/city-picker.tsx` — Reusable city autocomplete with Google Places + Nominatim fallback + Leaflet map preview (standalone)
- `client/src/components/location-mode-selector.tsx` — 3-tab location selection (Wijken/Radius/Reistijd)
  - **Wijken tab**: city search (Google Places primary, Nominatim fallback) + multi-select dropdown for districts from `config/market.ts` (8 cities have districts); selected districts shown as removable chips below dropdown; shows "binnenkort beschikbaar" for cities without district data
  - **Radius tab**: city search + radius km selector (2/5/10/15/25/50 km) + Leaflet Circle overlay on map
  - **Reistijd tab**: destination search (Google Places primary, Nominatim fallback) + transport mode (auto/OV/fiets) + max travel time (15/30/45/60/90 min) + destination pin on map
  - Returns `LocationData` object; validated via `isLocationValid()`
  - Accepts `mapMaxHeight` prop (e.g. `"40vh"`) for mobile viewport constraint
  - Used in: `onboarding.tsx` (LocationStep), `new-search.tsx` (step 1)
  - Dependencies: `leaflet`, `react-leaflet@4`, `@types/leaflet`
- `client/src/pages/onboarding-location.tsx` — Pre-auth funnel city selection, now with Google Places + Nominatim fallback + popular cities quick-select
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

### Design System (BlaBlaCar-inspired)
- **Primary color**: Blue #0D6EFD, hover #0B5ED7, light #EBF2FF
- **Dark navy**: #111C3D (headings), #0F172A (dark cards/banners)
- **Body text**: #111827 (primary), #1F2937 (secondary), #6B7280 (muted), #9CA3AF (placeholder/disabled)
- **Backgrounds**: white #FFFFFF, surface #F3F4F6, border #E5E7EB
- **Buttons**: Blue bg + white text, rounded-full (pill), min-h-[52px]. Content-width in cards/settings; full-width only for major form/onboarding CTAs. Variants: `default` (blue), `outline` (white bg + blue border), `secondary` (white bg + gray border), `banner` (white bg + dark navy text, for dark cards), `ghost`. Sizes: `default`, `sm`, `lg`, `compact` (44px), `save` (centered 180px width), `icon`.
- **Checkboxes**: Blue outline (#0D6EFD border) when unchecked with white fill; solid blue fill with white checkmark when checked. Applied consistently across attribute selection, search editing, and onboarding.
- **Inputs**: bg #F3F4F6, rounded-[20px], h-[60px], no border, dark text, gray placeholder
- **Cards**: white bg, rounded-2xl (16px), subtle shadow, #E5E7EB border
- **Dark banner cards**: bg #0F172A, rounded-2xl, white CTA button (compact h-[48px], not full-width)
- **Badges**: rounded-full, variants: default (gray), neon (blue bg), success (green), dark
- **CSS variables**: Legacy `--yo-*` vars still defined in index.css but all page/component code uses direct hex values. Primary HSL: `--primary: 214 97% 52%`.

### Typography System
- CSS utility classes in `client/src/index.css` `@layer utilities`:
  - `.text-page-title` — 24px, weight 800, #111C3D, tracking -0.02em (page headings)
  - `.text-section-title` — 18px, weight 700, #111C3D, tracking -0.01em
  - `.text-row-section-title` — 13px, weight 600, #6B7280, uppercase, tracking 0.02em (list section headers)
  - `.text-row-title` — 16px, weight 500, #111827 (list row titles)
  - `.text-row-subtitle` — 14px, weight 400, #6B7280
  - `.text-subtitle` — 15px, weight 400, #6B7280
  - `.text-muted-body` — 14px, weight 400, #6B7280
  - `.text-field-label` — 13px, weight 400, #6B7280 (form field labels above values)
  - `.text-field-value` — 16px, weight 500, #111827 (field values in detail lists)
- No uppercase on page titles (removed). Section row titles use uppercase only.

### Reusable PageHeader
- `client/src/components/ui/page-header.tsx` — Floating back button (fixed top-left, 48px circle, #F3F4F6 bg + subtle shadow) + page title in content flow
- Props: `title` (string), `onBack?` (callback, defaults to history.back()), `trailing?` (ReactNode), `closeButton?` (X icon instead of arrow)
- Style: fixed position back button respects safe-area-inset-top; title rendered with `.text-page-title` class in max-w-xl centered content container
- Used on ALL subpages: subscription-detail, payment-method, cancel flow, notification-settings, application-letter, viewing-tips, profile-details, profile-edit, delete-account, guide pages, change-password
- `listing-detail.tsx` uses its own `FloatingBackButton` component (same 48px style)
- NOT used on main navigation screens: dashboard (Home/Matches/Boost/Filters/Profile), or wizard flows (new-search)

### Reusable List Components
- `client/src/components/list-section.tsx` — BlaBlaCar-style list rows
  - `ListSection` — wrapper with optional title (uses `.text-row-section-title`)
  - `ListRow` — row with title, subtitle, icon, trailing, chevron. Uses `.text-row-title` + `.text-row-subtitle`.
  - `ListDivider` — horizontal separator line (mx-5, #E5E7EB)
- Profile details page uses `text-field-label` + `text-field-value` classes for label/value pairs

### Notifications
- **Channels**: Email (via Resend) + Web Push (VAPID, `push_subscriptions` in Supabase) + Expo Push (native mobile, `expo_push_tokens` in Replit PG)
- **Removed channels**: SMS and WhatsApp fully disabled — Twilio sending code removed, UI toggles removed, DB columns still exist but always set to `false`
- **Sending logic**: `server/notifications/index.ts` — sends email via `sendEmailMatchAlert`; `server/notifications/push.ts` — sends web push via `sendMatchPushNotifications`; `server/notifications/expo-push.ts` — sends native mobile push via Expo Push API (`sendExpoMatchPush`). All three channels triggered from `buffer.ts` flush.
- **Settings UI**: Account page inline toggles (push + email), no separate settings page needed
- **Settings API**: `GET/PUT /api/notifications/settings` — accepts `email_enabled`, `push_enabled`, forces `sms_enabled=false`, `whatsapp_enabled=false`
- **Expo Push Token API**: `POST /api/expo-push-token` (register/reactivate), `DELETE /api/expo-push-token` (deactivate). Auth via Supabase JWT. Tokens stored in Supabase `expo_push_tokens` table.
- **WebView↔Native bridge**: `client/src/lib/auth.tsx` sends `AUTH_STATE` messages (user_id + access_token) to `window.ReactNativeWebView.postMessage()` on every auth state change. `mobile-clean/App.tsx` receives via `onMessage`, registers push token with backend when user is authenticated.
- **expo_push_tokens table** (Supabase): id, user_id, expo_push_token, platform, is_active, created_at, updated_at. UNIQUE(user_id, expo_push_token) prevents duplicates.
- **push_delivery_log table** (Supabase): id, user_id, channel, token_snippet, full_token, listing_ids[], listing_count, title, body, status, expo_ticket_id, expo_receipt_status, error_type, error_message, created_at. Logs every push delivery attempt with Expo ticket IDs for receipt verification.
- **Supabase admin client**: `server/supabase-admin.ts` — singleton service-role client for push operations. Used by `expo-push.ts`, token endpoints, and admin endpoints.
- **Mockable push provider**: `expo-push.ts` exports `setPushProvider()` / `resetPushProvider()` for test injection. Tests use mock providers for success, failure, and temporary-failure scenarios without hitting the real Expo API.
- **Expo Push Retry Logic**: `sendWithRetry()` in `expo-push.ts` retries 429/5xx/network errors up to 2 times with escalating delay (3s × attempt). Permanent errors are logged immediately.
- **Expo Receipt Checking**: `checkExpoReceipts()` runs every 20 minutes via scheduler. Checks tickets 15min–24h old, updates `expo_receipt_status` in delivery log, deactivates tokens on `DeviceNotRegistered` (targeted by `full_token` when available).
- **Admin Delivery Log**: `GET /api/admin/push-delivery-log?user_id=&limit=` — view push delivery history with status, ticket IDs, and receipt results.
- **Mobile Deep Linking**: Push payload includes `data.url` (e.g. `/listing/{id}`) and `data.type` (`match_alert`/`test`). Native app handles notification taps via `addNotificationResponseReceivedListener` and navigates WebView. Badge count reset on app foreground. Android notification channel `match-alerts` created at startup. Token refresh handled via `addPushTokenListener`.

### Ingestion Pipeline
- **Scheduler**: `server/scheduler.ts` — runs every 5 min when `ENABLE_INGEST_SCHEDULER=true` (configurable via `INGEST_INTERVAL_MINUTES`, default changed from 10 → 5)
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
  - **Filter policy**: STRICT for core filters (city, price, bedrooms, size) — reject on mismatch. HYBRID for weak-metadata filters (furnished, pets_allowed, district) — allow null/unknown, reject only known mismatch.
  - **Furnished filter** (HYBRID): "furnished" → listing.furnished=true passes, null passes (hybrid), false rejects. "unfurnished" → listing.furnished=false passes, null passes (hybrid), true rejects. "any"/"no_preference"/null → skipped.
  - **Pets filter** (HYBRID, soft preference at launch): pets_allowed/huisdieren → listing.pets_allowed=true passes, null passes (hybrid), false rejects. UX treats pets as a "Wunsch" (wish), not a confirmed filter — separated from hard extras in the search wizard into its own "Wünsche" section. Hint: "Wunsch – wird selten in Inseraten angegeben". On match cards/detail, pets unknown shows softer note: "Haustiere: vom Anbieter nicht bestätigt – bitte selbst nachfragen". Other extra_features (balcony, elevator) remain STRICT (null = rejected).
  - **Districts filter** (HYBRID): listing.district matches profile districts → passes. listing.district=null/empty → passes (hybrid). listing.district exists but doesn't match → rejected. Only applied when `location_mode === "districts"` or not set.
  - **FilterCheck.hybridPass** field: boolean flag on each check indicating whether a match was allowed due to unknown/null data (hybrid pass) vs a true confirmed match.
  - Tests: `server/matching/engine.test.ts` — 28 tests covering strict filters, hybrid furnished/pets/district, strict boundary (balcony/elevator), and combined scenarios.
  - **Pets_allowed ingestion**: Dutch→English mapping in engine (`huisdieren` → `pets_allowed`, `balkon` → `balcony`). All 3 custom ingesters detect `NO_PETS_PATTERNS` first (→ false), then `PETS_PATTERNS` (→ true), else null. Config-based ingesters always return null for pets_allowed.
- `shared/match-score.ts` — also exports `getMatchReasons(details)` which returns top 2-3 German match reason labels (Standort, Preis, Zimmer, Größe) for sub-scores >= 70% of their max. Used by both `/api/matches` and `/api/listings/:id` endpoints.
- `server/ingesters/matching.ts` — Ingestion pipeline (dedup, insert, delegates to engine for matching). `furnished` and `district` columns checked independently from other advanced columns (`checkFurnishedColumn()`, `checkDistrictColumn()`)
- `server/log.ts` — Shared `log()` utility (extracted from index.ts to avoid circular deps)
- `shared/match-score.ts` — Deterministic match scoring (0–100) based on city fit (30pts), price fit (30pts), bedrooms fit (20pts), size fit (20pts). Labels: Perfektes Match (90+), Starkes Match (75–89), Gutes Match (60–74), Mögliches Match (40–59). Used by `/api/matches` and `/api/listings/:id`.
- City matching uses case-insensitive substring inclusion (e.g. "Berlin" matches "Berlin-Mitte")
- City pre-filter: matching engine pre-filters search profiles by city (ilike) before running full match logic; falls back to full scan if filter fails or city is too short (<3 chars)
- Duplicate prevention: checks `unique(user_id, search_profile_id, listing_id)` before insert
- Phone sync: `PUT /api/profile-data` with `phone` field also syncs to `user_notification_settings.phone_e164` (E.164 validated)
- Notification delivery: per-channel failure logging in `sendMatchAlerts` (logs false returns and rejections)
- Backfill triggered via `POST /api/search-profiles/backfill` (auth required)
- Test script: `scripts/test-matching-engine.ts` — run with `npx tsx scripts/test-matching-engine.ts`

### Canonical Match Tracking (user_matches)
- **`user_matches` table** (Replit PG) — single source of truth for per-user delivered matches, unique on `(user_id, listing_id)`
- **`server/user-matches.ts`** — module with CRUD: `upsertUserMatch()`, `markEmailSent()`, `markPushSent()`, `markViewed()`, `markApplied()`, `getUserMatchStats()`, `getRecentUserMatches()`, `getMatchCountForUser()`, `backfillFromSupabaseMatches()`
- **Flow**: matching engine creates match in Supabase `matches` table → also upserts into `user_matches` with listing metadata → notification buffer updates `email_sent`/`push_sent` after delivery → `/api/matches` marks as `viewed` when fetched by user
- **Deduplication**: `dedup_key` = `source:listing_id`, unique constraint on `(user_id, listing_id)` prevents duplicate counting
- **Counts**: `totalCount`, `newCount`, and `canonicalStats` in `/api/matches` response sourced exclusively from `user_matches` with exclusive tab buckets (applied > saved > viewed > new), all filtered by `visible_in_app AND NOT dismissed`
- **Per-match state**: Each match in API response includes `canonical_viewed`, `canonical_saved`, `canonical_applied`, `canonical_dismissed` from `user_matches`
- **Viewed tracking**: listings are marked as viewed only when user opens listing detail page (`/listing/:id`), NOT auto-marked on list fetch. Endpoint: `PATCH /api/matches/:listingId/viewed`
- **Save endpoint**: `PATCH /api/matches/:listingId/saved` — toggles saved state in canonical `user_matches`, returns 404 if match row not found
- **`fetch_runs` table** (Replit PG) — audit trail per ingestion cycle with stats: fetched_count, deduplicated_count, newly_matched_count, emails_sent_count, pushes_sent_count, error_count, cities_processed
- **Admin debug page**: `/admin/match-audit` — admin-only (email: `martin.essie87@gmail.com`), shows account info, canonical stats, recent match deliveries with per-match email/push/viewed status, fetch run history, backfill action
- **Migration**: `server/migrations/019_user_matches_supabase.sql` — reference SQL for future migration to Supabase

### Auth & Trial Subscription Flow
- **Trial creation**: `ensureTrialForCurrentUser()` in `client/src/lib/auth.tsx` — shared idempotent helper called from signup, login, and auth-callback. Calls `POST /api/subscription/ensure-trial` which checks for existing subscription before creating a 14-day trial. Returns 500 if creation fails (not silent 200).
- **Signup** (`signup.tsx`): After `signUp()`, checks for active session. Case A (session exists, email confirmation disabled): calls `ensureTrialForCurrentUser()` → redirects to `/onboarding`. Case B (no session, email confirmation enabled): shows "Bevestig je e-mailadres" confirmation UI with email address and link to login.
- **Login** (`login.tsx`): After `signInWithPassword()`, calls `ensureTrialForCurrentUser()` (catches users who signed up with email confirmation but never got a trial) → redirects to `/dashboard`.
- **Auth callback** (`auth-callback.tsx`): After `exchangeCodeForSession()`, calls `ensureTrialForCurrentUser()` (catches email-confirmed users) → redirects to `/dashboard`.
- **ProtectedRoute** (`App.tsx`): Checks search profiles → redirects to `/onboarding` if 0 profiles. This ensures users always go through the onboarding wizard regardless of entry point.

### Admin Portal (Unified)
- **Route**: `/admin/portal` — unified admin dashboard with 8 tabs
- **Access control**: Same `requireAdmin` middleware (Supabase JWT + `ADMIN_EMAILS` allowlist)
- **Frontend**: `client/src/pages/admin-portal.tsx` — desktop sidebar nav + mobile horizontal scroll tabs
- **Tabs**:
  1. **Overview**: KPI cards (total users, active subs, trial users, signups today, MRR, profiles, listings/matches today, emails/push today), 7-day trends, source health indicators
  2. **Users**: Searchable user list with subscription status, profile count, match count. Click-through to user detail (profile, subscription, search profiles, recent matches, cancellation feedback, notification settings). Filter by subscription status.
  3. **Subscriptions**: Paginated subscription list with status filters (all/active/trial/canceled/expired), Stripe dashboard links, user name enrichment
  4. **Search Profiles**: Paginated list showing city, location mode, price range, rooms, size. User name enrichment.
  5. **Listings & Sources**: Two sub-views — Source Monitor (ingestion run status, per-source found/inserted/duplicates/matches/errors) and Listings browser (filterable by city and source, with external links)
  6. **City Monitor**: Per-city monitoring dashboard. Shows all cities from user search profiles with tier (T1/T2/T3), active profile count, 7-day listing totals, last scrape timestamp, active/failed sources, and health status (green >20/wk, yellow 5–20, red <5). Filters by health, country, city name search. Data cached 5 minutes server-side.
  7. **Matches & Notifications**: Recent matches with user names, viewed/email/push status indicators. KPI cards for emails today, push today, delivery failures (7d).
  8. **System Status**: Health checks for Stripe, Google Places API, Ingestion Scheduler, Email (Resend), Push Notifications (VAPID), Replit DB, Supabase DB. Refresh button.
- **API endpoints** (all `/api/admin/portal/*`, `requireAdmin`):
  - `GET /api/admin/portal/overview` — aggregated KPIs from both DBs
  - `GET /api/admin/portal/users?search=&filter=&page=&limit=` — paginated user list
  - `GET /api/admin/portal/users/:userId` — user detail with subscription, profiles, matches
  - `GET /api/admin/portal/subscriptions?filter=&page=&limit=` — paginated subscription list
  - `GET /api/admin/portal/search-profiles?page=&limit=` — paginated search profiles
  - `GET /api/admin/portal/listings?source=&city=&page=&limit=` — paginated listings
  - `GET /api/admin/portal/sources` — ingestion source health from latest run
  - `GET /api/admin/portal/dynamic-cities` — per-city monitoring data (profiles, listings, health, sources)
  - `GET /api/admin/portal/matches?page=&limit=` — paginated matches with notification stats
  - `GET /api/admin/portal/system-status` — service health checks

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
- `client/src/pages/login.tsx` — Clean login page (login-only, no tabs). "Passwort vergessen?" link triggers Supabase password reset. "Konto erstellen" button navigates to /signup.
- `client/src/pages/dashboard.tsx` — Phase 2 dashboard with bottom-nav bar (5 tabs: Home, Matches, Tipps, Filter, Profil — all German via i18n). Mobile-first BlaBlaCar design. Match cards with image placeholders (city-based gradients), save/bookmark toggle, "Jetzt bewerben" opens ApplySheet. Matches page has sub-tabs: Neu, Angesehen, Gespeichert, Beworben (internal keys remain Dutch: `nieuw`, `bekeken`, `opgeslagen`, `gereageerd` — stored in localStorage, NOT user-visible). HomeTab includes AccountCompletionCard + SearchPreparationCard + RecenteMatchesSection (5 newest matches). ProfielTab includes SpeedReadinessCard (4-step checklist). Subscription CTA for expired users.
- `client/src/components/apply-sheet.tsx` — Reusable bottom sheet for instant apply flow: shows pre-filled application letter, copy, view listing, mark as applied. Used by MatchCard and ListingDetailPage.
- `client/src/pages/listing-detail.tsx` — Full listing detail page at `/listing/:id`. Hero image (260px), match score badge, title, price, location, details grid (bedrooms/size/source/time), "Warum dieses Match?" section with green checkmark reasons. CTA: "Jetzt bewerben" (opens ApplySheet) + "Originalinserat öffnen" (external link). External site ONLY opens from this detail page.
- `client/src/pages/new-search.tsx` — 5-step wizard for search profiles at `/dashboard/searches/new` (create) or `/dashboard/searches/edit/:id` (edit). Floating back button top-left, step indicator top-right, floating round green FAB bottom-right for navigation. Steps: 1) Standort (LocationModeSelector), 2) Anforderungen (rent/bedrooms/size/furnished dropdowns), 3) Zusätzliche Eigenschaften (checkbox list), 4) Zielgruppen & Kategorien (target groups), 5) Review screen "Suchauftrag prüfen" with edit buttons per section. Edit mode loads existing profile data via `getSearchProfile()` and updates via `updateSearchProfile()`. Max 4 profiles.
- `client/src/pages/delete-account.tsx` — Full-screen account deletion at `/account/delete`. Calls `DELETE /api/account` which deletes all user data (matches, search profiles, subscriptions, notification settings, profile data) and Supabase auth user. Blocks deletion if user has active paid subscription (shows warning with link to subscription settings).
- `client/src/pages/notification-settings.tsx` — Notification preferences (email toggle + push toggle with live browser permission check)
- `client/src/pages/application-letter.tsx` — Application letter template editor at `/application-letter`. Edit/save/reset template with German placeholders ([[ADRESSE]], [[STADT]], [[NAME]], [[BERUF]], [[EINKOMMEN]], [[PREIS]], [[TELEFON]], [[EMAIL]]). Backward-compatible with legacy Dutch placeholder keys.
- `client/src/pages/viewing-tips.tsx` — Dedicated viewing tips page at `/tips/bezichtiging` (route slug stays Dutch for URL stability). Five German sections via i18n. CTA to mark as completed.
- `client/src/pages/legal.tsx` — Legal pages: `/impressum`, `/datenschutz`, `/terms` (German placeholder content)
- `client/src/pages/paywall.tsx` — Subscription paywall with Stripe checkout. Dynamic price validation at startup (validates env var price IDs, falls back to Stripe API lookup by nickname/interval). No static fallback messages — errors shown as toasts.
- `client/src/pages/subscription-success.tsx` — Stripe payment success page at `/subscription-success?session_id=...`. Calls `POST /api/checkout/verify` to sync subscription from Stripe checkout session, then polls `/api/subscription/status` for up to ~16s until active. Shows spinner during sync, then success message. Auto-redirects to dashboard after activation. Invalidates subscription/stats/matches caches.
- `client/src/pages/subscription-detail.tsx` — Subscription detail page at `/account/subscription`. Shows plan type, status (green badge), price, start/renewal dates, billing frequency, auto-renew, payment method (mock). Actions: Ändern → /paywall, Zahlungsmethode → /account/payment-method, Kündigen → /account/subscription/cancel.
- `client/src/pages/payment-method.tsx` — Payment method management at `/account/payment-method`. Shows current card (mock Visa ****4242), add/remove actions.
- `client/src/pages/subscription-cancel.tsx` — Two-step cancel flow: `/account/subscription/cancel` (confirm with renewal date) and `/account/subscription/cancelled` (confirmation). Exports `SubscriptionCancelConfirmPage` and `SubscriptionCancelledPage`.
- `client/src/pages/change-password.tsx` — In-app password change at `/account/change-password`. Three fields: current password, new password (min 8 chars), confirm. Verifies current via `signInWithPassword`, updates via `updateUser`. No email sent. Success screen with green checkmark.

### Account Page (ProfielTab — merged single page)
- Layout: Single scrollable page titled "Account" on #F5F7FA background (previously two sub-tabs "Over jou" / "Account", now merged)
- Sticky header with "Account" title
- Section order: 1) Profile card (avatar + name + "woningzoekende" → /profile/details), 2) Stats card (two visual stat blocks with circular icon backgrounds — blue for matches, green for reactions — large numbers centered), 3) Zoekbuddy (if no buddy: "Zoekbuddy toevoegen" button; if buddy exists: shows email + chevron → /profile/edit/search_buddy_email), 4) Notification toggles (push + email inline toggles, no separate page), 5) Reactiebrief (copy + edit buttons), 6) Abonnement, 7) Ondersteuning (privacy, help, terms), 8) Uitloggen + Account verwijderen
- All sections in white rounded-lg cards with subtle shadow on gray bg
- Profile name: first_name + last_name from user_profile_data, fallback to auth metadata full_name, fallback to email prefix
- Phone number: reads from BOTH `pd?.phone` (Replit PG) and `notifQuery.data?.phone_e164` (Supabase) to fix display bug
- Button style: Pill buttons (content-width, centered, rounded-full) throughout edit screens and letter page. Full-width only for onboarding/major forms.
- Listing detail: badges shifted right (left-[68px]) to avoid overlapping the floating back button

### Profile Photo Upload
- `POST /api/profile-photo`: Accepts base64 image, uploads to Supabase Storage (avatars bucket), saves URL in user_profile_data.profile_photo_url
- `DELETE /api/profile-photo`: Removes photo from storage and clears profile_photo_url
- Frontend: ProfilePhotoSheet bottom sheet in dashboard.tsx — upload, replace, remove actions
- Max file size: 5MB; accepted formats: JPEG, PNG, WebP
- JSON body limit increased to 10mb in server/index.ts

### Personal Details Pages
- `/profile/details` (client/src/pages/profile-details.tsx): Clean list of personal fields (Vorname, Nachname, Geburtsdatum, E-Mail-Adresse, Telefonnummer, Beruf, Monatliches Einkommen). Each editable field tappable → opens edit screen. Email is read-only.
- `/profile/edit/:field` (client/src/pages/profile-edit.tsx): Single-field edit screen. All profile fields save to `PUT /api/profile-data` with exact DB column name as key.
- `GET /api/profile-stats`: Returns { matches_received, reactions_sent } counts from canonical `user_matches` table (via `getUserMatchStats`)

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

### Push Notifications (Web Push API / VAPID)
- **System**: Web Push API with VAPID keys via `web-push` npm package. No external service (Firebase/OneSignal) needed for web. Future mobile apps can add FCM/APNs tokens to the same `push_subscriptions` table.
- **Env vars**: `VITE_VAPID_PUBLIC_KEY` (shared), `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT` (shared, mailto: format)
- **Service worker**: `client/public/sw.js` — handles `push` event (shows notification) and `notificationclick` (opens app/listing URL)
- **Client utility**: `client/src/lib/push.ts` — `subscribeToPush(token)`, `unsubscribeFromPush(token)`, `isPushSupported()`, `getPushPermissionState()`, `getPushUnsupportedReason()` (returns granular reason: `iframe`, `insecure-context`, `ios-not-standalone`, `no-service-worker`, `no-notification-api`, `no-push-manager`)
- **PWA manifest**: `client/public/manifest.json` — required for iOS Home Screen install. `client/index.html` includes Apple meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`).
- **Server module**: `server/notifications/push.ts` — `initWebPush()`, `sendPushToUser()`, `sendMatchPushNotifications()` (with dedup via `push_sent_log` table)
- **Supabase tables** (migration 018):
  - `push_subscriptions`: id, user_id, endpoint (unique), p256dh, auth, created_at
  - `push_sent_log`: id, user_id, listing_id, sent_at, unique(user_id, listing_id)
  - `user_notification_settings.push_enabled` column (boolean, default false)
- **API routes**:
  - `POST /api/push/subscribe` — stores push subscription for authenticated user
  - `DELETE /api/push/subscribe` — removes push subscription by endpoint
  - `GET /api/push/vapid-key` — returns public VAPID key
  - `POST /api/admin/test-push` — sends test push to admin user (requires admin auth)
  - `GET/PUT /api/notifications/settings` — now includes `push_enabled`
- **Push trigger**: Integrated into `flushMatchAlertBuffer()` and `flushUserAlerts()` in `server/notifications/buffer.ts`. After email is sent, push is sent for the same verified listings (independent of email_enabled — uses its own push_enabled check).
- **Email/app alignment fix**: `buffer.ts` now calls `getAppVisibleListingIds()` before sending emails — applies the same premium filter, dedup, and listing existence check as `/api/matches`. A listing will only be emailed if it will also be visible in the app.
- **Debug endpoint**: `GET /api/admin/debug/match-alignment?user_id=...` — traces recent emailed vs app-visible listing IDs with per-listing exclusion reasons. Admin-only.
- **Dedup**: `push_sent_log` table prevents duplicate pushes per user+listing. Stale subscriptions (410/404) auto-removed.
- **Notification format**: German — Title: "Neue Wohnung gefunden", Body: "Eine neue Wohnung passt zu deinem Suchprofil in {{city}}." (singular) or "{{count}} neue Wohnungen passen zu deinem Suchprofil in {{city}}." (plural)
- **Settings UI**: Push toggle in `/settings/notifications` — shows browser permission state, handles denied/unsupported cases
- **PENDING**: Migration 018 must be run in Supabase SQL Editor before push features work

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
- **Per-city flush + final flush**: Matching engine buffers alerts via `server/notifications/buffer.ts` (`bufferMatchAlert`). After each city with new inserts, `flushMatchAlertBuffer` is called (per-city flush), reducing listing-to-alert latency. A final flush catches any remaining buffer at end of cycle. Dedup by `listing_id` prevents duplicate listings. Backfill uses `flushUserAlerts` for user-scoped flush. Guards: subscription check (engine + flush), alerts-disabled check at buffer entry + flush, settings-read-error = skip, flush mutex, listing existence verification, max 20 listings per email. Alerts only sent to users with active subscription (trial or paid).
- **Delivery recovery**: `recoverUndeliveredMatches()` in `buffer.ts` runs **independently on startup (15s delay) and every 5 minutes** via `scheduler.ts`. Recovery runs even if `ENABLE_INGEST_SCHEDULER` is disabled. Queries `user_matches` for rows with `email_sent=false AND push_sent=false AND visible_in_app=true AND dismissed=false` (last 24h), re-buffers them, and flushes. This handles the case where the in-memory buffer is lost due to server restart mid-ingestion. Structured logging shows per-user skip reasons (no sub, no email).
- **Stale fetch_run cleanup**: `cleanupStaleFetchRuns()` in `user-matches.ts` marks runs stuck in "running" for >5 minutes as "interrupted" on scheduler startup.
- **Admin email debug endpoint**: `GET /api/admin/debug/email-pipeline` — returns buffer state, undelivered match counts per user, and per-user delivery stats (total/emailed/pushed/pending).
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
- `index.ts` — Multi-city ingestion orchestrator: queries active cities from `search_profiles`, builds per-city ingesters, runs sources in parallel batches of 3 per city, per-city notification flush, overlap lock. Skips broken/gone sources. Tier-based inter-city delays (T1: 800ms, T2/T3: 1200ms).

Scheduler (`server/scheduler.ts`):
- `setInterval`-based, runs `runAllIngesters()` every `INGEST_INTERVAL_MINUTES` (default 5)
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
- `INGEST_INTERVAL_MINUTES` — scheduler interval in minutes (default: 5)
- `ENABLE_INGEST_SCHEDULER` — set to `true` to enable the automatic scheduler (currently enabled in shared env)

## Deployment

- **Target**: `vm` (always-on reserved VM) — required because the app runs persistent background jobs (ingestion scheduler every 5 min, email recovery, expo receipt checks). Previously was `autoscale` which could kill the scheduler between requests.
- **Build**: `npm run build`
- **Run**: `node ./dist/index.cjs`
- **IMPORTANT**: After changing env vars or code, you MUST redeploy (publish) for production to pick up changes. Shared env vars are not live-synced to running deployments.

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

### Capacitor Mobile Shell
- **App ID**: `com.housalert.app` | **App Name**: HousAlert
- **Config**: `capacitor.config.ts` — loads LOCAL bundled assets from `webDir: 'dist/public'` (NOT a remote URL)
- **API strategy**: `client/src/lib/api-base.ts` — `getApiBase()` returns `""` on web (relative paths) or `"https://app.housalert.com"` on native (absolute URL to production backend). All API calls go through `apiFetch()` which prepends the base URL for `/api/` paths and defaults `credentials: "include"`.
- **CORS**: `server/index.ts` allows Capacitor origins (`capacitor://localhost`, `https://localhost`, `http://localhost`, `ionic://localhost`) with full CRUD methods + Authorization header
- **Platforms**: `ios/` (Xcode project), `android/` (Gradle project)
- **Version**: All Capacitor packages pinned to v7 (Node 20 compatible; v8 requires Node 22+)
- **Plugins**: @capacitor/splash-screen, @capacitor/status-bar, @capacitor/push-notifications, @capacitor/preferences
- **Native helpers**: `client/src/lib/capacitor.ts` — `isNativePlatform()`, `initCapacitorPlugins()`, `registerNativePush()` (all use `window.Capacitor` directly, no static `@capacitor/core` import)
- **Auth persistence**: `client/src/lib/capacitor-storage.ts` — writes to both localStorage + Capacitor Preferences; `restoreAuthFromNative()` rehydrates on cold start
- **Init**: `client/src/main.tsx` — async bootstrap: restore auth → init plugins → dynamic import App (with error fallback screen)
- **Native routing**: `NativeAwareRoot` in `App.tsx` — native logged out → `/login`, native logged in → `/dashboard`, web → landing page
- **Service worker**: `client/public/sw.js` — web push handler, compatible with both web and native
- **Build & sync**: `npm run build && npx cap sync` — copies built web assets to native projects
- **Open IDE**: `npx cap open ios` (Xcode), `npx cap open android` (Android Studio)
- **Android permissions**: INTERNET, POST_NOTIFICATIONS, VIBRATE (in AndroidManifest.xml)
- **iOS**: content inset automatic, mobile preferred content mode, scheme "HousAlert"
- **Splash**: dark background (#1A1A1A), teal spinner (#2DD4BF), 2s duration
- **Status bar**: dark style, #1A1A1A background

## Reliability Testing

- **Test framework**: Vitest (config: `vitest.config.reliability.ts`)
- **Test files**: `tests/reliability/` — 3 test files, 16 smoke tests covering the 8 business-critical scenarios
  - `match-consistency.test.ts` — Tests 1-3: single match creation, deduplication, multi-profile dedup
  - `state-and-ordering.test.ts` — Tests 4-5: applied/unapplied state reversal, newest-first ordering
  - `backfill-and-metrics.test.ts` — Tests 6-8: backfill inflation prevention, fetch_run metrics integrity, admin debug consistency
- **Test helpers**: `tests/reliability/helpers.ts` — deterministic UUID generators, insert/query/cleanup utilities
- **Manual verification**: `tests/verify-matches.ts` — CLI script to inspect canonical match state for any user
- **Commands**:
  - Run smoke tests: `npx vitest run --config vitest.config.reliability.ts --reporter verbose`
  - Manual verify (list users): `npx tsx tests/verify-matches.ts`
  - Manual verify (specific user): `npx tsx tests/verify-matches.ts <user_id>`
- **Test data isolation**: Uses deterministic UUIDs with prefix `aaaaaaaa-bbbb-cccc-dddd-` for user_ids, cleaned up in beforeEach/afterAll

### Activation Tracking & Launch Readiness
- **`activation_events` table**: Replit PG, auto-created on startup via `server/migrations/apply.ts`. Columns: `id serial`, `user_id text`, `event_name text`, `metadata jsonb`, `created_at timestamptz`.
- **Event taxonomy**: `profile_created`, `notifications_enabled`, `first_match_viewed`, `first_reaction`, `trial_started`, `subscription_started`
- **Backend events**: `server/activation-events.ts` — `trackEvent()`, `getUserActivationStatus()`, `getActivationFunnel()`
- **Frontend events**: `client/src/lib/track-event.ts` — `trackEvent()` fires from onboarding, dashboard, apply page
- **Backend emit points**: trial creation (`/api/subscription/ensure-trial`), checkout verify, Stripe webhooks, notification settings update
- **API endpoints**: `POST /api/events` (log event), `GET /api/activation-status` (user checklist state from source-of-truth tables + events), `GET /api/admin/activation-funnel` (admin-only, source-of-truth + event funnel)
- **Activation checklist widget**: `ActivationChecklist` component in `dashboard.tsx` — shows progress bar + 4 interactive steps, hides when complete. Derives status from real DB tables (search_profiles, user_notification_settings, user_matches, subscriptions) with event fallback.
- **Match engagement nudges**: `NudgeBanners` component — shows contextual nudge for unviewed matches and viewed-but-not-reacted listings. Auto-dismisses per day.
- **Trial explanation**: Shown on onboarding AlertsStep and profile tab when user is on trial. i18n keys: `onboarding.alerts.trialNote`, `trial.explanation`, `trial.explanationDesc`.
- **Admin activation dashboard**: `/admin/activation` page — shows event-based funnel bars, source-of-truth metrics from DB (auth users, profiles, notifications, matches, reactions, trials, active subscriptions), and recent events log.
- **i18n keys added**: `activation.*`, `nudge.*`, `trial.*`, `cancellation.*` in all three locales (nl, de, en)
- **3 additional events**: `account_created` (fired from signup), `match_received` (fired from matching engine on first match creation, dedup-safe), `listing_opened` (fired from listing detail page)
- **Checklist "no match" state**: When user has a profile but 0 matches for 24+ hours, shows amber hint "filters may be too strict" with link to adjust filters
- **Explicit pricing in trial copy**: Trial messaging updated across all locales to show "14 dagen gratis — daarna vanaf €10,00/maand" (correct 14-day trial, actual lowest price)
- **Cancellation feedback flow**: When cancelling, users are asked "Heb je een woning gevonden?" with 4 options (found via HousAlert, found elsewhere, not found, other). Optional text for "other". Stored in `cancellation_feedback` table (Replit PG).
- **`cancellation_feedback` table**: Replit PG, auto-created on startup. Columns: `id serial`, `user_id text`, `reason_type text`, `reason_text text`, `found_home_via_housalert boolean`, `created_at timestamptz`.
- **Backend**: `server/cancellation-feedback.ts` — `saveCancellationFeedback()`, `getCancellationStats()`, `createCancellationFeedbackTable()`
- **API endpoints**: `POST /api/cancellation-feedback` (save feedback), `GET /api/admin/cancellation-stats` (admin-only stats)
- **Admin cancellation KPIs**: Added to admin activation dashboard — shows total cancellations, found via HousAlert, found elsewhere, not found, other, plus success percentage
