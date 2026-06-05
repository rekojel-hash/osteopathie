// ─── SERVICE WORKER — Osteopathie v3 ─────────────────────────────────────────
const CACHE_NAME = "osteopathie-v3";

// Assets locaux mis en cache à l'installation
const LOCAL_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// CDN externe — mis en cache au premier accès (pas à l'install)
const CDN_CACHE = "osteopathie-cdn-v3";
const CDN_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"
];

// ── Installation ──────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  console.log("[SW] Install — cache:", CACHE_NAME);
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(LOCAL_ASSETS)),
      caches.open(CDN_CACHE).then(cache => cache.addAll(CDN_URLS))
    ]).then(() => self.skipWaiting())
  );
});

// ── Activation — purge anciens caches ─────────────────────────────────────────
self.addEventListener("activate", event => {
  console.log("[SW] Activate — nettoyage");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => { console.log("[SW] Suppression:", k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — Cache-first avec revalidation en arrière-plan ─────────────────────
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // CDN externe : cache-first strict (les versions ne changent pas)
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res && res.status === 200) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Assets locaux : cache-first + revalidation silencieuse
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          if (res && res.status === 200) cache.put(event.request, res.clone());
          return res;
        }).catch(() => null);

        return cached || fetchPromise.then(res => res || cache.match("./index.html"));
      })
    )
  );
});
