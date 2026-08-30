const CACHE_NAME = "kalejdoskop-v3.0.0";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/config.js",
  "/manifest.json",
  "/logo.png",
  "/logo192.png",
  "/logo512.png",
  "/apple-touch-icon.png",
  "/favicon.png",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorujemy zapytania do Google Apps Script i zewnętrznych serwisów API
  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("cdn.tailwindcss.com")
  ) {
    return;
  }

  // Network-First ze spadkiem do Cache dla zasobów aplikacji
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("/index.html");
            }
          });
        })
    );
  }
});
