# Stekkies — Rental Alert App

A BlaBlaCar-inspired Dutch rental alert application. Users can sign up, log in, and manage saved rental search profiles. Listings are matched against profiles and shown as matches.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — `search_profiles`, `listings`, `matches` tables
- **Backend:** Express (minimal — auth + data handled by Supabase)

## Architecture

- `client/src/lib/supabase.ts` — Supabase client with session persistence enabled
- `client/src/lib/auth.tsx` — `AuthProvider` context + `useAuth()` hook
- `client/src/lib/search-profiles.ts` — CRUD functions for `search_profiles` table
- `client/src/lib/listings.ts` — Listings CRUD, matches CRUD, and client-side matching logic
- `client/src/pages/login.tsx` — Auth page with "Inloggen" / "Account aanmaken" tabs
- `client/src/pages/dashboard.tsx` — Protected dashboard with search profiles, matches, and test listing modal
- `client/src/pages/new-search.tsx` — Form to create a new search profile

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

## Email Alerts

When a new match is created, the app sends an email alert via Resend (Replit integration):
- `server/email.ts` — `sendMatchAlert(userEmail, listing)` using the Resend connector
- `server/routes.ts` — `POST /api/match-alert` endpoint called by the client after a match
- One email per listing match (not per profile match — deduped via `alertSent` flag)

## WG-Gesucht Ingestion

- `server/ingest-wg-gesucht.ts` — Scraper module for Berlin rental listings
- `POST /api/ingest/wg-gesucht` — Triggers one ingestion cycle
- Fetches the public WG-Gesucht Berlin apartments search results page (1 request per run, polite User-Agent)
- Parses: title, URL, price, bedrooms (Zimmer), size (m²), source_id from data-id attribute
- Dedup: checks by `source` + `source_id` (if column exists) AND by `url`
- After inserting new listings, runs server-side matching logic against all users' search profiles
- Sends email alerts via Resend for new matches

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

## Design

- Light background, centered max-w-4xl container
- Cards with subtle border and rounded corners
- Generous whitespace, clean typography (Open Sans)
- BlaBlaCar-style layout: sticky header + sectioned main content
- Primary color: blue (210 100% 48%)
- Max 4 search profiles per user
