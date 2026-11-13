// Reparto: la plata que pasa por el repartidor, anotada en la operación de cada sistema (13/11/2026).
// · anotarCobro: el efectivo que declaró al entregar queda como cobro de la operación, igual que si se
//   cargara a mano (Argencargo: operation_client_payments; MyBox: asiento de ingreso).
// · anotarCostoViaje / quitarCostoViaje: lo que se le paga por el viaje se reparte en partes iguales
//   entre las operaciones que llevó, como flete local de cada una.
// Regla de cuidado: si lo declarado no cierra (pagó de más, la op ya figuraba paga, no hay dólar del día)
// NO se anota nada y se devuelve el motivo, para que se revise a mano desde Admin → Reparto.
import { ac, mb } from "./reparto";
import { fetchDolar } from "./dolar";
import { hoyAR } from "./fecha-ar";

const filas = (r) => (Array.isArray(r?.body) ? r.body : []);
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const pesos = (n) => Math.round(Number(n || 0)).toLocaleString("es-AR");

// Dólar del día de cada sistema: Argencargo usa blue + 2 pesos; MyBox, el blue.
export async function tcDelDia() {
  try {
    const r = await fetchDolar({ cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return Number(d.venta) > 0 ? { argencargo: Number(d.venta), mybox: Number(d.venta_base || d.venta) } : null;
  } catch { return null; }
}

// Cuánto vale en dólares lo que cobró. Si pagó pesos y la cuenta queda a menos de 1 % (o USD 2) del
// saldo, se toma como pago exacto: los pesos cancelan lo que faltaba y el tipo de cambio es el que resulta.
export function valorizar(cobros, saldo, tc) {
  const usd = r2(cobros.filter((c) => c.moneda === "USD").reduce((a, c) => a + Number(c.monto || 0), 0));
  const ars = r2(cobros.filter((c) => c.moneda === "ARS").reduce((a, c) => a + Number(c.monto || 0), 0));
  if (ars > 0 && !(tc > 0)) return { error: "No se pudo leer el dólar del día" };
  let arsUsd = ars > 0 ? r2(ars / tc) : 0, tcUsado = tc;
  const falta = r2(saldo - usd);
  if (ars > 0 && falta > 0.01 && Math.abs(arsUsd - falta) <= Math.max(2, saldo * 0.01)) { arsUsd = falta; tcUsado = r2(ars / falta); }
  const total = r2(usd + arsUsd);
  if (total > saldo + 0.01) return { error: `Pagó USD ${r2(total - saldo).toLocaleString("es-AR")} de más (debía ${r2(saldo).toLocaleString("es-AR")})` };
  return { usd, ars, arsUsd, tcUsado, total };
}

async function cobroArgencargo(opId, cobros, quien, tc) {
  const op = filas(await ac(`/operations?id=eq.${opId}&select=id,operation_code,budget_total,debt_applied_usd,total_anticipos,credit_applied_usd,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,collection_method`))[0];
  if (!op) return { ok: false, motivo: "No se encontró la operación" };
  if (op.is_collected) return { ok: false, motivo: "La operación ya figuraba cobrada" };
  const previos = filas(await ac(`/operation_client_payments?operation_id=eq.${opId}&select=amount_usd`)).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
  const legacyRaw = Number(op.collected_amount || 0), legacyTc = Number(op.collection_exchange_rate || 0);
  const legacy = op.collection_currency === "ARS" ? (legacyTc > 0 ? legacyRaw / legacyTc : 0) : legacyRaw;
  const cobrado = previos > 0.01 ? previos : legacy;
  const total = Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0) - Number(op.total_anticipos || 0) - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0);
  const saldo = r2(total - cobrado);
  if (saldo <= 0.01) return { ok: false, motivo: "La operación no tenía saldo" };
  const v = valorizar(cobros, saldo, tc);
  if (v.error) return { ok: false, motivo: v.error };
  const hoy = hoyAR(), nota = `Cobrado por ${quien} al entregar`;
  const alta = (fila) => ac("/operation_client_payments", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fila) }).then((r) => !!filas(r)[0]);
  // Igual que el cobro a mano: si había un cobro del registro viejo sin renglón propio, primero se preserva.
  if (previos <= 0.01 && legacy > 0.01) {
    const lb = { operation_id: opId, payment_date: hoy, amount_usd: r2(legacy), currency: op.collection_currency || "USD", payment_method: op.collection_method || "transferencia", notes: "Cobro previo (migrado del registro anterior)" };
    if (op.collection_currency === "ARS" && legacyTc > 0) { lb.amount_ars = legacyRaw; lb.exchange_rate = legacyTc; }
    if (!(await alta(lb))) return { ok: false, motivo: "No se pudo preservar el cobro previo" };
  }
  if (v.usd > 0 && !(await alta({ operation_id: opId, payment_date: hoy, amount_usd: v.usd, currency: "USD", payment_method: "efectivo", notes: nota }))) return { ok: false, motivo: "No se pudo guardar el cobro" };
  if (v.ars > 0 && !(await alta({ operation_id: opId, payment_date: hoy, amount_usd: v.arsUsd, amount_ars: v.ars, exchange_rate: v.tcUsado, currency: "ARS", payment_method: "efectivo", notes: nota }))) return { ok: false, motivo: v.usd > 0 ? "Se anotaron los dólares pero no los pesos" : "No se pudo guardar el cobro" };
  const nuevo = r2(cobrado + v.total);
  await ac(`/operations?id=eq.${opId}`, { method: "PATCH", body: JSON.stringify({ collected_amount: nuevo, collection_method: "efectivo", collection_currency: "USD", collection_date: hoy, ...(Math.abs(nuevo - total) <= 0.01 ? { is_collected: true } : {}) }) });
  return { ok: true, usd: v.total, cubre: Math.abs(nuevo - total) <= 0.01, tc: v.ars > 0 ? v.tcUsado : null };
}

