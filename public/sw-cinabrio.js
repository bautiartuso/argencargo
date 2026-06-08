// Cinabrio — service worker mínimo para Web Push.
// La app cinabrio es chica y siempre online (es solo del owner), no precacheamos
// app shell — solo manejamos el evento push y el click.

const SW_VERSION = "v1";
const APP_CACHE = `cinabrio-${SW_VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("cinabrio-") && k !== APP_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

// Push: muestra la notificación con tag (= habit_id) para que repetir un disparo
// reemplaza la notificación anterior en vez de apilar.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Cinabrio", body: event.data?.text() || "" }; }
  const title = data.title || "Cinabrio";
  const options = {
    body: data.body || "",
    icon: "/cinabrio/icon.png",
    badge: "/cinabrio/icon.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/cinabrio" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/cinabrio";
  event.waitUntil(
    (async () => {
      // Si ya hay una ventana cinabrio abierta, enfocarla en vez de abrir otra.
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes("/cinabrio") && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
