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

export function calcOpBudget(op, items, pkgs, tariffs, config, clientOverrides, client, declaredItems = []) {
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
  // Marítimo:
  //   maritimo_blanco = LCL/FCL → mínimo 0,5 m³ por orden (consolidado).
  //   maritimo_negro  = Integral → sin mínimo, cobra el CBM real.
  // Aéreo China (canal A blanco y canal B negro): peso facturable mínimo 5 kg.
  // USA mantiene su mínimo previo (1 kg). aereo_blanco es siempre China.
  // Aéreo B (negro/integral): mínimo facturable 0,5 kg. Aéreo A (blanco/courier): USA 1 kg, China 5 kg.
  const aereoMinKg = op.channel === "aereo_negro" ? 0.5 : (isUSA ? 1 : 5);
  const fleteAmt = isAereo
    ? (op.channel === "aereo_negro" ? Math.max(totGW, aereoMinKg) : Math.max(pf, aereoMinKg))
    : (op.channel === "maritimo_blanco" ? Math.max(totCBM, 0.5) : totCBM);

  // Devuelve { rate, cost } del bracket aplicable. Si hay override por cliente, sobreescribe SOLO el rate (cost queda).
  // OJO: solo type='rate' (los 'special' como baterías se aplican aparte como adicional, no como tarifa base).
  // Fecha de referencia para la vigencia de tarifas: la fecha de creación de la op.
  // Las ops ya creadas usan la tarifa que regía cuando se crearon (no la actual);
  // sin op.created_at (cotización nueva) → ahora → tarifa vigente.
  const tariffRefMs = op.created_at ? Date.parse(op.created_at) : Date.now();
  const tariffActive = (t) =>
    (t.effective_from == null || Date.parse(t.effective_from) <= tariffRefMs) &&
    (t.effective_to == null || tariffRefMs < Date.parse(t.effective_to));
  const getRateAndCost = (sk, amt) => {
    const rates = tariffs.filter(t => t.service_key === sk && t.type === "rate" && tariffActive(t));
    for (const r of rates) {
      const min = Number(r.min_qty || 0);
      const max = r.max_qty != null ? Number(r.max_qty) : Infinity;
      if (amt >= min && amt < max) {
        const ov = (clientOverrides || []).find(o => o.tariff_id === r.id);
        return { rate: ov ? Number(ov.custom_rate) : Number(r.rate), cost: Number(r.cost || 0) };
      }
    }
    if (rates.length) {
      const last = rates[rates.length - 1];
      return { rate: Number(last.rate), cost: Number(last.cost || 0) };
    }
    return { rate: 0, cost: 0 };
  };

  // Tarifa: toma del service_key calculado arriba (ya incluye 'aereo_b_usa_celulares' si aplica).
  // Respeta client_tariff_overrides → permite tarifa preferencial por cliente tanto para carga general como celulares.
  const { rate: fleteRate, cost: fleteCostRate } = getRateAndCost(svcKey, fleteAmt);
  let flete = fleteAmt * fleteRate;
  let fleteCost = fleteAmt * fleteCostRate; // costo real del flete para Argencargo
  // Recargo por baterías: solo aéreo A (Courier Comercial), USD 2/kg facturable.
  // Se devuelve aparte (battExtra) para poder mostrarlo como línea propia, pero
  // queda incluido en `flete` para no alterar los totales/budget existentes.
  const battExtra = (op.channel === "aereo_blanco" && op.has_battery) ? fleteAmt * 2 : 0;
  flete += battExtra;

  const certFlRate = isAereo
    ? (isRI ? (config.cert_flete_aereo_real || 2.5) : (config.cert_flete_aereo_ficticio || 3.5))
    : (config.cert_flete_maritimo_ficticio || 100);

  const certFlAmt = isAereo
    ? (isRI ? totGW * certFlRate : Math.max(pf, aereoMinKg) * certFlRate)
    : totCBM * certFlRate;

  // Seguro: solo aplica a canal A (Courier Comercial / Marítimo LCL/FCL).
  // Canal B (Integral AC) no lo cobra al cliente — se devuelve 0 para que no aparezca en cotizaciones.
  const seguro = isBlanco ? (totalFob + certFlAmt) * 0.01 : 0;
  const cif = totalFob + certFlAmt + seguro;

  const getDesembolso = (c) => {
    const table = [[5, 0], [9, 36], [20, 50], [50, 58], [100, 65], [400, 72], [800, 84], [1000, 96], [Infinity, 120]];
    for (const [max, amt] of table) if (c < max) return amt;
    return 120;
  };

  // RI (aéreo blanco): los impuestos se calculan sobre el VALOR DECLARADO a Aduana,
  // no sobre el valor real que cargó el cliente. Escalamos cada item al total declarado
  // (proporcional — robusto a la re-agrupación de la compresión; las tasas DIE/TE/IVA por
  // item se conservan). Para no-RI la subfacturación es margen del admin → impuestos sobre real.
  let taxItems = items, taxFob = totalFob, taxCif = cif;
  if (isRI && isBlanco && Array.isArray(declaredItems) && declaredItems.length > 0) {
    const declTotal = declaredItems.reduce((s, d) => s + Number(d.quantity || 0) * Number(d.unit_price_declared_usd || 0), 0);
    if (declTotal > 0 && totalFob > 0) {
      const r = declTotal / totalFob;
      taxItems = items.map(it => ({ ...it, unit_price_usd: Number(it.unit_price_usd || 0) * r }));
      taxFob = declTotal;
      taxCif = taxFob + certFlAmt + (taxFob + certFlAmt) * 0.01;
    }
  }

  let totalTax = 0;
  if (isBlanco) {
    taxItems.forEach(it => {
      const itemFob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
      const pct = taxFob > 0 ? itemFob / taxFob : 1;
      const iCert = certFlAmt * pct;
      const iSeg = (itemFob + iCert) * 0.01;
      const iCif = itemFob + iCert + iSeg;
      // Importante: chequear null/"" explícito — el || trataba el 0 como falsy y caía al default 21%.
      // Si el admin explícitamente setea iva_rate=0, ese 0 es el valor correcto.
      const dr = (it.import_duty_rate==null||it.import_duty_rate==="")?0:Number(it.import_duty_rate)/100;
      const te = (it.statistics_rate==null||it.statistics_rate==="")?0:Number(it.statistics_rate)/100;
      const ivaR = (it.iva_rate==null||it.iva_rate==="")?0.21:Number(it.iva_rate)/100;
      const die = iCif * dr;
      const tasa = iCif * te;
      const bi = iCif + die + tasa;
      const iva = bi * ivaR;
      let t = die + tasa + iva;
      if (isMaritimo) {
        const ivaAdicR = (it.iva_additional_rate==null||it.iva_additional_rate==="")?0.20:Number(it.iva_additional_rate)/100;
        const iiggR = (it.iigg_rate==null||it.iigg_rate==="")?0.06:Number(it.iigg_rate)/100;
        const iibbR = (it.iibb_rate==null||it.iibb_rate==="")?0.05:Number(it.iibb_rate)/100;
        t += bi * ivaAdicR + bi * iiggR + bi * iibbR;
      } else {
        // Desembolso (cargo fijo de documentación) siempre aplica para canal A blanco,
        // independiente de DIE/TE/IVA del item. El IVA sobre el desembolso es 21% fijo
        // (es IVA del servicio del despachante, no del producto).
        const desemb = getDesembolso(taxCif) * pct;
        t += desemb + desemb * 0.21;
      }
      totalTax += t;
    });
  }

  // RI (aéreo blanco): si el admin cargó el despacho REAL (factura del despachante/DHL),
  // los impuestos son esos valores reales — NO la fórmula. El RI ve la factura del despacho,
  // así que el presupuesto tiene que coincidir al centavo. IVA incluido (su recupero como
  // crédito fiscal es asunto del RI con su contador, no lo descontamos acá).
  // Si todavía no está cargado el despacho, queda el estimado de la fórmula (sobre declarado).
  let despachoReal = false;
  if (isRI && isBlanco) {
    const dDie = Number(op.despacho_die_usd || 0);
    const dEst = Number(op.despacho_estadistica_usd || 0);
    const dDes = Number(op.despacho_desaduanaje_usd || 0);
    const dIva = Number(op.despacho_iva_usd || 0);
    const sum = dDie + dEst + dDes + dIva;
    if (sum > 0) { totalTax = sum; despachoReal = true; }
  }

  const shipCost = op.shipping_to_door ? Number(op.shipping_cost || 0) : 0;

  // Recargo por valor de mercadería (solo canal B).
  // Se calcula vpu = valor mercadería / cantidad (peso o CBM según canal).
  // Busca en tariffs.type='surcharge' del service_key el rango que aplica.
  // merchandise_value_usd (columna de op) override items; si no está, se usa totalFob (de items).
  let surcharge = 0, surchargePct = 0;
  // Exponemos info auxiliar para que la UI muestre vpu / umbrales aunque el recargo no aplique.
  let vpu = 0, surchargeNextThreshold = null, surchargeNextRate = null, surchargeUnit = null;
  if (!isBlanco) {
    const merchVal = Number(op.merchandise_value_usd || 0) || totalFob;
    const amt = isAereo ? (op.channel === "aereo_negro" ? totGW : pf) : totCBM;
    surchargeUnit = isAereo ? "kg" : "CBM";
    if (merchVal > 0 && amt > 0) {
      vpu = merchVal / amt;
      const surchs = tariffs
        .filter(t => t.service_key === svcKey && t.type === "surcharge")
        .sort((a, b) => Number(b.min_qty || 0) - Number(a.min_qty || 0));
      for (const s of surchs) {
        if (vpu >= Number(s.min_qty || 0)) {
          surchargePct = Number(s.rate || 0);
          surcharge = Math.round(merchVal * (surchargePct / 100) * 100) / 100;
          break;
        }
      }
      // Si NO aplicó recargo, buscar cuál sería el próximo umbral (el más bajo > vpu).
      if (surchargePct === 0) {
        const ascending = [...surchs].sort((a, b) => Number(a.min_qty || 0) - Number(b.min_qty || 0));
        const next = ascending.find(s => vpu < Number(s.min_qty || 0));
        if (next) {
          surchargeNextThreshold = Number(next.min_qty || 0);
          surchargeNextRate = Number(next.rate || 0);
        }
      }
    }
  }

  // Envío a domicilio confirmado por el cliente en /retiro/[token] (delivery_cost_usd) — se suma
  // siempre acá para que sobreviva cualquier recálculo de budget_total (antes se sumaba solo una
  // vez en el POST de confirmación y se perdía apenas se recalculaba el presupuesto de la op).
  const deliveryCost = Number(op.delivery_cost_usd || 0);

  // Canal B (negro) se cobra en efectivo — redondeamos al peso/dólar entero para no
  // manejar cambio suelto (ej. 462,50 → 463).
  const totalAbonar = isBlanco
    ? (totalTax + flete + seguro + shipCost + deliveryCost)
    : Math.round(flete + surcharge + shipCost + deliveryCost);

  // Costo real para Argencargo:
  //  - flete: lo que pagamos al carrier (fleteCost) — margen logístico = flete - fleteCost.
  //  - impuestos y seguro: pasan a AFIP / aseguradora (los cobramos y los pagamos, sin margen).
  //  - surcharge: NO tiene costo (es margen puro).
  //  - shipCost / deliveryCost (envío local): pass-through, asumimos costo = revenue (sin margen).
  const realCost = isBlanco
    ? (totalTax + fleteCost + seguro + shipCost + deliveryCost)
    : (fleteCost + shipCost + deliveryCost);

  return { totalTax, flete, battExtra, fleteCost, fleteRate, fleteCostRate, fleteAmt, seguro, totalAbonar, realCost, shipCost, surcharge, surchargePct, vpu, surchargeUnit, surchargeNextThreshold, surchargeNextRate, despachoReal };
}
