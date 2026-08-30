// Service Worker - Kalejdoskop Café PWA
const CACHE_NAME = "kalejdoskop-pwa-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/config.js",
  "/js/apiService.js",
  "/js/config.js",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("PWA: niektore zasoby nie mogly zostac zachowane w cache:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorujemy zapytania do Google Apps Script i zewnętrznych API (zawsze sieć)
  if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com") || url.hostname.includes("googleapis.com")) {
    return;
  }

  // Network First ze spadkiem do Cache dla zasobów aplikacji
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === "GET") {
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
});
