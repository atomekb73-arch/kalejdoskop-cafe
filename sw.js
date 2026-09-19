const CACHE_NAME = 'kalejdoskop-v-tb-white';
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/styles.css?v=20260919_white",
  "/app.js?v=20260919_white",
  "/config.js?v=20260919_white",
  "/authResetFlow.js?v=20260919_white",
  "/manifest.json",
  "/logo-tb.jpg",
  "/logo-tb.png",
  "/logo-designer.jpg",
  "/logo-designer.png",
  "/logo.png",
  "/logo-cube.png",
  "/logo192.png",
  "/logo512.png",
  "/Kalejdoskop.jpg",
  "/og-thumb.jpg",
  "/icons/logo-tb.jpg",
  "/icons/logo-tb.png",
  "/icons/logo-designer.jpg",
  "/icons/logo-designer.png",
  "/icons/logo.png",
  "/icons/logo-cube.png",
  "/icons/Kalejdoskop.jpg",
  "/icons/og-thumb.jpg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/favicon-32x32.png",
  "/icons/favicon-16x16.png",
  "/icons/apple-touch-icon.png",
  "/images/cube-repo-hero.webp",
  "/images/cube-repo-hero.png",
  "/apple-touch-icon.png",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/favicon.png",
  "/favicon.ico"
];

// Wymuszenie natychmiastowej aktywacji nowego Service Workera
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Nie czekaj na zamknięcie kart – instaluj od razu
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Usuń wszystkie stare wersje pamięci podręcznej oprócz bieżącej
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Przejmij kontrolę nad wszystkimi otwartymi oknami natychmiast
  );
});

// Obsługa wiadomości do wymuszenia skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Strategia Network-First dla zapytań do API Apps Script (żadnego starego cache dla bazy!)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('script.google.com') || url.includes('/exec')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Ignorujemy pozostałe zewnętrzne serwisy CDN
  if (
    url.includes('googleusercontent.com') ||
    url.includes('googleapis.com') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('cdn.tailwindcss.com')
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
