// Posiciones arancelarias más favorables para la factura de un vuelo (12/11/2026, pedido de Bautista).
// Para cada ítem de la factura busca posiciones que pagan menos derechos y donde la mercadería, TAL COMO
// ESTÁ DESCRIPTA, también puede clasificarse. No inventa: los candidatos salen del nomenclador
// (ncm_database) y Claude solo dice cuáles encajan, con qué fuerza y por qué. Nunca se aplica sola.
//
// POST { flight_id, rapido? }              → analiza (rapido = solo lo que no necesita IA, al instante) (hasta 10 descripciones nuevas por llamada; el resto
//                                            queda en `pendientes` y el panel vuelve a llamar)
// POST { action:"usar", item_id, ncm }     → cambia la posición del ítem del vuelo y guarda la anterior
//                                            en hs_original (la operación del cliente no se toca)
// POST { action:"descartar", item_id }     → no vuelve a sugerirla para esa mercadería
// POST { action:"volver", item_id }        → restituye la posición original
// POST { action:"probar", descripcion, ncm } → consulta suelta, sin vuelo y sin guardar nada
import { usuarioConRol } from "../../../../lib/auth-server";
import { callClaudeText } from "../../../../lib/anthropic";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};
const json = (d, s = 200) => Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
const arr = (x) => (Array.isArray(x) ? x : []);
const UUID = /^[0-9a-f-]{36}$/i;

const conPuntos = (hs) => { const c = String(hs || "").replace(/\D/g, ""); return c.length >= 8 ? `${c.slice(0, 4)}.${c.slice(4, 6)}.${c.slice(6, 8)}` : null; };
const normDesc = (d) => String(d || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);

// Agrupa las filas del nomenclador por código: { ncm, die, te, textos[] } (alícuota = la más alta del código).
function porCodigo(filas) {
  const m = new Map();
  arr(filas).forEach((f) => {
    const x = m.get(f.ncm_code) || { ncm: f.ncm_code, die: 0, te: 0, textos: [] };
    x.die = Math.max(x.die, Number(f.die || 0)); x.te = Math.max(x.te, Number(f.te || 0));
    const t = String(f.description || "").replace(/\s+/g, " ").trim();
    if (t && !x.textos.includes(t) && x.textos.length < 4) x.textos.push(t.slice(0, 110));
    m.set(f.ncm_code, x);
  });
  return m;
}
const partida = async (p4) => porCodigo(await sb(`/ncm_database?ncm_code=like.${p4}*&select=ncm_code,description,die,te&limit=2000`));

const SYSTEM = `Sos despachante de aduana experto en la Nomenclatura Común del Mercosur (NCM) para importaciones a la Argentina.
Te paso una mercadería, la posición con la que se va a declarar y una lista de posiciones que pagan menos derechos. Tu tarea es decir en cuáles de esas posiciones ESTA mercadería puede clasificarse aplicando las Reglas Generales Interpretativas y el texto legal.

Cómo razonar: la lista trae solo el texto de la última apertura de cada código, agrupada por subpartida. Un "Los demás" no significa nada suelto: vale únicamente dentro de su grupo, así que mirá las hermanas de cada candidata para saber de qué trata ese grupo (por ejemplo, si las hermanas son aparatos con conexión por cable, ese "Los demás" es de aparatos por cable). Reconstruí además de memoria el texto de la partida (4 dígitos) y de las subpartidas (6 y 8 dígitos), y compará la mercadería contra el texto completo de la rama, no contra la apertura suelta. Solo se pueden proponer las marcadas con ✔.

Criterio:
- "firme": la alternativa describe la mercadería igual o mejor que la posición actual (es más específica o igual de válida).
- "discutible": es defendible con el texto y con la función principal del producto, aunque la Aduana podría preferir la posición actual. También va acá cuando la alternativa depende de una característica que la descripción no dice pero que ese tipo de producto normalmente tiene (por ejemplo, que transmite por Bluetooth o WiFi): proponela y poné en "condicion" exactamente qué hay que verificar en el producto.
- Todo lo demás NO se propone.

Nunca propongas una posición que solo sirva describiendo la mercadería como otra cosa: otra función principal, otro material, una parte en lugar del aparato completo, o un uso que el producto no tiene. Que ninguna alternativa encaje es frecuente y es una respuesta correcta.

En "motivo" decí solo lo que estás seguro que dice el texto legal; no afirmes qué exige o excluye una posición si no lo recordás con certeza.

Además de la lista, podés sumar como máximo UNA posición de otra partida si la mercadería encaja ahí con claridad.

Respondé SOLO con JSON, sin texto alrededor:
{"alternativas":[{"ncm":"0000.00.00","fuerza":"firme","motivo":"una oración: por qué la mercadería encaja en esa posición","condicion":"qué tiene que cumplir o qué hay que verificar en el producto para sostenerla, o null"}]}
Como máximo 2 alternativas, de la más sólida a la menos.`;

