// Kill-switch service worker.
//
// A previous deploy registered a Workbox service worker that cached an old
// index.html, causing browsers to load stale/nonexistent assets (e.g.
// main.<oldhash>.js -> "Unexpected token '<'"). The app no longer uses a
// service worker. This file replaces the old one at the same /service-worker.js
// path: it takes control, clears all caches, unregisters itself, and reloads
// open clients so already-affected browsers self-heal automatically.
//
// Safe to keep indefinitely. It can be removed once you're confident no users
// still have the old service worker cached.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache the old SW created.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Stop controlling pages, then reload them so they fetch fresh assets.
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
