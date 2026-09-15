// Rate limit simple por IP, en memoria de la lambda.
//
// No es un rate limit distribuido (cada instancia de Vercel tiene su propio contador),
// pero alcanza para lo que necesitamos: que un endpoint público no se pueda martillar
// desde un script y nos queme la cuota de las APIs de los couriers.
// Si algún día hace falta algo serio, el reemplazo natural es Upstash/Vercel KV.

const buckets = new Map();
const MAX_BUCKETS = 5000; // techo para que la memoria no crezca sin control

export function ipDe(req) {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconocida"
  );
}

/**
 * @param {Request} req
 * @param {{ clave?: string, limite?: number, ventanaMs?: number }} opts
 * @returns {null | Response}  null = pasa; Response 429 = frenado
 */
export function limitar(req, { clave = "global", limite = 20, ventanaMs = 60_000 } = {}) {
  const ahora = Date.now();
  const k = `${clave}:${ipDe(req)}`;

  if (buckets.size > MAX_BUCKETS) {
    for (const [key, b] of buckets) {
      if (b.hasta < ahora) buckets.delete(key);
    }
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  const b = buckets.get(k);
  if (!b || b.hasta < ahora) {
    buckets.set(k, { n: 1, hasta: ahora + ventanaMs });
    return null;
  }
  b.n += 1;
  if (b.n > limite) {
    const esperar = Math.ceil((b.hasta - ahora) / 1000);
    return Response.json(
      { error: "rate_limited", message: "Demasiadas consultas seguidas. Probá de nuevo en un rato." },
      { status: 429, headers: { "Retry-After": String(esperar) } }
    );
  }
  return null;
}
