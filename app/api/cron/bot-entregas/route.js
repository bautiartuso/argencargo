// GET /api/cron/bot-entregas — recordatorios automáticos del bot de entregas.
// Corre cada 5 minutos (vercel.json): el aviso de carga lista sale casi al instante. Plantillas fijas de WhatsApp — cero IA, costo cero.
//
// Escalera para cargas LISTAS SIN COORDINAR, cada 60 h reloj, tope 2:
//   1º recordatorio_coordinar  → "tu carga sigue pendiente de coordinar" (simple)
//   2º recordatorio_almacenaje → "podemos almacenarla el tiempo que necesites pero
//      necesitamos el pago; sin pago rige USD 0,5 diarios por kg" — después de este,
//      pasa a GESTIÓN HUMANA (notificación al admin) y no se manda nada más.
//
// AVISO DE RETIRO AUTOMÁTICO: toda op que llega a la oficina (status entregada, sin
// delivery_ready_at, no RI con entrega directa) recibe sola el aviso de "carga lista"
// (mail + plantilla carga_lista) vía /api/notify — ya no hace falta tocar "Avisar".
//
// Los avisos salen a cualquier hora (ni bien la carga está lista). Los recordatorios solo
// en horario comercial (9 a 20 h Argentina).
//
// RI CON ENTREGA DIRECTA (el courier entrega en el domicilio): sin link ni nada que elegir.
// Cuando el tracking marca la entrega, el bot manda el TOTAL EN PESOS (saldo USD × dólar blue
// venta del momento) con la cuenta para transferir — solo en día hábil de 9 a 20 h Argentina.
// Plantillas ri_entregada_pesos / ri_saldo_pendiente (se crean solas en Meta, ver lib/wa.js).
//
// Sin credenciales de Meta todo es no-op. ?dry=1 devuelve qué mandaría sin mandar.

import { sendWaTemplate, waConfigured, waNumber, ensureWaTemplate } from "../../../../lib/wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

const H60 = 60 * 3600 * 1000;
const ESCALERA = ["recordatorio_coordinar", "recordatorio_almacenaje"];

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

