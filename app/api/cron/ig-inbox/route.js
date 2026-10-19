// GET /api/cron/ig-inbox — plan B del bot de Instagram (corre cada 2 minutos, vercel.json).
//
// El webhook (/api/bot/instagram) depende de que Meta entregue los eventos, y en modo
// desarrollo o después de fallas Meta frena las entregas sin avisar (19/10/2026: los DMs se
// veían por la API pero nunca llegaban al webhook). Este cron no depende de eso: lee la bandeja
// de Instagram de la página y los comentarios recientes, y contesta lo nuevo con las MISMAS
// reglas y los MISMOS marcadores que el webhook (lib/ig.js), así nunca contesta dos veces:
//   · DM: el último mensaje del cliente en los últimos 30 min → DM con el texto ig_dm_text
//     (una vez cada 7 días por persona).
//   · Comentario de primer nivel de otra cuenta en las publicaciones recientes → respuesta
//     pública ig_comment_text + DM privado (misma regla de 7 días). Dedupe por comment_id.
// ?dry=1 devuelve qué contestaría sin mandar nada.

import { igBotConfig, igTexts, igClaimEvent, igClaimUser, igReleaseUser, igSendDm, igPrivateReply, igPublicReply, igBumpStats } from "../../../../lib/ig";

export const runtime = "nodejs";
export const maxDuration = 60;

const VENTANA_MS = 30 * 60 * 1000;

async function get(cfg, path, params) {
  const q = new URLSearchParams({ ...params, access_token: cfg.token });
  const r = await fetch(`https://graph.facebook.com/v21.0/${path}?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Graph HTTP ${r.status}`);
  return j;
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const okAuth = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!okAuth) return Response.json({ error: "No autorizado" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const cfg = await igBotConfig();
  // Solo con el token de página (graph.facebook.com): es el que lee la bandeja de Instagram.
  if (!cfg.ok || cfg.source !== "env") return Response.json({ ok: true, skipped: "sin IG_PAGE_TOKEN / IG_USER_ID" });
  const textos = await igTexts();
  try { cfg.username = (await get(cfg, cfg.igUserId, { fields: "username" })).username || null; } catch {}
  const desde = Date.now() - VENTANA_MS;
  const hecho = { dms: [], comentarios: [], errores: [] };

  // ── DMs ──
  try {
    const conv = await get(cfg, "me/conversations", { platform: "instagram", fields: "updated_time,messages.limit(5){id,from,created_time}", limit: "25" });
    for (const c of conv.data || []) {
      if (new Date(c.updated_time).getTime() < desde) continue;
      const entrante = (c.messages?.data || []).find((m) => m.from?.id && String(m.from.id) !== cfg.igUserId && m.from?.username !== cfg.username);
      if (!entrante || new Date(entrante.created_time).getTime() < desde) continue;
      const quien = entrante.from.id;
      if (dry) { hecho.dms.push({ a: entrante.from.username || quien, msg: entrante.id }); continue; }
      if (!(await igClaimEvent("mid", entrante.id))) continue;
      if (!(await igClaimUser(quien))) continue;
      const r = await igSendDm(cfg, quien, textos.dm_text);
      if (r.ok) { await igBumpStats("dms"); hecho.dms.push(entrante.from.username || quien); }
      else { await igReleaseUser(quien); hecho.errores.push(`DM ${entrante.from.username || quien}: ${r.error}`); }
    }
  } catch (e) { hecho.errores.push(`bandeja: ${e.message}`); }

  // ── Comentarios en las publicaciones recientes ──
  try {
    const media = await get(cfg, `${cfg.igUserId}/media`, { fields: "id,comments_count,comments.limit(25){id,timestamp,from,username}", limit: "6" });
    for (const m of media.data || []) {
      for (const cm of m.comments?.data || []) {
        if (new Date(cm.timestamp).getTime() < desde) continue;
        const autor = cm.from?.id;
        if (!autor || String(autor) === cfg.igUserId) continue;
        if (dry) { hecho.comentarios.push({ de: cm.username || autor, id: cm.id }); continue; }
        if (!(await igClaimEvent("comment", cm.id))) continue;
        const pr = await igPublicReply(cfg, cm.id, textos.comment_text);
        if (pr.ok) await igBumpStats("comentarios"); else hecho.errores.push(`respuesta pública ${cm.id}: ${pr.error}`);
        if (await igClaimUser(autor)) {
          const dr = await igPrivateReply(cfg, cm.id, textos.dm_text);
          if (dr.ok) await igBumpStats("dms"); else { await igReleaseUser(autor); hecho.errores.push(`privado ${cm.id}: ${dr.error}`); }
        }
        hecho.comentarios.push(cm.username || autor);
      }
    }
  } catch (e) { hecho.errores.push(`comentarios: ${e.message}`); }

  if (hecho.dms.length || hecho.comentarios.length || hecho.errores.length) console.log("[cron/ig-inbox]", JSON.stringify(hecho));
  return Response.json({ ok: true, dry, ...hecho });
}
