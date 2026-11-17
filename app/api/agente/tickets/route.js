// /api/agente/tickets — tickets entre Argencargo y el agente (17/11/2026).
// Cada ticket es un tema con su chat: se abre, se conversa (con fotos) y se cierra.
//   GET                    → lista (el equipo ve todos; el agente, los suyos) + cuántos esperan respuesta
//   GET ?id=<ticket>       → el ticket con sus mensajes (y lo marca visto para quien lo abre)
//   POST {accion:"crear", agent_id?, titulo, texto, fotos}
//   POST {accion:"mensaje", ticket_id, texto, fotos}
//   POST {accion:"cerrar"|"reabrir", ticket_id}
//   POST multipart (file)  → sube una foto al bucket "tickets" y devuelve su URL
// Cada texto se guarda con su traducción (castellano ↔ chino) para que cada lado lo lea en su idioma.
// Avisos: al agente, campana + push; a Bautista, campana + Telegram.
import { quienLlama } from "../../../../lib/auth-server";
import { callClaudeText, HAIKU_MODEL } from "../../../../lib/anthropic";
import { tgNotify } from "../../../../lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const BUCKET = "tickets";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sb = async (path, init = {}) => {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { ...init, cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, body: j };
};
const filas = (r) => (Array.isArray(r.body) ? r.body : []);

// Quién llama: el equipo (admin/empleado) o un agente. Nadie más entra.
async function quien(req) {
  const yo = await quienLlama(req);
  if (!yo) return null;
  if (yo.staff) return { id: yo.id, rol: "admin" };
  if (yo.role === "agente") return { id: yo.id, rol: "agente" };
  return null;
}

// Castellano ↔ chino. Si falla o no hace falta, null (se muestra solo el original).
async function traducir(texto, rol) {
  const t = String(texto || "").trim();
  if (!t) return null;
  try {
    const out = await callClaudeText({
      model: HAIKU_MODEL, feature: "ticket_traducir", max_tokens: 1500,
      system: rol === "admin"
        ? "Traducís al chino simplificado un mensaje de trabajo que una empresa argentina de importaciones le escribe a su agente de carga en China. Tono directo y cordial. No traduzcas ni cambies códigos, números de tracking, guías, nombres de clientes, medidas ni montos. Si el mensaje ya está en chino, devolvelo igual. Respondé SOLO con la traducción, sin comillas ni comentarios."
        : "Traducís al castellano rioplatense un mensaje de trabajo que un agente de carga en China le escribe a una empresa argentina de importaciones (puede venir en chino, inglés o mezclado). Tono directo. No traduzcas ni cambies códigos, números de tracking, guías, nombres, medidas ni montos. Si el mensaje ya está en castellano, devolvelo igual. Respondé SOLO con la traducción, sin comillas ni comentarios.",
      user: t.slice(0, 4000),
    });
    const tr = String(out || "").trim();
    return tr && tr !== t ? tr.slice(0, 6000) : null;
  } catch { return null; }
}

const soloFotos = (v) => (Array.isArray(v) ? v : []).map((u) => String(u || "")).filter((u) => u.startsWith(`${SB_URL}/storage/v1/object/public/${BUCKET}/`)).slice(0, 12);
const recorte = (t, fotos) => (String(t || "").trim() || (fotos.length ? `📎 ${fotos.length} adjunto${fotos.length !== 1 ? "s" : ""}` : "")).slice(0, 140);

