// POST /api/portal/guardar-mercaderia
// Body: { op_id, items:[{description, quantity, unit_price_usd, ncm_code, import_duty_rate, statistics_rate, iva_rate, package_ids, antidumping_note}], has_battery, client_id? }
// `confirm: true` = el cliente terminó: se marca docs_confirmed_at y desde ahí no puede editar más
// (Bautista lo destraba desde el admin). Los guardados intermedios son borradores.
//
// El cliente carga la mercadería de su importación (la misma tabla que la calculadora). Va con
// service role porque además de los ítems hay que escribir la descripción y las baterías en
// `operations`, y el cliente no puede actualizar la op por RLS una vez que está en preparación.
// Solo mientras la op está pre-vuelo: después la mercadería queda congelada.
//
// Además, con cada guardado se guarda la COTIZACIÓN de la importación en `quotes` (15/09/2026):
// el estimado que el cliente ve después de cargar la mercadería es una cotización como las de
// la calculadora, y hasta hoy no quedaba registro. Una fila por op, que se actualiza sola.
import { calcOpBudget } from "../../../../lib/calc";
import { armarCotizacionDeImportacion } from "../../../../lib/cotizacion-importacion";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data, status: r.status };
}
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const arr = (r) => (Array.isArray(r?.data) ? r.data : null);