async function notifyAdmins(title, body) {
  const admins = await sb(`/profiles?role=eq.admin&select=id`);
  const ids = (Array.isArray(admins.body) ? admins.body : []).map((a) => a.id).filter(Boolean);
  await Promise.all(ids.flatMap((id) => [
    sb(`/notifications`, { method: "POST", body: JSON.stringify({ user_id: id, portal: "admin", title, body, link: "/admin" }) }).catch(() => {}),
    fetch(`${BASE_URL}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: id, portal: "admin", title, body, url: "/admin" }) }).catch(() => {}),
  ]));
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const okAuth = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!okAuth) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const now = Date.now();
  // Horario comercial Argentina (UTC-3): 9 a 20 h.
  const horaAr = (new Date(now).getUTCHours() + 24 - 3) % 24;
  // Los AVISOS de carga lista salen siempre (ni bien la carga está para entregar). Los
  // RECORDATORIOS a clientes que no confirmaron, solo en horario comercial.
  const enHorario = horaAr >= 9 && horaAr < 21;

  // ── Avisos de retiro automáticos ──
  const out = { avisos: [], avisos_enviados: 0, recordatorios: [], enviados: 0, wa: waConfigured(), hora_ar: horaAr };
  const r0 = await sb(`/operations?status=eq.entregada&delivery_ready_at=is.null&delivery_completed_at=is.null&ri_entrega_directa=not.is.true&select=id,operation_code,description,budget_total,delivery_public_token,sent_notifications,office_received_at,ri_entrega_directa,clients(first_name,client_code,email,whatsapp,tax_condition)`);
  const cand = Array.isArray(r0.body) ? r0.body : [];
  // Sin NCM en algún producto, el presupuesto está incompleto (derechos 0 %): NO se avisa —
  // el cliente pagaría de menos (AC-0128, 04/09). Se avisa al admin una vez por día.
  const itemsRes = cand.length ? await sb(`/operation_items?operation_id=in.(${cand.map((o) => o.id).join(",")})&select=operation_id,ncm_code`) : { body: [] };
  const sinNcm = new Set((Array.isArray(itemsRes.body) ? itemsRes.body : []).filter((i) => !String(i.ncm_code || "").trim()).map((i) => i.operation_id));
  for (const op of cand) {
    const c = op.clients || {};
    const riDir = op.ri_entrega_directa !== false && (op.ri_entrega_directa === true || c.tax_condition === "responsable_inscripto");
    if (riDir) continue;
    if (!c.email && !waNumber(c.whatsapp)) continue;
    const bloqueo = sinNcm.has(op.id) ? "productos sin NCM (presupuesto incompleto)" : !(Number(op.budget_total) > 0) ? "presupuesto en cero" : "";
    if (bloqueo) {
      out.bloqueados = [...(out.bloqueados || []), `${op.operation_code}: ${bloqueo}`];
      const last = op.sent_notifications?.aviso_bloqueado_at ? new Date(op.sent_notifications.aviso_bloqueado_at).getTime() : 0;
      if (!dry && now - last > 24 * 3600 * 1000) {
        await notifyAdmins("⛔ Aviso de carga lista frenado", `${op.operation_code} (${c.first_name || ""} ${c.client_code || ""}): ${bloqueo}. Completá la op y el aviso sale solo.`);
        await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_notifications: { ...(op.sent_notifications || {}), aviso_bloqueado_at: new Date().toISOString() } }) });
      }
      continue;
    }
    out.avisos.push(`${op.operation_code} → carga_lista`);
    if (dry) continue;
    try {
      const r = await fetch(`${BASE_URL}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body: JSON.stringify({ op_id: op.id, trigger: "retiro" }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok || j?.skipped === "already_sent") {
        out.avisos_enviados++;
        // Avisada = delivery_ready_at. /api/notify ya lo setea; acá se cubre "already_sent" (mail
        // mandado antes del fix) para que no quede en "Falta avisar" ni se reintente cada 5 min.
        await sb(`/operations?id=eq.${op.id}&delivery_ready_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery_ready_at: op.sent_notifications?.wa_retiro || op.sent_notifications?.email_retiro || new Date().toISOString() }) });
        continue;
      }
      if (j?.error === "cliente sin email" && waNumber(c.whatsapp) && op.delivery_public_token) {
        // Sin mail: sale solo el WhatsApp y se marca lista igual (mismo efecto que /api/notify).
        const carga = op.description ? `${op.description} (${op.operation_code})` : op.operation_code;
        const w = await sendWaTemplate(c.whatsapp, "carga_lista", [c.first_name || "Hola", carga, `${BASE_URL}/retiro/${op.delivery_public_token}`]);
        if (w?.ok) {
          out.avisos_enviados++;
          await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery_ready_at: new Date().toISOString(), sent_notifications: { ...(op.sent_notifications || {}), wa_retiro: new Date().toISOString() } }) });
          continue;
        }
      }
      console.error("[bot-entregas] aviso falló", op.operation_code, j?.error || r.status);
    } catch (e) { console.error("[bot-entregas] aviso", op.operation_code, e.message); }
  }

  const r1 = await sb(`/operations?delivery_ready_at=not.is.null&delivery_confirmed_at=is.null&delivery_completed_at=is.null&bot_coord_reminder_count=lt.2&select=id,operation_code,description,delivery_public_token,delivery_ready_at,bot_coord_reminder_at,bot_coord_reminder_count,clients(first_name,last_name,client_code,whatsapp)`);

  for (const op of Array.isArray(r1.body) ? r1.body : []) {
    if (!enHorario && !dry) { out.recordatorios_fuera_de_horario = true; break; }
    const base = new Date(op.bot_coord_reminder_at || op.delivery_ready_at).getTime();
    if (now - base < H60) continue;
    const num = waNumber(op.clients?.whatsapp);
    if (!num || !op.delivery_public_token) continue;
    const paso = op.bot_coord_reminder_count || 0; // 0, 1 o 2 → plantilla de la escalera
    const plantilla = ESCALERA[paso];
    out.recordatorios.push(`${op.operation_code} → ${plantilla}`);
    if (dry) continue;
    // "Mazos de cartas (AC-0121)" — con la descripción el cliente sabe de qué carga hablamos.
    const carga = op.description ? `${op.description} (${op.operation_code})` : op.operation_code;
    const r = await sendWaTemplate(num, plantilla, [
      op.clients?.first_name || "Hola", carga, `${BASE_URL}/retiro/${op.delivery_public_token}`,
    ]);
    if (r?.ok) {
      out.enviados++;
      await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ bot_coord_reminder_at: new Date().toISOString(), bot_coord_reminder_count: paso + 1 }) });
      // Tras el 2º y último aviso, la gestión pasa a un humano — el bot no insiste más.
      if (paso === 1) {
        const c = op.clients || {};
        await notifyAdmins("⚠️ Entrega sin respuesta — tomar gestión humana", `${c.first_name || ""} ${c.last_name || ""} (${c.client_code || "?"}) · ${op.operation_code}: 2 recordatorios sin coordinar ni pagar.`);
      }
    }
  }

  // ── RI con entrega directa: cobro en pesos, sin link ──
  // El courier entregó en el domicilio (el sync de tracking marca delivery_completed_at). No hay
  // nada que coordinar ni elegir: se le manda el total en PESOS (saldo USD × dólar blue venta del
  // momento) con la cuenta para transferir. Solo en día hábil de 9 a 20 h Argentina (pedido
  // 06/09: nada un domingo a la noche). Si ya había recibido el aviso viejo con link
  // (wa_ri_entregada), va como "saldo pendiente" en vez de "ya fue entregada". Una sola vez por
  // op: sent_notifications.wa_ri_cobro (con el monto y el TC usados).
  const arNow = new Date(now - 3 * 3600 * 1000);
  const diaHabil = arNow.getUTCDay() >= 1 && arNow.getUTCDay() <= 5 && arNow.getUTCHours() >= 9 && arNow.getUTCHours() < 20;
  out.ri_cobros = [];
  try {
    const desde = new Date(now - 90 * 86400000).toISOString();
    const r2 = await sb(`/operations?delivery_completed_at=gte.${encodeURIComponent(desde)}&is_collected=eq.false&ri_entrega_directa=not.is.false&select=id,operation_code,description,budget_total,debt_applied_usd,total_anticipos,credit_applied_usd,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,sent_notifications,ri_entrega_directa,clients(first_name,client_code,whatsapp,tax_condition)`);
    const riOps = (Array.isArray(r2.body) ? r2.body : []).filter((op) => {
      const c = op.clients || {};
      const riDir = op.ri_entrega_directa === true || c.tax_condition === "responsable_inscripto";
      return riDir && !op.sent_notifications?.wa_ri_cobro && waNumber(c.whatsapp);
    });
    if (riOps.length) {
      const pagosRes = await sb(`/operation_client_payments?operation_id=in.(${riOps.map((o) => o.id).join(",")})&select=operation_id,amount_usd`);
      const pagosBy = {};
      for (const pg of Array.isArray(pagosRes.body) ? pagosRes.body : []) pagosBy[pg.operation_id] = (pagosBy[pg.operation_id] || 0) + Number(pg.amount_usd || 0);
      // Mismo criterio que el panel de Entregas: los cobros registrados pisan al legacy is_collected.
      const saldoDe = (op) => {
        const pag = pagosBy[op.id] || 0;
        const legacy = !op.is_collected ? 0 : op.collection_currency === "ARS" ? (Number(op.collection_exchange_rate) > 0 ? Number(op.collected_amount || 0) / Number(op.collection_exchange_rate) : 0) : Number(op.collected_amount || 0);
        const collected = pag > 0 ? pag : legacy;
        return Math.round(Math.max(0, Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0) - Number(op.total_anticipos || 0) - collected - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0)) * 100) / 100;
      };
      let tc = 0, cuenta = null;
      for (const op of riOps) {
        const saldo = saldoDe(op);
        if (saldo <= 0.005) continue;
        const plantilla = op.sent_notifications?.wa_ri_entregada ? "ri_saldo_pendiente" : "ri_entregada_pesos";
        out.ri_cobros.push(`${op.operation_code} → ${plantilla} (USD ${saldo})${diaHabil ? "" : " · espera día hábil 9-20 h"}`);
        if (dry) continue;
        // La plantilla se da de alta en Meta apenas hay una op esperando (aunque sea fuera de
        // horario), así la aprobación ya está cuando llega el día hábil.
        const estado = await ensureWaTemplate(plantilla);
        if (!diaHabil) continue;
        if (estado && estado !== "APPROVED") { out.ri_plantilla = `${plantilla}: ${estado} en Meta — se reintenta en 5 min`; continue; }
        if (!tc) {
          const d = await fetch("https://dolarapi.com/v1/dolares/blue", { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() : null).catch(() => null);
          tc = Number(d?.venta) > 0 ? Number(d.venta) : 0;
          if (!tc) { out.ri_error = "sin tipo de cambio (DolarAPI) — se reintenta en 5 min"; break; }
          const stg = await sb(`/gi_settings?select=payment_alias,payment_titular&limit=1`);
          cuenta = Array.isArray(stg.body) && stg.body[0] ? stg.body[0] : {};
        }
        const ars = Math.round(saldo * tc);
        const totalTxt = `$ ${ars.toLocaleString("es-AR")} (USD ${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × TC $ ${tc.toLocaleString("es-AR")})`;
        const partes = String(cuenta.payment_alias || "").split(/\s*[·|,]\s*/).map((x) => x.trim()).filter(Boolean);
        const lineas = [...partes, cuenta.payment_titular ? `Titular: ${cuenta.payment_titular}` : ""].filter(Boolean);
        while (lineas.length < 3) lineas.push("Argencargo");
        const c = op.clients || {};
        const carga = op.description ? `${op.description} (${op.operation_code})` : op.operation_code;
        const w = await sendWaTemplate(c.whatsapp, plantilla, [c.first_name || "Hola", carga, totalTxt, lineas[0], lineas[1], lineas[2]]);
        if (!w?.ok) { console.error("[bot-entregas] ri_cobro falló", op.operation_code, w?.error); out.ri_error = `${op.operation_code}: ${w?.error || "envío falló"}`; continue; }
        out.ri_enviados = (out.ri_enviados || 0) + 1;
        await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_notifications: { ...(op.sent_notifications || {}), wa_ri_cobro: new Date().toISOString(), wa_ri_cobro_ars: ars, wa_ri_cobro_tc: tc } }) });
        await sb(`/op_communications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: op.id, type: "whatsapp", direction: "out", content: `Argy (${plantilla}): total a abonar $ ${ars.toLocaleString("es-AR")} (USD ${saldo} × TC ${tc}) con los datos para transferir.` }) }).catch(() => {});
      }
    }
  } catch (e) { console.error("[bot-entregas] ri_cobro", e.message); out.ri_error = e.message; }

  return Response.json(out);
}
