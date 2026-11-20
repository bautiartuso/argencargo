// Aviso por WhatsApp de un reempaque que le ahorró plata al cliente (20/11/2026, pedido de
// Bautista: "tu carga fue reempaquetada y logramos que te ahorres X (bajamos X kilos)"; solo
// las que ahorraron).
//
// El ahorro es el MISMO que ve el cliente en el cartel verde del portal: flete + recargo por
// sobrepeso con los bultos de antes, menos los de ahora (respeta tramos de tarifa y mínimos).
// Solo servidor: `svc(path)` es un fetch a PostgREST con la clave de servicio que devuelve el
// arreglo de filas (o null). Devuelve null si no hubo ahorro, { pendiente } si todavía no se puede
// calcular, o el ahorro con los kilos de antes y después.
import { calcOpBudget } from "./calc";

const n = (v) => Number(v || 0);
export const fmtKg = (v) => `${n(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
export const fmtUsd = (v) => `USD ${n(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// `filas` = los reempaques hechos y sin avisar de UNA operación. Si hay más de uno (el agente
// reembaló y después el courier volvió a medir) se cuenta de punta a punta: lo que tenía antes
// del primero contra lo que quedó después del último.
export async function ahorroReempaque(svc, opId, filas) {
  const orden = [...filas].sort((a, b) => String(a.completed_at || "").localeCompare(String(b.completed_at || "")));
  const primero = orden[0], ultimo = orden[orden.length - 1];
  const antesKg = n(primero?.original_billable_kg), despuesKg = n(ultimo?.new_billable_kg);
  const deltaKg = antesKg - despuesKg;
  if (!(antesKg > 0) || !(despuesKg > 0) || !(deltaKg > 0.01)) return null;

  const ops = await svc(`/operations?id=eq.${opId}&select=*&limit=1`);
  const op = ops?.[0];
  if (!op?.client_id) return null;
  const [cl, items, pkgs, tariffs, cfgRows, ov, decl] = await Promise.all([
    svc(`/clients?id=eq.${op.client_id}&select=id,first_name,last_name,client_code,tax_condition,whatsapp&limit=1`),
    svc(`/operation_items?operation_id=eq.${opId}&select=*`),
    svc(`/operation_packages?operation_id=eq.${opId}&select=id,quantity,length_cm,width_cm,height_cm,gross_weight_kg,national_tracking&order=package_number.asc`),
    svc(`/tariffs?select=*`),
    svc(`/calc_config?select=key,value`),
    svc(`/client_tariff_overrides?client_id=eq.${op.client_id}&select=tariff_id,custom_rate`),
    svc(`/flight_invoice_items?operation_id=eq.${opId}&select=*`),
  ]);
  const client = cl?.[0];
  if (!client) return null;
  const config = {}; (cfgRows || []).forEach((r) => { config[r.key] = Number(r.value); });

  let ahorroUsd = null, fleteHoy = 0;
  try {
    const est = (items || []).length && tariffs ? calcOpBudget(op, items, pkgs || [], tariffs, config, ov || [], client, decl || []) : null;
    // Todavía no se puede calcular (la op no tiene los productos cargados): se reintenta después.
    if (!est) return { pendiente: true, op, client };
    fleteHoy = n(est.flete) + n(est.overweightSurcharge);
    const snap = Array.isArray(primero.original_packages_snapshot) ? primero.original_packages_snapshot : null;
    if (est && snap && snap.length) {
      const estAntes = calcOpBudget(op, items, snap, tariffs, config, ov || [], client, decl || []);
      const d = (n(estAntes?.flete) + n(estAntes?.overweightSurcharge)) - (n(est.flete) + n(est.overweightSurcharge));
      if (d > 0.005) ahorroUsd = d;
    }
    // Sin presupuesto calculable: kilos × valor por kilo.
    if (ahorroUsd == null && est && n(est.fleteRate) > 0) ahorroUsd = deltaKg * n(est.fleteRate);
  } catch { return { pendiente: true, op, client }; }
  if (!(ahorroUsd > 0)) return null;
  // El presupuesto guardado todavía tiene el flete de antes del reempaque: avisar ahora sería
  // decirle al cliente que ahorró algo que el sistema le sigue cobrando.
  const presupuestoViejo = n(op.budget_flete) + n(op.budget_surcharge) > fleteHoy + 1;
  return { op, client, antesKg, despuesKg, deltaKg, ahorroUsd: Math.round(ahorroUsd * 100) / 100, presupuestoViejo };
}

// Parámetros de la plantilla `reempaque_ahorro`.
export function paramsReempaque({ op, client, antesKg, despuesKg, deltaKg, ahorroUsd }) {
  const carga = op.description ? `${op.description} (${op.operation_code})` : op.operation_code;
  return [client.first_name || "Hola", carga, fmtUsd(ahorroUsd), fmtKg(antesKg), fmtKg(despuesKg), fmtKg(deltaKg)];
}

// Presupuesto guardado al día después de un reempaque (20/11/2026, regla de Bautista: "cuando hago
// el reembalaje se tiene que modificar, sea para abajo, para arriba, para donde sea"). Es la misma
// cuenta y los mismos candados que el guardado automático del editor: no toca presupuestos a
// mano, entregas ya coordinadas, Gestión Integral ni ops canceladas. `patch(path, body)` escribe.
export async function recalcularPresupuestoOp(svc, patch, opId) {
  const op = (await svc(`/operations?id=eq.${opId}&select=*&limit=1`))?.[0];
  if (!op) return { omitido: "no se encontró la operación" };
  const base = { codigo: op.operation_code };
  if (op.status === "cancelada") return { ...base, omitido: "cancelada" };
  if (op.budget_mode === "manual") return { ...base, omitido: "presupuesto a mano" };
  if (op.delivery_confirmed_at) return { ...base, omitido: "entrega ya coordinada" };
  if (op.service_type === "gestion_integral") return { ...base, omitido: "Gestión Integral" };
  const [cl, items, pkgs, tariffs, cfgRows, ov, decl] = await Promise.all([
    op.client_id ? svc(`/clients?id=eq.${op.client_id}&select=id,first_name,last_name,client_code,tax_condition&limit=1`) : [],
    svc(`/operation_items?operation_id=eq.${opId}&select=*`),
    svc(`/operation_packages?operation_id=eq.${opId}&select=*`),
    svc(`/tariffs?select=*`),
    svc(`/calc_config?select=key,value`),
    op.client_id ? svc(`/client_tariff_overrides?client_id=eq.${op.client_id}&select=*`) : [],
    svc(`/flight_invoice_items?operation_id=eq.${opId}&select=quantity,unit_price_declared_usd`),
  ]);
  // Si falla alguna lectura no se guarda nada: un presupuesto calculado sin tarifas daría cualquier cosa.
  if (!items || !pkgs || !tariffs?.length || !cfgRows?.length || !cl) return { ...base, omitido: "no se pudieron leer los datos" };
  const esBlanco = String(op.channel || "").includes("blanco");
  if (esBlanco && !items.length) return { ...base, omitido: "sin productos cargados" };
  if (!esBlanco && !pkgs.length) return { ...base, omitido: "sin bultos" };
  const config = {}; cfgRows.forEach((r) => { config[r.key] = Number(r.value); });
  const { totalTax, flete, seguro, totalAbonar, surcharge, taxDetail } = calcOpBudget(op, items, pkgs, tariffs, config, ov || [], cl[0] || null, decl || []);
  if (!(totalAbonar > 0)) return { ...base, omitido: "el cálculo dio cero" };
  const antes = n(op.budget_total);
  if (Math.abs(antes - totalAbonar) < 0.005) return { ...base, antes, ahora: totalAbonar, igual: true };
  const okPatch = await patch(`/operations?id=eq.${opId}`, { budget_taxes: totalTax, budget_flete: flete, budget_seguro: seguro, budget_surcharge: surcharge || 0, budget_total: totalAbonar, budget_tax_detail: taxDetail || null });
  if (!okPatch) return { ...base, omitido: "no se pudo guardar" };
  return { ...base, antes, ahora: totalAbonar };
}
