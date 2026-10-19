/* Africa of Hope PWA service worker — app-shell cache with offline fallback. */
const CACHE = "aoh-pwa-v2";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/favicon.ico", "/gebeya.webp"];

/* Brand mark (favicon + PWA icon + header logo). Cached on install and served
 * cache-first so the logo paints instantly and still shows offline. */
const BRAND_ICON =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

/* Remote assets we are happy to keep for offline use (opaque responses). */
function isRemoteAsset(url) {
  return (
    url.origin === "https://files.monstarx.app" ||
    /\.(png|jpe?g|webp|avif|svg|gif|ico)(\?|$)/i.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Cache each shell file on its own so one missing file cannot abort the rest.
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() =>
        // `no-cors` keeps a cross-origin logo cacheable; failure is harmless.
        fetch(BRAND_ICON, { mode: "no-cors" })
          .then((res) => caches.open(CACHE).then((cache) => cache.put(BRAND_ICON, res)))
          .catch(() => undefined),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network-first for navigations (so CMS content stays fresh) with cache
// fallback; cache-first for same-origin static assets; cache-first for the
// brand icon and other remote images so they load lazily from cache.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (!isRemoteAsset(url)) return;
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req, { mode: "no-cors" }).then((res) => {
            caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => undefined);
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/index.html").then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/images/"))) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        }),
    ),
  );
});
