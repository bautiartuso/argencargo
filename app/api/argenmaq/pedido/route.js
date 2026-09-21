// POST /api/argenmaq/pedido — el cliente confirma su carrito desde la web y se crea la operación
// en ARGENMAQ (cat_pedidos, estado "nuevo"). Los precios se recalculan acá con el service role a
// partir de la ficha (EXW, canales) para que el cliente no pueda mandar sus propios números.
import { totalesPedido, leerAjustes } from "../../../../lib/catalogo-precio";
export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const svc = async (path, init = {}) => { const r = await fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } }); const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.message || `Supabase ${r.status}`); return d; };
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function POST(req) {
  try {
    if (!SB_SERVICE) return Response.json({ error: "server no configurado" }, { status: 500 });
    const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Tenés que ingresar" }, { status: 401 });
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!u.ok) return Response.json({ error: "Sesión vencida, ingresá de nuevo" }, { status: 401 });
    const user = await u.json();
    const cl = await svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id,first_name,last_name,company_name,email,whatsapp&limit=1`);
    const cliente = Array.isArray(cl) ? cl[0] : null;
    if (!cliente) return Response.json({ error: "Completá tus datos antes de pedir" }, { status: 400 });

    const b = await req.json();
    const items = Array.isArray(b.items) ? b.items.filter((i) => i && i.id) : [];
    if (!items.length) return Response.json({ error: "El carrito está vacío" }, { status: 400 });
    const ids = items.map((i) => `"${String(i.id).replace(/[^0-9a-f-]/gi, "")}"`).join(",");
    const prods = await svc(`/rest/v1/cat_productos?id=in.(${ids})&estado=eq.publicado&select=id,numero,nombre,exw_usd,markup_pct,dias_produccion,canales,proveedor_id`);
    const aj = leerAjustes(await svc(`/rest/v1/cat_ajustes?select=clave,valor`));
    const lineas = [], vias = new Set();
    let importacion = 0;
    for (const it of items) {
      const p = (prods || []).find((x) => x.id === it.id);
      if (!p) return Response.json({ error: "Una de las máquinas ya no está disponible" }, { status: 400 });
      const qty = Math.max(1, Math.min(50, Math.round(n(it.qty) || 1)));
      const via = String(it.via || "");
      const canal = p.canales?.[via];
      if (!canal?.mostrar) return Response.json({ error: `La vía elegida para ${p.nombre} no está disponible` }, { status: 400 });
      vias.add(via);
      importacion += n(canal.argencargo?.total) * qty;
      const gestion_pct = canal.gestion_pct != null ? n(canal.gestion_pct) : p.markup_pct != null ? n(p.markup_pct) : n(aj.gestion_pct);
      lineas.push({ producto_id: p.id, codigo: `MAQ-${String(p.numero || 0).padStart(5, "0")}`, nombre: p.nombre, qty, exw_unit: n(p.exw_usd), gestion_pct, gestion_usd: canal.gestion_usd != null ? n(canal.gestion_usd) : null, via, dias_produccion: p.dias_produccion || null });
    }
    const tot = totalesPedido(lineas, aj, importacion);
    const nombre = cliente.company_name || `${cliente.first_name || ""} ${cliente.last_name || ""}`.trim() || cliente.email;
    const ins = await svc(`/rest/v1/cat_pedidos`, { method: "POST", body: JSON.stringify({
      estado: "nuevo", client_id: cliente.id, cliente_nombre: nombre, cliente_contacto: [cliente.whatsapp, cliente.email].filter(Boolean).join(" · ") || null,
      items: lineas, prueba_fabrica: false, exw_total: tot.exw_total, financiero: tot.financiero, gestion: tot.gestion, prueba_monto: 0, precio_total: tot.precio_total,
      importacion_usd: Math.round(importacion * 100) / 100, notas: [b.notas ? String(b.notas).slice(0, 500) : null, `Vía: ${[...vias].join(", ")} · pedido desde la web`].filter(Boolean).join("\n"),
      historial: [{ estado: "nuevo", at: new Date().toISOString(), by: cliente.email || "web" }], created_by: user.id,
    }) });
    const row = Array.isArray(ins) ? ins[0] : ins;
    return Response.json({ ok: true, id: row.id, numero: row.numero, codigo: `AM-${String(row.numero || 0).padStart(5, "0")}`, precio_total: row.precio_total, importacion_usd: row.importacion_usd });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
