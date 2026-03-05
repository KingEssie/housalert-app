# Stekkies — Rental Alert App

A BlaBlaCar-inspired Dutch rental alert application. Users can sign up, log in, and manage saved rental search profiles. When matching rental properties are found, they receive instant alerts.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Data:** Supabase (PostgreSQL) — `search_profiles` table
- **Backend:** Express (minimal — auth + data handled by Supabase)

## Architecture

- `client/src/lib/supabase.ts` — Supabase client with session persistence enabled
- `client/src/lib/auth.tsx` — `AuthProvider` context + `useAuth()` hook
- `client/src/lib/search-profiles.ts` — CRUD functions for `search_profiles` table
- `client/src/pages/login.tsx` — Auth page with "Inloggen" / "Account aanmaken" tabs
- `client/src/pages/dashboard.tsx` — Protected dashboard with search profiles + matches
- `client/src/pages/new-search.tsx` — Form to create a new search profile

## Required Secrets

- `VITE_SUPABASE_URL` — Supabase project URL (e.g. https://xxx.supabase.co)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Supabase Table: search_profiles

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

CREATE POLICY "Users can view own profiles"
  ON search_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles"
  ON search_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON search_profiles FOR DELETE
  USING (auth.uid() = user_id);
```

## Routes

- `/` → redirects to `/dashboard`
- `/login` — Login/signup page (Dutch UI)
- `/dashboard` — Protected; shows search profiles + matches
- `/dashboard/searches/new` — Protected; create new search profile

## Design

- Light background, centered max-w-4xl container
- Cards with subtle border and rounded corners
- Generous whitespace, clean typography (Open Sans)
- BlaBlaCar-style layout: sticky header + sectioned main content
- Primary color: blue (210 100% 48%)
- Max 4 search profiles per user
