// Mail "Nuevas tarifas del aéreo desde el 25/09" (temporada alta + recargo por combustible).
// Dos versiones: monotributo / consumidor final (tres tramos) y Responsable Inscripto (dos tramos).
// El texto lo cerró Bautista el 25/09/2026. Se manda desde /api/admin/aviso-tarifas.

const CUERPO_MONO = "<p style=\"font-size:15px;line-height:1.6;color:#333;margin:0 0 14px\">Te escribimos para informarte que las aerol\u00edneas aplicaron <strong>nuevos recargos por combustible</strong> y estamos entrando en <strong>temporada alta</strong>, cuando el espacio en bodega es m\u00e1s caro. Por eso, a partir del <strong>viernes 25 de septiembre</strong> rigen nuevas tarifas para la <strong>carga a\u00e9rea v\u00eda Courier Comercial</strong>.</p><p style=\"font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#B8956A;margin:22px 0 8px\">Nuevas tarifas \u00b7 Carga a\u00e9rea v\u00eda Courier Comercial</p>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border:1px solid #e6eaf0;border-radius:10px;border-collapse:separate;overflow:hidden\"><tr><td style=\"padding:12px 16px;font-size:14px;color:#44506a\">De 10 a 25 kg</td><td align=\"right\" style=\"padding:12px 16px;font-size:15px;font-weight:800;color:#152D54\">USD 16 / kg</td></tr><tr><td style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:14px;color:#44506a\">De 25 a 100 kg</td><td align=\"right\" style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:15px;font-weight:800;color:#152D54\">USD 15 / kg</td></tr><tr><td style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:14px;color:#44506a\">M\u00e1s de 100 kg</td><td align=\"right\" style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:15px;font-weight:800;color:#152D54\">USD 14 / kg</td></tr></table><ul style=\"font-size:14px;line-height:1.75;color:#333;margin:16px 0 0;padding-left:20px\">\n<li><strong>M\u00ednimo facturable: 10 kg.</strong></li>\n<li>Productos con <strong>bater\u00edas</strong>: + USD 1 por kg.</li>\n</ul><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0 0\"><tr><td style=\"background:#eef6ee;border:1px solid #cfe6cf;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.55;color:#1f5130\"><strong>Tus operaciones abiertas y las que est\u00e1n en tr\u00e1nsito mantienen la tarifa anterior.</strong> Las nuevas tarifas aplican solo a las importaciones que se armen desde el 25/09.</td></tr></table><p style=\"font-size:14px;line-height:1.6;color:#333;margin:20px 0 0\">Pod\u00e9s ver las tarifas actualizadas y cotizar tus pr\u00f3ximas importaciones desde tu portal.</p>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0 4px\"><tr><td style=\"background:#152D54;border-radius:8px\"><a href=\"https://www.argencargo.com.ar/portal\" style=\"display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#fff;text-decoration:none\">Ir a mi portal \u2192</a></td></tr></table>\n<p style=\"font-size:14px;line-height:1.6;color:#333;margin:18px 0 0\">Cualquier duda, respond\u00e9 este mail o escribinos por WhatsApp.<br/>Gracias por seguir confiando en nosotros.</p>\n<p style=\"font-size:14px;color:#333;margin:14px 0 0\">Equipo <strong>Argencargo</strong></p>";
const CUERPO_RI = "<p style=\"font-size:15px;line-height:1.6;color:#333;margin:0 0 14px\">Te escribimos para informarte que las aerol\u00edneas aplicaron <strong>nuevos recargos por combustible</strong> y estamos entrando en <strong>temporada alta</strong>, cuando el espacio en bodega es m\u00e1s caro. Por eso, a partir del <strong>viernes 25 de septiembre</strong> rigen nuevas tarifas para la <strong>carga a\u00e9rea v\u00eda Courier Comercial</strong>.</p><p style=\"font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#B8956A;margin:22px 0 8px\">Nuevas tarifas \u00b7 Carga a\u00e9rea v\u00eda Courier Comercial</p>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border:1px solid #e6eaf0;border-radius:10px;border-collapse:separate;overflow:hidden\"><tr><td style=\"padding:12px 16px;font-size:14px;color:#44506a\">De 10 a 25 kg</td><td align=\"right\" style=\"padding:12px 16px;font-size:15px;font-weight:800;color:#152D54\">USD 16 / kg</td></tr><tr><td style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:14px;color:#44506a\">M\u00e1s de 25 kg</td><td align=\"right\" style=\"padding:12px 16px;border-top:1px solid #e6eaf0;font-size:15px;font-weight:800;color:#152D54\">USD 15 / kg</td></tr></table><ul style=\"font-size:14px;line-height:1.75;color:#333;margin:16px 0 0;padding-left:20px\">\n<li><strong>M\u00ednimo facturable: 10 kg.</strong></li>\n<li>Productos con <strong>bater\u00edas</strong>: + USD 1 por kg.</li>\n</ul><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0 0\"><tr><td style=\"background:#eef6ee;border:1px solid #cfe6cf;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.55;color:#1f5130\"><strong>Tus operaciones abiertas y las que est\u00e1n en tr\u00e1nsito mantienen la tarifa anterior.</strong> Las nuevas tarifas aplican solo a las importaciones que se armen desde el 25/09.</td></tr></table><p style=\"font-size:14px;line-height:1.6;color:#333;margin:20px 0 0\">Pod\u00e9s ver las tarifas actualizadas y cotizar tus pr\u00f3ximas importaciones desde tu portal.</p>\n<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0 4px\"><tr><td style=\"background:#152D54;border-radius:8px\"><a href=\"https://www.argencargo.com.ar/portal\" style=\"display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#fff;text-decoration:none\">Ir a mi portal \u2192</a></td></tr></table>\n<p style=\"font-size:14px;line-height:1.6;color:#333;margin:18px 0 0\">Cualquier duda, respond\u00e9 este mail o escribinos por WhatsApp.<br/>Gracias por seguir confiando en nosotros.</p>\n<p style=\"font-size:14px;color:#333;margin:14px 0 0\">Equipo <strong>Argencargo</strong></p>";

