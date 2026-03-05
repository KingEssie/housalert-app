# Stekkies — Rental Alert App

A BlaBlaCar-inspired Dutch rental alert application. Users can sign up, log in, and manage saved searches. When matching rental properties are found, they receive instant alerts.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Wouter
- **Auth:** Supabase Auth (email + password)
- **Backend:** Express (minimal — auth handled by Supabase)

## Architecture

- `client/src/lib/supabase.ts` — Supabase client (uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `client/src/lib/auth.tsx` — `AuthProvider` context + `useAuth()` hook
- `client/src/pages/login.tsx` — Auth page with "Inloggen" / "Account aanmaken" tabs
- `client/src/pages/dashboard.tsx` — Protected dashboard with search and match sections

## Required Secrets

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Routes

- `/` → redirects to `/dashboard`
- `/login` — Login/signup page (Dutch UI)
- `/dashboard` — Protected; redirects to `/login` if unauthenticated

## Design

- Light background, centered max-w-4xl container
- Cards with subtle border and rounded corners
- Generous whitespace, clean typography (Open Sans)
- BlaBlaCar-style layout: sticky header + sectioned main content
- Primary color: blue (210 100% 48%)
