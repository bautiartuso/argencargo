// Argencargo Agente — service worker con soporte offline
// Cachea app shell para que el agente pueda usar la PWA sin conexión.
// La queue de paquetes pendientes se maneja en lib/offline-queue.js (IndexedDB del cliente).

const SW_VERSION = "v3-offline";
const APP_CACHE = `ac-agente-${SW_VERSION}`;

// Recursos a precachear (mínimo para que la app cargue offline)
const PRECACHE = [
  "/agente",
  "/icon.png",
  "/icon-pwa.png",
  "/manifest-agente.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("ac-agente-") && k !== APP_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: network-first con fallback a cache para navegación.
// Para assets estáticos: cache-first.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Solo cachear de same-origin (no externos como Supabase)
  if (url.origin !== self.location.origin) return;

  // No cachear API calls — siempre red
  if (url.pathname.startsWith("/api/")) return;

  // Navegación HTML: network-first
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/agente")))
    );
    return;
  }

  // Assets estáticos: cache-first con fallback red
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|svg|ico)$/)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => new Response("", { status: 503 }))
      )
    );
    return;
  }

  // Default: red, fallback cache
  event.respondWith(fetch(req).catch(() => caches.match(req) || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain" } })));
});

// Mensaje desde la app: trigger sync queue
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Push notifications (sin cambios)
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Argencargo", body: event.data?.text() || "" }; }
  const title = data.title || "Argencargo";
  const options = { body: data.body || "", icon: "/icon.png", badge: "/icon.png", data: { url: data.url || "/agente" } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/agente";
  event.waitUntil(self.clients.openWindow(url));
});
