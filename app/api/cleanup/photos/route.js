// GET /api/cleanup/photos — cron diario que libera espacio del bucket "package-photos".
//
// Tres reglas, se aplican todas:
//   A) La foto se subió hace más de N días (default 90), sin importar el estado de la op.
//   B) La operación se cerró hace más de M días (default 30).
//   C) El archivo está en el storage y ninguna fila de la base lo referencia (huérfano).
//
// Las dos primeras además ponen photo_url en NULL. La tercera es la que más libera: al borrar
// una op o reemplazar una foto, la fila se iba pero el archivo quedaba ocupando lugar para
// siempre. Se le da margen de 2 días para no pisar una foto recién subida cuya fila todavía
// no se escribió.
//
// Config editable desde calc_config:
//   photo_retention_days              (A, default 90)
//   photo_retention_after_close_days  (B, default 30)

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = "package-photos";
const GRACIA_HUERFANOS_DIAS = 2;

export const maxDuration = 60;

const sb = (path, opts = {}) =>
  fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });

const j = async (path) => { const r = await sb(path); return r.ok ? r.json() : []; };

// .../storage/v1/object/public/package-photos/<PATH> → <PATH>
function storagePath(url) {
  if (!url) return null;
  const m = String(url).match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function borrarDelStorage(paths) {
  const limpios = [...new Set(paths.filter(Boolean))];
  if (limpios.length === 0) return 0;
  // De a 100 por si la lista es larga
  let borrados = 0;
  for (let i = 0; i < limpios.length; i += 100) {
    const lote = limpios.slice(i, i + 100);
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: lote }),
    });
    if (r.ok) borrados += lote.length;
    else console.error("[cleanup] storage delete", await r.text());
  }
  return borrados;
}

async function limpiarColumna(tabla, ids) {
  if (!ids.length) return;
  await sb(`/rest/v1/${tabla}?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ photo_url: null, photo_uploaded_at: null }),
  });
}


// Solo el cron de Vercel (Bearer CRON_SECRET) puede disparar esto. Sin el chequeo, cualquiera
// que conociera la URL podia ejecutarlo a voluntad.
function autorizado(req) {
  const auth = req.headers.get("authorization") || "";
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  try {
    const cfg = await j(`/rest/v1/calc_config?key=in.(photo_retention_days,photo_retention_after_close_days)&select=key,value`);
    const val = (k, def) => { const r = (Array.isArray(cfg) ? cfg : []).find((x) => x.key === k); const n = parseInt(r?.value); return Number.isFinite(n) && n > 0 ? n : def; };
    const diasSubida = val("photo_retention_days", 90);
    const diasCierre = val("photo_retention_after_close_days", 30);

    const corte = (d) => new Date(Date.now() - d * 86400000).toISOString();
    const aBorrar = [];               // paths del storage
    const porTabla = { operation_packages: [], unassigned_packages: [] };

    // ── A) Fotos subidas hace más de N días
    for (const tabla of ["operation_packages", "unassigned_packages"]) {
      const filas = await j(`/rest/v1/${tabla}?photo_url=not.is.null&photo_uploaded_at=lt.${corte(diasSubida)}&select=id,photo_url`);
      for (const f of filas) { aBorrar.push(storagePath(f.photo_url)); porTabla[tabla].push(f.id); }
    }

    // ── B) Operaciones cerradas hace más de M días
    const ops = await j(`/rest/v1/operations?status=in.(operacion_cerrada,cancelada)&closed_at=lt.${corte(diasCierre)}&select=id`);
    const opIds = ops.map((o) => o.id);
    if (opIds.length) {
      // de a 200 ids por URL, que si no se pasa de largo
      for (let i = 0; i < opIds.length; i += 200) {
        const lote = opIds.slice(i, i + 200);
        const filas = await j(`/rest/v1/operation_packages?operation_id=in.(${lote.join(",")})&photo_url=not.is.null&select=id,photo_url`);
        for (const f of filas) { aBorrar.push(storagePath(f.photo_url)); porTabla.operation_packages.push(f.id); }
      }
    }

    // ── C) Huérfanos: archivos que ninguna fila referencia
    const referencias = new Set();
    for (const [tabla, col] of [
      ["operation_packages", "photo_url"], ["unassigned_packages", "photo_url"],
      ["gi_quote_products", "photo_url"], ["gi_quote_request_products", "photo_url"],
    ]) {
      const filas = await j(`/rest/v1/${tabla}?${col}=not.is.null&select=${col}`);
      for (const f of filas) { const p = storagePath(f[col]); if (p) referencias.add(p); }
    }
    // Los que estamos por borrar en A/B ya no cuentan como referencia viva
    for (const p of aBorrar) referencias.delete(p);

    const archivos = await j(`/rest/v1/rpc/listar_objetos_bucket?p_bucket=${BUCKET}`);
    let huerfanos = 0;
    const limiteHuerfano = Date.now() - GRACIA_HUERFANOS_DIAS * 86400000;
    for (const a of (Array.isArray(archivos) ? archivos : [])) {
      if (referencias.has(a.name)) continue;
      if (new Date(a.created_at).getTime() > limiteHuerfano) continue; // recién subido
      aBorrar.push(a.name);
      huerfanos++;
    }

    // ── D) Notificaciones viejas: es la tabla mas grande de la base (30k filas) y nadie
    // relee una notificacion de hace meses. Leidas: 60 dias. Sin leer: 180.
    await sb(`/rest/v1/notifications?read=is.true&created_at=lt.${corte(60)}`, { method: "DELETE" });
    await sb(`/rest/v1/notifications?read=is.false&created_at=lt.${corte(180)}`, { method: "DELETE" });

    const borrados = await borrarDelStorage(aBorrar);
    await limpiarColumna("operation_packages", [...new Set(porTabla.operation_packages)]);
    await limpiarColumna("unassigned_packages", [...new Set(porTabla.unassigned_packages)]);

    return Response.json({
      ok: true,
      borrados_del_storage: borrados,
      por_antiguedad: porTabla.operation_packages.length + porTabla.unassigned_packages.length,
      huerfanos,
      dias_desde_subida: diasSubida,
      dias_desde_cierre: diasCierre,
    });
  } catch (e) {
    console.error("[cleanup] error", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