// La base solo tiene el texto de la última apertura ("Los demás" no dice nada suelto). Para que se entienda
// de qué trata cada grupo se le muestra la partida agrupada por subpartida, con las hermanas de cada
// candidata: ✔ = paga menos y se puede proponer; las demás van solo como contexto.
function estructura(todas, actual, candidatos) {
  const esCand = new Set(candidatos.map((c) => c.ncm));
  const grupos = new Map();
  [...todas.values()].sort((a, b) => a.ncm.localeCompare(b.ncm)).forEach((c) => { const k = c.ncm.slice(0, 9); (grupos.get(k) || grupos.set(k, []).get(k)).push(c); });
  const lineas = [];
  for (const [k, cs] of grupos) {
    if (!cs.some((c) => esCand.has(c.ncm) || c.ncm === actual.ncm)) continue;
    lineas.push(`Grupo ${k}x:`);
    cs.forEach((c) => lineas.push(`  ${esCand.has(c.ncm) ? "✔" : c.ncm === actual.ncm ? "●" : "·"} ${c.ncm} (derechos ${c.die} %, tasa ${c.te} %): ${c.textos.join(" · ") || "sin texto"}`));
    if (lineas.length > 170) break;
  }
  return lineas.join("\n");
}

async function analizar(desc, actual, candidatos, todas) {
  const lista = todas ? estructura(todas, actual, candidatos) : candidatos.map((c) => `✔ ${c.ncm} (derechos ${c.die} %, tasa ${c.te} %): ${c.textos.join(" · ") || "sin texto"}`).join("\n");
  const extra = todas ? candidatos.filter((c) => !todas.has(c.ncm)).map((c) => `✔ ${c.ncm} (derechos ${c.die} %, tasa ${c.te} %): ${c.textos.join(" · ") || "sin texto"}`).join("\n") : "";
  const user = `Mercadería: "${desc}"\nPosición actual (●): ${actual.ncm} (derechos ${actual.die} %, tasa de estadística ${actual.te} %): ${actual.textos.join(" · ") || "sin texto"}\n\nAperturas de la partida, agrupadas (✔ = paga menos y se puede proponer; · = solo contexto):\n${lista}${extra ? `\n\nOtras posiciones más baratas que ya se usan en este mismo vuelo:\n${extra}` : ""}`;
  // Dos pasos rápidos en vez de un razonamiento largo (tardaba un minuto por ítem, 12/11/2026):
  // 1) barrido: qué candidatas podrían servir; 2) verificación: cada propuesta se revisa sola contra su grupo.
  const txt = await callClaudeText({ system: SYSTEM, user, max_tokens: 800, feature: "ncm-alternativas" });
  const m = String(txt || "").match(/\{[\s\S]*\}/);
  if (!m) return [];
  let j = null; try { j = JSON.parse(m[0]); } catch { return []; }
  const props = arr(j?.alternativas).slice(0, 2).map((a) => ({ ncm: conPuntos(a?.ncm), fuerza: a?.fuerza === "firme" ? "firme" : "discutible", motivo: String(a?.motivo || "").slice(0, 400), condicion: a?.condicion ? String(a.condicion).slice(0, 300) : null })).filter((a) => a.ncm && a.ncm !== actual.ncm);
  const ok = await Promise.all(props.map((a) => verificar(desc, actual, a, todas).catch(() => null)));
  return ok.filter(Boolean);
}

