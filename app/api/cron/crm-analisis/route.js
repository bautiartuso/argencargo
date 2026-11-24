// /api/cron/crm-analisis — el análisis comercial de cada persona (23/11/2026), cada 10 minutos.
// Toma de la base a quienes les falta el análisis o les cambió algo desde el último (un chat nuevo,
// una cotización, una importación entregada, un contacto de seguimiento) y los analiza con Claude
// (lib/crm-analisis.js). Solo gente con algo para leer; el resto no gasta.
// POST {clave} con token de admin/empleado → analiza a esa persona ahora (botón "Analizar de nuevo").
import { esCronValido, usuarioConRol } from "../../../../lib/auth-server";
import { analizarPersona, personaPorClave, personasPendientes } from "../../../../lib/crm-analisis";

export const maxDuration = 300;
const TANDA = 24, A_LA_VEZ = 4, TOPE_MS = 240e3;

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const t0 = Date.now();
  const fila = await personasPendientes(TANDA);
  let hechos = 0, fallas = 0, i = 0;
  const uno = async () => { while (i < fila.length && Date.now() - t0 < TOPE_MS) { const p = fila[i++]; const r = await analizarPersona(p); if (r.error) { fallas++; console.error("[crm-analisis]", p.clave, r.error); } else hechos++; } };
  await Promise.all(Array.from({ length: A_LA_VEZ }, uno));
  return Response.json({ ok: true, en_fila: fila.length, analizados: hechos, fallas });
}

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!/^[ck]:[0-9a-f-]{36}$/.test(String(b.clave || ""))) return Response.json({ error: "Falta la persona" }, { status: 400 });
  const p = await personaPorClave(b.clave);
  if (!p) return Response.json({ error: "Persona inexistente" }, { status: 404 });
  const r = await analizarPersona(p);
  if (r.error) return Response.json({ error: r.error }, { status: 500 });
  return Response.json({ ok: true, analisis: { temperatura: r.temperatura, lectura: r.lectura, siguiente: r.siguiente, mensaje: r.mensaje, quien: r.quien, analizado_at: r.analizado_at } });
}
