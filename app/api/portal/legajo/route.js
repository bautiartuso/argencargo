// GET /api/portal/legajo?op_id=…  — Legajo de la importación para el cliente (22/10/2026).
// Solo aéreo courier comercial y solo clientes RI (ver lib/legajo-server.js). Devuelve solo lo que
// existe: facturas de Argencargo, factura del courier, DSI (links firmados por 1 hora al bucket
// privado, con "Ver" y "Descargar") y los cobros para armar los recibos.
import { cargarLegajo } from "../../../../lib/legajo-server";

export async function GET(req) {
  const l = await cargarLegajo(req, new URL(req.url).searchParams.get("op_id"));
  if (l.error) return Response.json({ error: l.error }, { status: l.status });
  if (!l.visible) return Response.json({ visible: false });
  const { docs, ...resto } = l;
  return Response.json({ ...resto, docs: docs.map(({ storage_path, ...d }) => d) });
}
