// lib/studio-argenmaq.js — Content Studio de ARGENMAQ.
// A diferencia del Studio de Argencargo, acá no hay competencia que mirar ni ideas que inventar:
// cada pieza sale de un dato real (una máquina del catálogo con su precio, un pedido que viajó o
// llegó, lo que pidieron en A pedido). Si el dato no está, la pieza no existe.
// Reglas: las historias pueden llevar precio (duran 24 h); las publicaciones y carruseles no (quedan
// y envejecen). Nunca se muestra la fecha de llegada: a nadie le entusiasma esperar.
// Solo servidor (usa la service role).
import { callClaudeText, HAIKU_MODEL } from "./anthropic";
import { igPublish } from "./studio";
import { tgNotify } from "./telegram";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const AM_SITIO = "argenmaq.vercel.app";

export async function sbq(pathq, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${pathq}`, { ...opts, cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: opts.method === "POST" ? "return=representation" : opts.method === "PATCH" ? "return=representation" : "", ...(opts.headers || {}) } });
  const t = await r.text(); let body = null; try { body = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(body?.message || body?.error || `supabase ${r.status}`);
  return body;
}

// Quién llama: la misma regla que el panel (admin/empleado de Argencargo, socio GI o rol ARGENMAQ).
export async function quien(token) {
  if (!token) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!u.ok) return null;
  const { id, email } = await u.json();
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${id}&select=id,role,is_gi_partner,argenmaq_role`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const rows = await p.json().catch(() => []);
  const prof = Array.isArray(rows) ? rows[0] : null;
  if (!prof || !(["admin", "empleado"].includes(prof.role) || prof.is_gi_partner === true || prof.argenmaq_role)) return null;
  return { ...prof, email };
}

// ── Datos ────────────────────────────────────────────────────────────────────
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
export const fmtUSD = (v) => `USD ${Math.round(Number(v || 0)).toLocaleString("es-AR")}`;
const foto = (m) => (Array.isArray(m?.fotos) && m.fotos[0]) || null;
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diaDelAnio = () => Math.floor((Date.now() - 3 * 3600e3) / 864e5);

// Rubros → hashtags de oficio (los que la gente realmente busca).
const HASH = {
  gastronomia: "#gastronomia #cocinaindustrial #equipamientogastronomico #restaurante #bar",
  panaderia: "#panaderia #pasteleria #amasadora #hornopanadero #panaderos",
  heladeria: "#heladeria #heladosoft #helado #heladeros",
  alimentos: "#procesamientodealimentos #industriaalimentaria #envasado",
  packaging: "#packaging #envasado #empaque #emprendedores",
  metalurgica: "#metalurgica #soldadura #tornomecanico #taller #industria",
  carpinteria: "#carpinteria #madera #maquinariaparamadera #carpinteros",
  textil: "#textil #confeccion #bordado #emprendedorestextiles",
  impresion: "#impresion #grafica #sublimacion #imprenta",
  construccion: "#construccion #obra #maquinariaparaconstruccion",
  plastico: "#plastico #reciclaje #inyeccion",
  agro: "#agro #campo #ganaderia #maquinariaagricola",
  lavado: "#lavadero #limpieza #lavanderia",
  automotriz: "#taller #mecanica #automotriz #gomeria",
  energia: "#bombas #energia #generadores",
  estetica: "#estetica #cosmetica #spa",
  otros: "#maquinaria #industria",
};
const hashtags = (cat) => `${HASH[cat] || HASH.otros} #maquinariaindustrial #importacion #argenmaq #llaveenmano`;

export async function fuentes() {
  const hace = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const [maqs, precios, cats, pedidos, busq, piezas] = await Promise.all([
    sbq(`/cat_maquinas_publicas?select=id,numero,nombre,categoria,subcategoria,fotos,video_url,dias_produccion,garantia_meses,medidas,vias,publicado_at&order=publicado_at.desc`),
    sbq(`/cat_maquinas_precios?select=id,escalera,dias_produccion`),
    sbq(`/cat_categorias?select=slug,nombre,padre_slug`),
    sbq(`/cat_pedidos?select=id,numero,estado,items,created_at,historial&order=created_at.desc&limit=60`).catch(() => []),
    sbq(`/cat_busquedas?select=id,descripcion,estado,created_at&created_at=gte.${hace(10)}&order=created_at.desc&limit=30`).catch(() => []),
    sbq(`/am_piezas?select=id,tipo,plantilla,maquina_id,estado,created_at&created_at=gte.${hace(30)}&order=created_at.desc`).catch(() => []),
  ]);
  const precioDe = {}; (precios || []).forEach((p) => { precioDe[p.id] = p; });
  const nombreCat = {}; (cats || []).forEach((c) => { nombreCat[c.slug] = c.nombre; });
  return { maqs: maqs || [], precioDe, nombreCat, pedidos: pedidos || [], busq: busq || [], piezas: piezas || [] };
}

