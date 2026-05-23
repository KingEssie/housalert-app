---
name: MyHome Path 2 for-sale contamination
description: MyHome fetcher Path 2 (Angular SSR brochure link parser) was inserting for-sale homepage listings as Dublin rentals; fix pattern and cleanup steps.
---

## Rule
Always validate rental-page context before trusting brochure links from MyHome.

MyHome with render=true redirects to the homepage (featured for-sale properties: Cork, Wicklow, Galway, Kerry) — NOT rental search results. Path 2 found `/residential/brochure/...` links in that response and inserted them as rentals.

## Fix applied (myhome/index.ts)
Before returning any brochure links from Path 2, check `isRentalPage`:
- `html.includes("transactionType=3")`
- `html.includes("to-let")`
- `html.includes('"transactionTypeId":3')`
- `html.includes('"propertyType":"Apartment to Let"')`
If none match, log "homepage redirect" and discard all links.

**Why:** MyHome render=true silently redirects to homepage; brochure link regex matches both for-sale and for-rent URLs with no way to tell them apart without page-level context signals.

**How to apply:** Any future MyHome scraping work must first confirm the response is a rental search result page before parsing listing URLs.

## Data cleanup (May 2026)
40 user_matches rows inserted from homepage for-sale listings were marked `visible_in_app=false, suppression_reason='bad_source_data'` via direct SQL. Two users affected (IDs: acb0a5e8, 552ce205). Email not yet sent for any of them.
