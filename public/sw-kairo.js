// Kairo — service worker mínimo para Web Push (fin de descanso, etc.). Sin caché de la app.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Kairo", body: event.data?.text() || "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Kairo", {
    body: data.body || "",
    icon: "/kairo-icon-192.png",
    badge: "/kairo-icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/kairo" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/kairo";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (c.url.includes("/kairo") && "focus" in c) return c.focus();
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
