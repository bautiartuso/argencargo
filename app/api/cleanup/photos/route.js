// GET /api/cleanup/photos — cron diario: borra fotos de bultos de ops cerradas hace +N días
// Config: calc_config.photo_retention_days (default 90)
// Borra del storage bucket "package-photos" + setea photo_url=NULL

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  return r;
}

// Extrae el path dentro del bucket de una URL pública del Storage
// .../storage/v1/object/public/package-photos/<PATH> → <PATH>
function extractStoragePath(url) {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/public\/package-photos\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req) {
  try {
    // 1. Leer retention days
    const cfgR = await sb(`/rest/v1/calc_config?key=eq.photo_retention_days&select=value`);
    const cfg = await cfgR.json();
    const retentionDays = parseInt(cfg?.[0]?.value) || 90;
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

    // 2. Encontrar ops cerradas hace +N días
    const opsR = await sb(`/rest/v1/operations?status=eq.operacion_cerrada&closed_at=lt.${cutoff}&select=id,operation_code,closed_at`);
    const ops = await opsR.json();
    if (!Array.isArray(ops) || ops.length === 0) {
      return Response.json({ ok: true, deleted: 0, ops_checked: 0, retention_days: retentionDays });
    }

    const opIds = ops.map(o => o.id);

    // 3. Buscar bultos con foto cargada de esas ops
    const pkgsR = await sb(`/rest/v1/operation_packages?operation_id=in.(${opIds.join(",")})&photo_url=not.is.null&select=id,photo_url`);
    const pkgs = await pkgsR.json();
    if (!Array.isArray(pkgs) || pkgs.length === 0) {
      return Response.json({ ok: true, deleted: 0, ops_checked: ops.length, retention_days: retentionDays });
    }

    // 4. Borrar del storage en bulk (Supabase Storage acepta array de paths en DELETE /storage/v1/object/<bucket>)
    const paths = pkgs.map(p => extractStoragePath(p.photo_url)).filter(Boolean);
    if (paths.length > 0) {
      // Storage DELETE: enviar prefixes en body
      const delR = await fetch(`${SB_URL}/storage/v1/object/package-photos`, {
        method: "DELETE",
        headers: {
          apikey: SB_SERVICE,
          Authorization: `Bearer ${SB_SERVICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!delR.ok) {
        const txt = await delR.text();
        console.error("storage delete error", txt);
      }
    }

    // 5. Nullificar photo_url en la DB para esos bultos
    const pkgIds = pkgs.map(p => p.id);
    await sb(`/rest/v1/operation_packages?id=in.(${pkgIds.join(",")})`, {
      method: "PATCH",
      body: JSON.stringify({ photo_url: null, photo_uploaded_at: null }),
    });

    return Response.json({
      ok: true,
      deleted: pkgs.length,
      ops_checked: ops.length,
      retention_days: retentionDays,
      sample_ops: ops.slice(0, 3).map(o => o.operation_code),
    });
  } catch (e) {
    console.error("cleanup error", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