// Lo que se puede decir de una máquina con datos reales: precio final y dos cuotas. Sin fecha de llegada.
export function fichaReal(m, f) {
  const p = f.precioDe[m.id]; const esc = p?.escalera;
  const tr = esc?.maritima?.[0] || esc?.aerea?.[0];
  if (!tr || !foto(m)) return null;
  const med = m.medidas || {};
  return {
    id: m.id, nombre: m.nombre, codigo: `MAQ-${String(m.numero || 0).padStart(5, "0")}`, foto: foto(m), fotos: (m.fotos || []).slice(0, 4), video: m.video_url || null,
    categoria: m.categoria, rubro: f.nombreCat[m.categoria] || "", subrubro: f.nombreCat[m.subcategoria] || "",
    precio: Math.round(Number(tr.unit)), cuota1: Math.round(Number(tr.maquina)), cuota2: Math.round(Number(tr.argencargo)),
    via: tr.via, garantia: num(m.garantia_meses), produccion: num(p?.dias_produccion ?? m.dias_produccion),
    medidas: [med.largo_cm && med.ancho_cm && med.alto_cm ? `${med.largo_cm} × ${med.ancho_cm} × ${med.alto_cm} cm` : null, med.peso_kg ? `${med.peso_kg} kg` : null].filter(Boolean),
    publicado_at: m.publicado_at || null,
    url: `https://${AM_SITIO}/m/${m.id}`,
  };
}

// Datos de marca para las historias "¿Sabías que…?": rotan por día, nunca prometen plazos.
const SABIAS = [
  { titulo: "Pedidos a medida.", bajada: "¿Otra capacidad, otro tamaño? Se lo pedimos a la fábrica y te pasamos el precio final." },
  { titulo: "El precio que ves es el final.", bajada: "Flete, seguro y aduana ya están adentro. Nada de sorpresas al llegar." },
  { titulo: "Pagás en dos cuotas.", bajada: "Una parte al encargar, el resto cuando la máquina está en tu negocio." },
  { titulo: "Cero trámites de aduana.", bajada: "Importamos a nombre nuestro. Vos no firmás un solo papel." },
  { titulo: "Garantía de fábrica.", bajada: "Cada máquina del catálogo viene con la garantía del fabricante." },
  { titulo: "Somos parte de Argencargo.", bajada: "Años trayendo cargas de China. Ahora también tu máquina." },
  { titulo: "¿No está en el catálogo?", bajada: "La buscamos en fábrica y te pasamos el precio final puesto en tu negocio." },
  { titulo: "También traemos repuestos.", bajada: "Una foto de la pieza y de la placa de la máquina alcanza para arrancar." },
];

