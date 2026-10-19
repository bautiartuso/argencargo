// GET/POST /api/bot/instagram — el bot de Instagram que deriva todo a WhatsApp.
//
// Por Instagram NO se conversa. Cada DM y cada comentario de otra cuenta recibe UNA sola
// respuesta que manda al WhatsApp de Argencargo (wa.me/5491125088580):
//   · DM entrante      → se le contesta por privado con el texto "ig_dm_text" (una vez cada
//                        7 días por usuario). Se ignoran ecos propios, reacciones y leídos.
//   · Comentario ajeno → respuesta pública "ig_comment_text" debajo del comentario (solo en
//                        comentarios de primer nivel) + DM privado al autor con el mismo texto
//                        del DM (misma regla de 7 días). Dedupe por id de comentario.
// Los dos textos se editan en el admin → solapa Bot → Instagram (cs_settings).
//
// GET  → verificación del webhook de Meta (hub.challenge, IG_VERIFY_TOKEN).
// POST → eventos del objeto "instagram" (campos messages y comments). Se valida la firma
//        X-Hub-Signature-256 con META_APP_SECRET: sin firma válida no se procesa nada.
//
// Si faltan credenciales (IG_PAGE_TOKEN/IG_USER_ID o la cuenta del Estudio) o META_APP_SECRET (opcional IG_APP_SECRET),
// se contesta 200 (Meta no reintenta) sin hacer nada y se avisa al dueño por Telegram una vez.
//
// ── Pasos en Meta (los hace Bautista, ~20 min) ───────────────────────────────────────────
//  1. Instagram: la cuenta tiene que ser PROFESIONAL (Empresa o Creador) y estar vinculada a la
//     página de Facebook de Argencargo (Instagram → Configuración → Centro de cuentas).
//  2. Instagram → Configuración → Privacidad → Mensajes → "Herramientas conectadas" →
//     PERMITIR el acceso a mensajes (sin esto Meta no manda los DMs al webhook).
//  3. developers.facebook.com → la MISMA app del bot de WhatsApp → Add product → Instagram
//     (Instagram API con inicio de sesión de Facebook). En "API setup with Facebook login" vincular
//     la página; la app necesita los permisos instagram_basic, instagram_manage_messages,
//     instagram_manage_comments, pages_manage_metadata y pages_messaging (en modo desarrollo
//     alcanza con que Bautista sea admin/tester de la app; para que le responda a cualquiera hay
//     que pasar la app a modo Live con esos permisos aprobados o con Advanced Access).
//  4. Webhooks → objeto "Instagram": Callback URL https://www.argencargo.com.ar/api/bot/instagram,
//     Verify token = IG_VERIFY_TOKEN (cualquier texto inventado). Suscribirse a los campos
//     "messages" y "comments". Después, en Instagram → "Webhooks" del producto, confirmar que
//     la página quedó suscripta (o POST /{page-id}/subscribed_apps con subscribed_fields=messages,comments).
//  5. Token: Graph API Explorer o System User del Business → token de USUARIO con los permisos de
//     arriba → canjearlo por uno de larga duración → con ese, GET /me/accounts: el access_token de
//     la página es IG_PAGE_TOKEN (no vence mientras la app esté activa). Y GET
//     /{page-id}?fields=instagram_business_account devuelve IG_USER_ID.
//  6. App secret: app → Settings → Basic → "App secret" = META_APP_SECRET.
//  7. Cargar en Vercel (Production): IG_PAGE_TOKEN, IG_USER_ID, IG_VERIFY_TOKEN, META_APP_SECRET
//     y redeploy. Probar: mandarle un DM desde otra cuenta y comentar una publicación.

import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { tgAlert } from "../../../../lib/telegram";
import { igBotConfig, igTexts, igClaimEvent, igClaimUser, igReleaseUser, igSendDm, igPrivateReply, igPublicReply, igBumpStats } from "../../../../lib/ig";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  const url = new URL(req.url);
  const tok = process.env.IG_VERIFY_TOKEN;
  if (url.searchParams.get("hub.mode") === "subscribe" && tok && url.searchParams.get("hub.verify_token") === tok) {
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return Response.json({ error: "Verificación inválida" }, { status: 403 });
}

// Meta firma con la clave secreta de la app (META_APP_SECRET). Si el webhook se configuró desde
// "API con inicio de sesión de Instagram", firma con el secreto de la app de Instagram (IG_APP_SECRET):
// se aceptan las dos.
function firmaValida(raw, header) {
  const secretos = [process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter(Boolean);
  if (!secretos.length || !header) return false;
  const given = String(header).replace(/^sha256=/, "");
  return secretos.some((secret) => {
    const mine = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (given.length !== mine.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(mine, "hex")); } catch { return false; }
  });
}

const esc = (s) => String(s || "").replace(/[<>&]/g, "");

async function avisarFalta(que) {
  await tgAlert("ig_bot_config", `📸 <b>Bot de Instagram sin configurar:</b> ${esc(que)}. Están llegando mensajes/comentarios y no se contestan. Cargá en Vercel IG_PAGE_TOKEN, IG_USER_ID, IG_VERIFY_TOKEN y META_APP_SECRET (los pasos están en app/api/bot/instagram/route.js).`, { cooldownHours: 24 * 30 });
}

