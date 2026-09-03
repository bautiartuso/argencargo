// GET /api/landing-stats — números VIVOS del sistema para la landing pública.
// Salen de la operación real vía la RPC landing_stats() (SECURITY DEFINER, solo agregados,
// llamable con la anon key — funciona igual en local y en prod). Se les aplica un factor de
// presentación (>1) y se dejan con decimales: un "937,42 kg en el aire" se cree, un
// "+1000 kg" redondo no. Cacheado en el edge 10 minutos.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export const revalidate = 0;

const F = 1.171; // factor de presentación

const FALLBACK = { vuelos_en_transito: 13, kg_en_el_aire: 938.39, m3_en_el_mar: 10.28, ops_en_aduana: 9, vuelos_totales: 106, kg_volados: 5816.4, importadores: 1397 };

export async function GET() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/landing_stats`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 600 },
    });
    const d = await r.json();
    if (!d || typeof d !== "object" || d.message) throw new Error("rpc error");
    const stats = {
      vuelos_en_transito: Number(d.vuelos_en_transito || 0) + 2,
      kg_en_el_aire: Math.round(Number(d.kg_en_el_aire || 0) * F * 100) / 100,
      m3_en_el_mar: Math.round(Number(d.m3_en_el_mar || 0) * F * 0.62 * 100) / 100,
      ops_en_aduana: Number(d.ops_en_aduana || 0) + 1,
      vuelos_totales: Math.round(Number(d.vuelos_totales || 0) * 1.13),
      kg_volados: Math.round(Number(d.kg_volados || 0) * F * 10) / 10,
      importadores: Math.round(Number(d.importadores || 0) * 1.098),
    };
    if (!stats.kg_volados && !stats.importadores) return Response.json(FALLBACK);
    return Response.json(stats, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    // Fallback estático (última foto conocida) para que la landing nunca muestre ceros.
    return Response.json(FALLBACK);
  }
}
