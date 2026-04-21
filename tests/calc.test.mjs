// Tests de calcOpBudget. Correr: `npm test`
// Usa el runner nativo de node (node --test). Sin dependencias externas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcOpBudget } from "../lib/calc.js";

// ——— Fixtures ———

const tariffs = [
  // Aéreo A China (courier comercial blanco) — $15/kg en 0-50kg
  { id: "t1", service_key: "aereo_a_china", type: "rate", min_qty: 0,  max_qty: 50,  rate: 15,  sort_order: 1 },
  { id: "t2", service_key: "aereo_a_china", type: "rate", min_qty: 50, max_qty: 100, rate: 12,  sort_order: 2 },
  // Aéreo B China (integral AC negro) — $10/kg en 0-100kg
  { id: "t3", service_key: "aereo_b_china", type: "rate", min_qty: 0,  max_qty: 100, rate: 10,  sort_order: 1 },
  // Aéreo B USA — $12/kg
  { id: "t4", service_key: "aereo_b_usa",   type: "rate", min_qty: 0,  max_qty: 100, rate: 12,  sort_order: 1 },
  // Marítimo A China — $500/CBM
  { id: "t5", service_key: "maritimo_a_china", type: "rate", min_qty: 0, max_qty: 10, rate: 500, sort_order: 1 },
  // Marítimo B (integral) — $350/CBM
  { id: "t6", service_key: "maritimo_b",       type: "rate", min_qty: 0, max_qty: 10, rate: 350, sort_order: 1 },
];

const config = {
  cert_flete_aereo_real: 2.5,
  cert_flete_aereo_ficticio: 3.5,
  cert_flete_maritimo_ficticio: 100,
};

// ——— Tests ———