// Aviso al otro lado. Nunca frena la respuesta.
async function avisar(req, ticket, rol, texto, textoTr, nuevo) {
  try {
    const cod = `#${ticket.numero}`;
    if (rol === "admin") {
      const title = nuevo ? `🎫 ${cod} · ${ticket.titulo_tr || ticket.titulo}` : `💬 ${cod} · ${ticket.titulo_tr || ticket.titulo}`;
      const body = (textoTr || texto || "").slice(0, 180) || null;
      await sb(`/notifications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: ticket.agent_id, portal: "agente", title, body, link: "?tab=tickets" }) });
      const origen = new URL(req.url).origin;
      await fetch(`${origen}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") || "" }, body: JSON.stringify({ user_id: ticket.agent_id, portal: "agente", title, body, url: "/agente?tab=tickets", tag: `ticket-${ticket.id}` }) }).catch(() => {});
    } else {
      const adm = filas(await sb(`/profiles?role=eq.admin&select=id`));
      const title = nuevo ? `🎫 El agente abrió el ticket ${cod}` : `💬 El agente respondió el ticket ${cod}`;
      const body = `${ticket.titulo_tr || ticket.titulo}${textoTr || texto ? ` — ${(textoTr || texto).slice(0, 160)}` : ""}`;
      for (const a of adm) await sb(`/notifications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: a.id, portal: "admin", title, body, link: null }) });
      const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await tgNotify(`${nuevo ? "🎫 <b>El agente abrió un ticket</b>" : "💬 <b>El agente respondió</b>"} · ${cod}\n<b>${esc(ticket.titulo_tr || ticket.titulo)}</b>${textoTr || texto ? `\n${esc((textoTr || texto).slice(0, 600))}` : ""}`).catch(() => {});
    }
  } catch (e) { console.error("[tickets] aviso", e?.message); }
}

const esperaAdmin = (t) => t.status === "abierto" && t.ultimo_rol === "agente";
const esperaAgente = (t) => t.status === "abierto" && t.ultimo_rol === "admin";

export async function GET(req) {
  const yo = await quien(req);
  if (!yo) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  const mio = yo.rol === "agente" ? `&agent_id=eq.${yo.id}` : "";
  if (id) {
    if (!UUID.test(id)) return Response.json({ error: "Ticket inválido" }, { status: 400 });
    const t = filas(await sb(`/agent_tickets?id=eq.${id}${mio}&select=*&limit=1`))[0];
    if (!t) return Response.json({ error: "No existe el ticket" }, { status: 404 });
    const mensajes = filas(await sb(`/agent_ticket_messages?ticket_id=eq.${id}&select=*&order=created_at.asc&limit=500`));
    const col = yo.rol === "admin" ? "visto_admin_at" : "visto_agente_at";
    await sb(`/agent_tickets?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ [col]: new Date().toISOString() }) });
    return Response.json({ ticket: t, mensajes });
  }
  const lista = filas(await sb(`/agent_tickets?select=*${mio}&order=status.asc,ultimo_at.desc&limit=400`));
  const pendientes = lista.filter(yo.rol === "admin" ? esperaAdmin : esperaAgente).length;
  let agentes = [];
  if (yo.rol === "admin") agentes = filas(await sb(`/agent_signups?status=eq.approved&select=auth_user_id,first_name,last_name,recibe_reclamos&order=recibe_reclamos.desc`)).filter((a) => a.auth_user_id).map((a) => ({ id: a.auth_user_id, nombre: `${a.first_name || ""} ${a.last_name || ""}`.trim(), principal: !!a.recibe_reclamos }));
  return Response.json({ rol: yo.rol, tickets: lista, pendientes, abiertos: lista.filter((t) => t.status === "abierto").length, agentes });
}

