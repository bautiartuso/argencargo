// Mail "tu carga llegó a Buenos Aires" (21/10/2026): sale cuando el admin marca ⚓ Llegó en un
// contenedor. Todavía no hay operación (eso nace con "Me lo entregaron"), así que va por cliente con
// lo que viaja en ese contenedor. Solo arma el contenido; el marco (logo, pie) lo pone /api/notify.

const fecha = (iso) => { if (!iso) return "—"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const sumar = (iso, dias) => { const x = new Date(String(iso).slice(0, 10) + "T12:00:00"); x.setDate(x.getDate() + dias); return x.toISOString().slice(0, 10); };
const m3 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function contenidoContenedorPuerto({ nombre, productos = [], bultos = 0, cbm = 0, llego, contenedor = null, portalUrl, NAVY = "#152D54", AC = "#3B7DD8" }) {
  const retiro = llego ? sumar(llego, 14) : null;
  const merc = productos.filter(Boolean);
  const mercTxt = merc.length === 0 ? "Tu mercadería" : merc.length <= 3 ? merc.join(" · ") : `${merc.slice(0, 3).join(" · ")} y ${merc.length - 3} más`;
  const subject = "Tu carga llegó a Buenos Aires 🇦🇷";
  const greeting = `¡Hola ${esc(nombre || "")}!`;
  const body = `<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 14px">El contenedor con tu carga <strong>llegó al puerto de Buenos Aires</strong> el ${fecha(llego)}.</p>
<p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 6px">Ahora pasa por descarga y aduana, que suele llevar unos 14 días. Apenas esté lista te mandamos otro mail con el total final y el link para coordinar el retiro o el envío.</p>`;
  const fila = (l, v, color = NAVY) => `<tr><td style="padding:10px 14px;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#7a8699;border-bottom:1px solid #e8ecf2;white-space:nowrap">${l}</td><td style="padding:10px 14px;font-size:14.5px;font-weight:700;color:${color};border-bottom:1px solid #e8ecf2;text-align:right">${v}</td></tr>`;
  const extraHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;border:1px solid #e1e6ee;border-radius:12px;border-collapse:separate;overflow:hidden">
  <tr><td colspan="2" style="padding:14px;background:#f4f7fb;border-bottom:1px solid #e1e6ee">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${AC}">Tu carga</div>
    <div style="font-size:15.5px;font-weight:800;color:${NAVY};margin-top:3px">${esc(mercTxt)}</div>
  </td></tr>
  ${fila("Llegó a Buenos Aires", fecha(llego))}
  ${fila("Estado", "En aduana", "#c2410c")}
  ${fila("Retiro estimado", retiro ? fecha(retiro) : "—", "#15803d")}
  ${fila("Bultos · volumen", `${bultos} · ${m3(cbm)} m³`)}
  ${contenedor ? fila("Contenedor", `<span style="font-family:monospace">${esc(contenedor)}</span>`) : ""}
</table>
<div style="text-align:center;margin:24px 0 6px"><a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:${AC};color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px">Ver mi carga en el portal</a></div>`;
  return { subject, greeting, body, extraHtml };
}