async function cobroMyBox(opId, cobros, quien, tc) {
  const op = filas(await mb(`/operations?id=eq.${opId}&select=id,operation_code,paid_at,delivered_at,delivery_cost_usd,extra_charge_usd,debt_applied_usd,credit_applied_usd,debt_registered_usd,discount_applied_usd,clients(first_name,last_name)`))[0];
  if (!op) return { ok: false, motivo: "No se encontró la operación" };
  if (op.paid_at) return { ok: false, motivo: "La operación ya figuraba cobrada" };
  const [pk, pg] = await Promise.all([mb(`/packages?operation_id=eq.${opId}&select=ingreso_usd`), mb(`/finance_entries?operation_id=eq.${opId}&type=eq.ingreso&select=amount`)]);
  const saldo = r2(filas(pk).reduce((a, p) => a + Number(p.ingreso_usd || 0), 0) + Number(op.delivery_cost_usd || 0) + Number(op.extra_charge_usd || 0) + Number(op.debt_applied_usd || 0)
    - filas(pg).reduce((a, f) => a + Number(f.amount || 0), 0) - Number(op.credit_applied_usd || 0) - Number(op.debt_registered_usd || 0) - Number(op.discount_applied_usd || 0));
  if (saldo <= 0.01) return { ok: false, motivo: "La operación no tenía saldo" };
  const v = valorizar(cobros, saldo, tc);
  if (v.error) return { ok: false, motivo: v.error };
  const cliente = `${op.clients?.first_name || ""} ${op.clients?.last_name || ""}`.trim();
  const base = { date: hoyAR(), type: "ingreso", currency: "USD", payment_method: "efectivo", is_paid: true, auto_generated: false, operation_id: opId };
  const alta = (fila) => mb("/finance_entries", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fila) }).then((r) => !!filas(r)[0]);
  const desc = `Cobro ${op.operation_code} · ${cliente} · cobró ${quien}`;
  if (v.usd > 0 && !(await alta({ ...base, description: desc, amount: v.usd, wallet: "efectivo_usd", monto_ars: null }))) return { ok: false, motivo: "No se pudo guardar el cobro" };
  if (v.ars > 0 && !(await alta({ ...base, description: `${desc} (ARS ${pesos(v.ars)} @ ${pesos(v.tcUsado)})`, amount: v.arsUsd, wallet: "efectivo_ars", monto_ars: v.ars }))) return { ok: false, motivo: v.usd > 0 ? "Se anotaron los dólares pero no los pesos" : "No se pudo guardar el cobro" };
  const cubre = saldo - v.total <= 0.005;
  // Cobrada y entregada = cerrada (mismo criterio que Operaciones de MyBox).
  if (cubre) await mb(`/operations?id=eq.${opId}`, { method: "PATCH", body: JSON.stringify({ paid_at: new Date().toISOString(), ...(op.delivered_at ? { status: "cerrada" } : {}) }) });
  return { ok: true, usd: v.total, cubre, tc: v.ars > 0 ? v.tcUsado : null };
}

