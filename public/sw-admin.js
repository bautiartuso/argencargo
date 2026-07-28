// Argencargo Admin — service worker solo para Web Push.
// El panel admin no necesita funcionar offline (a diferencia del de agente, que se usa en el
// depósito), así que este SW no cachea nada: solo recibe los push y abre el panel al tocarlos.
// Sin este archivo registrado no hay forma de recibir notificaciones en el admin, por mucho que
// se envíen desde el servidor.

const SW_VERSION = "v1-push";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Argencargo", body: event.data?.text() || "" };
  }
  const title = data.title || "Argencargo";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/admin" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  // Si el panel ya está abierto en una pestaña, la enfocamos en vez de abrir otra.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