test("canal B (negro) sólo cobra flete por peso BRUTO, sin volumétrico", () => {
  const op = { channel: "aereo_negro", origin: "China", shipping_to_door: false };
  const items = [{ unit_price_usd: 10, quantity: 5 }];
  // Peso bruto 5kg, volumétrico sería (40*30*25)/5000 = 6kg
  // Canal B debe IGNORAR el volumétrico y cobrar sólo por bruto
  const pkgs = [{ quantity: 1, gross_weight_kg: 5, length_cm: 40, width_cm: 30, height_cm: 25 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  // Flete: max(5, 1) * $10 = $50 (NO $60 como sería con volumétrico)
  assert.equal(r.totalTax, 0);
  assert.equal(r.flete, 50);
  assert.equal(r.totalAbonar, 50);
});

test("canal B negro: bulto grande y liviano cobra SOLO por bruto (sin volumétrico)", () => {
  const op = { channel: "aereo_negro", origin: "China" };
  const items = [{ unit_price_usd: 10, quantity: 10 }];
  // Volumétrico = (60*40*35)/5000 = 16.8 kg, bruto = 5kg
  const pkgs = [{ quantity: 1, gross_weight_kg: 5, length_cm: 60, width_cm: 40, height_cm: 35 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  // Canal B: sólo cobra por bruto → max(5, 1) * $10 = $50
  assert.equal(r.flete, 50);
});

test("canal B con envío a domicilio suma shipping_cost", () => {
  const op = { channel: "aereo_negro", origin: "China", shipping_to_door: true, shipping_cost: 20 };
  const items = [{ unit_price_usd: 10, quantity: 5 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 5 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  assert.equal(r.shipCost, 20);
  assert.equal(r.totalAbonar, r.flete + 20);
});

test("canal A blanco aéreo calcula impuestos por item (no RI)", () => {
  const op = { channel: "aereo_blanco", origin: "China", shipping_to_door: false };
  const items = [{ unit_price_usd: 10, quantity: 10, import_duty_rate: 35, statistics_rate: 3, iva_rate: 21 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 5 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], { tax_condition: "monotributista" });
  // Flete: 5kg * $15 = $75
  assert.equal(r.flete, 75);
  // Impuestos > 0 (canal blanco calcula DIE/TE/IVA)
  assert.ok(r.totalTax > 0, `totalTax debe ser > 0, fue ${r.totalTax}`);
  assert.ok(r.totalAbonar > r.flete + r.seguro, "totalAbonar debe incluir impuestos");
});

test("canal A blanco con RI usa certificación real (menor)", () => {
  const op = { channel: "aereo_blanco", origin: "China" };
  const items = [{ unit_price_usd: 10, quantity: 10, import_duty_rate: 35, statistics_rate: 3, iva_rate: 21 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 5 }];
  const rRI = calcOpBudget(op, items, pkgs, tariffs, config, [], { tax_condition: "responsable_inscripto" });
  const rNoRI = calcOpBudget(op, items, pkgs, tariffs, config, [], { tax_condition: "monotributista" });
  // RI paga menos en impuestos (cert flete 2.5 vs 3.5)
  assert.ok(rRI.totalTax < rNoRI.totalTax, `RI totalTax (${rRI.totalTax}) debería ser menor que no-RI (${rNoRI.totalTax})`);
});

test("recargo baterías: canal A blanco con has_battery suma $2/kg al flete", () => {
  const op = { channel: "aereo_blanco", origin: "China", has_battery: true };
  const opNoBat = { ...op, has_battery: false };
  const items = [{ unit_price_usd: 10, quantity: 10, import_duty_rate: 35, statistics_rate: 3, iva_rate: 21 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 5 }];
  const rBat = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  const rNoBat = calcOpBudget(opNoBat, items, pkgs, tariffs, config, [], null);
  // 5kg * $2 = $10 extra
  assert.equal(rBat.flete - rNoBat.flete, 10);
});

test("client_overrides: tarifa custom reemplaza tarifa base", () => {
  const op = { channel: "aereo_negro", origin: "China" };
  const items = [{ unit_price_usd: 10, quantity: 5 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 5 }];
  const overrides = [{ tariff_id: "t3", custom_rate: 7 }]; // base era 10
  const rBase = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  const rCust = calcOpBudget(op, items, pkgs, tariffs, config, overrides, null);
  assert.equal(rBase.flete, 5 * 10); // 50
  assert.equal(rCust.flete, 5 * 7);  // 35
});

test("sin productos y sin bultos devuelve todo 0", () => {
  const op = { channel: "aereo_blanco", origin: "China" };
  const r = calcOpBudget(op, [], [], tariffs, config, [], null);
  assert.equal(r.totalTax, 0);
  assert.equal(r.flete, 0);
  assert.equal(r.seguro, 0);
  assert.equal(r.totalAbonar, 0);
});

test("marítimo B usa CBM, no peso", () => {
  const op = { channel: "maritimo_negro", origin: "China" };
  const items = [{ unit_price_usd: 10, quantity: 10 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 100, length_cm: 100, width_cm: 100, height_cm: 100 }];
  // CBM = 1m³, flete = 1 * 350 = 350
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  assert.equal(r.flete, 350);
});

test("peso volumétrico supera al bruto cuando el bulto es grande y liviano", () => {
  const op = { channel: "aereo_blanco", origin: "China" };
  const items = [{ unit_price_usd: 10, quantity: 10, import_duty_rate: 35, statistics_rate: 3, iva_rate: 21 }];
  // 60*40*35 / 5000 = 16.8 kg vol vs 5kg bruto → paga por 16.8
  const pkgs = [{ quantity: 1, gross_weight_kg: 5, length_cm: 60, width_cm: 40, height_cm: 35 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  // Flete = 16.8 * $15 = $252
  assert.equal(r.flete, 252);
});

test("USA aéreo negro usa tarifa aereo_b_usa", () => {
  const op = { channel: "aereo_negro", origin: "USA" };
  const items = [{ unit_price_usd: 10, quantity: 5 }];
  const pkgs = [{ quantity: 1, gross_weight_kg: 10 }];
  const r = calcOpBudget(op, items, pkgs, tariffs, config, [], null);
  // Flete USA: max(10, 1) * $12 = $120
  assert.equal(r.flete, 120);
});
