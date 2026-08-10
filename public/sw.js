// ChatCommerce CRM Africa — Service Worker
// Version: 1.0.0

const CACHE_NAME = "cc-crm-v1";
const STATIC_CACHE = "cc-static-v1";
const API_CACHE = "cc-api-v1";

// Static assets to pre-cache
const STATIC_ASSETS = ["/", "/manifest.json", "/icons/icon-192.svg", "/icons/icon-512.svg"];

// ─── Install: pre-cache static assets ───
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ───
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith("http")) return;

  // SSE requests — pass through (never cache)
  if (url.pathname.includes("/api/notifications/stream")) {
    return;
  }

  // API calls — Network First strategy
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — Cache First strategy
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages — Network First with offline fallback
  event.respondWith(
    networkFirst(request, STATIC_CACHE, 3000).catch(() =>
      caches.match("/")
    )
  );
});

// ─── Cache First Strategy ───
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Hors ligne", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ─── Network First Strategy ───
async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Race network vs timeout
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve(cached), timeoutMs)
  );

  const response = await Promise.race([networkPromise, timeoutPromise]);
  if (!response) {
    throw new Error("Aucune réponse disponible");
  }
  return response;
}

// ─── Push Notification handling (future) ───
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || "ChatCommerce CRM";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    vibrate: [200, 100, 200],
    tag: data.tag || "notification",
    data: data.url ? { url: data.url } : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click: open app ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(urlToOpen);
      })
  );
});
