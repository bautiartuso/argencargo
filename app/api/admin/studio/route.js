// GET/POST /api/admin/studio — Content Studio v2 (admin y empleado).
//
// GET ?view=pieces        → todas las piezas (Aprobación/Calendario filtran en el cliente)
// GET ?view=memory        → knowledge + brand kit (cs_memory) + assets (logos, referencias) + runs + instagram
// POST {action:"generate", brief, kind, count}      → piezas a la cola (el analista arma los briefs)
// POST {action:"runner", mix:{feed,carousel,story}} → el analista propone esa mezcla (manual); count = total si no hay mix
// POST {action:"chat", messages, images}            → chatbot estratega (devuelve reply y, si está listo, el brief)
// POST {action:"approve"|"reject"|"regenerate"|"published"|"publish_now", id}
// POST {action:"feedback", id, feedback}            → pedir cambio (vuelve a la cola)
// POST {action:"schedule", id, scheduled_at}
// POST {action:"memory", key, title, content}
// POST {action:"asset_delete", id}
// POST {action:"instagram", ig_user_id, access_token} / {action:"instagram_test"}
// POST multipart {action:"asset", kind, file}       → sube logo o posteo de referencia

import { sb, loadMemory, loadAssets, runner, crearPiezas, appendHistorial, appendAprendizaje, chatIdea, uploadStorage, igSettings, igTest, igPublish, igConnect, normKind, igDiscoverySettings, loadCompetitors, discoverAccount, radarCompetencia, normUsername, borrarImagenesPieza, decidirFoto, estadoEstudio } from "../../../../lib/studio";

export const maxDuration = 120;
export const runtime = "nodejs";

async function isStaff(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role,email&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && ["admin", "empleado"].includes(p.body[0]?.role) ? (p.body[0].email || p.body[0].role) : false;
  } catch { return false; }
}

const SEL = "id,brand,kind,slides,slides_plan,status,source,pillar,title,brief,headline,subheadline,caption,hashtags,image_url,images,photo_url,photo_prompt,photo_brand,width,height,feedback,error,publish_error,ig_media_id,scheduled_at,published_at,approved_at,locked_at,created_at,updated_at";

export async function GET(req) {
  const who = await isStaff(req);
  if (!who) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "pieces";
  if (view === "memory") {
    const [memory, assets, runs, ig, disc, competitors, estado] = await Promise.all([loadMemory(), loadAssets(), sb(`/cs_runs?select=id,kind,requested,created,log,started_at,finished_at&order=started_at.desc&limit=30`), igSettings(), igDiscoverySettings(), loadCompetitors(), estadoEstudio().catch(() => null)]);
    // Por corrida: piezas, aprobadas, fotos y costo (desde cs_pieces.run_id).
    const runRows = Array.isArray(runs.body) ? runs.body : [];
    if (runRows.length) {
      const pr = await sb(`/cs_pieces?run_id=in.(${runRows.map((r) => r.id).join(",")})&select=run_id,status,photos_generated,photo_cost_usd`);
      const byRun = {};
      for (const p of Array.isArray(pr.body) ? pr.body : []) {
        const b = (byRun[p.run_id] = byRun[p.run_id] || { piezas: 0, aprobadas: 0, descartadas: 0, fotos: 0, costo: 0 });
        b.piezas++; if (["approved", "scheduled", "published"].includes(p.status)) b.aprobadas++; if (p.status === "rejected") b.descartadas++;
        b.fotos += Number(p.photos_generated || 0); b.costo += Number(p.photo_cost_usd || 0);
      }
      for (const r of runRows) { const b = byRun[r.id] || { piezas: 0, aprobadas: 0, descartadas: 0, fotos: 0, costo: 0 }; r.resumen = { ...b, costo: Math.round(b.costo * 100) / 100 }; }
    }
    return Response.json({ memory, assets, runs: runRows, estado, instagram: { ig_user_id: ig.ig_user_id || "", connected: !!(ig.ig_user_id && ig.access_token), username: ig.username || null },
      discovery: { connected: !!(disc.ig_user_id && disc.access_token), username: disc.username || null, page_name: disc.page_name || null, connected_at: disc.connected_at || null }, competitors });
  }
  if (view === "competencia") {
    const r = await sb(`/cs_competitor_posts?select=id,username,ig_media_id,media_type,caption,media_url,thumbnail_url,permalink,children,like_count,comments_count,posted_at,analysis,analyzed_at&order=posted_at.desc.nullslast&limit=80`);
    return Response.json({ posts: Array.isArray(r.body) ? r.body : [] });
  }
  const r = await sb(`/cs_pieces?select=${SEL}&order=created_at.desc&limit=400`);
  return Response.json({ pieces: Array.isArray(r.body) ? r.body : [] });
}