// ── Limpieza de "nos pidieron" ───────────────────────────────────────────────
// En A pedido se pega de todo (chats de WhatsApp, links, "quiere máquinas"). Claude lo convierte en
// nombres cortos de máquinas y descarta lo que no es un pedido concreto. Si falla, filtro a mano.
const basura = (t) => /https?:\/\/|^\[?\d{1,2}\/\d{1,2}\/\d{2,4}|~|^(tiene|quiere|busca|necesita)\s+(una?\s+)?maqui?/i.test(t) || t.replace(/[^a-záéíóúñ ]/gi, "").trim().split(/\s+/).length < 2;
async function limpiarPedidos(busq) {
  const crudos = busq.map((b) => String(b.descripcion || "").replace(/\[Repuesto\][^\n]*\n*/i, "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 3);
  if (!crudos.length) return [];
  try {
    const txt = await callClaudeText({
      model: HAIKU_MODEL, feature: "argenmaq-pedidos", max_tokens: 800,
      system: "Sos el editor de redes de ARGENMAQ, una importadora de maquinaria industrial de China en Argentina. Te paso textos crudos que dejaron clientes pidiendo máquinas (a veces copiados de WhatsApp, con links o sin sentido). Devolvé solo los pedidos concretos de una máquina, como nombre corto y genérico de máquina en español rioplatense, en minúscula salvo siglas, máximo 40 caracteres (ej: 'cortadora de salmón ahumado', 'máquina expendedora', 'horno rotativo'). Descartá links, exportaciones de chat, mensajes vagos ('quiere máquinas') y datos personales. Sin duplicados.",
      user: crudos.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join("\n"),
      json_schema: { type: "object", properties: { items: { type: "array", items: { type: "string" } } }, required: ["items"], additionalProperties: false },
    });
    const j = JSON.parse(txt); const items = (j.items || []).map((s) => String(s).trim()).filter((s) => s.length > 3 && s.length <= 48);
    if (items.length) return [...new Set(items)];
  } catch (e) { console.error("[studio-argenmaq] limpiarPedidos", e.message); }
  return [...new Set(crudos.filter((t) => !basura(t)).map((t) => t.slice(0, 44)))];
}

// ── Textos con personalidad ──────────────────────────────────────────────────
// Un solo llamado para todas las piezas del día. Los hechos los pone el código; Claude solo redacta.
async function redactar(piezas) {
  if (!piezas.length) return;
  try {
    const txt = await callClaudeText({
      model: HAIKU_MODEL, feature: "argenmaq-captions", max_tokens: 3000,
      system: `Escribís los textos de Instagram de ARGENMAQ: importamos maquinaria industrial de China y la entregamos en el negocio del cliente en Argentina, llave en mano (flete, seguro y aduana incluidos), con precio final en dólares y pago en dos cuotas (una al encargar, otra al recibir). Somos la división de maquinaria de Argencargo.
Voz: rioplatense con voseo, directa, con un toque de humor seco de taller; cercana a dueños de panaderías, restaurantes, talleres y pymes. Frases cortas. Cero verso corporativo, cero "¡Increíble!", nada de emojis (a lo sumo uno al final). Cada texto distinto en estructura: a veces arranca con una pregunta, a veces con un dato, a veces con una escena del negocio del cliente.
Reglas duras: usá SOLO los datos que te doy, no inventes capacidades ni medidas. En 'historia' podés mencionar el precio si te lo doy. En 'post' y 'carrusel' NUNCA pongas precio ni montos: invitá a consultar. Nunca menciones plazos, días ni fechas de llegada. Terminá las historias con "Link en la historia" y los posts con "Link en la bio". Largo: historias 2 a 3 líneas; posts 3 a 5 líneas. No pongas hashtags (van aparte).`,
      user: piezas.map((p, i) => `${i + 1}. [${p.tipo} · ${p.plantilla}] ${p.hechos}`).join("\n\n"),
      json_schema: { type: "object", properties: { textos: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, caption: { type: "string" } }, required: ["n", "caption"], additionalProperties: false } } }, required: ["textos"], additionalProperties: false },
    });
    const j = JSON.parse(txt);
    (j.textos || []).forEach((t) => { const p = piezas[t.n - 1]; if (p && t.caption && t.caption.trim().length > 20) p.caption = t.caption.trim(); });
  } catch (e) { console.error("[studio-argenmaq] redactar", e.message); }
  piezas.forEach((p) => { delete p.hechos; });
}

// ── Runner: arma la cantidad pedida ──────────────────────────────────────────
// candidatos({ historias: 3, publicaciones: 2, excluir: [ids de máquinas ya propuestas] })
// Arma un pozo grande de piezas posibles y elige alternando plantillas, para que nunca salgan
// dos iguales seguidas. Solo redacta los textos de las que va a devolver.
const ORDEN_H = ["maquina_dia", "cual_elegis", "nueva", "cuanto_sale", "sabias", "en_viaje", "llego", "pedidos"];
const ORDEN_P = ["ficha", "carrusel_ficha", "rubro", "carrusel_rubro"];
export async function candidatos({ historias = 0, publicaciones = 0, excluir = [] } = {}) {
  const pozo = await armarCandidatos(new Set(excluir));
  const elegir = (lista, orden, n) => {
    const porPl = {}; lista.forEach((p) => (porPl[p.plantilla] = porPl[p.plantilla] || []).push(p));
    const out = [];
    while (out.length < n && Object.values(porPl).some((l) => l.length)) for (const k of orden) { const l = porPl[k]; if (l?.length && out.length < n) out.push(l.shift()); }
    return out;
  };
  const H = elegir(pozo.historias, ORDEN_H, historias), P = elegir(pozo.publicaciones, ORDEN_P, publicaciones);
  await redactar([...H, ...P]);
  return { historias: H, publicaciones: P };
}

