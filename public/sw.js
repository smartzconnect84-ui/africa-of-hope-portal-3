/* AFRICA OF HOPE — PWA service worker.
 *
 * One worker, three caches:
 *   shell  — the app shell + offline page (network-first navigations)
 *   assets — hashed build files (immutable, cache-first)
 *   images — brand logo and public imagery (stale-while-revalidate, capped)
 *
 * Anything authenticated or dynamic (Supabase REST/Auth/Storage, API calls) is
 * never touched by this worker, so private student and admin data can never be
 * served from a cache.
 */
const VERSION = "v5";
const SHELL_CACHE = `aoh-shell-${VERSION}`;
const ASSET_CACHE = `aoh-assets-${VERSION}`;
const IMAGE_CACHE = `aoh-images-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE];

const OFFLINE_URL = "/offline.html";
const SHELL = ["/", "/index.html", OFFLINE_URL, "/manifest.webmanifest"];
const NAV_TIMEOUT = 5000;
const IMAGE_CACHE_LIMIT = 60;

/* The official brand mark (same transparent logo used by the site header). */
const BRAND_ICON =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|svg|gif|ico)$/i;

/** Requests that must always go straight to the network. */
function isPrivateRequest(url) {
  return (
    /\/(auth|rest|storage|realtime|functions)\/v1\//.test(url.pathname) ||
    /supabase\.(co|in)$/.test(url.hostname) ||
    /googleapis\.com$/.test(url.hostname) ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("token") ||
    url.searchParams.has("access_token")
  );
}

function isRemoteImage(url) {
  return url.hostname === "files.monstarx.app" || IMAGE_EXT.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Cache each shell file on its own so one missing file cannot abort the rest.
      .then((cache) => Promise.all(SHELL.map((path) => cache.add(path).catch(() => undefined))))
      .then(() =>
        // `no-cors` keeps the cross-origin logo cacheable; failure is harmless.
        fetch(BRAND_ICON, { mode: "no-cors" })
          .then((res) => caches.open(IMAGE_CACHE).then((cache) => cache.put(BRAND_ICON, res)))
          .catch(() => undefined),
      ),
  );
  // A waiting worker stays idle until the page asks to update (see `message`).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("aoh-") && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ------------------------------------------------------------ push (f65) */

/**
 * Deadline reminders. The payload is JSON: { title, body, url, tag }.
 * Shown with the brand mark so an alert is recognisable on the lock screen.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "AFRICA OF HOPE reminder";
  const options = {
    body: payload.body || "You have an upcoming deadline in the student portal.",
    icon: BRAND_ICON,
    badge: BRAND_ICON,
    tag: payload.tag || "aoh-reminder",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/** Tapping a reminder focuses the open app, or opens the reminder's page. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = self.location.origin + "/";
  try {
    const requested = new URL(event.notification.data?.url || "/", self.location.origin);
    if (requested.origin === self.location.origin) target = requested.href;
  } catch { /* invalid payload: open home */ }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate?.(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/** Keeps the image cache from growing without bound on low-storage phones. */
async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - IMAGE_CACHE_LIMIT).map((key) => cache.delete(key)));
}

async function fromCache(request) {
  return (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
}

/** Network-first with a timeout so a flaky connection still renders offline. */
async function networkFirstNavigation(request) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT)),
    ]);
    if (response && response.ok) {
      const copy = response.clone();
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.put("/index.html", copy))
        .catch(() => undefined);
    }
    return response;
  } catch {
    // Any SPA route is served from the cached shell, then the offline page.
    return (
      (await caches.match("/index.html")) ||
      (await caches.match("/")) ||
      (await caches.match(OFFLINE_URL)) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
  }
  return response;
}

async function staleWhileRevalidateImage(request) {
  const cached = await caches.match(request);
  const network = fetch(request, { mode: "no-cors" })
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        const copy = response.clone();
        caches
          .open(IMAGE_CACHE)
          .then((cache) => cache.put(request, copy))
          .then(trimImageCache)
          .catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isPrivateRequest(url)) return; // never cached, never intercepted

  if (url.origin !== self.location.origin) {
    if (!isRemoteImage(url)) return;
    event.respondWith(staleWhileRevalidateImage(request));
    return;
  }

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    // Vite emits content-hashed filenames, so these are safe to keep forever.
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  if (IMAGE_EXT.test(url.pathname) || request.destination === "image") {
    event.respondWith(staleWhileRevalidateImage(request));
    return;
  }

  // Fonts, manifest and other static files: cache-first, refreshed in the background.
  if (/\.(woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstAsset(request));
  }
  // Worker, manifest, JSON and non-hashed scripts must remain network-fresh.
});
