// Firma y plantillas de los mails del admin (23/10/2026). La usan el servidor (/api/admin/mail, que la
// pega al final de cada mail enviado) y el panel de Email (vista previa). Se guardan en el bucket
// privado mail-config/preferencias.json y se editan desde Email → Firma y plantillas.

export const FIRMA_DEF = {
  activa: true,
  nombre: "Bautista Artuso",
  cargo: "Argencargo",
  whatsapp: "+54 9 11 2508-8580",
  web: "argencargo.com.ar",
  direccion: "Virrey Loreto 2428, Belgrano, CABA",
};

const WA_COTIZAR = "https://wa.me/5491125088580";

export const PLANTILLAS_DEF = [
  {
    id: "cotizacion-wa",
    titulo: "Cotización → WhatsApp",
    asunto: "",
    texto: `Hola {nombre}, ¡buen día!

Gracias por comunicarte con Argencargo. Nos especializamos en importaciones puerta a puerta: flete aéreo y marítimo, gestión aduanera y entrega en tu domicilio, con seguimiento en todo momento.

Para darte una cotización precisa y asesorarte mejor, te pedimos que nos escribas por WhatsApp: ahí el proceso es mucho más ágil y te respondemos enseguida.
${WA_COTIZAR}

Si podés, mandanos fotos o links de los productos, las cantidades y desde dónde se envían.

¡Quedamos a disposición!`,
  },
];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
const urlWeb = (w) => { const x = String(w || "").trim(); return !x ? "" : /^https?:\/\//i.test(x) ? x : `https://${x.replace(/^www\./i, "www.")}`; };

// Tarjeta de firma en HTML de mail (tablas e estilos en línea: Gmail, Outlook y el celu la respetan).
export function firmaHtml(f = FIRMA_DEF) {
  const wa = soloDigitos(f.whatsapp);
  const web = urlWeb(f.web);
  const linea = (html) => `<div style="margin:0">${html}</div>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif">
<tr>
<td style="padding:4px 18px 4px 0;border-right:2px solid #1F5FBF;vertical-align:middle">${web ? `<a href="${esc(web)}" target="_blank" style="text-decoration:none">` : ""}<img src="https://www.argencargo.com.ar/argencargo/logo-apilado.png" width="112" alt="Argencargo" style="display:block;border:0;width:112px;height:auto">${web ? "</a>" : ""}</td>
<td style="padding:4px 0 4px 18px;vertical-align:middle;font-size:13px;line-height:1.6;color:#334155">
${f.nombre ? `<div style="font-size:15px;font-weight:bold;color:#0A1628;margin:0">${esc(f.nombre)}</div>` : ""}
${f.cargo ? `<div style="color:#64748b;margin:0 0 6px">${esc(f.cargo)}</div>` : ""}
${wa ? linea(`<a href="https://wa.me/${wa}" target="_blank" style="color:#16a34a;text-decoration:none;font-weight:bold">WhatsApp ${esc(f.whatsapp)}</a>`) : ""}
${web ? linea(`<a href="${esc(web)}" target="_blank" style="color:#1F5FBF;text-decoration:none">${esc(String(f.web).replace(/^https?:\/\//i, ""))}</a>`) : ""}
${f.direccion ? linea(`<span style="color:#64748b">${esc(f.direccion)}</span>`) : ""}
</td>
</tr>
</table>`;
}

export function firmaTexto(f = FIRMA_DEF) {
  return ["", "--", ...[f.nombre, f.cargo, f.whatsapp && `WhatsApp ${f.whatsapp}`, f.web, f.direccion].filter(Boolean)].join("\n");
}

// {nombre} → el primer nombre de a quién se le escribe ("Hola Valery,"); sin nombre queda "Hola,".
export function aplicarPlantilla(texto, nombre) {
  const n = String(nombre || "").replace(/["']/g, "").trim().split(/\s+/)[0] || "";
  const limpio = /@/.test(n) ? "" : n;
  return String(texto || "").replace(/\s*\{nombre\}/g, limpio ? ` ${limpio}` : "");
}