async function armarCandidatos(excluir) {
  const f = await fuentes();
  const usadas = new Map(); f.piezas.forEach((p) => { if (p.maquina_id && p.estado !== "descartada") usadas.set(p.maquina_id, Math.max(usadas.get(p.maquina_id) || 0, new Date(p.created_at).getTime())); });
  const frescura = (m) => usadas.get(m.id) || 0; // 0 = nunca usada
  const fichas = f.maqs.map((m) => fichaReal(m, f)).filter(Boolean);
  // Nunca usadas primero, después las usadas hace más tiempo. Entre las nunca usadas, barajo: cada corrida propone máquinas distintas.
  const orden = [...fichas].filter((m) => !excluir.has(m.id)).sort((a, b) => frescura(a) - frescura(b) || String(b.publicado_at || "").localeCompare(String(a.publicado_at || "")));
  const libres = orden.filter((m) => !frescura(m)); for (let i = libres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [libres[i], libres[j]] = [libres[j], libres[i]]; } orden.splice(0, libres.length, ...libres);
  const tomadas = new Set(); const tomar = (n, filtro = () => true) => { const r = orden.filter((m) => !tomadas.has(m.id) && filtro(m)).slice(0, n); r.forEach((m) => tomadas.add(m.id)); return r; };
  const especs = (m) => [m.rubro && `rubro: ${m.rubro}`, m.subrubro && `tipo: ${m.subrubro}`, m.medidas[0] && `medidas: ${m.medidas[0]}`, m.medidas[1] && `peso: ${m.medidas[1]}`, m.garantia && `garantía de fábrica: ${m.garantia} meses`].filter(Boolean).join(", ");
  const H = [], P = [];
  const pieza = (lista, tipo, plantilla, titulo, maquina, slides, hechos, caption, tags) => lista.push({ tipo, plantilla, titulo, maquina_id: maquina?.id || null, link: maquina?.url || null, datos: { slides }, hechos, caption, hashtags: tags, imagenes: [] });

  // ── Historias (con precio, sin fecha) ──
  tomar(4).forEach((m) => pieza(H, "historia", "maquina_dia", `Máquina del día · ${m.nombre}`, m, [{ p: "maquina_dia", ...m }],
    `Máquina del día: ${m.nombre}. Precio final puesto en el negocio ${fmtUSD(m.precio)}; cuota 1 ${fmtUSD(m.cuota1)}, cuota 2 al recibir ${fmtUSD(m.cuota2)}. ${especs(m)}.`,
    `${m.nombre}. Precio final puesto en tu negocio: ${fmtUSD(m.precio)}, en dos cuotas. Link en la historia.`, hashtags(m.categoria)));

  const hace30 = Date.now() - 30 * 864e5;
  tomar(2, (m) => m.publicado_at && new Date(m.publicado_at).getTime() > hace30).forEach((m) => pieza(H, "historia", "nueva", `Nueva en el catálogo · ${m.nombre}`, m, [{ p: "nueva", ...m }],
    `Máquina recién sumada al catálogo: ${m.nombre}. Precio final ${fmtUSD(m.precio)} en dos cuotas. ${especs(m)}.`,
    `Nueva en el catálogo: ${m.nombre}. ${fmtUSD(m.precio)} puesta en tu negocio, en dos cuotas. Link en la historia.`, hashtags(m.categoria)));

  const porRubro = {}; orden.forEach((m) => { if (!tomadas.has(m.id)) (porRubro[m.categoria] = porRubro[m.categoria] || []).push(m); });
  Object.entries(porRubro).filter(([k, v]) => k !== "otros" && v.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 2).forEach(([k, v]) => {
    const [a, b] = v.slice(0, 2); tomadas.add(a.id); tomadas.add(b.id);
    pieza(H, "historia", "cual_elegis", `¿Cuál elegís? · ${f.nombreCat[k] || k}`, a, [{ p: "cual_elegis", rubro: f.nombreCat[k] || k, a: { nombre: a.nombre, foto: a.foto, precio: a.precio }, b: { nombre: b.nombre, foto: b.foto, precio: b.precio } }],
      `Dos opciones para ${f.nombreCat[k] || k}: A) ${a.nombre}, ${fmtUSD(a.precio)}. B) ${b.nombre}, ${fmtUSD(b.precio)}. Precios finales puestos en el negocio. Pedile a la gente que elija.`,
      `Para ${String(f.nombreCat[k] || k).toLowerCase()}, ¿cuál elegís? A: ${a.nombre}, ${fmtUSD(a.precio)}. B: ${b.nombre}, ${fmtUSD(b.precio)}. Las dos puestas en tu negocio. Link en la historia.`, hashtags(k));
  });

  tomar(2).forEach((m) => pieza(H, "historia", "cuanto_sale", `¿Cuánto sale? · ${m.nombre}`, m, [{ p: "cuanto_sale", ...m }, { p: "maquina_dia", ...m }],
    `Juego en dos historias: primero se pregunta cuánto sale ${m.nombre} puesta en el negocio, la segunda revela ${fmtUSD(m.precio)} en dos cuotas. ${especs(m)}.`,
    `¿Cuánto sale una ${m.nombre.toLowerCase()} puesta en tu negocio? ${fmtUSD(m.precio)}, en dos cuotas. Link en la historia.`, hashtags(m.categoria)));

  const cuando = (p, estado) => { const h = Array.isArray(p.historial) ? p.historial.find((x) => x.estado === estado) : null; return h?.at ? new Date(h.at) : new Date(p.created_at); };
  const reciente = (d, dias) => Date.now() - d.getTime() < dias * 864e5;
  f.pedidos.filter((p) => p.estado === "en_importacion" && reciente(cuando(p, "en_importacion"), 12)).slice(0, 1).forEach((p) => {
    const it = Array.isArray(p.items) ? p.items[0] : null; if (!it?.nombre) return;
    const m = fichas.find((x) => x.id === it.id) || null;
    pieza(H, "historia", "en_viaje", `Salió de China · ${it.nombre}`, m, [{ p: "en_viaje", nombre: it.nombre, qty: it.qty || 1, foto: m?.foto || it.foto || null }],
      `Un pedido real salió de China rumbo a Argentina: ${it.nombre}${it.qty > 1 ? ` × ${it.qty}` : ""}. Nosotros nos ocupamos de flete, seguro y aduana. Sin nombrar al cliente.`,
      `Salió de China: ${String(it.nombre).toLowerCase()}. Flete, seguro y aduana corren por nuestra cuenta; el cliente solo la recibe. Link en la historia.`, hashtags(m?.categoria || "otros"));
  });
  f.pedidos.filter((p) => p.estado === "entregado" && reciente(cuando(p, "entregado"), 10)).slice(0, 1).forEach((p) => {
    const it = Array.isArray(p.items) ? p.items[0] : null; if (!it?.nombre) return;
    const m = fichas.find((x) => x.id === it.id) || null;
    pieza(H, "historia", "llego", `Llegó · ${it.nombre}`, m, [{ p: "llego", nombre: it.nombre, qty: it.qty || 1, foto: m?.foto || it.foto || null }],
      `Un pedido real ya fue entregado en el negocio del cliente: ${it.nombre}${it.qty > 1 ? ` × ${it.qty}` : ""}. Llave en mano. Sin nombrar al cliente.`,
      `Llegó y ya está trabajando: ${String(it.nombre).toLowerCase()}. De la fábrica en China al negocio del cliente. Link en la historia.`, hashtags(m?.categoria || "otros"));
  });

  const pedidosLimpios = await limpiarPedidos(f.busq);
  if (pedidosLimpios.length >= 3) pieza(H, "historia", "pedidos", `Nos pidieron (${pedidosLimpios.length})`, null, [{ p: "pedidos", items: pedidosLimpios.slice(0, 6), total: pedidosLimpios.length }],
    `Estos días nos pidieron máquinas que no están en el catálogo: ${pedidosLimpios.slice(0, 6).join(", ")}. Las buscamos en fábrica y pasamos precio final puesto en el negocio.`,
    `Esto nos pidieron estos días: ${pedidosLimpios.slice(0, 3).join(", ")} y más. Si no está en el catálogo, la buscamos. Link en la historia.`, "#maquinariaindustrial #importacion #argenmaq #llaveenmano #emprendedores #pymes");

  [0, 1].forEach((k) => { const s = SABIAS[(diaDelAnio() + k * 3) % SABIAS.length]; pieza(H, "historia", "sabias", `Dato · ${s.titulo}`, null, [{ p: "sabias", titulo: s.titulo, bajada: s.bajada }],
    `Historia de marca con un dato de cómo trabajamos: "${s.titulo} ${s.bajada}".`, `${s.titulo} ${s.bajada} Link en la historia.`, "#maquinariaindustrial #importacion #argenmaq #llaveenmano"); });

  // ── Publicaciones y carruseles (sin precio) ──
  const tomadasH = new Set(tomadas); tomadas.clear(); // los posts pueden repetir máquina con las historias: distinto formato, distinta vida
  const noHist = (m) => !tomadasH.has(m.id);
  tomar(3, noHist).forEach((m) => pieza(P, "post", "ficha", `Ficha · ${m.nombre}`, m, [{ p: "ficha", ...m }],
    `Publicación de ficha: ${m.nombre}. ${especs(m)}. Importada llave en mano, puesta en el negocio, en dos cuotas. Sin precio.`,
    `${m.nombre}. Importada llave en mano: flete, aduana y entrega en tu negocio incluidos. Consultá el precio final. Link en la bio.`, hashtags(m.categoria)));
  tomar(2, noHist).forEach((m) => pieza(P, "carrusel", "carrusel_ficha", `Carrusel · ${m.nombre}`, m, [{ p: "portada", ...m }, { p: "specs", ...m }, { p: "incluye", ...m }],
    `Carrusel de 3 placas: foto de ${m.nombre}; especificaciones (${especs(m)}); qué incluye el precio final (flete, seguro, aduana, entrega en el negocio, dos cuotas). Sin precio.`,
    `${m.nombre}, en tres placas: la máquina, los datos y qué incluye traerla. Consultá el precio final puesto en tu negocio. Link en la bio.`, hashtags(m.categoria)));

  const grupos = {}; fichas.forEach((m) => { (grupos[m.categoria] = grupos[m.categoria] || []).push(m); });
  const rubros = Object.entries(grupos).filter(([k, v]) => k !== "otros" && v.length >= 3).sort((a, b) => b[1].length - a[1].length);
  rubros.sort(() => Math.random() - 0.5);
  rubros.slice(0, 2).forEach((r1) => {
    const tres = r1[1].sort((a, b) => frescura(a) - frescura(b)).slice(0, 3); const nom = f.nombreCat[r1[0]] || r1[0];
    pieza(P, "post", "rubro", `3 máquinas para ${nom}`, null, [{ p: "rubro", rubro: nom, maquinas: tres.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.foto })) }],
      `Publicación "3 máquinas para ${nom}": ${tres.map((m) => m.nombre).join("; ")}. Todas llave en mano, en dos cuotas. Sin precio.`,
      `Tres máquinas para ${nom.toLowerCase()}, importadas llave en mano:\n${tres.map((m, i) => `${i + 1}. ${m.nombre}`).join("\n")}\nConsultá por la que necesitás. Link en la bio.`, hashtags(r1[0]));
  });
  rubros.slice(0, 2).reverse().forEach(([k, v]) => {
    const cinco = v.sort((a, b) => frescura(a) - frescura(b)).slice(0, 5); const nom = f.nombreCat[k] || k;
    pieza(P, "carrusel", "carrusel_rubro", `Carrusel · ${nom} (${cinco.length})`, null, [{ p: "rubro_portada", rubro: nom, n: cinco.length }, ...cinco.map((m, i) => ({ p: "rubro_item", i: i + 1, n: cinco.length, nombre: m.nombre, foto: m.foto, sub: m.subrubro || nom }))],
      `Carrusel para ${nom}: portada y una placa por máquina: ${cinco.map((m) => m.nombre).join("; ")}. Llave en mano, en dos cuotas. Sin precio.`,
      `${cinco.length} máquinas para ${nom.toLowerCase()}, una por placa. Deslizá y consultá por la que te sirve. Link en la bio.`, hashtags(k));
  });

  return { historias: H, publicaciones: P };
}

