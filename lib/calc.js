// Cálculo de presupuesto de una operación.
// Pura y sin dependencias externas — fácil de testear.
//
// Inputs:
//   op:              { channel, origin, has_battery, shipping_to_door, shipping_cost, ... }
//   items:           [{ unit_price_usd, quantity, import_duty_rate, statistics_rate, iva_rate, iva_additional_rate, iigg_rate, iibb_rate }]
//   pkgs:            [{ quantity, gross_weight_kg, length_cm, width_cm, height_cm }]
//   tariffs:         [{ service_key, min_qty, max_qty, rate, id }]
//   config:          { cert_flete_aereo_real, cert_flete_aereo_ficticio, cert_flete_maritimo_ficticio }
//   clientOverrides: [{ tariff_id, custom_rate }]
//   client:          { tax_condition }  // "responsable_inscripto" para RI
//
// Output: { totalTax, flete, seguro, totalAbonar, shipCost }

export function calcOpBudget(op, items, pkgs, tariffs, config, clientOverrides, client) {
  const totalFob = items.reduce((s, it) => s + Number(it.unit_price_usd || 0) * Number(it.quantity || 1), 0);

  let pf = 0, totCBM = 0, totGW = 0;
  pkgs.forEach(p => {
    const q = Number(p.quantity || 1);
    const gw = Number(p.gross_weight_kg || 0);
    const l = Number(p.length_cm || 0);
    const w = Number(p.width_cm || 0);
    const h = Number(p.height_cm || 0);
    const b = gw * q;
    const v = l && w && h ? ((l * w * h) / 5000) * q : 0;
    pf += Math.max(b, v);
    totGW += b;
    totCBM += l && w && h ? ((l * w * h) / 1000000) * q : 0;
  });

  const isBlanco = op.channel?.includes("blanco");
  const isAereo = op.channel?.includes("aereo");
  const isMaritimo = op.channel?.includes("maritimo");
  const isUSA = op.origin === "USA";
  const isRI = client?.tax_condition === "responsable_inscripto";

  // Si es aéreo B USA + celulares, usa service_key especial 'aereo_b_usa_celulares' (configurable + overrideable por cliente)
  const isPhonesBUsa = op.channel === "aereo_negro" && isUSA && op.has_phones;
  const svcKey = isPhonesBUsa ? "aereo_b_usa_celulares" :
    op.channel === "aereo_blanco" ? "aereo_a_china" :
    op.channel === "aereo_negro" ? (isUSA ? "aereo_b_usa" : "aereo_b_china") :
    op.channel === "maritimo_blanco" ? "maritimo_a_china" :
    "maritimo_b";

  // Canal B aéreo (negro): cobra por peso BRUTO únicamente (sin volumétrico).
  // Canal A aéreo (blanco): cobra por peso facturable (max bruto / volumétrico).
  // Marítimo: por CBM.
  const fleteAmt = isAereo
    ? (op.channel === "aereo_negro" ? Math.max(totGW, 1) : pf)
    : (op.channel === "maritimo_blanco" ? Math.max(totCBM, 1) : totCBM);

  const getRate = (sk, amt) => {
    const rates = tariffs.filter(t => t.service_key === sk);
    for (const r of rates) {
      const min = Number(r.min_qty || 0);
      const max = r.max_qty != null ? Number(r.max_qty) : Infinity;
      if (amt >= min && amt < max) {
        const ov = (clientOverrides || []).find(o => o.tariff_id === r.id);
        return ov ? Number(ov.custom_rate) : Number(r.rate);
      }
    }
    return rates.length ? Number(rates[rates.length - 1].rate) : 0;
  };

  // Tarifa: toma del service_key calculado arriba (ya incluye 'aereo_b_usa_celulares' si aplica).
  // Respeta client_tariff_overrides → permite tarifa preferencial por cliente tanto para carga general como celulares.
  const fleteRate = getRate(svcKey, fleteAmt);
  let flete = fleteAmt * fleteRate;
  if (op.channel === "aereo_blanco" && op.has_battery) flete += fleteAmt * 2;

  const certFlRate = isAereo
    ? (isRI ? (config.cert_flete_aereo_real || 2.5) : (config.cert_flete_aereo_ficticio || 3.5))
    : (config.cert_flete_maritimo_ficticio || 100);

  const certFlAmt = isAereo
    ? (isRI ? totGW * certFlRate : pf * certFlRate)
    : totCBM * certFlRate;

  const seguro = (totalFob + certFlAmt) * 0.01;
  const cif = totalFob + certFlAmt + seguro;

  const getDesembolso = (c) => {
    const table = [[5, 0], [9, 36], [20, 50], [50, 58], [100, 65], [400, 72], [800, 84], [1000, 96], [Infinity, 120]];
    for (const [max, amt] of table) if (c < max) return amt;
    return 120;
  };

  let totalTax = 0;
  if (isBlanco) {
    items.forEach(it => {
      const itemFob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
      const pct = totalFob > 0 ? itemFob / totalFob : 1;
      const iCert = certFlAmt * pct;
      const iSeg = (itemFob + iCert) * 0.01;
      const iCif = itemFob + iCert + iSeg;
      const dr = Number(it.import_duty_rate || 0) / 100;
      const te = Number(it.statistics_rate || 0) / 100;
      const ivaR = Number(it.iva_rate || 21) / 100;
      const die = iCif * dr;
      const tasa = iCif * te;
      const bi = iCif + die + tasa;
      const iva = bi * ivaR;
      let t = die + tasa + iva;
      if (isMaritimo) {
        const ivaAdicR = Number(it.iva_additional_rate || 20) / 100;
        const iiggR = Number(it.iigg_rate || 6) / 100;
        const iibbR = Number(it.iibb_rate || 5) / 100;
        t += bi * ivaAdicR + bi * iiggR + bi * iibbR;
      } else {
        const desemb = getDesembolso(cif) * pct;
        t += desemb + desemb * 0.21;
      }
      totalTax += t;
    });
  }

  const shipCost = op.shipping_to_door ? Number(op.shipping_cost || 0) : 0;
  const totalAbonar = isBlanco ? (totalTax + flete + seguro + shipCost) : (flete + shipCost);

  return { totalTax, flete, seguro, totalAbonar, shipCost };
}
