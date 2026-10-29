// Mail con los papeles de la importación (29/10/2026). Al cerrar una op cuyo legajo el cliente ve
// completo (RI con entrega directa que paga los impuestos, o marcado "Sí" a mano), le sale un mail
// desde el Gmail conectado, con la firma, como si se lo mandara Bautista: DSI, factura del courier,
// guía aérea, factura de la mercadería y, si se facturó, la factura de Argencargo. Lo dispara el cron
// /api/cron/legajo-mail; queda marcado en sent_notifications.email_legajo.
import { cargarLegajo } from "./legajo-server";
import { leerConfig, gm, armarMime, b64url } from "./gmail";
import { FIRMA_DEF, firmaHtml, firmaTexto } from "./firma-mail";
import { launchBrowser } from "./chromium";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });

// En el orden en que van en el mail.
const PAPELES = [
  ["dsi", "Destinación simplificada (DSI)", "DSI"],
  ["factura_courier", "Factura del courier (impuestos)", "Factura courier"],
  ["guia_aerea", "Guía aérea", "Guia aerea"],
  ["factura_comercial", "Factura de la mercadería", "Factura de la mercaderia"],
];
const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function firma() {
  const r = await svc("/storage/v1/object/mail-config/preferencias.json");
  let d = {}; if (r.ok) { try { d = await r.json(); } catch {} }
  return { ...FIRMA_DEF, ...(d.firma || {}) };
}

// Arma el mail (sin mandarlo). Devuelve { omitir: motivo } si no corresponde.
export async function armarMailLegajo(opId) {
  const l = await cargarLegajo(null, opId, { servidor: true });
  if (l.error) return { omitir: l.error };
  if (!l.visible || l.nivel !== "completo") return { omitir: "el cliente no ve el legajo completo" };
  const code = l.op.operation_code;
  const [cliR, opR] = await Promise.all([
    svc(`/rest/v1/clients?id=eq.${l.cliente.id}&select=email,first_name&limit=1`).then((r) => r.json()).catch(() => []),
    svc(`/rest/v1/operations?id=eq.${opId}&select=description&limit=1`).then((r) => r.json()).catch(() => []),
  ]);
  const email = String(cliR?.[0]?.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { omitir: "el cliente no tiene mail" };

  const adjuntos = [], lineas = [];
  for (const [tipo, titulo, archivo] of PAPELES) {
    const d = l.docs.find((x) => x.tipo === tipo);
    if (!d) continue;
    const r = await fetch(d.url).catch(() => null);
    if (!r?.ok) continue;
    const ext = d.ext === "jpeg" ? "jpg" : d.ext;
    adjuntos.push({ nombre: `${archivo} ${code}.${ext}`, tipo: MIME[ext] || "application/octet-stream", datos: Buffer.from(await r.arrayBuffer()).toString("base64") });
    lineas.push(titulo);
  }
  // Factura de Argencargo: solo si se facturó (no siempre). Se imprime la página pública con Chromium.
  const facturas = l.facturas.filter((f) => f.tipo === "Factura C");
  if (facturas.length) {
    let browser = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      for (const f of facturas) {
        await page.goto(f.url, { waitUntil: "networkidle0", timeout: 40000 });
        const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } });
        adjuntos.push({ nombre: `Factura Argencargo ${f.numero}.pdf`, tipo: "application/pdf", datos: Buffer.from(pdf).toString("base64") });
        lineas.push(`Factura de Argencargo N.º ${f.numero}`);
      }
    } catch (e) { console.error("[legajo-mail] factura", code, e.message); }
    finally { if (browser) await browser.close().catch(() => {}); }
  }
  if (!adjuntos.length) return { omitir: "no hay papeles para mandar" };

  const nombre = String(cliR?.[0]?.first_name || l.cliente.first_name || "").trim().split(/\s+/)[0];
  const desc = String(opR?.[0]?.description || "").trim();
  const texto = `Hola${nombre ? ` ${nombre}` : ""}, ¿cómo estás?

Te comparto la documentación de tu importación ${code}${desc ? ` (${desc})` : ""}, que ya quedó cerrada. Te adjunto:

${lineas.map((x) => `• ${x}`).join("\n")}

Los tenés también siempre a mano en tu portal, entrando a la operación → Legajo.

Cualquier cosa que necesites, avisame.

Saludos,`;
  return { para: email, asunto: `Documentación de tu importación ${code}`, texto, adjuntos, lineas };
}

// Manda el mail por el Gmail conectado. Devuelve { ok, id } o { omitir } o { error }.
export async function enviarMailLegajo(opId) {
  const m = await armarMailLegajo(opId);
  if (m.omitir) return m;
  const cfg = await leerConfig();
  if (!cfg?.refresh_token) return { error: "Gmail no conectado" };
  const f = await firma();
  const extra = f.activa !== false ? { htmlExtra: firmaHtml(f), textoExtra: firmaTexto(f) } : {};
  const mime = armarMime({ de: cfg.email, para: m.para, asunto: m.asunto, texto: m.texto, adjuntos: m.adjuntos, ...extra });
  try {
    const d = await gm("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(Buffer.from(mime, "utf8")) }) });
    return { ok: true, id: d?.id || null, para: m.para, papeles: m.lineas };
  } catch (e) { return { error: e.message || "Gmail rechazó el envío" }; }
}

// Marca en la op que el mail salió (o que no correspondía), sin pisar el resto de sent_notifications.
export async function marcarMailLegajo(opId, valor) {
  const r = await svc(`/rest/v1/operations?id=eq.${opId}&select=sent_notifications&limit=1`).then((x) => x.json()).catch(() => []);
  const sn = { ...(r?.[0]?.sent_notifications || {}), email_legajo: valor };
  await svc(`/rest/v1/operations?id=eq.${opId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_notifications: sn }) });
}