// ── Programación y publicación ───────────────────────────────────────────────
const kindDe = (p) => p.tipo === "historia" ? "story" : p.tipo === "carrusel" ? "carousel" : "feed";
export async function publicarPieza(p, cfg) {
  const igId = await igPublish({ kind: kindDe(p), images: p.imagenes, caption: p.caption, hashtags: p.hashtags }, cfg);
  const [act] = await sbq(`/am_piezas?id=eq.${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify({ estado: "publicada", ig_id: String(igId), publicada_at: new Date().toISOString(), error: null }) });
  avisar(act || p).catch(() => {});
  return act;
}
async function avisar(p) {
  const texto = p.tipo === "historia"
    ? `📣 <b>ARGENMAQ · historia publicada</b>\n${p.titulo}${p.link ? `\n\nEl sticker de link no se puede poner por API: si querés el link tocable, subila también desde el celular con este link:\n${p.link}` : ""}`
    : `📣 <b>ARGENMAQ · ${p.tipo === "carrusel" ? "carrusel" : "publicación"} en Instagram</b>\n${p.titulo}`;
  return tgNotify(texto, { photos: (p.imagenes || []).slice(0, 4) });
}
// Manda la pieza al celular (Telegram) con el link, para subirla a mano con el sticker.
export async function mandarAlCelular(p) {
  return tgNotify(`📲 <b>ARGENMAQ · para subir a mano</b>\n${p.titulo}\n\n${p.link ? `Link para el sticker:\n${p.link}\n\n` : ""}Texto:\n${(p.caption || "").slice(0, 600)}`, { photos: (p.imagenes || []).slice(0, 4) });
}
// El token de Instagram dura 60 días. Meta no da tokens eternos para este tipo de conexión, pero se puede
// renovar cada vez: acá se renueva cuando tiene más de 7 días, desde el cron (cada minuto), publique o no.
// Mientras el servidor esté vivo, la conexión no vence nunca.
export async function igRenovar(cfg) {
  if (cfg?.mode !== "ig_login" || !cfg.access_token) return cfg;
  const edad = Date.now() - new Date(cfg.refreshed_at || cfg.connected_at || 0).getTime();
  if (edad < 7 * 86400000) return cfg;
  try {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.access_token)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) { const nc = { ...cfg, access_token: j.access_token, refreshed_at: new Date().toISOString() }; await igGuardar(nc); return nc; }
    console.error("[studio-argenmaq] renovar token IG", JSON.stringify(j).slice(0, 200));
    if (edad > 55 * 86400000) tgNotify(`⚠️ <b>ARGENMAQ · el token de Instagram está por vencer</b> y no se pudo renovar: ${String(j?.error?.message || "").slice(0, 160)}. Volvé a conectarlo desde el panel.`).catch(() => {});
  } catch (e) { console.error("[studio-argenmaq] renovar", e.message); }
  return cfg;
}
// El vigilante: publica lo programado cuya hora ya pasó. Lo llama el cron de studio-publisher.
export async function publicarProgramadas() {
  let cfg = await igCfg();
  if (!cfg?.ig_user_id || !cfg?.access_token) return { skipped: "ARGENMAQ: Instagram sin conectar" };
  cfg = await igRenovar(cfg);
  const due = await sbq(`/am_piezas?estado=eq.programada&programada_at=lte.${new Date().toISOString()}&select=*&order=programada_at.asc&limit=3`).catch(() => []);
  const out = [];
  for (const p of due) {
    try { await publicarPieza(p, cfg); out.push({ id: p.id, ok: true }); }
    catch (e) {
      await sbq(`/am_piezas?id=eq.${encodeURIComponent(p.id)}`, { method: "PATCH", body: JSON.stringify({ estado: "error", error: String(e.message).slice(0, 300) }) }).catch(() => {});
      tgNotify(`⚠️ <b>ARGENMAQ · no se pudo publicar</b>\n${p.titulo}\n${String(e.message).slice(0, 200)}`).catch(() => {});
      out.push({ id: p.id, error: e.message });
    }
  }
  return { argenmaq: out };
}

// ── Instagram de ARGENMAQ (cuenta propia, separada de la de Argencargo) ──────
export async function igCfg() {
  const r = await sbq(`/cs_settings?key=eq.instagram_argenmaq&select=value`).catch(() => []);
  return Array.isArray(r) && r[0] ? r[0].value || {} : {};
}
export async function igGuardar(cfg) {
  await sbq(`/cs_settings?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "instagram_argenmaq", value: cfg, updated_at: new Date().toISOString() }) });
}

// ── Storage: las imágenes van al bucket público `catalogo`, carpeta studio/ ──
export async function subirImagen(nombre, buffer) {
  const up = await fetch(`${SB_URL}/storage/v1/object/catalogo/studio/${nombre}`, { method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": "image/png", "x-upsert": "true" }, body: buffer });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return `${SB_URL}/storage/v1/object/public/catalogo/studio/${nombre}`;
}
