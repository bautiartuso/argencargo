// POST /api/maritimo/leer-bl (29/10/2026) — { texto } (texto del PDF del BL, sacado en el navegador)
// Devuelve los datos del contenedor FCL para precargarlos en la op: número, tipo, precinto, naviera,
// buque, viaje, MBL/HBL, puertos, bultos, peso, m³ y el agente en destino. Solo admin/empleado.
import { callClaudeText, HAIKU_MODEL } from "../../../../lib/anthropic";
import { usuarioConRol } from "../../../../lib/auth-server";
import { NAVIERAS } from "../../../../lib/navieras";

export const maxDuration = 60;

const S = { type: ["string", "null"] }, N = { type: ["number", "null"] };
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["contenedores", "vessel", "voyage", "mbl", "hbl", "forwarder", "destination_agent", "pol", "pod", "etd", "shipping_line"],
  properties: {
    contenedores: { type: "array", items: { type: "object", additionalProperties: false, required: ["container_number", "size", "seal", "packages", "gross_kg", "cbm"],
      properties: { container_number: S, size: S, seal: S, packages: N, gross_kg: N, cbm: N } } },
    vessel: S, voyage: S, mbl: S, hbl: S, forwarder: S, destination_agent: S, pol: S, pod: S, etd: S, shipping_line: S,
  },
};
const SYSTEM = `Extraés datos de un Bill of Lading (BL) marítimo de importación a Argentina. Devolvé solo lo que figura en el documento; si un dato no está, null.
- container_number: 4 letras + 7 dígitos (ej. MSMU8599988), sin espacios ni guiones. seal: el precinto (lo que va después de la barra en "MSMU8599988/FJ29648480").
- size: uno de 20, 40, 40HC, 45HC, 20RF, 40RF (1*40HQ = 40HC; 40GP/40DV = 40; 20GP = 20).
- shipping_line: la naviera dueña del buque/contenedor, uno de: ${NAVIERAS.map((x) => x.n).join(", ")}. Deducila del prefijo del contenedor o del buque (MSMU/MSCU/MEDU o "MSC ..." = MSC; COSU/CSNU/CBHU = COSCO; MAEU/MRKU/MSKU = Maersk; CMAU/CGMU = CMA CGM; HLXU/HLBU = Hapag-Lloyd; ONEU = ONE; EGHU/EMCU = Evergreen; ZIMU = ZIM; HMMU = HMM; YMLU = Yang Ming; OOLU = OOCL). Si no se puede, null.
- vessel y voyage: el buque ("MSC DOMITILLE") y el viaje ("QI641A", sin "V.").
- mbl: Master B/L. hbl: House B/L. forwarder: quien emite el BL (el NVOCC). destination_agent: a quien hay que pedir la entrega en destino ("For delivery of goods please apply to"), solo el nombre de la empresa.
- pol: puerto de carga, pod: puerto de descarga, en formato "Ciudad, País" con mayúscula inicial.
- etd: fecha de embarque/zarpe si figura (YYYY-MM-DD). packages: cantidad de bultos; gross_kg: peso bruto en kg; cbm: volumen en m³.`;

export async function POST(req) {
  if (!(await usuarioConRol(req))) return Response.json({ ok: false, error: "no_auth" }, { status: 401 });
  const { texto } = await req.json().catch(() => ({}));
  const t = String(texto || "").slice(0, 20000);
  if (t.length < 40) return Response.json({ ok: false, error: "No se pudo leer texto del PDF (¿es una foto escaneada?)" }, { status: 400 });
  try {
    const out = await callClaudeText({ model: HAIKU_MODEL, system: SYSTEM, user: t, max_tokens: 1500, json_schema: SCHEMA, feature: "leer-bl" });
    const d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim());
    d.contenedores = (d.contenedores || []).map((c) => ({ ...c, container_number: String(c.container_number || "").replace(/[^A-Z0-9]/gi, "").toUpperCase() || null })).filter((c) => c.container_number);
    return Response.json({ ok: true, ...d });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || "No se pudo leer el BL" }, { status: 500 });
  }
}
