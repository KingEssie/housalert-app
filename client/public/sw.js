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
