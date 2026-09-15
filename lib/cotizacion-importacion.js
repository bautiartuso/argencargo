// Cotización de una importación armada desde el depósito (15/09/2026).
//
// Cuando el cliente carga la mercadería de sus bultos y ve el estimado, eso es una cotización
// y se guarda en `quotes` igual que las de la calculadora: una fila por operación
// (operation_id), que se actualiza con cada guardado. Antes ese flujo no guardaba nada y no
// quedaba registro de lo que el cliente había visto.
//
// Recibe el resultado de calcOpBudget (est) y arma el cuerpo con la MISMA forma que usa la
// calculadora del portal (products / packages / channel_alternatives con detail), así
// "Mis cotizaciones" y la lista del admin lo leen sin casos especiales.
//
// Pura: no toca la base. La usan el endpoint guardar-mercaderia y el script de relleno.

const n = (v) => Number(v || 0);
const r2 = (v) => Math.round(v * 100) / 100;

export function armarCotizacionDeImportacion({ op, items, pkgs, client, est }) {
  const totalFob = items.reduce((s, it) => s + n(it.unit_price_usd) * (n(it.quantity) || 1), 0);
  let totGW = 0, totCBM = 0;
  pkgs.forEach((p) => {
    const q = n(p.quantity) || 1;
    totGW += n(p.gross_weight_kg) * q;
    const l = n(p.length_cm), w = n(p.width_cm), h = n(p.height_cm);
    if (l && w && h) totCBM += ((l * w * h) / 1e6) * q;
  });

  // Lo que le cuesta la importación completa. Para el RI que paga los impuestos directo al
  // despachante, est.totalAbonar no los incluye (taxesBilledByArgencargo=false): acá se suman
  // para que total_cost sea el total de la importación, que es el número que le importa al
  // cliente. Lo que se le paga a Argencargo queda aparte en abonarArgencargo.
  const fueraDeAC = est.taxesBilledByArgencargo ? 0 : n(est.totalTax);
  const total = n(est.totalAbonar) + fueraDeAC;
  const td = est.taxDetail || {};
  const fleteBase = n(est.flete) - n(est.battExtra); // calcOpBudget ya suma battExtra en flete
  const envio = n(est.shipCost) + n(op.delivery_cost_usd);
  const impuestos = est.despachoReal
    ? [["Impuestos y despacho (factura real)", n(est.totalTax)]]
    : [["Derechos de importación", n(td.derechos)], ["Tasa estadística", n(td.tasaE)], ["IVA", n(td.iva)], ["Gasto documental", n(td.desembolso) + n(td.ivaDesembolso)]];
  const detail = [
    ["Flete internacional", fleteBase],
    n(est.battExtra) > 0 && ["Recargo por baterías", n(est.battExtra)],
    n(est.overweightSurcharge) > 0 && ["Recargo por sobrepeso", n(est.overweightSurcharge)],
    ["Seguro (1%)", n(est.seguro)],
    ...impuestos,
    envio > 0 && ["Envío a domicilio", envio],
  ].filter(Boolean).map(([l, v]) => [l, r2(v)]);

  const key = "aereo_a_china";
  const name = "Aéreo Courier Comercial";
  const info = op.origin === "USA" ? "3-5 días hábiles" : "7-10 días hábiles";
  const products = items.map((it) => ({
    type: "general",
    description: it.description || "",
    unit_price: n(it.unit_price_usd),
    quantity: n(it.quantity) || 1,
    ncm: it.ncm_code || it.import_duty_rate != null
      ? { ncm_code: it.ncm_code || "MANUAL", import_duty_rate: n(it.import_duty_rate), statistics_rate: n(it.statistics_rate), iva_rate: it.iva_rate == null || it.iva_rate === "" ? 21 : n(it.iva_rate) }
      : null,
    ...(it.antidumping_note ? { antidumping_note: it.antidumping_note } : {}),
  }));
  const packages = pkgs.map((p) => ({
    qty: n(p.quantity) || 1,
    length: p.length_cm ?? "", width: p.width_cm ?? "", height: p.height_cm ?? "", weight: p.gross_weight_kg ?? "",
    national_tracking: p.national_tracking || null,
  }));

  return {
    operation_id: op.id,
    client_id: client?.id || op.client_id || null,
    client_name: client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : null,
    client_code: client?.client_code || null,
    origin: op.origin || "China",
    channel_key: key,
    channel_name: name,
    client_selected_channel: key,
    products,
    packages,
    delivery: op.shipping_to_door ? "caba" : "oficina",
    total_fob: r2(totalFob),
    total_weight: r2(totGW),
    total_cbm: Math.round(totCBM * 1e4) / 1e4,
    total_cost: r2(total),
    tax_breakdown: td,
    channel_alternatives: [{
      key, name, info,
      totalAbonar: r2(total),
      abonarArgencargo: r2(n(est.totalAbonar)),
      flete: r2(n(est.flete)), seguro: r2(n(est.seguro)), totalTax: r2(n(est.totalTax)),
      shipCost: r2(envio), overweight: r2(n(est.overweightSurcharge)),
      detail, isBlanco: true,
    }],
    has_battery: !!op.has_battery,
    status: "pending",
    expires_at: new Date(Date.now() + 15 * 864e5).toISOString(),
  };
}
