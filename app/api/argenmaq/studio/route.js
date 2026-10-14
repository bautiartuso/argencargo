// /api/argenmaq/studio — Content Studio de ARGENMAQ (panel › Marketing › Content Studio).
//   GET  ?accion=candidatos  → piezas de hoy armadas con datos reales + piezas guardadas + estado de Instagram
//   POST {accion:"guardar", pieza}      → dibuja las imágenes, las sube al storage y guarda la pieza (aprobada)
//   POST {accion:"publicar", id}        → publica en el Instagram de ARGENMAQ
//   POST {accion:"descartar", id}       → la marca descartada (para que no se repita la máquina igual)
//   POST {accion:"ig_conectar", token}  → conecta la cuenta de Instagram de ARGENMAQ (separada de la de Argencargo)
//   POST {accion:"ig_desconectar"}
import { candidatos, sbq, quien, igCfg, igGuardar, subirImagen } from "../../../../lib/studio-argenmaq";
import { igConnect, igPublish } from "../../../../lib/studio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const codificar = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const auth = async (req) => quien((req.headers.get("authorization") || "").replace(/^Bearer /i, ""));
const err = (m, s = 400) => Response.json({ error: m }, { status: s });

export async function GET(req) {
  const yo = await auth(req); if (!yo) return err("Sin acceso", 401);
  const accion = new URL(req.url).searchParams.get("accion") || "candidatos";
  try {
    if (accion === "candidatos") {
      const [cands, guardadas, ig] = await Promise.all([
        candidatos(),
        sbq(`/am_piezas?select=*&order=created_at.desc&limit=60`).catch(() => []),
        igCfg(),
      ]);
      return Response.json({ candidatos: cands, guardadas, ig: ig?.ig_user_id ? { username: ig.username || null, connected_at: ig.connected_at || null } : null });
    }
    return err("Acción desconocida");
  } catch (e) { return err(e.message, 500); }
}

export async function POST(req) {
  const yo = await auth(req); if (!yo) return err("Sin acceso", 401);
  let b = {}; try { b = await req.json(); } catch { return err("Datos inválidos"); }
  const origen = new URL(req.url).origin;
  try {
    if (b.accion === "guardar") {
      const p = b.pieza || {};
      const slides = Array.isArray(p.datos?.slides) ? p.datos.slides : [];
      if (!slides.length) return err("La pieza no tiene imágenes");
      const imagenes = [];
      for (let i = 0; i < slides.length; i++) {
        const r = await fetch(`${origen}/api/argenmaq/studio/imagen?d=${codificar(slides[i])}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`No se pudo dibujar la imagen ${i + 1}`);
        const png = Buffer.from(await r.arrayBuffer());
        imagenes.push(await subirImagen(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i + 1}.png`, png));
      }
      const fila = { tipo: p.tipo === "post" ? "post" : "historia", plantilla: String(p.plantilla || "").slice(0, 40), titulo: String(p.titulo || "").slice(0, 200), maquina_id: p.maquina_id || null, datos: p.datos || null, caption: String(p.caption || "").slice(0, 2200), hashtags: String(p.hashtags || "").slice(0, 500), imagenes, estado: "aprobada", creado_por: yo.id };
      const [creada] = await sbq(`/am_piezas`, { method: "POST", body: JSON.stringify(fila) });
      return Response.json({ ok: true, pieza: creada });
    }
    if (b.accion === "publicar") {
      const cfg = await igCfg();
      if (!cfg?.ig_user_id || !cfg?.access_token) return err("Primero conectá el Instagram de ARGENMAQ.");
      const [p] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(b.id)}&select=*&limit=1`);
      if (!p) return err("No existe la pieza", 404);
      if (p.estado === "publicada") return err("Ya está publicada");
      const igId = await igPublish({ kind: p.tipo === "historia" ? "story" : "feed", images: p.imagenes, caption: p.caption, hashtags: p.hashtags }, cfg);
      const [act] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify({ estado: "publicada", ig_id: String(igId), publicada_at: new Date().toISOString() }) });
      return Response.json({ ok: true, pieza: act });
    }
    if (b.accion === "descartar") {
      const [act] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(b.id)}`, { method: "PATCH", body: JSON.stringify({ estado: "descartada" }) });
      return Response.json({ ok: true, pieza: act });
    }
    if (b.accion === "ig_conectar") {
      const cfg = await igConnect(String(b.token || "").trim(), String(b.ig_user_id || ""));
      await igGuardar(cfg);
      return Response.json({ ok: true, ig: { username: cfg.username || null, connected_at: cfg.connected_at } });
    }
    if (b.accion === "ig_desconectar") { await igGuardar({}); return Response.json({ ok: true }); }
    return err("Acción desconocida");
  } catch (e) { return err(e.message, 500); }
}
