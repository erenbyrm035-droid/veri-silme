/* Viva AI Coach — Service Worker (PWA)
 * Statik varlıklar: cache-first. Sayfalar/veri: network-first + offline fallback.
 * Supabase/API istekleri asla cache'lenmez (her zaman ağ). */
const VERSION = "viva-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

const PRECACHE = ["/", "/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Aynı origin dışı (Supabase, YouTube vb.) → dokunma, doğrudan ağ.
  if (url.origin !== self.location.origin) return;

  // API / auth → her zaman ağ (cache'leme).
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Next statik varlıklar → cache-first.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Sayfa gezinmesi → network-first, hata olursa cache/offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
  }
});
