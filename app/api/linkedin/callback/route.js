// GET /api/linkedin/callback — vuelta del OAuth de LinkedIn: guarda el token y vuelve al admin
// (Content Studio → Conexión) con ?li=ok o ?li=error&msg=…
import { liCallback } from "../../../../lib/linkedin";
import { BASE_URL } from "../../../../lib/studio";
export const runtime = "nodejs";
export async function GET(req) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state") || "";
  const err = u.searchParams.get("error_description") || u.searchParams.get("error");
  const back = (ok, msg) => Response.redirect(`${BASE_URL}/admin?page=studio&li=${ok ? "ok" : "error"}${msg ? `&msg=${encodeURIComponent(String(msg).slice(0, 200))}` : ""}`, 302);
  if (err || !code) return back(false, err || "LinkedIn no devolvió el código");
  try { const cfg = await liCallback({ code, state }); return back(true, cfg.name || ""); }
  catch (e) { return back(false, e.message); }
}
