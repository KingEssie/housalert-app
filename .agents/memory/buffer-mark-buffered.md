---
name: markBuffered must be fire-and-forget
description: bufferMatchAlert is synchronous; markBuffered must be called with .catch(() => {}) not awaited
---

## Rule
`bufferMatchAlert(userId, email, listing)` is declared `void` (sync). Any async DB call inside it must be fire-and-forget: `markBuffered(userId, [listing.listing_id]).catch(() => {})`.

**Why:** Making it `async` would change its call signature and break all callers in the match engine (which call it without await). A thrown promise in a void context creates an unhandled rejection.

**How to apply:** Place the `.catch(() => {})` call at the end of `bufferMatchAlert`, after the buffer.set/push. Do NOT convert the function to async.
