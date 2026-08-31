// lib/arca.js — Facturación electrónica ARCA (ex AFIP) para monotributista (Factura C).
//
// Tres piezas, todas contra los web services OFICIALES y gratuitos de ARCA:
//   · WSAA: autenticación — se firma un ticket (TRA) con el certificado digital y ARCA
//     devuelve token+sign válidos 12 h (se cachean en arca_config, serverless no tiene RAM).
//   · WSFEv1: emisión — FECAESolicitar devuelve el CAE que hace válida la factura.
//   · Padrón (ws_sr_constancia_inscripcion): datos del receptor a partir del CUIT.
//
// La integración es de UNA VÍA: este código llama a ARCA solo al facturar; ARCA no tiene
// ningún acceso al sistema.
//
// Env (Vercel): ARCA_CUIT (emisor), ARCA_CERT (PEM base64), ARCA_KEY (clave privada PEM
// base64). Ambiente y punto de venta viven en la tabla arca_config.

import forge from "node-forge";
import https from "node:https";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

// Los servidores SOAP de ARCA (servicios1.afip.gov.ar) usan TLS con parámetros DH viejos
// que Node moderno rechaza (ERR_SSL_DH_KEY_TOO_SMALL) — se baja el nivel de seguridad
// SOLO para estas llamadas, con un agente propio. fetch (undici) no acepta agente https,
// así que el POST SOAP va por node:https directo.
const arcaAgent = new https.Agent({ ciphers: "DEFAULT:@SECLEVEL=1", keepAlive: true });
function soapPost(url, headers, body, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      host: u.hostname, path: u.pathname + u.search, method: "POST",
      agent: arcaAgent, timeout: timeoutMs,
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { data += c; });
      res.on("end", () => resolve(data));
    });
    req.on("timeout", () => { req.destroy(new Error("ARCA timeout")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const URLS = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
    padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
};

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: opts.method ? "return=representation" : undefined, ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

export async function arcaConfig() {
  const r = await sb(`/arca_config?id=eq.1&limit=1`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
}

export function arcaReady() {
  return !!(process.env.ARCA_CUIT && process.env.ARCA_CERT && process.env.ARCA_KEY);
}

function pem(name) {
  return Buffer.from(process.env[name] || "", "base64").toString("utf8");
}

// Extrae el contenido de un tag XML (los WS de ARCA devuelven XML plano y estable —
// un parser completo sería más frágil que esto para respuestas tan acotadas).
function xmlTag(xml, tag) {
  const m = String(xml).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}
function xmlAll(xml, tag) {
  return [...String(xml).matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1].trim());
}
const unesc = (s) => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── WSAA: ticket de acceso (token+sign, 12 h) ────────────────────────────────
async function loginWsaa(service, env) {
  const now = Date.now();
  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now / 1000)}</uniqueId>
    <generationTime>${new Date(now - 10 * 60000).toISOString().slice(0, 19)}-00:00</generationTime>
    <expirationTime>${new Date(now + 10 * 60000).toISOString().slice(0, 19)}-00:00</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

  // Firma CMS (PKCS#7) del TRA con el certificado — el equivalente de openssl smime -sign.
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  const cert = forge.pki.certificateFromPem(pem("ARCA_CERT"));
  const key = forge.pki.privateKeyFromPem(pem("ARCA_KEY"));
  p7.addCertificate(cert);
  p7.addSigner({
    key, certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  const cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body>
</soapenv:Envelope>`;
  const xml = await soapPost(URLS[env].wsaa, { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" }, soap, 20000);
  const fault = xmlTag(xml, "faultstring");
  if (fault) throw new Error(`WSAA: ${fault}`);
  const inner = unesc(xmlTag(xml, "loginCmsReturn") || "");
  const token = xmlTag(inner, "token");
  const sign = xmlTag(inner, "sign");
  const expira = xmlTag(inner, "expirationTime");
  if (!token || !sign) throw new Error("WSAA: respuesta sin token/sign");
  return { token, sign, expires: expira ? new Date(expira).toISOString() : new Date(now + 11.5 * 3600000).toISOString() };
}

// Ticket con cache en arca_config (renueva si faltan <30 min).
export async function getTicket(service, env) {
  const cfg = await arcaConfig();
  if (cfg?.wsaa_service === `${service}:${env}` && cfg.wsaa_token && cfg.wsaa_expires_at && new Date(cfg.wsaa_expires_at).getTime() - Date.now() > 30 * 60000) {
    return { token: cfg.wsaa_token, sign: cfg.wsaa_sign };
  }
  const t = await loginWsaa(service, env);
  await sb(`/arca_config?id=eq.1`, { method: "PATCH", body: JSON.stringify({ wsaa_token: t.token, wsaa_sign: t.sign, wsaa_service: `${service}:${env}`, wsaa_expires_at: t.expires, updated_at: new Date().toISOString() }) });
  return t;
}

// ── WSFE: SOAP genérico ──────────────────────────────────────────────────────
async function wsfe(method, innerXml, env) {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Body><ar:${method}>${innerXml}</ar:${method}></soap:Body>
</soap:Envelope>`;
  const xml = await soapPost(URLS[env].wsfe, { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `http://ar.gov.afip.dif.FEV1/${method}` }, soap, 25000);
  const fault = xmlTag(xml, "faultstring");
  if (fault) throw new Error(`WSFE: ${fault}`);
  return xml;
}

function authXml(t, cuit) {
  return `<ar:Auth><ar:Token>${t.token}</ar:Token><ar:Sign>${t.sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;
}

export async function ultimoComprobante(ptoVta, tipoCbte, env) {
  const cuit = process.env.ARCA_CUIT;
  const t = await getTicket("wsfe", env);
  const xml = await wsfe("FECompUltimoAutorizado", `${authXml(t, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${tipoCbte}</ar:CbteTipo>`, env);
  const err = xmlTag(xml, "Msg");
  const nro = xmlTag(xml, "CbteNro");
  if (nro == null) throw new Error(`WSFE último autorizado: ${err || "sin número"}`);
  return Number(nro);
}

// Emite UNA Factura C. det: {docTipo, docNro, condIvaReceptor, importe, fecha(yyyy-mm-dd)}.
// Devuelve {numero, cae, caeVto} o tira con el detalle del rechazo.
export async function emitirFacturaC(det, env) {
  const cuit = process.env.ARCA_CUIT;
  const cfg = await arcaConfig();
  const ptoVta = Number(cfg?.punto_venta || 1);
  const tipo = 11; // Factura C
  const ultimo = await ultimoComprobante(ptoVta, tipo, env);
  const nro = ultimo + 1;
  const f = det.fecha.replace(/-/g, "");
  const imp = Number(det.importe).toFixed(2);
  const t = await getTicket("wsfe", env);
  const inner = `${authXml(t, cuit)}<ar:FeCAEReq>
    <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo></ar:FeCabReq>
    <ar:FeDetReq><ar:FECAEDetRequest>
      <ar:Concepto>2</ar:Concepto>
      <ar:DocTipo>${det.docTipo}</ar:DocTipo><ar:DocNro>${det.docNro || 0}</ar:DocNro>
      <ar:CbteDesde>${nro}</ar:CbteDesde><ar:CbteHasta>${nro}</ar:CbteHasta>
      <ar:CbteFch>${f}</ar:CbteFch>
      <ar:ImpTotal>${imp}</ar:ImpTotal><ar:ImpTotConc>0</ar:ImpTotConc><ar:ImpNeto>${imp}</ar:ImpNeto>
      <ar:ImpOpEx>0</ar:ImpOpEx><ar:ImpTrib>0</ar:ImpTrib><ar:ImpIVA>0</ar:ImpIVA>
      <ar:FchServDesde>${f}</ar:FchServDesde><ar:FchServHasta>${f}</ar:FchServHasta><ar:FchVtoPago>${f}</ar:FchVtoPago>
      <ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>
      <ar:CondicionIVAReceptorId>${det.condIvaReceptor}</ar:CondicionIVAReceptorId>
    </ar:FECAEDetRequest></ar:FeDetReq>
  </ar:FeCAEReq>`;
  const xml = await wsfe("FECAESolicitar", inner, env);
  const resultado = xmlTag(xml, "Resultado");
  const cae = xmlTag(xml, "CAE");
  const caeVto = xmlTag(xml, "CAEFchVto");
  if (resultado !== "A" || !cae) {
    const obs = xmlAll(xml, "Msg").join(" · ") || "rechazada sin detalle";
    throw new Error(`ARCA rechazó la factura: ${unesc(obs)}`);
  }
  return { numero: nro, cae, caeVto: caeVto ? `${caeVto.slice(0, 4)}-${caeVto.slice(4, 6)}-${caeVto.slice(6, 8)}` : null, ptoVta, tipo };
}

// ── Padrón: datos del receptor por CUIT ──────────────────────────────────────
export async function consultarPadron(cuitConsultado, env) {
  const cuit = process.env.ARCA_CUIT;
  const t = await getTicket("ws_sr_constancia_inscripcion", env);
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Body><a5:getPersona_v2>
    <token>${t.token}</token><sign>${t.sign}</sign>
    <cuitRepresentada>${cuit}</cuitRepresentada><idPersona>${cuitConsultado}</idPersona>
  </a5:getPersona_v2></soapenv:Body>
</soapenv:Envelope>`;
  const xml = await soapPost(URLS[env].padron, { "Content-Type": "text/xml; charset=utf-8" }, soap, 15000);
  const fault = xmlTag(xml, "faultstring");
  if (fault) throw new Error(`Padrón: ${fault}`);
  const razon = xmlTag(xml, "razonSocial");
  const nombre = [xmlTag(xml, "nombre"), xmlTag(xml, "apellido")].filter(Boolean).join(" ");
  const domicilio = [xmlTag(xml, "direccion"), xmlTag(xml, "localidad"), xmlTag(xml, "descripcionProvincia")].filter(Boolean).join(", ");
  // Condición frente al IVA (para RG 5616): si el padrón lista impuesto 30 (IVA) → RI;
  // regimen monotributo → 6; si no, consumidor final/exento se elige a mano.
  const impuestos = xmlAll(xml, "idImpuesto").map(Number);
  const condIva = impuestos.includes(30) ? 1 : impuestos.includes(20) || impuestos.includes(21) ? 6 : null;
  return { nombre: unesc(razon || nombre || ""), domicilio: unesc(domicilio), cond_iva: condIva };
}

export const COND_IVA = { 1: "IVA Responsable Inscripto", 4: "IVA Sujeto Exento", 5: "Consumidor Final", 6: "Responsable Monotributo", 7: "Sujeto No Categorizado", 13: "Monotributista Social" };

// ── QR oficial (RG 4892) ─────────────────────────────────────────────────────
export function qrUrl(inv, cuitEmisor) {
  const payload = {
    ver: 1, fecha: inv.fecha, cuit: Number(cuitEmisor), ptoVta: inv.punto_venta, tipoCmp: inv.tipo_cbte,
    nroCmp: Number(inv.numero), importe: Number(inv.importe), moneda: inv.moneda || "PES", ctz: Number(inv.cotizacion || 1),
    tipoDocRec: inv.doc_tipo, nroDocRec: Number(inv.doc_nro || 0), tipoCodAut: "E", codAut: Number(inv.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
}

export { esc as xmlEsc };
