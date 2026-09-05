// GET/POST /api/admin/studio — Content Studio v2 (admin y empleado).
//
// GET ?view=pieces        → todas las piezas (Aprobación/Calendario filtran en el cliente)
// GET ?view=memory        → knowledge + brand kit (cs_memory) + assets (logos, referencias) + runs + instagram
// POST {action:"generate", brief, kind, count}      → piezas a la cola (el analista arma los briefs)
// POST {action:"runner", count}                     → el analista propone N (manual)
// POST {action:"chat", messages, images}            → chatbot estratega (devuelve reply y, si está listo, el brief)
// POST {action:"approve"|"reject"|"regenerate"|"published"|"publish_now", id}
// POST {action:"feedback", id, feedback}            → pedir cambio (vuelve a la cola)
// POST {action:"schedule", id, scheduled_at}
// POST {action:"memory", key, title, content}
// POST {action:"asset_delete", id}
// POST {action:"instagram", ig_user_id, access_token} / {action:"instagram_test"}
// POST multipart {action:"asset", kind, file}       → sube logo o posteo de referencia

import { sb, loadMemory, loadAssets, runner, crearPiezas, appendHistorial, chatIdea, uploadStorage, igSettings, igTest, igPublish } from "../../../../lib/studio";

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

const SEL = "id,brand,kind,status,source,pillar,title,brief,headline,subheadline,caption,hashtags,image_url,width,height,feedback,error,publish_error,ig_media_id,scheduled_at,published_at,approved_at,locked_at,created_at,updated_at";

export async function GET(req) {
  const who = await isStaff(req);
  if (!who) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "pieces";
  if (view === "memory") {
    const [memory, assets, runs, ig] = await Promise.all([loadMemory(), loadAssets(), sb(`/cs_runs?select=id,kind,requested,created,log,started_at,finished_at&order=started_at.desc&limit=30`), igSettings()]);
    return Response.json({ memory, assets, runs: Array.isArray(runs.body) ? runs.body : [], instagram: { ig_user_id: ig.ig_user_id || "", connected: !!(ig.ig_user_id && ig.access_token), username: ig.username || null } });
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
      const created = await crearPiezas([{ kind: body.kind === "story" ? "story" : "feed", pillar: body.pillar || null, title: body.title || brief.slice(0, 60), brief }], { source: "chatbot" });
      return Response.json({ ok: true, created: created.length });
    }
    const kinds = body.kind === "story" ? Array(count).fill("story") : body.kind === "feed" ? Array(count).fill("feed") : null;
    const created = await runner({ count, brief, kinds, source: "manual" });
    return Response.json({ ok: true, created: created.length });
  }
  if (a === "runner") {
    const count = Math.min(20, Math.max(1, Number(body.count) || 3));
    const created = await runner({ count, source: "runner" });
    return Response.json({ ok: true, created: created.length, titulos: created.map((c) => c.title) });
  }
  if (a === "chat") {
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
    if (!messages.length) return Response.json({ error: "Sin mensajes" }, { status: 400 });
    const out = await chatIdea({ messages, images });
    return Response.json(out);
  }
  if (a === "approve") {
    const r = await patch(id, { status: "approved", approved_at: now, approved_by: String(who) });
    const p = Array.isArray(r.body) && r.body[0];
    if (p) appendHistorial(p).catch(() => {});
    return Response.json({ ok: true });
  }
  if (a === "reject") { await patch(id, { status: "rejected" }); return Response.json({ ok: true }); }
  if (a === "regenerate") { await patch(id, { status: "generating", locked_at: null, attempts: 0, error: null, feedback: null }); return Response.json({ ok: true }); }
  if (a === "feedback") {
    const fb = String(body.feedback || "").trim();
    if (!fb) return Response.json({ error: "Decime qué cambiar" }, { status: 400 });
    await patch(id, { status: "generating", locked_at: null, attempts: 0, error: null, feedback: fb });
    return Response.json({ ok: true });
  }
  if (a === "schedule") {
    const when = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (!when || isNaN(when)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
    await patch(id, { status: "scheduled", scheduled_at: when.toISOString(), publish_error: null });
    return Response.json({ ok: true });
  }
  if (a === "published") { await patch(id, { status: "published", published_at: now }); return Response.json({ ok: true }); }
  if (a === "publish_now") {
    const cfg = await igSettings();
    if (!cfg.ig_user_id || !cfg.access_token) return Response.json({ error: "Instagram no está conectado (solapa Conexión)" }, { status: 400 });
    const r = await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const piece = Array.isArray(r.body) && r.body[0];
    if (!piece?.image_url) return Response.json({ error: "La pieza no tiene imagen" }, { status: 400 });
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
    const cfg = { ig_user_id: String(body.ig_user_id || "").trim(), access_token: String(body.access_token || "").trim() };
    if (!cfg.ig_user_id || !cfg.access_token) return Response.json({ error: "Faltan el ID de la cuenta y el token" }, { status: 400 });
    let info; try { info = await igTest(cfg); } catch (e) { return Response.json({ error: `Instagram rechazó la conexión: ${e.message}` }, { status: 400 }); }
    await sb(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "instagram", value: { ...cfg, username: info.username || null }, updated_at: now }) });
    return Response.json({ ok: true, info });
  }
  if (a === "instagram_test") {
    const cfg = await igSettings();
    if (!cfg.ig_user_id) return Response.json({ error: "Sin conexión" }, { status: 400 });
    try { return Response.json({ ok: true, info: await igTest(cfg) }); } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
  }
  if (a === "instagram_disconnect") { await sb(`/cs_settings?key=eq.instagram`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); return Response.json({ ok: true }); }
  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