export async function POST(req) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  if (!secret) { waitUntil(avisarFalta("falta META_APP_SECRET (no se puede validar la firma de Meta)")); return Response.json({ ok: true, skipped: "sin app secret" }); }
  if (!firmaValida(raw, req.headers.get("x-hub-signature-256"))) { console.error("[bot/instagram] firma inválida (¿falta IG_APP_SECRET o META_APP_SECRET es de otra app?)", { con_firma: !!req.headers.get("x-hub-signature-256"), bytes: raw.length, cuerpo: raw.slice(0, 300) }); return Response.json({ error: "Firma inválida" }, { status: 401 }); }
  let body = null; try { body = JSON.parse(raw); } catch {}
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) { console.log("[bot/instagram] evento ignorado", body?.object); return Response.json({ ok: true, ignored: true }); }
  console.log("[bot/instagram] evento recibido", JSON.stringify(body).slice(0, 600));

  // Meta quiere el 200 rápido: el trabajo real sigue en segundo plano.
  waitUntil(procesar(body.entry).catch((e) => console.error("[bot/instagram]", e.message)));
  return Response.json({ ok: true });
}

async function procesar(entries) {
  const cfg = await igBotConfig();
  if (!cfg.ok) { await avisarFalta("faltan IG_PAGE_TOKEN / IG_USER_ID"); return; }
  const textos = await igTexts();
  const propio = (id, entryId) => !id || String(id) === cfg.igUserId || (entryId && String(id) === String(entryId));

  for (const entry of entries) {
    // El webhook es de la app (Argencargo Radar), que también tiene vinculadas otras cuentas
    // (MyBox, ARGENMAQ): solo se atiende lo que llega a la cuenta de Argencargo.
    if (entry.id && String(entry.id) !== cfg.igUserId) { console.log("[bot/instagram] entrada de otra cuenta ignorada", entry.id); continue; }
    // ── DMs: llegan en entry.messaging (formato Messenger) o en entry.changes con field "messages"
    // (formato de la API con inicio de sesión de Instagram y de los eventos de prueba) ──
    const dms = [
      ...(Array.isArray(entry.messaging) ? entry.messaging : []),
      ...(Array.isArray(entry.changes) ? entry.changes : []).filter((c) => c.field === "messages" && c.value).map((c) => c.value),
    ];
    for (const ev of dms) {
      const m = ev.message;
      if (!m || m.is_echo || m.is_deleted || ev.reaction || ev.read || ev.postback) continue;
      const from = ev.sender?.id;
      if (propio(from, entry.id)) continue;
      if (m.mid && !(await igClaimEvent("mid", m.mid))) continue;          // reintento de Meta
      if (!(await igClaimUser(from))) { console.log("[bot/instagram] DM ya contestado hace <7 días", from); continue; }
      const r = await igSendDm(cfg, from, textos.dm_text);
      if (r.ok) { await igBumpStats("dms"); console.log("[bot/instagram] DM contestado", from); }
      else { await igReleaseUser(from); await reportarError("DM", r.error); }
    }
    // ── Comentarios (entry.changes[].field === "comments") ──
    for (const ch of Array.isArray(entry.changes) ? entry.changes : []) {
      if (ch.field !== "comments") continue;
      const v = ch.value || {};
      const cid = v.id;
      const autor = v.from?.id;
      if (!cid || propio(autor, entry.id)) continue;                        // nuestras propias respuestas
      if (!(await igClaimEvent("comment", cid))) continue;
      // Respuesta pública solo en comentarios de primer nivel (en un hilo ya contestado no se insiste).
      if (!v.parent_id) {
        const pr = await igPublicReply(cfg, cid, textos.comment_text);
        if (pr.ok) await igBumpStats("comentarios"); else await reportarError("respuesta pública", pr.error);
      }
      // DM privado al autor (misma regla de 7 días que los DMs).
      if (autor && (await igClaimUser(autor))) {
        const dr = await igPrivateReply(cfg, cid, textos.dm_text);
        if (dr.ok) await igBumpStats("dms"); else { await igReleaseUser(autor); await reportarError("DM privado por comentario", dr.error); }
      }
    }
  }
}

// Errores de Meta (token vencido, permiso que falta): aviso con enfriamiento para no spamear.
async function reportarError(que, msg) {
  const m = String(msg || "");
  const key = /token|session|expired|OAuth|permission|\(#10\)|\(#190\)|\(#200\)/i.test(m) ? "ig_bot_token" : "ig_bot_error";
  await tgAlert(key, `📸 <b>Bot de Instagram: falló ${esc(que)}.</b>\n${esc(m).slice(0, 300)}\n${key === "ig_bot_token" ? "Parece token vencido o permiso que falta: regenerá IG_PAGE_TOKEN en Meta y cargalo en Vercel." : ""}`, { cooldownHours: 6 });
}
