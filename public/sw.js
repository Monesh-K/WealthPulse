/**
 * WealthPulse — Service Worker
 * Enables offline support and PWA install
 */
const CACHE_NAME = 'wealthpulse-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/vendor/chart.umd.min.js',
  '/js/app.js',
  '/js/services/api.js',
  '/js/services/auth.js',
  '/js/services/utils.js',
  '/js/services/charts.js',
  '/js/pages/dashboard.js',
  '/js/pages/assets.js',
  '/js/pages/liabilities.js',
  '/js/pages/goals.js',
  '/js/pages/transactions.js',
  '/js/pages/snapshots.js',
  '/js/pages/essentials.js',
  '/js/pages/calculators.js',
  '/js/pages/settings.js',
  '/js/pages/import.js',
  '/js/pages/marketcharts.js',
  '/js/pages/news.js',
  '/js/pages/aichat.js',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first for API and CDN, cache first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // API requests — network only (don't cache financial data)
  if (url.pathname.startsWith('/api/')) return;

  // External URLs (Google profile pics, etc.) — let the browser handle natively
  // Don't intercept — avoids CSP issues within service worker context
  if (url.hostname !== self.location.hostname) {
    return; // don't call event.respondWith — browser handles it normally
  }

  // Static assets — cache first, fast load
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Revalidate in background for next load (don't block response)
        fetch(event.request).then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              try { cache.put(event.request, response); } catch (e) { /* ignore */ }
            });
          }
        }).catch(() => {});
        return cached;
      }
      // Not in cache — fetch from network
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(event.request, clone); } catch (e) { /* ignore */ }
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