export const TARIFAS_TRIGGER = "tarifas_2026_09";
export const TARIFAS_SUBJECT = "Nuevas tarifas del aéreo desde el 25/09";

export function mailTarifas({ nombre, isRI }) {
  const saludo = nombre ? `Hola ${String(nombre).trim().split(" ")[0]},` : "Hola,";
  return { subject: TARIFAS_SUBJECT, html: renderEmailShell({ subject: TARIFAS_SUBJECT, greeting: saludo, body: isRI ? CUERPO_RI : CUERPO_MONO }) };
}

// Copia de la plantilla de /api/notify (los archivos de ruta no pueden exportar helpers).
function renderEmailShell({ subject, greeting, body, extraHtml, opCode, NAVY = "#152D54", AC = "#3B7DD8" }) {
  const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
  const LOGO_COLOR = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
  const greetingHtml = greeting ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">${greeting}</h2>` : "";
  const opCodeHtml = opCode ? `<tr><td style="padding:24px 32px 0"><p style="color:#666;font-size:13px;margin:0;padding-top:16px;border-top:1px solid #eee">Código de operación: <strong style="color:${NAVY};font-family:monospace">${opCode}</strong><br/>Cualquier consulta, respondé este email o escribinos por WhatsApp.</p></td></tr>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject || "Argencargo"}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">

        <!-- HEADER: banner azul con logo BLANCO directo -->
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:40px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="200" style="display:block;max-width:200px;height:auto;margin:0 auto"/>
        </td></tr>

        <!-- BODY: saludo + cuerpo + cta -->
        <tr><td style="padding:28px 32px">
          ${greetingHtml}
          ${body || ""}
          ${extraHtml || ""}
        </td></tr>

        <!-- Código op + nota de respuesta -->
        ${opCodeHtml}

        <!-- FOOTER: fondo navy + logo BLANCO (evita problema de cuadrado blanco del JPG) -->
        <tr><td style="padding:28px 32px;background:${NAVY}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="110" valign="middle" style="padding-right:16px">
                <img src="${LOGO_WHITE}" alt="Argencargo" width="100" style="display:block;max-width:100px;height:auto"/>
              </td>
              <td valign="middle" style="font-size:12px;line-height:1.7;color:#cfd8e8">
                <div style="font-weight:800;color:#fff;letter-spacing:0.02em;margin-bottom:2px">ARGENCARGO</div>
                <div><span style="color:#8ea3c4">T.</span> +54 9 11 2508-8580</div>
                <div><span style="color:#8ea3c4">E-mail:</span> <a href="mailto:info@argencargo.com.ar" style="color:#8fb8ff;text-decoration:none">info@argencargo.com.ar</a></div>
                <div>Virrey Loreto 2428 — Belgrano, CABA</div>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
      <p style="font-size:10px;color:#aaa;margin:12px 0 0;text-align:center">© ${new Date().getFullYear()} Argencargo · <a href="https://argencargo.com.ar" style="color:#888;text-decoration:none">argencargo.com.ar</a></p>
    </td></tr>
  </table>
</body></html>`;
}
