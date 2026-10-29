// Sesión en las llamadas a /api (28/10/2026): las pantallas llamaban a varias rutas del servidor
// sin mandar la sesión, y esas rutas quedaban abiertas a cualquiera. Este parche agrega el token
// del panel (leído del localStorage de cada panel) a todo fetch a /api que no traiga uno, así las
// rutas pueden exigir sesión sin tocar cada llamada.
// refrescar (29/10/2026): si el token guardado ya venció, se renueva antes de llamar (el portal pasa su
// ensureFreshToken); sin eso las rutas respondían "no_auth" pasada la hora (lector de facturas).
const vencido = (t) => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000 < Date.now() + 60000; } catch { return false; } };
export function instalarAuthFetch(claves, { refrescar = null } = {}) {
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
          if (tok && refrescar && vencido(tok)) {
            const base = init;
            return Promise.resolve(refrescar(tok)).catch(() => tok).then((nt) => { h.set("Authorization", `Bearer ${nt || tok}`); return orig(input, { ...base, headers: h }); });
          }
          if (tok) { h.set("Authorization", `Bearer ${tok}`); init = { ...init, headers: h }; }
        }
      }
    } catch {}
    return orig(input, init);
  };
  window.__acAuthFetch = true;
}
