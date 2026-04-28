// Argencargo Agente — service worker mínimo
// Solo registra la PWA para "Add to Home Screen". No cachea nada de la app
// para que siempre se sirva la última versión desde la red.

const SW_VERSION = "v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first sin cache. Si falla la red, devuelve respuesta de error simple.
self.addEventListener("fetch", (event) => {
  // Solo manejamos navegaciones GET; el resto pasa directo.
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("Sin conexión", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    })
  );
});

// Notificaciones push (placeholder para Web Push si se habilita)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Argencargo", body: event.data?.text() || "" };
  }
  const title = data.title || "Argencargo";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/agente" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/agente";
  event.waitUntil(self.clients.openWindow(url));
});