export async function POST(req) {
  const who = await isStaff(req);
  if (!who) return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date().toISOString();
  const patch = (id, data) => sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...data, updated_at: now }) });

  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const fd = await req.formData();
    const kind = fd.get("kind") === "logo" ? "logo" : "reference";
    const file = fd.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "Falta el archivo" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Máximo 15 MB" }, { status: 400 });
    const safe = String(file.name || "imagen").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
    const url = await uploadStorage(`${kind === "logo" ? "logos" : "referencias"}/${Date.now()}_${safe}`, Buffer.from(await file.arrayBuffer()), file.type || "image/png");
    const ins = await sb(`/cs_assets`, { method: "POST", body: JSON.stringify({ kind, url, name: String(fd.get("name") || file.name || ""), note: String(fd.get("note") || "") }) });
    return Response.json({ ok: true, asset: Array.isArray(ins.body) ? ins.body[0] : null });
  }

  const body = await req.json().catch(() => ({}));
  const a = body.action;
  const id = String(body.id || "");

  if (a === "generate") {
    const count = Math.min(6, Math.max(1, Number(body.count) || 1));
    const brief = String(body.brief || "").trim();
    if (!brief) return Response.json({ error: "Contame qué querés comunicar" }, { status: 400 });
    if (body.direct) {
      // Brief ya definido (por el chatbot): va directo a la cola sin pasar por el analista.
      // Si quien pide no decidió la foto (Adaptar del radar, chat sin datos), la decide el analista.
      const foto = typeof body.photo === "boolean" ? { photo: body.photo, photo_brand: !!body.photo_brand, photo_prompt: String(body.photo_prompt || "") } : await decidirFoto({ brief, kind: normKind(body.kind), title: body.title });
      const created = await crearPiezas([{ kind: normKind(body.kind), slides: body.slides, slides_plan: body.slides_plan, pillar: body.pillar || null, title: body.title || brief.slice(0, 60), brief, ...foto }], { source: body.source === "radar" ? "radar" : "chatbot" });
      return Response.json({ ok: true, created: created.length });
    }
    const kinds = ["story", "feed", "carousel"].includes(body.kind) ? Array(count).fill(body.kind) : null;
    const created = await runner({ count, brief, kinds, source: "manual" });
    return Response.json({ ok: true, created: created.length });
  }
  if (a === "runner") {
    const mix = body.mix && typeof body.mix === "object" ? { feed: Number(body.mix.feed) || 0, carousel: Number(body.mix.carousel) || 0, story: Number(body.mix.story) || 0 } : null;
    const total = mix ? mix.feed + mix.carousel + mix.story : Math.min(20, Math.max(1, Number(body.count) || 3));
    if (!total) return Response.json({ error: "Elegí al menos una pieza" }, { status: 400 });
    if (total > 30) return Response.json({ error: "Máximo 30 piezas por corrida" }, { status: 400 });
    const created = await runner(mix ? { mix, source: "runner" } : { count: total, source: "runner" });
    return Response.json({ ok: true, created: created.length, titulos: created.map((c) => c.title) });
  }
  if (a === "chat") {
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    if (!messages.length) return Response.json({ error: "Sin mensajes" }, { status: 400 });
    const out = await chatIdea({ messages, images, kindPref: ["feed", "carousel", "story"].includes(body.kind_pref) ? body.kind_pref : "auto" });
    return Response.json(out);
  }
  if (a === "approve") {
    const r = await patch(id, { status: "approved", approved_at: now, approved_by: String(who) });
    const p = Array.isArray(r.body) && r.body[0];
    if (p) appendHistorial(p).catch(() => {});
    return Response.json({ ok: true });
  }
  // Rechazar borra las imágenes del storage (la fila queda para que el analista no repita el tema).
  if (a === "reject") {
    const note = String(body.note || "").trim();
    const r = await patch(id, { status: "rejected", reject_note: note || null });
    const p = Array.isArray(r.body) && r.body[0];
    if (p) { await borrarImagenesPieza(p); if (note) appendAprendizaje(p, "descartada porque", note).catch(() => {}); }
    return Response.json({ ok: true });
  }
  if (a === "reject_all") {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter(Boolean).slice(0, 100);
    if (!ids.length) return Response.json({ error: "Nada para rechazar" }, { status: 400 });
    const r = await sb(`/cs_pieces?id=in.(${ids.map(encodeURIComponent).join(",")})&status=eq.review`, { method: "PATCH", body: JSON.stringify({ status: "rejected", updated_at: now }) });
    const rows = Array.isArray(r.body) ? r.body : [];
    for (const p of rows) await borrarImagenesPieza(p);
    return Response.json({ ok: true, rechazadas: rows.length });
  }
  if (a === "regenerate") { await patch(id, { status: "generating", locked_at: null, attempts: 0, error: null, feedback: null }); return Response.json({ ok: true }); }
  if (a === "feedback") {
    const fb = String(body.feedback || "").trim();
    if (!fb) return Response.json({ error: "Decime qué cambiar" }, { status: 400 });
    // new_photo: se descarta la foto actual y se genera otra con el cambio pedido como nota.
    let extraFoto = {};
    if (body.new_photo) {
      const cur = await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}&select=id,photo_url,photo_prompt`);
      const p = Array.isArray(cur.body) && cur.body[0];
      if (p?.photo_url) { await borrarImagenesPieza({ id: p.id, photo_url: p.photo_url }, { limpiarFila: false }); }
      extraFoto = { photo_url: null, photo_note: fb, ...(p && !p.photo_prompt ? {} : {}) };
    }
    const rf = await patch(id, { status: "generating", locked_at: null, attempts: 0, error: null, feedback: fb, ...extraFoto });
    const pf = Array.isArray(rf.body) && rf.body[0];
    if (pf) appendAprendizaje(pf, "cambio pedido", fb).catch(() => {});
    return Response.json({ ok: true });
  }
  if (a === "schedule") {
    const when = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (!when || isNaN(when)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
    await patch(id, { status: "scheduled", scheduled_at: when.toISOString(), publish_error: null });
    return Response.json({ ok: true });
  }
  if (a === "unschedule") { await patch(id, { status: "approved", scheduled_at: null, publish_error: null }); return Response.json({ ok: true }); }
  if (a === "published") { await patch(id, { status: "published", published_at: now }); return Response.json({ ok: true }); }
  if (a === "publish_now") {
    const cfg = await igSettings();
    if (!cfg.ig_user_id || !cfg.access_token) return Response.json({ error: "Instagram no está conectado (solapa Conexión)" }, { status: 400 });
    const r = await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const piece = Array.isArray(r.body) && r.body[0];
    if (!piece?.image_url && !(Array.isArray(piece?.images) && piece.images.length)) return Response.json({ error: "La pieza no tiene imagen" }, { status: 400 });
    try {
      const mid = await igPublish(piece, cfg);
      await patch(id, { status: "published", published_at: now, ig_media_id: mid, publish_error: null });
      return Response.json({ ok: true });
    } catch (e) { await patch(id, { publish_error: String(e.message).slice(0, 300) }); return Response.json({ error: e.message }, { status: 400 }); }
  }
  if (a === "memory") {
    const key = String(body.key || ""); if (!key) return Response.json({ error: "Falta key" }, { status: 400 });
    await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key, title: String(body.title || key), content: String(body.content || ""), updated_at: now }) });
    return Response.json({ ok: true });
  }
  if (a === "asset_delete") { await sb(`/cs_assets?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return Response.json({ ok: true }); }
  if (a === "instagram") {
    const token = String(body.access_token || "").trim();
    if (!token) return Response.json({ error: "Pegá el token" }, { status: 400 });
    let cfg; try { cfg = await igConnect(token, String(body.ig_user_id || "").trim()); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    let info; try { info = await igTest(cfg); } catch (e) { return Response.json({ error: `Instagram rechazó la conexión: ${e.message}` }, { status: 400 }); }
    await sb(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "instagram", value: { ...cfg, username: info.username || cfg.username || null }, updated_at: now }) });
    return Response.json({ ok: true, info: { ...info, page_name: cfg.page_name || null, mode: cfg.mode } });
  }
  if (a === "instagram_test") {
    const cfg = await igSettings();
    if (!cfg.ig_user_id) return Response.json({ error: "Sin conexión" }, { status: 400 });
    try { return Response.json({ ok: true, info: await igTest(cfg) }); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  }
  if (a === "instagram_disconnect") { await sb(`/cs_settings?key=eq.instagram`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return Response.json({ ok: true }); }
  // Radar de competencia: segundo token (Facebook) solo para mirar otras cuentas.
  if (a === "discovery_connect") {
    const token = String(body.access_token || "").trim();
    if (!token) return Response.json({ error: "Pegá el token" }, { status: 400 });
    let cfg; try { cfg = await igConnect(token); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    if (cfg.mode !== "fb") return Response.json({ error: "Ese es un token de Instagram (sirve para publicar). Para mirar a la competencia hace falta un token de FACEBOOK con la página vinculada: seguí el instructivo de abajo." }, { status: 400 });
    // El token de página hereda el vencimiento del token de usuario: si es corto (no se extendió), avisar.
    try {
      const d = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(cfg.access_token)}&access_token=${encodeURIComponent(token)}`);
      const dj = await d.json().catch(() => ({}));
      const exp = Number(dj?.data?.expires_at || 0);
      if (exp && exp * 1000 - Date.now() < 3 * 86400000) return Response.json({ error: `Ese token vence en ${Math.max(1, Math.round((exp * 1000 - Date.now()) / 3600000))} h. Antes de pegarlo, extendelo en el Depurador de tokens (developers.facebook.com/tools/debug/accesstoken → Extender token de acceso) y pegá el token extendido: así el radar no se corta.` }, { status: 400 });
      cfg.expires_at = exp ? new Date(exp * 1000).toISOString() : null;
    } catch {}
    try { const bd = await discoverAccount(cfg, "magforce_argentina"); if (!bd?.id) throw new Error("no devolvió datos"); }
    catch (e) { return Response.json({ error: `El token conecta pero Business Discovery falla: ${e.message}. Revisá que el token tenga instagram_basic, instagram_manage_insights, pages_read_engagement, pages_show_list y ads_read.` }, { status: 400 }); }
    await sb(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "instagram_discovery", value: cfg, updated_at: now }) });
    return Response.json({ ok: true, info: { username: cfg.username, page_name: cfg.page_name } });
  }
  if (a === "discovery_disconnect") { await sb(`/cs_settings?key=eq.instagram_discovery`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return Response.json({ ok: true }); }
  if (a === "competitor_add") {
    const u = normUsername(body.username);
    if (!/^[a-z0-9._]{1,30}$/.test(u)) return Response.json({ error: "Usuario inválido" }, { status: 400 });
    await sb(`/cs_competitors?on_conflict=username`, { method: "POST", body: JSON.stringify({ username: u, active: true, note: String(body.note || "") || null }) });
    return Response.json({ ok: true });
  }
  if (a === "competitor_toggle") { await sb(`/cs_competitors?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: !!body.active }) }); return Response.json({ ok: true }); }
  if (a === "competitor_delete") { await sb(`/cs_competitors?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return Response.json({ ok: true }); }
  if (a === "competencia_scan") { const r = await radarCompetencia({ analizar: 6 }); return Response.json({ ok: true, ...r }); }
  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
