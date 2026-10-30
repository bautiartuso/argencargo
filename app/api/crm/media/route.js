// GET /api/crm/media?id=<media_id> — una foto, audio o documento de un chat del CRM.
// Meta guarda los archivos; acá no se copian a Supabase (egress al mínimo): se piden a Meta recién
// cuando alguien abre el adjunto y se devuelven en el momento. La URL de Meta vence a los 5 minutos,
// por eso se resuelve siempre de nuevo.
import { usuarioConRol } from "../../../../lib/auth-server";
import { GRAPH_CRM } from "../../../../lib/crm-wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
async function tokenCrm() {
  const k = process.env.SUPABASE_SERVICE_ROLE;
  const r = await fetch(`${SB_URL}/rest/v1/crm_numbers?select=token&status=eq.conectado&token=not.is.null&order=connected_at.desc&limit=1`, { headers: { apikey: k, Authorization: `Bearer ${k}` }, cache: "no-store" }).then((x) => x.json()).catch(() => []);
  return Array.isArray(r) && r[0]?.token ? r[0].token : null;
}

export async function GET(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d+$/.test(id)) return Response.json({ error: "id inválido" }, { status: 400 });
  const token = await tokenCrm();
  if (!token) return Response.json({ error: "El número no está conectado" }, { status: 409 });
  const meta = await fetch(`${GRAPH_CRM}/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json()).catch(() => null);
  if (!meta?.url) return Response.json({ error: meta?.error?.message || "Meta ya no tiene este archivo" }, { status: 404 });
  const f = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!f.ok) return Response.json({ error: `Meta devolvió ${f.status}` }, { status: 502 });
  return new Response(f.body, { status: 200, headers: { "Content-Type": meta.mime_type || f.headers.get("content-type") || "application/octet-stream", "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline" } });
}
