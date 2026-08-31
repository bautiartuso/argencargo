// GET /api/facturas/padron?cuit=XXXXXXXXXXX — datos del receptor desde el padrón de ARCA
// (razón social, domicilio fiscal y condición IVA), como el autocompletar de
// Comprobantes en línea. Admin only.

import { arcaReady, arcaConfig, consultarPadron } from "../../../../lib/arca";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 30;

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const r = await fetch(`${SB_URL}/rest/v1/profiles?select=role&id=eq.${payload.sub}`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
    const p = await r.json();
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!arcaReady()) return Response.json({ error: "ARCA sin configurar" }, { status: 500 });
  const cuit = String(new URL(req.url).searchParams.get("cuit") || "").replace(/\D/g, "");
  if (cuit.length !== 11) return Response.json({ error: "CUIT inválido (11 dígitos)" }, { status: 400 });
  const cfg = await arcaConfig();
  const env = cfg?.environment === "produccion" ? "produccion" : "homologacion";
  try {
    const d = await consultarPadron(cuit, env);
    return Response.json({ ok: true, ...d });
  } catch (e) {
    return Response.json({ error: String(e.message) }, { status: 502 });
  }
}
