// lib/studio-argenmaq.js — Content Studio de ARGENMAQ.
// A diferencia del Studio de Argencargo, acá no hay competencia que mirar ni ideas que inventar:
// cada pieza sale de un dato real (una máquina del catálogo con su precio y su fecha de llegada,
// un pedido que viajó o llegó, lo que pidieron en A pedido). Si el dato no está, la pieza no existe.
// Regla: las historias pueden llevar precio (duran 24 h); las publicaciones no (quedan y envejecen).
// Solo servidor (usa la service role).

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
const DIAS_VIA_DEF = { aereo: 10, maritimo_lcl: 60, maritimo_integral: 60 };
const fechaLarga = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const limpiar = (t, max) => String(t || "").replace(/\[Repuesto\][^\n]*\n*/i, "").replace(/\s+/g, " ").trim().slice(0, max);
const foto = (m) => (Array.isArray(m?.fotos) && m.fotos[0]) || null;

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
  const [maqs, precios, cats, ajustes, pedidos, busq, piezas] = await Promise.all([
    sbq(`/cat_maquinas_publicas?select=id,numero,nombre,categoria,subcategoria,fotos,video_url,dias_produccion,garantia_meses,medidas,vias,publicado_at&order=publicado_at.desc`),
    sbq(`/cat_maquinas_precios?select=id,escalera,dias_produccion`),
    sbq(`/cat_categorias?select=slug,nombre,padre_slug`),
    sbq(`/cat_ajustes?select=clave,valor&clave=eq.dias_via`),
    sbq(`/cat_pedidos?select=id,numero,estado,items,eta,created_at,historial&order=created_at.desc&limit=60`).catch(() => []),
    sbq(`/cat_busquedas?select=id,descripcion,created_at&created_at=gte.${hace(7)}&order=created_at.desc&limit=30`).catch(() => []),
    sbq(`/am_piezas?select=id,tipo,plantilla,maquina_id,estado,created_at&created_at=gte.${hace(21)}&order=created_at.desc`).catch(() => []),
  ]);
  const diasVia = ajustes?.[0]?.valor || DIAS_VIA_DEF;
  const precioDe = {}; (precios || []).forEach((p) => { precioDe[p.id] = p; });
  const nombreCat = {}; (cats || []).forEach((c) => { nombreCat[c.slug] = c.nombre; });
  return { maqs: maqs || [], precioDe, nombreCat, diasVia, pedidos: pedidos || [], busq: busq || [], piezas: piezas || [] };
}

// Lo que se puede decir de una máquina con datos reales: precio final, dos cuotas, fecha de llegada.
export function fichaReal(m, f) {
  const p = f.precioDe[m.id]; const esc = p?.escalera;
  const tr = esc?.maritima?.[0] || esc?.aerea?.[0];
  if (!tr || !foto(m)) return null;
  const dias = (num(f.diasVia?.[tr.via]) ?? DIAS_VIA_DEF[tr.via] ?? 60) + (num(p?.dias_produccion ?? m.dias_produccion) || 0);
  const llega = new Date(Date.now() + dias * 864e5);
  const med = m.medidas || {};
  return {
    id: m.id, nombre: m.nombre, codigo: `MAQ-${String(m.numero || 0).padStart(5, "0")}`, foto: foto(m), fotos: (m.fotos || []).slice(0, 4), video: m.video_url || null,
    categoria: m.categoria, rubro: f.nombreCat[m.categoria] || "", subrubro: f.nombreCat[m.subcategoria] || "",
    precio: Math.round(Number(tr.unit)), cuota1: Math.round(Number(tr.maquina)), cuota2: Math.round(Number(tr.argencargo)),
    via: tr.via, dias, llega: fechaLarga(llega), llegaISO: llega.toISOString().slice(0, 10),
    garantia: num(m.garantia_meses), produccion: num(p?.dias_produccion ?? m.dias_produccion),
    medidas: [med.largo_cm && med.ancho_cm && med.alto_cm ? `${med.largo_cm} × ${med.ancho_cm} × ${med.alto_cm} cm` : null, med.peso_kg ? `${med.peso_kg} kg` : null].filter(Boolean),
    url: `https://${AM_SITIO}/m/${m.id}`,
  };
}

