// Cliente Supabase mínimo compartido entre módulos del admin.
// Extraído de app/admin/page.js (que mantiene su copia inline por estabilidad).

export const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
export const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export const sf = async (p, o = {}) => {
  const r = await fetch(`${SB_URL}${p}`, { ...o, headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(o.headers || {}) } });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return null; }
};

export const ac = async (endpoint, body) => sf(`/auth/v1/${endpoint}`, { method: "POST", body: JSON.stringify(body) });

// Sessions (clave compartida con admin/page.js: 'ac_admin')
export const saveSession = (d) => { try { localStorage.setItem("ac_admin", JSON.stringify(d)); } catch {} };
export const loadSession = () => { try { const d = localStorage.getItem("ac_admin"); return d ? JSON.parse(d) : null; } catch { return null; } };
export const clearSession = () => { try { localStorage.removeItem("ac_admin"); } catch {} };

const jwtExp = (t) => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch { return 0; } };

let _refreshingPromise = null;
const refreshToken = async () => {
  if (_refreshingPromise) return _refreshingPromise;
  _refreshingPromise = (async () => {
    const s = loadSession(); if (!s?.refresh_token) return null;
    const r = await ac("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    if (r?.access_token) { const ns = { ...s, token: r.access_token, refresh_token: r.refresh_token || s.refresh_token, user: r.user || s.user }; saveSession(ns); return ns.token; }
    clearSession(); if (typeof window !== "undefined") window.location.reload(); return null;
  })();
  try { return await _refreshingPromise; } finally { _refreshingPromise = null; }
};

const ensureFreshToken = async (token) => {
  const exp = jwtExp(token);
  if (exp && Date.now() > exp - 60000) {
    const s = loadSession();
    if (s?.token && jwtExp(s.token) > Date.now() + 60000) return s.token;
    const nt = await refreshToken(); if (nt) return nt;
  }
  return token;
};

const _sanitizeBody = (b) => {
  if (!b || typeof b !== "object" || Array.isArray(b)) return b;
  const out = {}; for (const k in b) { const v = b[k]; out[k] = v === "" ? null : v; } return out;
};

export const dq = async (table, { method = "GET", body, token, filters = "", headers: h = {} } = {}) => {
  const fresh = await ensureFreshToken(token);
  const cleanBody = (method === "PATCH" || method === "POST") ? _sanitizeBody(body) : body;
  const doReq = async (tk) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${filters}`, {
      method,
      body: cleanBody ? JSON.stringify(cleanBody) : undefined,
      headers: {
        apikey: SB_KEY, "Content-Type": "application/json",
        Authorization: `Bearer ${tk}`,
        ...(method === "POST" ? { Prefer: "return=representation" } : method === "DELETE" ? { Prefer: "return=minimal" } : method === "PATCH" ? { Prefer: "return=representation" } : {}),
        ...h,
      },
    });
    const txt = await r.text(); let parsed = null; try { parsed = JSON.parse(txt); } catch {}
    if (r.status >= 400) console.error(`[dq] ${method} ${table} ${r.status}`, parsed);
    return { status: r.status, body: parsed };
  };
  let r = await doReq(fresh);
  if (r.status === 401) { const nt = await refreshToken(); if (nt) r = await doReq(nt); }
  return r.body;
};
