// HousAlert Service Worker
// SW_VERSION: v6 — add network-first navigation fetch handler to fix PWA nav cache
const SW_VERSION = "v6";

// On install: skip waiting immediately so the new SW activates without
// requiring all tabs to close. Critical for Safari PWA where the old SW
// (and its cached VAPID key binding) can linger indefinitely.
self.addEventListener("install", (event) => {
  console.log("[SW] Installing version", SW_VERSION);
  self.skipWaiting();
});

// On activate: claim all open clients immediately so pages controlled by
// the old SW are instantly handed to the new one. Also purge any stale
// caches left from previous versions.
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating version", SW_VERSION);
  event.waitUntil(
    Promise.all([
      // Claim all clients (tabs/windows) without waiting for reload
      self.clients.claim(),
      // Delete any old caches (future-proof if caching is ever added)
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith("housalert-v6"))
            .map((k) => {
              console.log("[SW] Deleting stale cache:", k);
              return caches.delete(k);
            })
        )
      ),
    ])
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Nieuwe woningmatch gevonden",
    body: "Er zijn nieuwe woningen die bij je zoekprofiel passen.",
    url: "/matches",
    listing_id: null,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed.title) data.title = parsed.title;
      if (parsed.body) data.body = parsed.body;
      if (parsed.listing_id) data.listing_id = parsed.listing_id;
      if (parsed.url) data.url = parsed.url;
      else if (parsed.listing_id) data.url = "/listing/" + parsed.listing_id;
    }
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url, listing_id: data.listing_id },
      tag: "housalert-match",
      renotify: true,
    })
  );
});

// ─── Navigation fetch handler ───────────────────────────────────────────────
// Chrome's installed PWA caches the start_url response in a "navigation cache"
// that is separate from both the SW cache and the HTTP cache. Without a fetch
// handler here, Chrome serves that stale navigation-cached HTML when the PWA
// is opened from the home screen — even though index.html has no-store headers.
//
// This handler intercepts every navigation (HTML page) request and always goes
// to the network first, bypassing the navigation cache. Content-hashed assets
// (JS/CSS/images) are not intercepted — the browser's HTTP cache handles those
// normally (immutable + content-hashed filenames guarantee freshness there).
self.addEventListener("fetch", (event) => {
  // Only intercept navigation requests (the initial HTML document load).
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .catch(() => {
        // Network unavailable — fall back to whatever the browser has cached.
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Last resort: serve the root index.html from cache if available.
          return caches.match("/").then((root) => root || Response.error());
        });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  let url = "/matches";
  if (notifData.listing_id) {
    url = "/listing/" + notifData.listing_id;
  } else if (notifData.url) {
    url = notifData.url;
  }

  const appOrigin = self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(appOrigin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(appOrigin + url);
    })
  );
});