async function avisarAdmins(title, body, link) {
  const adm = await svc(`/rest/v1/profiles?role=eq.admin&select=id`);
  for (const a of (arr(adm) || [])) {
    await svc(`/rest/v1/notifications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: a.id, portal: "admin", title, body, link }) });
  }
}

// Calcula el estimado con la misma cuenta que ve el cliente (calcOpBudget con tarifas, config
// y overrides del cliente) y lo deja en `quotes`. Lanza si algo falla: el que llama decide
// qué hacer, pero nunca se pierde en silencio.
async function guardarCotizacion({ op, clientId, items }) {
  const [pk, tf, cf, ov, cl] = await Promise.all([
    svc(`/rest/v1/operation_packages?operation_id=eq.${op.id}&select=id,quantity,length_cm,width_cm,height_cm,gross_weight_kg,national_tracking&order=package_number.asc`),
    svc(`/rest/v1/tariffs?select=*`),
    svc(`/rest/v1/calc_config?select=key,value`),
    svc(`/rest/v1/client_tariff_overrides?client_id=eq.${clientId}&select=tariff_id,custom_rate`),
    svc(`/rest/v1/clients?id=eq.${clientId}&select=id,first_name,last_name,client_code,tax_condition&limit=1`),
  ]);
  const pkgs = arr(pk), tariffs = arr(tf), cfgRows = arr(cf), client = (arr(cl) || [])[0];
  if (!pkgs || !tariffs || !cfgRows || !client) throw new Error("no se pudieron leer bultos, tarifas o cliente");
  const config = {}; cfgRows.forEach((r) => { config[r.key] = Number(r.value); });
  const est = calcOpBudget(op, items, pkgs, tariffs, config, arr(ov) || [], client, []);
  const body = armarCotizacionDeImportacion({ op, items, pkgs, client, est });
  const ex = await svc(`/rest/v1/quotes?operation_id=eq.${op.id}&select=id&limit=1`);
  const prev = (arr(ex) || [])[0];
  const r = prev
    ? await svc(`/rest/v1/quotes?id=eq.${prev.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) })
    : await svc(`/rest/v1/quotes`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const row = (arr(r) || [])[0];
  if (!r.ok || !row?.id) throw new Error(r.data?.message || r.data?.hint || `HTTP ${r.status}`);
  return { id: row.id, quote_number: row.quote_number, total_cost: body.total_cost };
}

export async function POST(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const opId = String(body.op_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(opId)) return Response.json({ error: "op_invalida" }, { status: 400 });

  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ error: "no_auth" }, { status: 401 });
  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const ownClientId = Array.isArray(cl.data) && cl.data[0]?.id;
  const isAdmin = Array.isArray(prof.data) && ["admin", "empleado"].includes(prof.data[0]?.role);
  let clientId = ownClientId || null;
  if (body.client_id && (isAdmin || body.client_id === ownClientId)) clientId = body.client_id;
  if (!clientId) return Response.json({ error: "sin_cliente" }, { status: 403 });

  // La op completa: calcOpBudget necesita origen, baterías, envío, despacho real, etc.
  const opR = await svc(`/rest/v1/operations?id=eq.${opId}&client_id=eq.${clientId}&select=*&limit=1`);
  const op = Array.isArray(opR.data) ? opR.data[0] : null;
  if (!op) return Response.json({ error: "op_no_encontrada" }, { status: 404 });
  if (op.docs_confirmed_at && !isAdmin) return Response.json({ error: "mercaderia_confirmada" }, { status: 409 });
  if (op.channel !== "aereo_blanco" || op.service_type === "gestion_integral" || !["en_deposito_origen", "en_preparacion"].includes(op.status))
    return Response.json({ error: "op_no_editable" }, { status: 409 });
  const fo = await svc(`/rest/v1/flight_operations?operation_id=eq.${opId}&select=id&limit=1`);
  if (Array.isArray(fo.data) && fo.data.length) return Response.json({ error: "ya_en_vuelo" }, { status: 409 });

  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({
      description: String(it.description || "").trim().slice(0, 300),
      quantity: num(it.quantity), unit_price_usd: num(it.unit_price_usd),
      ncm_code: it.ncm_code ? String(it.ncm_code).slice(0, 20) : null,
      import_duty_rate: num(it.import_duty_rate), statistics_rate: num(it.statistics_rate), iva_rate: it.iva_rate == null || it.iva_rate === "" ? 21 : num(it.iva_rate),
      package_ids: Array.isArray(it.package_ids) && it.package_ids.length ? it.package_ids.filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))) : null,
      antidumping_note: it.antidumping_note ? String(it.antidumping_note).slice(0, 300) : null,
    }))
    .filter((it) => it.description && it.quantity > 0 && it.unit_price_usd > 0);
  if (!items.length) return Response.json({ error: "sin_items" }, { status: 400 });

  // Reemplazo completo de la mercadería (la op está pre-vuelo, no hay nada facturado sobre estos ítems).
  await svc(`/rest/v1/operation_items?operation_id=eq.${opId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  for (const it of items) {
    const ins = await svc(`/rest/v1/operation_items`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: opId, ...it }) });
    if (!ins.ok) return Response.json({ error: "no_se_guardo", detail: ins.data }, { status: 500 });
  }
  const description = items.length > 3 ? "Consolidado" : items.map((it) => it.description).join(", ").slice(0, 200);
  const patch = { description };
  if (typeof body.has_battery === "boolean") patch.has_battery = body.has_battery;
  const confirm = body.confirm === true;
  const now = new Date().toISOString();
  if (confirm) patch.docs_confirmed_at = now;
  await svc(`/rest/v1/operations?id=eq.${opId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });

  // La cotización de la importación. La mercadería ya quedó guardada: si esto falla no se
  // frena al cliente, pero se avisa al admin y el portal muestra el error. Nunca en silencio.
  let quote = null, quoteError = null;
  try {
    quote = await guardarCotizacion({ op: { ...op, ...patch }, clientId, items });
  } catch (e) {
    quoteError = e?.message || String(e);
    console.error("[guardar-mercaderia] cotizacion no guardada", op.operation_code, quoteError);
    await avisarAdmins(`⚠️ No se guardó la cotización de ${op.operation_code}`, quoteError.slice(0, 200), `/admin?op=${op.operation_code}`).catch(() => {});
  }

  if (confirm) {
    await svc(`/rest/v1/tracking_events`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: opId, title: "Mercadería confirmada por el cliente", occurred_at: now, source: "internal", status_code: op.status, is_visible_to_client: true }) });
    // Aviso al admin: la importación quedó lista para presupuestar y armar el vuelo.
    const cli = await svc(`/rest/v1/clients?id=eq.${clientId}&select=client_code&limit=1`);
    const code = Array.isArray(cli.data) && cli.data[0]?.client_code ? cli.data[0].client_code + " · " : "";
    const cot = quote?.quote_number ? ` · AGC-${String(quote.quote_number).padStart(5, "0")}` : "";
    await avisarAdmins(`📋 Mercadería confirmada · ${op.operation_code}`, `${code}${items.length} producto${items.length !== 1 ? "s" : ""} · ${description}${cot}`, `/admin?op=${op.operation_code}`);
  }
  return Response.json({ ok: true, items: items.length, description, confirmed: confirm, quote, quote_error: quoteError });
}
