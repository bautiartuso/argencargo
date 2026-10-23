// lib/gmail.js — La casilla de Gmail conectada en el admin (04/10/2026), compartida entre el panel de
// Email (/api/admin/mail) y el pedido de DSI de los vuelos (/api/aereo/dsi, 22/10/2026).
// Solo servidor: el refresh token vive en el bucket privado mail-config/gmail.json.
import crypto from "crypto";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const CID = process.env.GOOGLE_CLIENT_ID;
const CSECRET = process.env.GOOGLE_CLIENT_SECRET;
export const BUCKET = "mail-config";
const ARCHIVO = "gmail.json";
export const GM = "https://gmail.googleapis.com/gmail/v1/users/me";

const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, ...(init.headers || {}) } });

// ── Configuración guardada (refresh token) ────────────────────────────────────────────────
// La configuración casi nunca cambia: se guarda 10 min en memoria para no leer Storage en cada
// consulta (el contador de no leídos pregunta cada minuto).
let cacheConfig = { at: 0, data: null };
export async function leerConfig() {
  if (cacheConfig.data && Date.now() - cacheConfig.at < 10 * 60000) return cacheConfig.data;
  const r = await svc(`/storage/v1/object/${BUCKET}/${ARCHIVO}`);
  if (!r.ok) return null;
  try { const d = await r.json(); cacheConfig = { at: Date.now(), data: d }; return d; } catch { return null; }
}
export async function guardarConfig(data) {
  cacheConfig = { at: 0, data: null };
  const b = await svc(`/storage/v1/bucket/${BUCKET}`);
  if (!b.ok) await svc(`/storage/v1/bucket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  return svc(`/storage/v1/object/${BUCKET}/${ARCHIVO}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(data) });
}

let cacheToken = null; // { token, vence }
export const fijarToken = (t) => { cacheToken = t; };
export async function accessToken() {
  if (cacheToken && cacheToken.vence > Date.now() + 60000) return cacheToken.token;
  const cfg = await leerConfig();
  if (!cfg?.refresh_token) throw new Error("no_conectado");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: cfg.refresh_token, grant_type: "refresh_token" }) });
  const d = await r.json();
  if (!d.access_token) throw new Error("token_invalido");
  cacheToken = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3000) * 1000 };
  return d.access_token;
}
export async function gm(path, init = {}) {
  const t = await accessToken();
  const r = await fetch(`${GM}${path}`, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${t}`, ...(init.body && !(init.headers || {})["Content-Type"] ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  if (r.status === 204) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Gmail ${r.status}`);
  return d;
}

// ── Utilidades de mensajes ────────────────────────────────────────────────────────────────
export const hdr = (headers, n) => (headers || []).find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
export const b64dec = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
export const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function recorrer(part, out) {
  if (!part) return;
  const mime = part.mimeType || "";
  if (part.filename && part.body?.attachmentId) out.adjuntos.push({ id: part.body.attachmentId, nombre: part.filename, tipo: mime, tamano: part.body.size || 0, cid: hdr(part.headers, "Content-ID").replace(/[<>]/g, "") });
  else if (mime === "text/html" && part.body?.data) out.html += b64dec(part.body.data).toString("utf8");
  else if (mime === "text/plain" && part.body?.data) out.texto += b64dec(part.body.data).toString("utf8");
  (part.parts || []).forEach((p) => recorrer(p, out));
}
export const resumen = (m) => {
  const h = m.payload?.headers || [];
  return { id: m.id, hilo: m.threadId, de: hdr(h, "From"), para: hdr(h, "To"), asunto: hdr(h, "Subject"), fecha: Number(m.internalDate) || Date.parse(hdr(h, "Date")) || 0, extracto: m.snippet || "", noLeido: (m.labelIds || []).includes("UNREAD"), spam: (m.labelIds || []).includes("SPAM"), etiquetas: m.labelIds || [], adjuntos: /multipart\/mixed/i.test(hdr(h, "Content-Type")) };
};

// Arma el MIME del mail (texto + html + adjuntos) en base64url para la API.
export function armarMime({ de, para, cc, asunto, texto, adjuntos = [], enRespuestaA, referencias, htmlExtra = "", textoExtra = "" }) {
  const enc = (s) => `=?UTF-8?B?${Buffer.from(String(s || ""), "utf8").toString("base64")}?=`;
  const limite = "ac_" + crypto.randomBytes(8).toString("hex");
  const alt = "alt_" + crypto.randomBytes(8).toString("hex");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>${htmlExtra}`;
  texto = `${texto || ""}${textoExtra}`;
  const lineas = [];
  if (de) lineas.push(`From: ${de}`);
  lineas.push(`To: ${para}`);
  if (cc) lineas.push(`Cc: ${cc}`);
  lineas.push(`Subject: ${enc(asunto)}`, "MIME-Version: 1.0");
  if (enRespuestaA) lineas.push(`In-Reply-To: ${enRespuestaA}`, `References: ${referencias || enRespuestaA}`);
  lineas.push(`Content-Type: multipart/mixed; boundary="${limite}"`, "", `--${limite}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "",
    `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(String(texto || ""), "utf8").toString("base64"),
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html, "utf8").toString("base64"), `--${alt}--`);
  for (const a of adjuntos) {
    lineas.push(`--${limite}`, `Content-Type: ${a.tipo || "application/octet-stream"}; name="${enc(a.nombre)}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${enc(a.nombre)}"`, "", String(a.datos || "").replace(/(.{76})/g, "$1\r\n"));
  }
  lineas.push(`--${limite}--`);
  return lineas.join("\r\n");
}

