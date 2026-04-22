// Orquestador: llamado por cron cada 6h.
// Itera ops activas con tracking internacional + carrier y sincroniza eventos.
// Protegido con CRON_SECRET para evitar abuso.

import { SB_URL, SB_SERVICE, upsertEvent, updateSyncStatus, normalizeEvent } from "../_helpers";
import {
  getFedexTracking, fedexConfigured,
  getDhlTracking, dhlConfigured,
  getUpsTracking, upsConfigured
} from "../../../../lib/tracking/carriers";

// Permitir hasta 60 segundos de ejecución (por defecto Hobby es 10s).
export const maxDuration = 60;

const ACTIVE_STATUSES = ["en_transito", "arribo_argentina", "en_aduana", "entregada"];

// Internal secret for server-to-server calls to /api/notify.
const CRON_SECRET = process.env.CRON_SECRET || "";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://argencargo.com.ar";

// Dispara /api/notify con bypass de CRON_SECRET (el endpoint lo acepta además del JWT admin).
async function triggerMail(op_id, trigger) {
  if (!CRON_SECRET) return { skipped: "no CRON_SECRET" };
  try {
    const r = await fetch(`${BASE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
      body: JSON.stringify({ op_id, trigger })
    });
    return await r.json();
  } catch (e) { return { error: e.message }; }
}

async function fetchActiveOps(operationId) {
  let url;
  if (operationId) {
    url = `${SB_URL}/rest/v1/operations?select=id,operation_code,international_tracking,international_carrier,status&id=eq.${operationId}`;
  } else {
    const statuses = ACTIVE_STATUSES.map(s => `"${s}"`).join(",");
    url = `${SB_URL}/rest/v1/operations?select=id,operation_code,international_tracking,international_carrier,status&status=in.(${statuses})&international_tracking=not.is.null&international_carrier=not.is.null`;
  }
  const r = await fetch(url, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  return await r.json();
}

function carrierRoute(carrier) {
  const c = (carrier || "").toLowerCase();
  if (c.includes("dhl")) return "dhl";
  if (c.includes("fedex")) return "fedex";
  if (c.includes("ups")) return "ups";
  return null;
}

function isCarrierConfigured(route) {
  if (route === "fedex") return fedexConfigured();
  if (route === "dhl") return dhlConfigured();
  if (route === "ups") return upsConfigured();
  return false;
}

async function callCarrier(route, trackingNumber) {
  if (route === "fedex") return getFedexTracking(trackingNumber);
  if (route === "dhl") return getDhlTracking(trackingNumber);
  if (route === "ups") return getUpsTracking(trackingNumber);
  return { error: `carrier desconocido: ${route}` };
}

async function syncOne(op) {
  const route = carrierRoute(op.international_carrier);
  if (!route) return { op: op.operation_code, skipped: "carrier desconocido" };
  if (!isCarrierConfigured(route)) {
    await updateSyncStatus(op.id, route, 0, `${route.toUpperCase()} API no configurada`);
    return { op: op.operation_code, skipped: `${route} no configurada` };
  }

  const d = await callCarrier(route, op.international_tracking);
  if (d.error) {
    await updateSyncStatus(op.id, route, 0, d.error);
    return { op: op.operation_code, error: d.error };
  }

  let inserted = 0;
  const errors = [];
  for (const ev of d.events || []) {
    const { ok, error } = await upsertEvent(normalizeEvent({
      operation_id: op.id,
      source: route,
      carrier: op.international_carrier,
      ...ev
    }));
    if (ok) inserted++;
    else if (error && errors.length < 3) errors.push(error);
  }

  // ETA / fecha entrega real → operations.eta (y status si ya llegó al courier)
  // operations.eta es tipo DATE, así que truncamos el timestamp a YYYY-MM-DD.
  const patch = {};
  if (d.eta) {
    const m = String(d.eta).match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) patch.eta = m[1];
  }

  // Auto-status #1: arribo AL PAÍS DESTINO (Argentina) Y op está en_transito → arribo_argentina
  // Exigimos que la ubicación mencione Argentina para evitar falsos positivos en escalas.
  // IMPORTANTE: el evento CC/customs-clearance se IGNORA para transición de status porque
  // algunos couriers (DHL) lo tiran antes del arribo físico. La transición a en_aduana
  // se hace con un timer de 4h post-arribo (más abajo).
  if (op.status === "en_transito" && inserted > 0) {
    // FedEx usa "AR" (Arrived at facility). Como inArg filtra que el facility esté en AR,
    // es seguro. RC/IA son los standard del TCR.
    const arrivalCodes = new Set(["RC", "IA", "AR"]);
    // Keywords cubren inglés Y español (FedEx responde en español según cuenta).
    const arrivalKeywords = ["arrived", "arrival", "arribo", "llegó", "llego", "destino"];
    const argKeywords = ["argentin", "buenos aires", "ezeiza", ", ar ", "(ar)", " ar,", ", ar", "aep"];
    const hasArrival = (d.events || []).some(ev => {
      const txt = `${ev.title||""} ${ev.description||""} ${ev.location||""}`.toLowerCase();
      const inArg = argKeywords.some(kw => txt.includes(kw));
      if (!inArg) return false;
      if (ev.status_code && arrivalCodes.has(ev.status_code)) return true;
      return arrivalKeywords.some(kw => txt.includes(kw));
    });
    if (hasArrival) patch.status = "arribo_argentina";
  }

  // Auto-status #2: si hace 4h+ que la op está en arribo_argentina → en_aduana.
  // Buscamos el evento de arribo más reciente en tracking_events y comparamos occurred_at.
  if (op.status === "arribo_argentina") {
    try {
      const evRes = await fetch(
        `${SB_URL}/rest/v1/tracking_events?operation_id=eq.${op.id}&status_code=in.(RC,IA)&select=occurred_at&order=occurred_at.desc&limit=1`,
        { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
      );
      const evs = await evRes.json();
      const arrivedAt = Array.isArray(evs) && evs[0] ? new Date(evs[0].occurred_at) : null;
      if (arrivedAt && (Date.now() - arrivedAt.getTime()) >= 4 * 60 * 60 * 1000) {
        patch.status = "en_aduana";
      }
    } catch (e) { /* noop */ }
  }

  // Auto-status #3: courier entregó (DL) → entregada (= lista para retirar en oficina).
  if (["en_transito", "arribo_argentina", "en_aduana"].includes(op.status) && inserted > 0) {
    const deliveryCodes = new Set(["DL", "delivered", "OK"]);
    const hasDelivery = (d.events || []).some(ev => ev.status_code && deliveryCodes.has(ev.status_code));
    if (hasDelivery) patch.status = "entregada";
  }

  if (Object.keys(patch).length) {
    await fetch(`${SB_URL}/rest/v1/operations?id=eq.${op.id}`, {
      method: "PATCH",
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch)
    });
    // Email automático cuando el sync cambia el status (la guarda sent_notifications
    // en /api/notify previene duplicados con el admin).
    if (patch.status === "arribo_argentina") {
      await triggerMail(op.id, "arribo");
    }
  }

  // Notification #5: notify client about new tracking events
  if (inserted > 0) {
    try {
      const opRes = await fetch(`${SB_URL}/rest/v1/operations?id=eq.${op.id}&select=client_id`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
      const opData = await opRes.json();
      const clientId = Array.isArray(opData) && opData[0] ? opData[0].client_id : null;
      if (clientId) {
        const clRes = await fetch(`${SB_URL}/rest/v1/clients?id=eq.${clientId}&select=auth_user_id`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
        const clData = await clRes.json();
        const authUid = Array.isArray(clData) && clData[0] ? clData[0].auth_user_id : null;
        if (authUid) {
          await fetch(`${SB_URL}/rest/v1/notifications`, {
            method: "POST",
            headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ user_id: authUid, portal: "cliente", title: "Actualización de tracking", body: `Operación ${op.operation_code}: ${inserted} nuevos eventos`, link: `?op=${op.operation_code}` })
          });
        }
      }
    } catch (e) { console.error("notif error", e); }
  }

  await updateSyncStatus(op.id, route, inserted, errors[0] || null);
  return { op: op.operation_code, inserted, carrier: route, eta: d.eta || null, errors: errors.length ? errors : undefined };
}

async function runSync(req) {
  const auth = req.headers.get("authorization") || new URL(req.url).searchParams.get("secret") || "";
  const expected = process.env.CRON_SECRET || "";
  let authorized = !expected || auth === `Bearer ${expected}` || auth === expected;
  if (!authorized && auth.startsWith("Bearer ")) {
    // Verificar que es un JWT de admin válido
    const jwt = auth.slice(7);
    try {
      const v = await fetch(`${SB_URL}/rest/v1/profiles?select=role&id=eq.${JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString()).sub}`, {
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
      });
      const p = await v.json();
      if (Array.isArray(p) && p[0]?.role === "admin") authorized = true;
    } catch {}
  }
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "SUPABASE_SERVICE_ROLE no configurado" }, { status: 500 });

  const operationId = new URL(req.url).searchParams.get("operation_id");
  const ops = await fetchActiveOps(operationId);
  if (!Array.isArray(ops)) return Response.json({ error: "failed to fetch ops", detail: ops }, { status: 500 });

  // Procesar ops en paralelo con Promise.allSettled (mucho más rápido que secuencial)
  const settled = await Promise.allSettled(ops.map(op => syncOne(op)));
  const results = settled.map((s, i) => s.status === "fulfilled" ? s.value : { op: ops[i].operation_code, error: String(s.reason?.message || s.reason) });

  return Response.json({ synced: results.length, results });
}

// GET y POST → mismo comportamiento. Vercel Cron usa GET por defecto.
export async function GET(req) { return runSync(req); }
export async function POST(req) { return runSync(req); }
