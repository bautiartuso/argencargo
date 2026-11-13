// Service worker de la app de reparto: solo recibe las notificaciones y abre la app al tocarlas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Reparto", { body: d.body || "", icon: "/reparto-icon.png", badge: "/reparto-icon.png", tag: d.tag || undefined, data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    const abierta = ws.find((w) => w.url.includes(url));
    return abierta ? abierta.focus() : self.clients.openWindow(url);
  }));
});