// ── Candidatas de hoy ─────────────────────────────────────────────────────────
// Devuelve piezas listas para aprobar. Cada una trae `render` (lo que dibuja la imagen) y el texto.
export async function candidatos() {
  const f = await fuentes();
  const usadas = new Map(); f.piezas.forEach((p) => { if (p.maquina_id && p.estado !== "descartada") usadas.set(p.maquina_id, Math.max(usadas.get(p.maquina_id) || 0, new Date(p.created_at).getTime())); });
  const frescura = (m) => usadas.get(m.id) || 0; // 0 = nunca usada
  const fichas = f.maqs.map((m) => fichaReal(m, f)).filter(Boolean);
  // Orden: nunca usadas primero (las más nuevas del catálogo adelante), después las usadas hace más tiempo.
  const orden = [...fichas].sort((a, b) => frescura(a) - frescura(b) || String(f.maqs.find((m) => m.id === b.id)?.publicado_at || "").localeCompare(String(f.maqs.find((m) => m.id === a.id)?.publicado_at || "")));
  const out = [];
  const pieza = (tipo, plantilla, titulo, maquina, render, caption, tags) => ({ tipo, plantilla, titulo, maquina_id: maquina?.id || null, datos: render, caption, hashtags: tags, imagenes: [] });

  // 1) Máquina del día (historia con precio) — 3 opciones
  orden.slice(0, 3).forEach((m) => out.push(pieza("historia", "maquina_dia", `Máquina del día · ${m.nombre}`, m,
    { slides: [{ p: "maquina_dia", ...m }] },
    `${m.nombre}.\nPrecio final puesto en tu negocio: ${fmtUSD(m.precio)}. Pagás ${fmtUSD(m.cuota1)} ahora y ${fmtUSD(m.cuota2)} al recibirla. Llega aprox. el ${m.llega}.\nLink en la historia.`,
    hashtags(m.categoria))));

  // 2) ¿Cuánto sale? (dos historias: tapado → revelado) — 2 opciones, máquinas distintas a las del día
  orden.slice(3, 5).forEach((m) => out.push(pieza("historia", "cuanto_sale", `¿Cuánto sale? · ${m.nombre}`, m,
    { slides: [{ p: "cuanto_sale", ...m }, { p: "maquina_dia", ...m }] },
    `¿Cuánto sale una ${m.nombre.toLowerCase()} puesta en tu negocio, con flete, aduana y entrega incluidos? ${fmtUSD(m.precio)}, en dos cuotas. Llega aprox. el ${m.llega}.`,
    hashtags(m.categoria))));

  // 3) Pedidos reales que viajaron o llegaron (sin datos del cliente)
  const cuando = (p, estado) => { const h = Array.isArray(p.historial) ? p.historial.find((x) => x.estado === estado) : null; return h?.at ? new Date(h.at) : new Date(p.created_at); };
  const reciente = (d, dias) => Date.now() - d.getTime() < dias * 864e5;
  f.pedidos.filter((p) => p.estado === "en_importacion" && reciente(cuando(p, "en_importacion"), 12)).slice(0, 2).forEach((p) => {
    const it = Array.isArray(p.items) ? p.items[0] : null; if (!it?.nombre) return;
    const m = fichas.find((x) => x.id === it.id) || null;
    const eta = p.eta ? fechaLarga(new Date(p.eta)) : (m ? m.llega : null);
    out.push(pieza("historia", "en_viaje", `Salió de China · ${it.nombre}`, m,
      { slides: [{ p: "en_viaje", nombre: it.nombre, qty: it.qty || 1, foto: m?.foto || it.foto || null, eta }] },
      `Una ${String(it.nombre).toLowerCase()} salió de China rumbo a Argentina${eta ? `. Llega aprox. el ${eta}` : ""}. Así viajan las máquinas de ARGENMAQ: nosotros nos ocupamos del flete, el seguro y la aduana, y vos la recibís en tu negocio.`,
      hashtags(m?.categoria || "otros")));
  });
  f.pedidos.filter((p) => p.estado === "entregado" && reciente(cuando(p, "entregado"), 10)).slice(0, 2).forEach((p) => {
    const it = Array.isArray(p.items) ? p.items[0] : null; if (!it?.nombre) return;
    const m = fichas.find((x) => x.id === it.id) || null;
    out.push(pieza("historia", "llego", `Llegó · ${it.nombre}`, m,
      { slides: [{ p: "llego", nombre: it.nombre, qty: it.qty || 1, foto: m?.foto || it.foto || null }] },
      `Llegó y ya está trabajando: ${String(it.nombre).toLowerCase()}. De la fábrica en China al negocio del cliente, llave en mano. ¿Cuál es la máquina que te falta a vos?`,
      hashtags(m?.categoria || "otros")));
  });

  // 4) Lo que nos pidieron esta semana (A pedido, anonimizado)
  const pedidosSemana = f.busq.map((b) => limpiar(b.descripcion, 48)).filter((t) => t.length > 3);
  if (pedidosSemana.length >= 3) out.push(pieza("historia", "pedidos", `Nos pidieron esta semana (${pedidosSemana.length})`, null,
    { slides: [{ p: "pedidos", items: pedidosSemana.slice(0, 6), total: pedidosSemana.length }] },
    `Esta semana nos pidieron ${pedidosSemana.length} máquinas que no están en el catálogo. Las buscamos en fábrica y pasamos el precio final puesto en Argentina. ¿Qué máquina te falta a vos? Escribinos.`,
    "#maquinariaindustrial #importacion #argenmaq #llaveenmano #emprendedores #pymes"));

  // 5) Publicaciones: ficha de máquina (sin precio) — 2 opciones
  orden.slice(0, 2).forEach((m) => out.push(pieza("post", "ficha", `Publicación · ${m.nombre}`, m,
    { slides: [{ p: "ficha", ...m }] },
    `${m.nombre}.\n${[m.rubro && `Para ${m.rubro.toLowerCase()}`, m.garantia && `Garantía de fábrica de ${m.garantia} meses`, m.produccion && `Producción en ${m.produccion} días`, "Importada llave en mano: flete, aduana y entrega en tu negocio incluidos", "Se importa a 220 V, lista para trabajar"].filter(Boolean).join(". ")}.\n\nConsultá el precio final puesto en tu negocio, en dos cuotas. Link en la bio.`,
    hashtags(m.categoria))));

  // 6) Publicación por rubro: "3 máquinas para tu {rubro}" (sin precio)
  const porRubro = {}; fichas.forEach((m) => { (porRubro[m.categoria] = porRubro[m.categoria] || []).push(m); });
  Object.entries(porRubro).filter(([k, v]) => k !== "otros" && v.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 2).forEach(([k, v]) => {
    const tres = v.sort((a, b) => frescura(a) - frescura(b)).slice(0, 3);
    out.push(pieza("post", "rubro", `3 máquinas para ${f.nombreCat[k] || k}`, null,
      { slides: [{ p: "rubro", rubro: f.nombreCat[k] || k, maquinas: tres.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.foto })) }] },
      `Tres máquinas para ${String(f.nombreCat[k] || k).toLowerCase()}, importadas de China llave en mano:\n${tres.map((m, i) => `${i + 1}. ${m.nombre}`).join("\n")}\n\nTodas con precio final puesto en tu negocio y en dos cuotas. Consultá por la que necesitás. Link en la bio.`,
      hashtags(k)));
  });
  return out;
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
