// GET/POST /api/admin/studio — Content Studio (admin y empleado).
//
// GET ?view=pieces[&status=review|approved|scheduled|published|rejected|error|generating]
// GET ?view=memory
// GET ?view=piece&id=…
// POST {action:"generate", brief, kind:"feed"|"story"|"auto", count}   → crea piezas en cola
// POST {action:"runner", count}                                          → el analista propone N
// POST {action:"process"}                                                → procesa la siguiente de la cola
// POST {action:"approve"|"reject"|"regenerate", id}
// POST {action:"feedback", id, feedback}                                 → pedir cambio (regenera)
// POST {action:"schedule", id, scheduled_at}
// POST {action:"published", id}
// POST {action:"memory", key, content}

import { sb, loadMemory, runner, crearPiezas, processNext, appendHistorial } from "../../../../lib/studio";
import { geminiConfigured } from "../../../../lib/gemini-image";

export const maxDuration = 300;
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

const SEL = "id,brand,kind,status,source,pillar,title,brief,headline,subheadline,caption,hashtags,image_url,photo_url,width,height,feedback,error,scheduled_at,published_at,approved_at,created_at,updated_at";

export async function GET(req) {
  const who = await isStaff(req);
  if (!who) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "pieces";
  if (view === "memory") return Response.json({ memory: await loadMemory(), fotos: geminiConfigured() });
  if (view === "piece") {
    const r = await sb(`/cs_pieces?id=eq.${encodeURIComponent(url.searchParams.get("id") || "")}&select=${SEL},html&limit=1`);
    return Response.json({ piece: Array.isArray(r.body) ? r.body[0] : null });
  }
  const status = url.searchParams.get("status");
  const filt = status ? `&status=in.(${status})` : "";
  const r = await sb(`/cs_pieces?select=${SEL}${filt}&order=created_at.desc&limit=300`);
  return Response.json({ pieces: Array.isArray(r.body) ? r.body : [], fotos: geminiConfigured() });
}

export async function POST(req) {
  const who = await isStaff(req);
  if (!who) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const a = body.action;
  const now = new Date().toISOString();
  const patch = (id, data) => sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...data, updated_at: now }) });

  if (a === "generate") {
    const count = Math.min(6, Math.max(1, Number(body.count) || 1));
    const brief = String(body.brief || "").trim();
    if (!brief) return Response.json({ error: "Contame qué querés comunicar" }, { status: 400 });
    const kinds = body.kind === "story" ? Array(count).fill("story") : body.kind === "feed" ? Array(count).fill("feed") : null;
    const created = await runner({ count, brief, kinds, source: "manual" });
    return Response.json({ ok: true, created: created.length });
  }
  if (a === "runner") {
    const count = Math.min(8, Math.max(1, Number(body.count) || 4));
    const created = await runner({ count, source: "runner" });
    return Response.json({ ok: true, created: created.length, titulos: created.map((c) => c.title) });
  }
  if (a === "process") {
    const r = await processNext();
    return Response.json({ ok: true, processed: r });
  }

  const id = String(body.id || "");
  if (!id && ["approve", "reject", "regenerate", "feedback", "schedule", "published"].includes(a)) return Response.json({ error: "Falta id" }, { status: 400 });

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
    await patch(id, { status: "scheduled", scheduled_at: when.toISOString() });
    return Response.json({ ok: true });
  }
  if (a === "published") { await patch(id, { status: "published", published_at: now }); return Response.json({ ok: true }); }
  if (a === "memory") {
    const key = String(body.key || ""); if (!key) return Response.json({ error: "Falta key" }, { status: 400 });
    await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key, title: String(body.title || key), content: String(body.content || ""), updated_at: now }) });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
