---
name: user_profile_data schema
description: user_profile_data is in Replit PG, has no email column — email is Supabase auth only.
---

## The Rule
Never query `upd.email` from `user_profile_data` via pgPool. The table has no `email` column. Email is stored only in Supabase `auth.users` which is not accessible from Replit PG queries.

**Why:** Causes `column upd.email does not exist` PostgreSQL error → 500 on any endpoint that does the JOIN.

**Columns that DO exist:** user_id, search_buddy_email, application_template, document_checklist, first_name, last_name, birth_date, phone, bio, profile_photo_url, occupation, monthly_income, and various boolean flags.

**How to get user email in admin queries:** Use `supabase.auth.admin.getUserById(userId)` or `supabase.auth.admin.listUsers()` separately, then merge in application code.
