---
name: SherryFitz URL formats and district-city matching
description: SherryFitz sitemap uses two path formats and stores cities like Swords/Bray/Drogheda as districts under county cities — parser must handle both.
---

# SherryFitz sitemap URL formats

## The rule
Two URL formats coexist in the SherryFitz sitemap:
- **5-part (standard):** `/rent/TYPE/CITY/DISTRICT/SLUG` — type is a known property type slug
- **4-part (type-less):** `/rent/CITY/DISTRICT/SLUG` — parts[1] is a county/city, not a type

Distinguish them by checking if `parts[1]` is in `KNOWN_PROPERTY_TYPES` set.

## District-as-city pattern
Several Irish launch cities are stored as *districts* under a county city, not as top-level city slugs:
- Swords → `/rent/TYPE/dublin/swords/SLUG`
- Bray → `/rent/TYPE/wicklow/bray/SLUG` or `/rent/TYPE/dublin/bray/SLUG`
- Drogheda → `/rent/TYPE/meath/drogheda/SLUG`

The sitemap filter `url.includes('/swords/')` correctly FINDS these; the old parser rejected them because `urlCitySlug !== expectedCitySlug`. Fix: accept when `district === expectedCitySlug` and set `city = toTitleCase(expectedCitySlug)`.

**Why:** SherryFitz's sitemap reflects Irish administrative geography — Swords is in County Dublin, Bray is in County Wicklow, Drogheda is in County Meath. Without district matching, all three cities show normalized=0 despite the sitemap having their listings.

**How to apply:** When modifying `parseListingFromUrl`, always check both `matchesByCity` and `matchesByDistrict`. Never reject solely on `urlCitySlug !== expectedCitySlug`.

## PropertyPal county URL overrides
Some cities lack a PropertyPal city-level page (404) or have very thin coverage. Working county-level alternatives (HTTP 200):
- `county-louth` → covers Drogheda/Dundalk area
- `county-galway` → covers Galway area
- `county-limerick` → covers Limerick area
- `county-wicklow` → 404 (does NOT work for Bray)

Configured in `COUNTY_URL_OVERRIDES` map inside `server/sources/ireland/propertypal/index.ts`. Env var `PROPERTYPAL_{CITY}_RENT_URL` takes precedence.

## Supabase listings RLS note
The `listings` table in Supabase has RLS that blocks the anon key — it returns count=0 for all cities. Always use `SUPABASE_SERVICE_ROLE_KEY` for admin queries. The public API endpoint already uses the service role key.

## 24h delayed preview
All non-Dublin listings have `delayed=0` immediately after insertion because the public API applies a `lte("created_at", now-24h)` filter. This is intentional. Non-Dublin inventory becomes visible ~24h after first ingestion.
