// Sesión en las llamadas a /api (28/10/2026): las pantallas llamaban a varias rutas del servidor
// sin mandar la sesión, y esas rutas quedaban abiertas a cualquiera. Este parche agrega el token
// del panel (leído del localStorage de cada panel) a todo fetch a /api que no traiga uno, así las
// rutas pueden exigir sesión sin tocar cada llamada.
export function instalarAuthFetch(claves) {
  if (typeof window === "undefined" || window.__acAuthFetch) return;
  const orig = window.fetch.bind(window);
  const leer = () => {
    for (const k of claves) {
      try {
        const d = JSON.parse(localStorage.getItem(k) || "null");
        const t = d?.token || d?.access_token;
        if (t) return t;
      } catch {}
    }
    return null;
  };
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      const propio = url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);
      if (propio) {
        const h = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
        if (!h.has("authorization")) {
          const tok = leer();
          if (tok) { h.set("Authorization", `Bearer ${tok}`); init = { ...init, headers: h }; }
        }
      }
    } catch {}
    return orig(input, init);
  };
  window.__acAuthFetch = true;
}