export async function POST(req) {
  const yo = await quien(req);
  if (!yo) return Response.json({ error: "No autorizado" }, { status: 401 });

  // Foto: llega de a una, ya achicada por el navegador.
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    const file = fd?.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return Response.json({ error: "Falta el archivo" }, { status: 400 });
    // Fotos y documentos comunes (PDF, planillas, Word, texto). Nada ejecutable.
    const nombre = String(file.name || "archivo");
    const extOrig = (nombre.match(/\.([a-z0-9]{1,5})$/i) || [])[1]?.toLowerCase() || "";
    const esFoto = String(file.type || "").startsWith("image/");
    const DOCS = ["pdf", "xls", "xlsx", "doc", "docx", "csv", "txt"];
    if (!esFoto && !DOCS.includes(extOrig)) return Response.json({ error: "Ese tipo de archivo no se puede adjuntar" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > 4.2 * 1024 * 1024) return Response.json({ error: "El archivo es muy pesado (máximo 4 MB)" }, { status: 413 });
    const ext = esFoto ? (file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : file.type.includes("gif") ? "gif" : "jpg") : extOrig;
    // Los documentos conservan su nombre (va después del segundo guion bajo) para mostrarlo en el chat.
    const limpio = nombre.replace(/\.[a-z0-9]{1,5}$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "archivo";
    const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}${esFoto ? "" : `_${limpio}`}.${ext}`;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type || "application/octet-stream" }, body: bytes });
    if (!up.ok) return Response.json({ error: "No se pudo subir el archivo" }, { status: 502 });
    return Response.json({ url: `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}` });
  }

  const b = await req.json().catch(() => ({}));
  const ahora = new Date().toISOString();
  const visto = yo.rol === "admin" ? "visto_admin_at" : "visto_agente_at";

  if (b.accion === "crear") {
    const titulo = String(b.titulo || "").trim().slice(0, 140);
    const texto = String(b.texto || "").trim().slice(0, 4000);
    const fotos = soloFotos(b.fotos);
    if (!titulo) return Response.json({ error: "Falta el asunto" }, { status: 400 });
    const agentId = yo.rol === "agente" ? yo.id : String(b.agent_id || "");
    if (!UUID.test(agentId)) return Response.json({ error: "Elegí el agente" }, { status: 400 });
    const [tituloTr, textoTr] = await Promise.all([traducir(titulo, yo.rol), traducir(texto, yo.rol)]);
    const ins = await sb(`/agent_tickets`, { method: "POST", body: JSON.stringify({ agent_id: agentId, titulo, titulo_tr: tituloTr, creado_por: yo.id, creado_rol: yo.rol, ultimo_at: ahora, ultimo_rol: yo.rol, ultimo_texto: recorte(texto, fotos) || titulo, ultimo_texto_tr: textoTr ? recorte(textoTr, fotos) : (texto ? null : tituloTr), [visto]: ahora }) });
    const t = filas(ins)[0];
    if (!t) return Response.json({ error: "No se pudo crear el ticket" }, { status: 500 });
    if (texto || fotos.length) await sb(`/agent_ticket_messages`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ticket_id: t.id, autor_id: yo.id, autor_rol: yo.rol, texto: texto || null, texto_tr: textoTr, fotos }) });
    await avisar(req, t, yo.rol, texto, textoTr, true);
    return Response.json({ ok: true, ticket: t });
  }

  const id = String(b.ticket_id || "");
  if (!UUID.test(id)) return Response.json({ error: "Ticket inválido" }, { status: 400 });
  const t = filas(await sb(`/agent_tickets?id=eq.${id}${yo.rol === "agente" ? `&agent_id=eq.${yo.id}` : ""}&select=*&limit=1`))[0];
  if (!t) return Response.json({ error: "No existe el ticket" }, { status: 404 });

  if (b.accion === "mensaje") {
    const texto = String(b.texto || "").trim().slice(0, 4000);
    const fotos = soloFotos(b.fotos);
    if (!texto && !fotos.length) return Response.json({ error: "Escribí algo o adjuntá una foto" }, { status: 400 });
    const textoTr = await traducir(texto, yo.rol);
    const ins = await sb(`/agent_ticket_messages`, { method: "POST", body: JSON.stringify({ ticket_id: id, autor_id: yo.id, autor_rol: yo.rol, texto: texto || null, texto_tr: textoTr, fotos }) });
    const m = filas(ins)[0];
    if (!m) return Response.json({ error: "No se pudo guardar el mensaje" }, { status: 500 });
    // Escribir en un ticket cerrado lo reabre: el tema volvió a estar pendiente.
    await sb(`/agent_tickets?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ultimo_at: ahora, ultimo_rol: yo.rol, ultimo_texto: recorte(texto, fotos), ultimo_texto_tr: textoTr ? recorte(textoTr, fotos) : null, [visto]: ahora, ...(t.status === "cerrado" ? { status: "abierto", cerrado_at: null, cerrado_por: null } : {}) }) });
    await avisar(req, t, yo.rol, texto, textoTr, false);
    return Response.json({ ok: true, mensaje: m });
  }

  if (b.accion === "cerrar" || b.accion === "reabrir") {
    const cerrar = b.accion === "cerrar";
    if ((t.status === "cerrado") === cerrar) return Response.json({ ok: true });
    await sb(`/agent_tickets?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(cerrar ? { status: "cerrado", cerrado_at: ahora, cerrado_por: yo.id } : { status: "abierto", cerrado_at: null, cerrado_por: null }) });
    await sb(`/agent_ticket_messages`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ticket_id: id, autor_id: yo.id, autor_rol: "sistema", texto: `${cerrar ? "cerrado" : "reabierto"}:${yo.rol}` }) });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
