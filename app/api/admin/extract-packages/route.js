// POST /api/admin/extract-packages — lee la foto del desglose de bultos del courier
// (la que sube el agente al despachar) con visión de Claude y devuelve las filas
// estructuradas: peso real y dimensiones por bulto. El admin las revisa, asigna a la
// operación que corresponda (los vuelos multi-op no se adivinan) y las aplica.
//
// Body: { flight_id }  →  { bultos: [{peso_kg, largo_cm, ancho_cm, alto_cm}], total_kg }

import { callClaudeVision, limpiarJson } from "../../../../lib/anthropic";
import { payloadVerificado } from "../../../../lib/auth-server";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  return r.ok ? r.json() : null;
}

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = (await payloadVerificado(auth.slice(7)));
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && ["admin","empleado"].includes(p[0]?.role);
  } catch { return false; }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body = null; try { body = await req.json(); } catch {}
  if (!body?.flight_id) return Response.json({ error: "flight_id requerido" }, { status: 400 });

  const fl = await sb(`/flights?id=eq.${body.flight_id}&select=dispatch_photo_url,flight_code&limit=1`);
  const flight = Array.isArray(fl) && fl[0];
  if (!flight?.dispatch_photo_url) return Response.json({ error: "El vuelo no tiene foto del desglose cargada" }, { status: 400 });

  const imgRes = await fetch(flight.dispatch_photo_url);
  if (!imgRes.ok) return Response.json({ error: "No se pudo descargar la foto" }, { status: 502 });
  const mime = imgRes.headers.get("content-type") || "image/jpeg";
  const b64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

  try {
    // 26/11/2026: el agente a veces manda su planilla sin encabezados en vez de la captura del courier
    // (FL-0188): nº, destino, cantidad de bultos solo en la primera fila, largo, ancho, alto, peso bruto,
    // volumétrico y un código repetido. La lectura tomaba la cantidad (14) como peso del primer bulto y
    // dejaba el resto vacío. Va con el modelo principal: sin encabezados hay que razonar qué columna es cuál.
    const raw = await callClaudeVision({
      system: "Extraés datos de tablas de bultos de couriers y agentes de carga chinos. Devolvés SOLO el JSON pedido, sin comentarios.",
      prompt: `La imagen es el desglose de bultos de un envío. Puede venir de dos formas:

A) Captura del sistema del courier, con encabezados en chino: 序号=nro, 实重=peso real kg, 长/宽/高=largo/ancho/alto cm, 材重=peso volumétrico, 收费重=peso facturable, 体积=volumen.

B) Planilla SIN encabezados. Las columnas suelen ser, en este orden: número de fila; destino (por ejemplo 阿根廷); a veces una columna con la CANTIDAD total de bultos escrita solo en la primera fila; largo, ancho y alto en cm (tres números enteros seguidos); el peso real (bruto) en kg; el peso volumétrico; y un código que se repite igual en todas las filas.

Cómo ubicar el peso real cuando no hay encabezados:
- El peso volumétrico es largo × ancho × alto ÷ 5000 (o ÷ 6000). Comprobalo con una fila: la columna que coincide con esa cuenta es el volumétrico y NO es lo que pido.
- El peso real es la otra columna con decimales, la que está al lado del volumétrico. Cambia en cada fila.
- Un número que aparece en una sola fila y coincide con la cantidad de filas es la cantidad de bultos: no es un peso.
- Un número idéntico en todas las filas es un código: no es un peso.

Extraé UNA fila por bulto, en el orden de la imagen, con:
- numeros: TODOS los números de esa fila, de izquierda a derecha, tal como están escritos (sin saltear ninguno).
- peso_kg: el peso real en kg. largo_cm, ancho_cm, alto_cm: las medidas.
- volumetrico_kg: el peso volumétrico que figura en la fila (null si la tabla no lo trae).
Leé cada fila por separado, dígito por dígito: los pesos tienen decimales y dos filas pueden parecerse. Ignorá los totales del pie. Si un valor no se lee, poné null.`,
      thinking: "adaptive",
      images: [b64],
      media_type: mime,
      max_tokens: 9000,
      json_schema: {
        type: "object",
        properties: {
          bultos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                numeros: { type: "array", items: { type: "number" } },
                peso_kg: { type: ["number", "null"] },
                volumetrico_kg: { type: ["number", "null"] },
                largo_cm: { type: ["number", "null"] },
                ancho_cm: { type: ["number", "null"] },
                alto_cm: { type: ["number", "null"] },
              },
              required: ["numeros", "peso_kg", "volumetrico_kg", "largo_cm", "ancho_cm", "alto_cm"],
              additionalProperties: false,
            },
          },
        },
        required: ["bultos"],
        additionalProperties: false,
      },
    });
    let parsed = typeof raw === "string" ? JSON.parse(limpiarJson(raw)) : raw;
    if (Array.isArray(parsed)) parsed = { bultos: parsed }; // el respaldo a veces devuelve la lista suelta
    const bultos = (parsed?.bultos || []).filter((b) => b.peso_kg != null || b.largo_cm != null);
    // Resguardo de columna corrida: si en una fila el "peso" leído es justo el volumétrico (largo × ancho × alto
    // ÷ 5000 o ÷ 6000) y en las demás filas el peso está siempre a la misma distancia del volumétrico, se toma
    // de esa posición el número de la fila (FL-0188: una fila salía con el volumétrico como peso).
    const cerca = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= 0.02;
    const posVol = (b) => { const v = Number(b.largo_cm) * Number(b.ancho_cm) * Number(b.alto_cm); if (!(v > 0) || !Array.isArray(b.numeros)) return -1; return b.numeros.findIndex((n) => cerca(n, v / 5000) || cerca(n, v / 6000) || cerca(n, Math.round(v / 5) / 1000) || cerca(n, Math.round(v / 6) / 1000)); };
    const saltos = {};
    for (const b of bultos) { const j = posVol(b); if (j < 0 || b.peso_kg == null || cerca(b.peso_kg, b.numeros[j])) continue; const i = b.numeros.findIndex((n, k) => k !== j && cerca(n, b.peso_kg)); if (i >= 0) saltos[i - j] = (saltos[i - j] || 0) + 1; }
    const salto = Object.entries(saltos).sort((a, b) => b[1] - a[1])[0];
    if (salto && salto[1] >= Math.max(2, bultos.length / 2)) for (const b of bultos) { const j = posVol(b); if (j < 0 || !cerca(b.peso_kg, b.numeros[j])) continue; const n = b.numeros[j + Number(salto[0])]; if (n != null && n > 0) b.peso_kg = n; }
    for (const b of bultos) { delete b.numeros; delete b.volumetrico_kg; }
    // Resguardo: si el único "peso" leído es igual a la cantidad de filas, era la cantidad de bultos.
    const conPeso = bultos.filter((b) => b.peso_kg != null);
    if (bultos.length > 1 && conPeso.length === 1 && Number(conPeso[0].peso_kg) === bultos.length) conPeso[0].peso_kg = null;
    if (bultos.length === 0) return Response.json({ error: "No se pudieron leer bultos de la foto" }, { status: 422 });
    const total = Math.round(bultos.reduce((a, b) => a + Number(b.peso_kg || 0), 0) * 100) / 100;
    return Response.json({ ok: true, bultos, total_kg: total, flight_code: flight.flight_code });
  } catch (e) {
    return Response.json({ error: `No se pudo procesar la imagen: ${String(e.message).slice(0, 200)}` }, { status: 502 });
  }
}