const SYSTEM_VERIF = `Sos despachante de aduana experto en la Nomenclatura Común del Mercosur. Revisás con criterio estricto si una mercadería puede declararse en una posición propuesta.
Te paso la mercadería, la posición propuesta y TODAS las aperturas de su grupo. Las hermanas te dicen de qué trata el grupo: un "Los demás" solo cubre mercadería de la misma clase que sus hermanas (si las hermanas son aparatos con conexión por cable, ese "Los demás" es de aparatos por cable, y un aparato inalámbrico NO entra).
Respondé SOLO con JSON:
{"valida":true,"fuerza":"firme","motivo":"una oración con el porqué","condicion":"qué hay que verificar en el producto, o null"}
- "valida": false si el grupo es de otra clase de mercadería, o si haría falta describir el producto como algo que no es.
- "fuerza": "firme" si describe la mercadería igual o mejor que la posición actual; "discutible" si es defendible pero la Aduana podría preferir la actual.`;

// Segunda mirada, una propuesta por vez, contra las aperturas de su propio grupo.
async function verificar(desc, actual, a, todas) {
  const grupo = todas ? [...todas.values()].filter((c) => c.ncm.slice(0, 9) === a.ncm.slice(0, 9)).sort((x, y) => x.ncm.localeCompare(y.ncm)) : [];
  if (!grupo.length) return a; // posición de otra partida: no hay grupo cargado para contrastar
  const user = `Mercadería: "${desc}"\nPosición actual: ${actual.ncm}: ${actual.textos.join(" · ") || "sin texto"}\nPosición propuesta: ${a.ncm}\n\nAperturas del grupo ${a.ncm.slice(0, 9)}x:\n${grupo.map((c) => `${c.ncm === a.ncm ? "→" : " "} ${c.ncm}: ${c.textos.join(" · ") || "sin texto"}`).join("\n")}`;
  const txt = await callClaudeText({ system: SYSTEM_VERIF, user, max_tokens: 400, feature: "ncm-alternativas" });
  const m = String(txt || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j = null; try { j = JSON.parse(m[0]); } catch { return null; }
  if (!j?.valida) return null;
  return { ...a, fuerza: j.fuerza === "firme" && a.fuerza === "firme" ? "firme" : "discutible", motivo: String(j.motivo || a.motivo).slice(0, 400), condicion: j.condicion ? String(j.condicion).slice(0, 300) : a.condicion };
}

async function analizarVuelo(flightId, soloRapido = false) {
  const items = arr(await sb(`/flight_invoice_items?flight_id=eq.${flightId}&select=id,description,quantity,unit_price_declared_usd,hs_code,hs_original&order=sort_order.asc`));
  // Un grupo por (descripción, posición): si el ítem ya tiene una alternativa aplicada, se mira la original.
  const grupos = new Map();
  items.forEach((it) => {
    const hs = conPuntos(it.hs_original || it.hs_code), d = normDesc(it.description);
    if (!hs || d.length < 4) return;
    const k = `${d}|${hs}`;
    if (!grupos.has(k)) grupos.set(k, { k, desc: String(it.description).trim(), d, hs, items: [] });
    grupos.get(k).items.push(it);
  });
  const lista = [...grupos.values()];
  if (!lista.length) return { items: [], pendientes: 0 };
  // Lo que ya está analizado (y lo que se decidió).
  const guardados = new Map();
  const hsUnicos = [...new Set(lista.map((g) => g.hs))];
  arr(await sb(`/ncm_alternativas?hs_code=in.(${hsUnicos.map((h) => `"${h}"`).join(",")})&select=desc_norm,hs_code,resultado,decision`)).forEach((r) => guardados.set(`${r.desc_norm}|${r.hs_code}`, r));
  // Nomenclador de cada partida involucrada.
  const partidas = new Map();
  await Promise.all([...new Set(lista.map((g) => g.hs.slice(0, 4)))].map(async (p4) => partidas.set(p4, await partida(p4))));
  const dato = (ncm) => partidas.get(ncm.slice(0, 4))?.get(ncm) || null;
  const codigosVuelo = [...new Set(lista.map((g) => g.hs))];

  const faltan = lista.filter((g) => !guardados.has(g.k) && dato(g.hs));
  const tanda = soloRapido ? [] : faltan.slice(0, 10);
  await Promise.all(tanda.map(async (g) => {
    const actual = dato(g.hs);
    const carga = actual.die + actual.te;
    // Candidatos: las que pagan menos en la misma partida (primero las de la misma subpartida) + las
    // posiciones más baratas que ya se usan en este mismo vuelo.
    const mismas = [...partidas.get(g.hs.slice(0, 4)).values()].filter((c) => c.ncm !== g.hs && c.die + c.te < carga)
      .sort((a, b) => (b.ncm.slice(0, 7) === g.hs.slice(0, 7)) - (a.ncm.slice(0, 7) === g.hs.slice(0, 7)) || a.ncm.localeCompare(b.ncm)).slice(0, 70);
    const delVuelo = codigosVuelo.map(dato).filter((c) => c && c.ncm !== g.hs && c.die + c.te < carga && !mismas.some((m) => m.ncm === c.ncm));
    const candidatos = [...mismas, ...delVuelo];
    let res = [];
    if (candidatos.length) {
      try {
        const alts = await analizar(g.desc, actual, candidatos, partidas.get(g.hs.slice(0, 4)));
        for (const a of alts) {
          let c = candidatos.find((x) => x.ncm === a.ncm);
          if (!c) { const otra = await partida(a.ncm.slice(0, 4)); c = otra.get(a.ncm) || null; } // la de otra partida: tiene que existir
          if (c && c.die + c.te < carga) res.push({ ...a, die: c.die, te: c.te, texto: c.textos.slice(0, 2).join(" · ") });
        }
      } catch (e) { return; } // si falla la IA no se guarda nada: se reintenta en la próxima llamada
    }
    const fila = { desc_norm: g.d, hs_code: g.hs, resultado: res };
    await sb(`/ncm_alternativas?on_conflict=desc_norm,hs_code`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila) });
    guardados.set(g.k, { ...fila, decision: null });
  }));

  // Sin IA: si otro ítem parecido de este mismo vuelo ya va por una posición que paga menos, se sugiere esa.
  // "Parecido" = mismas dos primeras palabras con sentido (gafas inteligentes, auriculares bluetooth…).
  const tipoDe = (d) => d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, " ").split(" ").filter((w) => w.length >= 4 && !["para", "with", "from", "tipo", "modelo", "nuevo", "nueva", "alta", "calidad"].includes(w)).slice(0, 2).join(" ");
  const propias = (g) => {
    const actual = dato(g.hs), tipo = tipoDe(g.d);
    if (!actual || tipo.split(" ").length < 2) return [];
    const vistos = new Set();
    return lista.filter((o) => o.hs !== g.hs && tipoDe(o.d) === tipo).map((o) => ({ o, c: dato(o.hs) })).filter(({ o, c }) => c && c.die + c.te < actual.die + actual.te && !vistos.has(o.hs) && vistos.add(o.hs))
      .map(({ o, c }) => ({ ncm: o.hs, fuerza: "propia", die: c.die, te: c.te, texto: c.textos.slice(0, 2).join(" · "), motivo: `En este mismo vuelo ya presentás "${o.desc.slice(0, 70)}" por esta posición.`, condicion: null }));
  };

  const out = [];
  lista.forEach((g) => {
    const r = guardados.get(g.k), actual = dato(g.hs);
    if (!actual) return;
    const mias = propias(g);
    if (!r && !mias.length) return;
    g.items.forEach((it) => {
      const valor = Number(it.quantity || 0) * Number(it.unit_price_declared_usd || 0);
      const alternativas = [...mias, ...arr(r?.resultado).filter((a) => !mias.some((m) => m.ncm === a.ncm))].map((a) => ({ ...a, ahorro_usd: Math.round(valor * (actual.die + actual.te - a.die - a.te)) / 100 }));
      const aplicada = it.hs_original ? conPuntos(it.hs_code) : null;
      if (!alternativas.length && !aplicada) return;
      out.push({ item_id: it.id, actual: { ncm: g.hs, die: actual.die, te: actual.te }, alternativas, decision: r?.decision || null, aplicada });
    });
  });
  return { items: out, pendientes: Math.max(0, faltan.length - tanda.length) };
}

