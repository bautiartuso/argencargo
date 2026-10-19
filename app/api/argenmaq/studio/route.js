// /api/argenmaq/studio — Content Studio de ARGENMAQ (panel › Marketing › Content Studio).
//   GET  ?accion=candidatos&h=3&p=2&excluir=id,id → arma esa cantidad de historias y publicaciones (runner)
//   GET  ?accion=estado                 → estado de Instagram
//   GET  ?accion=piezas[&desde=&hasta=] → piezas guardadas (cola, calendario, historial)
//   POST {accion:"guardar", pieza, programada_at?} → dibuja las imágenes, las sube y guarda (aprobada o programada)
//   POST {accion:"programar", id, programada_at}   → la pone en el calendario (la publica el cron)
//   POST {accion:"desprogramar", id}               → vuelve a aprobada
//   POST {accion:"publicar", id}                   → publica ahora en el Instagram de ARGENMAQ
//   POST {accion:"celular", id}                    → la manda por Telegram con el link, para subirla a mano con sticker
//   POST {accion:"descartar", id} · {accion:"texto", id, caption, hashtags}
//   POST {accion:"ig_conectar", token} · {accion:"ig_desconectar"}
import { candidatos, guiones, sbq, quien, igCfg, igGuardar, igRenovar, subirImagen, publicarPieza, mandarAlCelular } from "../../../../lib/studio-argenmaq";
import { igConnect } from "../../../../lib/studio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const codificar = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const auth = async (req) => quien((req.headers.get("authorization") || "").replace(/^Bearer /i, ""));
const err = (m, s = 400) => Response.json({ error: m }, { status: s });
const unaPieza = async (id) => { const [p] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(id)}&select=*&limit=1`); return p || null; };
const patch = async (id, body) => { const [p] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }); return p; };

export async function GET(req) {
  const yo = await auth(req); if (!yo) return err("Sin acceso", 401);
  const u = new URL(req.url); const accion = u.searchParams.get("accion") || "candidatos";
  try {
    const igEstado = async () => { const ig = await igCfg(); return ig?.ig_user_id ? { username: ig.username || null, connected_at: ig.connected_at || null } : null; };
    if (accion === "estado") return Response.json({ ig: await igEstado() });
    if (accion === "candidatos") {
      const n = (k, max) => Math.max(0, Math.min(max, parseInt(u.searchParams.get(k) || "0", 10) || 0));
      const excluir = String(u.searchParams.get("excluir") || "").split(",").filter(Boolean);
      if (n("g", 6)) return Response.json({ guiones: await guiones({ cantidad: n("g", 6), excluir }) });
      const c = await candidatos({ historias: n("h", 10), publicaciones: n("p", 6), excluir });
      return Response.json({ historias: c.historias || [], publicaciones: c.publicaciones || [] });
    }
    if (accion === "piezas") {
      const piezas = await sbq(`/am_piezas?select=*&order=created_at.desc&limit=300`).catch(() => []);
      return Response.json({ piezas });
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
      if (!slides.length && p.tipo !== "guion") return err("La pieza no tiene imágenes");
      const imagenes = [];
      for (let i = 0; i < slides.length; i++) {
        const r = await fetch(`${origen}/api/argenmaq/studio/imagen?d=${codificar(slides[i])}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`No se pudo dibujar la imagen ${i + 1}`);
        const png = Buffer.from(await r.arrayBuffer());
        imagenes.push(await subirImagen(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i + 1}.png`, png));
      }
      const cuando = b.programada_at ? new Date(b.programada_at) : null;
      if (cuando && Number.isNaN(cuando.getTime())) return err("Fecha inválida");
      const tipo = ["historia", "post", "carrusel", "guion"].includes(p.tipo) ? p.tipo : "historia";
      const fila = { tipo, plantilla: String(p.plantilla || "").slice(0, 40), titulo: String(p.titulo || "").slice(0, 200), maquina_id: p.maquina_id || null, link: p.link || null, datos: p.datos || null, caption: String(p.caption || "").slice(0, 2200), hashtags: String(p.hashtags || "").slice(0, 500), imagenes, estado: cuando ? "programada" : "aprobada", programada_at: cuando ? cuando.toISOString() : null, creado_por: yo.id };
      const [creada] = await sbq(`/am_piezas`, { method: "POST", body: JSON.stringify(fila) });
      return Response.json({ ok: true, pieza: creada });
    }
    if (b.accion === "programar") {
      const cuando = new Date(b.programada_at); if (Number.isNaN(cuando.getTime())) return err("Fecha inválida");
      const p = await unaPieza(b.id); if (!p) return err("No existe la pieza", 404);
      if (p.estado === "publicada") return err("Ya está publicada");
      return Response.json({ ok: true, pieza: await patch(p.id, { estado: "programada", programada_at: cuando.toISOString(), error: null }) });
    }
    if (b.accion === "desprogramar") return Response.json({ ok: true, pieza: await patch(b.id, { estado: "aprobada", programada_at: null, error: null }) });
    if (b.accion === "texto") return Response.json({ ok: true, pieza: await patch(b.id, { caption: String(b.caption || "").slice(0, 2200), hashtags: String(b.hashtags || "").slice(0, 500) }) });
    if (b.accion === "publicar") {
      const pg = await unaPieza(b.id); if (pg?.tipo === "guion") return err("Un guion no se publica: se filma. Mandalo al celular o programalo para que te llegue ese día.");
      let cfg = await igCfg();
      if (!cfg?.ig_user_id || !cfg?.access_token) return err("Primero conectá el Instagram de ARGENMAQ.");
      cfg = await igRenovar(cfg);
      const p = await unaPieza(b.id); if (!p) return err("No existe la pieza", 404);
      if (p.estado === "publicada") return err("Ya está publicada");
      try { return Response.json({ ok: true, pieza: await publicarPieza(p, cfg) }); }
      catch (e) { await patch(p.id, { estado: "error", error: String(e.message).slice(0, 300) }).catch(() => {}); throw e; }
    }
    if (b.accion === "celular") {
      const p = await unaPieza(b.id); if (!p) return err("No existe la pieza", 404);
      const r = await mandarAlCelular(p);
      if (!r || r.skipped || r.error) return err(`Telegram no respondió: ${r?.skipped || r?.error || "sin conexión"} (se conecta desde el Studio de Argencargo).`);
      return Response.json({ ok: true });
    }
    if (b.accion === "descartar") return Response.json({ ok: true, pieza: await patch(b.id, { estado: "descartada", programada_at: null }) });
    if (b.accion === "ig_conectar") {
      const cfg = await igConnect(String(b.token || "").trim(), String(b.ig_user_id || ""));
      await igGuardar(cfg);
      return Response.json({ ok: true, ig: { username: cfg.username || null, connected_at: cfg.connected_at } });
    }
    if (b.accion === "ig_desconectar") { await igGuardar({}); return Response.json({ ok: true }); }
    return err("Acción desconocida");
  } catch (e) { return err(e.message, 500); }
}
