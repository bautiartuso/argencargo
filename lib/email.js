// Envío de emails por Resend, con registro (17/09/2026).
//
// Antes cada ruta hacía su propio fetch a api.resend.com y nadie guardaba el resultado. Los
// avisos de bulto en depósito se podían contar de casualidad (marcan clients.deposit_email_last_at
// para agrupar de a una hora), pero los de arribo, retiro y cierre no dejaban rastro: pg_net
// guarda la respuesta unas horas y después la borra. Si se vencía la API key o un cliente tenía
// el mail mal escrito, no había forma de enterarse.
//
// Ahora todo pasa por acá y queda en email_log, éxito o error.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";

// El registro nunca puede voltear un envío: si falla el log, el mail ya salió igual.
async function registrar(fila) {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!key) return;
  try {
    await fetch(`${SB_URL}/rest/v1/email_log`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(fila),
    });
  } catch (e) { console.error("[email] no se pudo registrar el envío:", e.message); }
}

// Manda un mail y lo registra. Devuelve { ok, id, error, status }.
// `trigger` es la etiqueta con la que después se filtra en email_log: usá siempre la misma
// para el mismo tipo de aviso (bulto_deposito, arribo, retiro, cerrada, welcome, reminder…).
export async function enviarEmail({ to, subject, html, trigger = null, client_id = null, op_id = null, from = null, reply_to = null }) {
  const key = process.env.RESEND_API_KEY;
  // RESEND_FROM no está seteada en Vercel: cada ruta traía este mismo fallback y al centralizar
  // el envío me lo comí, así que durante 18 h Resend rechazó TODO con 422 "Missing from field"
  // (19 mails: bienvenidas, avisos de bulto, resumen diario, cierres). El dominio está
  // verificado en Resend y sale desde info@ — el default tiene que estar acá siempre.
  const remitente = from || process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
  const destino = Array.isArray(to) ? to : [to];

  if (!key) {
    await registrar({ trigger, to_email: destino.join(", "), subject, ok: false, error: "RESEND_API_KEY no configurada", client_id, op_id });
    return { ok: false, error: "RESEND_API_KEY no configurada", status: 500 };
  }

  let r = null, resp = null, errTxt = null;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remitente, to: destino, subject, html, ...(reply_to ? { reply_to } : {}) }),
    });
    resp = await r.json().catch(() => null);
  } catch (e) {
    // Red caída o timeout: no hay respuesta de Resend, así que no se sabe si salió.
    errTxt = e.message;
  }

  const ok = !!(r && r.ok);
  if (!ok && !errTxt) errTxt = JSON.stringify(resp || {}).slice(0, 500);

  await registrar({
    trigger, to_email: destino.join(", "), subject, ok,
    resend_id: ok ? resp?.id || null : null,
    error: ok ? null : errTxt,
    client_id, op_id,
  });

  if (!ok) console.error(`[email] falló el envío a ${destino.join(", ")} (${trigger || "sin trigger"}):`, errTxt);
  return { ok, id: ok ? resp?.id || null : null, error: ok ? null : errTxt, status: r?.status || 0, detail: resp };
}
