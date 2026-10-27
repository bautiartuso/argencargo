// GET /api/portal/dsi?op_id=…[&formato=html][&ver=1][&s=firma]
// Destinación simplificada de Argencargo (27/10/2026) para monotributistas y consumidores finales:
// formato de la de DHL con los datos reales de la DSI de ARCA y solo la mercadería del cliente.
// Acceso: el cliente dueño de la op, admin/empleado, o un link firmado (?s=) que genera el equipo
// con &firmar=1 para poder mandarlo o abrirlo sin sesión.
import { quienLlama, firmaLink } from "../../../../lib/auth-server";
import { leerDsiPdf } from "../../../../lib/dsi-server";
import { armarDsiArgencargo, dsiArgencargoHtml, condicionDgi } from "../../../../lib/dsi-argencargo";
import { nombreArchivo, BASE_URL } from "../../../../lib/legajo-server";
import { launchBrowser } from "../../../../lib/chromium";
import { arcaReady, arcaConfig, consultarPadron } from "../../../../lib/arca";
import { minKgAereoDe } from "../../../../lib/calc";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const TASA_FLETE_DECLARADO = 3.5;

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const UUID = /^[0-9a-f-]{36}$/i;
async function svc(path, init = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {}
  return Array.isArray(d) ? d : d;
}
const lista = (x) => (Array.isArray(x) ? x : []);
const json = (d, status = 200) => Response.json(d, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const opId = q.get("op_id") || "";
  if (!UUID.test(opId)) return json({ error: "op_invalida" }, 400);
  const firmado = q.get("s") && q.get("s") === firmaLink(`dsi:${opId}`);

  const [op] = lista(await svc(`/rest/v1/operations?id=eq.${opId}&select=id,operation_code,channel,origin,created_at,client_id,clients(auth_user_id,tax_condition)&limit=1`));
  if (!op) return json({ error: "no_encontrada" }, 404);
  let quien = null;
  if (!firmado) {
    quien = await quienLlama(req);
    const esDueno = quien?.id && op.clients?.auth_user_id === quien.id;
    if (!quien?.staff && !esDueno) return json({ error: "no_autorizado" }, 401);
  }
  // El equipo pide el link firmado para abrirlo o compartirlo.
  if (q.get("firmar") === "1") {
    if (!quien?.staff) return json({ error: "no_autorizado" }, 401);
    return json({ url: `${BASE_URL}/api/portal/dsi?op_id=${opId}&s=${firmaLink(`dsi:${opId}`)}&ver=1` });
  }

  const [docs, fos, bultosR, fii] = await Promise.all([
    svc(`/rest/v1/legajo_docs?operation_id=eq.${opId}&tipo=eq.dsi&borrado_at=is.null&storage_path=not.is.null&select=id,storage_path,datos,flight_id,uploaded_at&order=uploaded_at.desc`),
    svc(`/rest/v1/flight_operations?operation_id=eq.${opId}&select=flight_id,flights(id,flight_code,international_carrier,international_tracking,dest_name,dest_tax_id,dest_address,received_at)`),
    svc(`/rest/v1/operation_packages?operation_id=eq.${opId}&select=quantity,gross_weight_kg,length_cm,width_cm,height_cm`),
    svc(`/rest/v1/flight_invoice_items?operation_id=eq.${opId}&select=flight_id,description,quantity,unit_price_declared_usd,hs_code,sort_order&order=sort_order.asc`),
  ]);
  const doc = lista(docs)[0];
  if (!doc) return json({ error: "sin_dsi", mensaje: "La operación todavía no tiene la DSI cargada en el legajo." }, 404);
  const fo = lista(fos).find((x) => x.flight_id === doc.flight_id) || lista(fos)[0];
  const flight = fo?.flights || null;

  // Cabecera completa: si la DSI se cargó antes de que el lector la sacara, se lee del PDF y se guarda.
  let datos = doc.datos || {};
  if (!datos.cab?.idLiquidacion) {
    const r = await fetch(`${SB_URL}/storage/v1/object/legajos/${doc.storage_path}`, { headers: { apikey: SB, Authorization: `Bearer ${SB}` } });
    if (r.ok) {
      try {
        const leido = await leerDsiPdf(await r.arrayBuffer());
        if (leido?.cab?.idLiquidacion || leido?.lines?.length) {
          datos = { ...datos, ...leido, cab: { ...(datos.cab || {}), ...leido.cab } };
          await svc(`/rest/v1/legajo_docs?storage_path=eq.${encodeURIComponent(doc.storage_path)}&tipo=eq.dsi`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ datos }) });
        }
      } catch (e) { console.error("[portal/dsi] lectura", e?.message); }
    }
  }
  // Condición ante ARCA de quien figura como destinatario de la guía (se consulta una vez y se guarda).
  const cuitDest = String(datos.cab?.destinatarioCuit || datos.destinatario?.cuit || flight?.dest_tax_id || "").replace(/\D/g, "");
  if (cuitDest.length === 11 && datos.cab && datos.cab.destinatarioCondIva === undefined && arcaReady()) {
    try {
      const cfg = await arcaConfig();
      const p = await consultarPadron(cuitDest, cfg?.environment === "produccion" ? "produccion" : "homologacion");
      datos = { ...datos, cab: { ...datos.cab, destinatarioCondIva: p?.cond_iva ?? 5 } };
      await svc(`/rest/v1/legajo_docs?storage_path=eq.${encodeURIComponent(doc.storage_path)}&tipo=eq.dsi`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ datos }) });
    } catch (e) { console.error("[portal/dsi] padrón", e?.message); }
  }

  const opsEnGuia = flight?.id ? lista(await svc(`/rest/v1/flight_operations?flight_id=eq.${flight.id}&select=operation_id`)).length : 1;
  const items = lista(fii).filter((i) => !flight?.id || i.flight_id === flight.id);
  const bultos = lista(bultosR).reduce((a, p) => a + Number(p.quantity || 1), 0) || 1;
  // Flete declarado para monotributo/CF: USD 3,5 por kg facturable, con el mismo
  // mínimo y el mismo volumétrico (÷5000) que la calculadora.
  const pf = lista(bultosR).reduce((a, p) => { const q = Number(p.quantity || 1); const b = Number(p.gross_weight_kg || 0) * q; const l = Number(p.length_cm || 0), w = Number(p.width_cm || 0), h = Number(p.height_cm || 0); const v = l && w && h ? (l * w * h / 5000) * q : 0; return a + Math.max(b, v); }, 0);
  // Bautista, 27/10/2026: en la destinación va USD 3,5/kg, que es lo que se declara. (calc_config
  // cert_flete_aereo_ficticio sigue en 3,25 para la calculadora; no se toca desde acá.)
  const tasaFlete = TASA_FLETE_DECLARADO;
  const kg = pf > 0 ? Math.max(pf, minKgAereoDe(op.origin, op.created_at ? Date.parse(op.created_at) : Date.now())) : 0;
  const fleteDeclarado = kg > 0 ? Math.round(kg * tasaFlete * 100) / 100 : null;
  const d = armarDsiArgencargo({ dsi: datos, flight, op, items, bultos, condicion: condicionDgi(datos.cab?.destinatarioCondIva), unica: opsEnGuia === 1, fleteDeclarado });
  const html = dsiArgencargoHtml(d);
  if (q.get("formato") === "html") return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const nombre = nombreArchivo(`Destinacion simplificada ${op.operation_code}.pdf`);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${q.get("ver") === "1" ? "inline" : "attachment"}; filename="${nombre}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[portal/dsi] pdf", e?.message);
    return json({ error: "pdf" }, 500);
  } finally { if (browser) await browser.close().catch(() => {}); }
}