async function decidir(itemId, decision, ncm) {
  const it = arr(await sb(`/flight_invoice_items?id=eq.${itemId}&select=id,description,hs_code,hs_original,flight_id&limit=1`))[0];
  if (!it) return json({ error: "Ítem no encontrado" }, 404);
  const original = conPuntos(it.hs_original || it.hs_code);
  const memoria = (dec) => sb(`/ncm_alternativas?desc_norm=eq.${encodeURIComponent(normDesc(it.description))}&hs_code=eq.${original}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ decision: dec, decided_at: new Date().toISOString() }) });
  if (decision === "usar") {
    const nuevo = conPuntos(ncm);
    if (!nuevo) return json({ error: "Posición inválida" }, 400);
    const existe = arr(await sb(`/ncm_database?ncm_code=eq.${nuevo}&select=ncm_code&limit=1`)).length > 0;
    if (!existe) return json({ error: "Esa posición no está en el nomenclador" }, 400);
    await sb(`/flight_invoice_items?id=eq.${itemId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ hs_code: nuevo, hs_original: original }) });
    await memoria(`usar:${nuevo}`);
    return json({ ok: true, hs_code: nuevo, hs_original: original });
  }
  if (decision === "volver") {
    if (!it.hs_original) return json({ ok: true, hs_code: it.hs_code, hs_original: null });
    await sb(`/flight_invoice_items?id=eq.${itemId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ hs_code: it.hs_original, hs_original: null }) });
    await memoria(null);
    return json({ ok: true, hs_code: it.hs_original, hs_original: null });
  }
  await memoria("descartar");
  return json({ ok: true });
}

export async function POST(req) {
  const yo = await usuarioConRol(req, ["admin"]);
  if (!yo) return json({ error: "sin_permiso" }, 401);
  let b = {}; try { b = await req.json(); } catch {}
  if (["usar", "descartar", "volver"].includes(b.action)) {
    if (!UUID.test(String(b.item_id || ""))) return json({ error: "Ítem inválido" }, 400);
    return decidir(b.item_id, b.action, b.ncm);
  }
  // Consulta suelta, sin vuelo y sin guardar nada: qué posiciones más baratas encajan con una mercadería.
  if (b.action === "probar") {
    const hs = conPuntos(b.ncm), desc = String(b.descripcion || "").trim();
    if (!hs || desc.length < 4) return json({ error: "Faltan la descripción o la posición" }, 400);
    const cods = await partida(hs.slice(0, 4));
    const actual = cods.get(hs);
    if (!actual) return json({ error: "Esa posición no está en el nomenclador" }, 400);
    const carga = actual.die + actual.te;
    const candidatos = [...cods.values()].filter((c) => c.ncm !== hs && c.die + c.te < carga)
      .sort((x, y) => (y.ncm.slice(0, 7) === hs.slice(0, 7)) - (x.ncm.slice(0, 7) === hs.slice(0, 7)) || x.ncm.localeCompare(y.ncm)).slice(0, 70);
    if (!candidatos.length) return json({ actual, candidatos: 0, alternativas: [] });
    try {
      const alts = await analizar(desc, actual, candidatos, cods);
      const out = [];
      for (const a of alts) { let c = candidatos.find((x) => x.ncm === a.ncm); if (!c) c = (await partida(a.ncm.slice(0, 4))).get(a.ncm) || null; if (c && c.die + c.te < carga) out.push({ ...a, die: c.die, te: c.te, texto: c.textos.slice(0, 2).join(" · ") }); }
      return json({ actual, candidatos: candidatos.length, alternativas: out });
    } catch (e) { return json({ error: String(e?.message || e).slice(0, 300) }, 502); }
  }
  if (!UUID.test(String(b.flight_id || ""))) return json({ error: "Vuelo inválido" }, 400);
  try { return json(await analizarVuelo(b.flight_id, !!b.rapido)); }
  catch (e) { return json({ error: String(e?.message || e).slice(0, 300) }, 500); }
}