// → { ok: true, usd, cubre, tc } | { ok: false, motivo }
export async function anotarCobro({ base, opId, cobros, quien }) {
  const efectivo = (cobros || []).filter((c) => Number(c.monto) > 0);
  if (!efectivo.length) return null;
  const tc = efectivo.some((c) => c.moneda === "ARS") ? await tcDelDia() : null;
  try { return base === "mybox" ? await cobroMyBox(opId, efectivo, quien, tc?.mybox) : await cobroArgencargo(opId, efectivo, quien, tc?.argencargo); }
  catch (e) { return { ok: false, motivo: `Error al anotar: ${String(e?.message || e).slice(0, 120)}` }; }
}

// Reparte el pago del viaje (en pesos) en partes iguales entre sus paradas y lo anota como flete local de
// cada operación. metodo: "efectivo" | "transferencia". Devuelve por parada lo anotado (para poder deshacerlo).
export async function anotarCostoViaje({ paradas, pagoArs, metodo, quien }) {
  const tc = await tcDelDia();
  if (!tc) throw new Error("No se pudo leer el dólar del día: probá de nuevo en un rato");
  const n = paradas.length, parte = Math.floor((pagoArs / n) * 100) / 100, hoy = hoyAR();
  const hecho = [];
  for (let i = 0; i < n; i++) {
    const p = paradas[i], ars = i === n - 1 ? r2(pagoArs - parte * (n - 1)) : parte;
    if (!(ars > 0)) continue;
    if (p.base === "mybox") {
      const usd = r2(ars / tc.mybox);
      const ins = await mb("/finance_entries", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ date: hoy, type: "gasto", description: `Envío a domicilio · ${p.operation_code} · ${quien} (ARS ${pesos(ars)} @ ${pesos(tc.mybox)})`, amount: usd, currency: "USD", payment_method: metodo, wallet: metodo === "transferencia" ? "banco_ars" : "efectivo_ars", monto_ars: ars, category: "envio_domicilio", is_paid: true, auto_generated: false, operation_id: p.operation_id }) });
      const id = filas(ins)[0]?.id;
      if (id) hecho.push({ parada_id: p.id, costo: { ars, usd, tc: tc.mybox, asiento: id } });
    } else {
      const usd = r2(ars / tc.argencargo);
      const op = filas(await ac(`/operations?id=eq.${p.operation_id}&select=cost_flete_local,cost_flete_local_ars,cost_flete_local_currency`))[0];
      if (!op) continue;
      // Si ya había un flete local cargado en dólares, se suma solo el valor en dólares.
      const enPesos = !(Number(op.cost_flete_local) > 0) || op.cost_flete_local_currency === "ARS";
      const r = await ac(`/operations?id=eq.${p.operation_id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        cost_flete_local: r2(Number(op.cost_flete_local || 0) + usd),
        ...(enPesos ? { cost_flete_local_ars: r2(Number(op.cost_flete_local_ars || 0) + ars), cost_flete_local_currency: "ARS", cost_flete_local_exchange_rate: tc.argencargo, cost_flete_local_method: metodo } : {}),
        cost_flete_local_paid_at: new Date().toISOString(),
      }) });
      if (filas(r)[0]) hecho.push({ parada_id: p.id, costo: { ars, usd, tc: tc.argencargo, en_pesos: enPesos } });
    }
  }
  return hecho;
}

// Deshace lo anotado por anotarCostoViaje (viaje marcado como no pagado).
export async function quitarCostoViaje(paradas) {
  for (const p of paradas) {
    const c = p.costo;
    if (!c) continue;
    if (p.base === "mybox") { if (c.asiento) await mb(`/finance_entries?id=eq.${c.asiento}`, { method: "DELETE" }); continue; }
    const op = filas(await ac(`/operations?id=eq.${p.operation_id}&select=cost_flete_local,cost_flete_local_ars`))[0];
    if (!op) continue;
    const usd = Math.max(0, r2(Number(op.cost_flete_local || 0) - Number(c.usd || 0)));
    await ac(`/operations?id=eq.${p.operation_id}`, { method: "PATCH", body: JSON.stringify({ cost_flete_local: usd || null, ...(c.en_pesos ? { cost_flete_local_ars: Math.max(0, r2(Number(op.cost_flete_local_ars || 0) - Number(c.ars || 0))) || null } : {}), ...(usd ? {} : { cost_flete_local_paid_at: null }) }) });
  }
}
