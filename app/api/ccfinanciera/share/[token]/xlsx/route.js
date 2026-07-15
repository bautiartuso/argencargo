// GET /api/ccfinanciera/share/[token]/xlsx
// Descarga en Excel de los movimientos de CC Financiera, para quien tenga el link
// público (mismo token que /ccfinanciera/share/[token] — sin login aparte).

import * as XLSX from "xlsx";

// Sin esto, Next.js cachea las respuestas de fetch() del route handler y el Excel quedaría
// pegado a un snapshot viejo en vez de traer los movimientos actuales.
export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, ...(init.headers || {}) },
  });
  return r.json();
}

const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y}`;
};

export async function GET(_req, { params }) {
  try {
    if (!SB_SERVICE) return Response.json({ ok: false, error: "server no configurado" }, { status: 500 });
    const token = params?.token;
    if (!token) return Response.json({ ok: false, error: "token requerido" }, { status: 400 });

    // Misma validación que /api/ccfinanciera/share/[token] — el token ES la credencial,
    // no hay login aparte.
    const tokenRow = await sb(`/rest/v1/cc_solfin_share_tokens?token=eq.${encodeURIComponent(token)}&active=eq.true&select=id,label,created_at&limit=1`);
    if (!Array.isArray(tokenRow) || tokenRow.length === 0) {
      return Response.json({ ok: false, error: "Link inválido o revocado" }, { status: 404 });
    }

    const movsRaw = await sb(`/rest/v1/cc_solfin_movements?select=*&order=date.asc,created_at.asc`);
    const movements = Array.isArray(movsRaw) ? movsRaw : [];

    // Saldo corriente por moneda — misma lógica que la página compartida.
    let arsBal = 0, usdBal = 0;
    const rows = movements.map((m) => {
      const net = Number(m.net_amount || 0);
      const signed = m.type === "ingreso" ? net : -net;
      if (m.currency === "ARS") arsBal += signed; else usdBal += signed;
      const running = m.currency === "ARS" ? arsBal : usdBal;
      return {
        Fecha: fmtDate(m.date),
        Tipo: m.type === "ingreso" ? "Ingreso" : "Egreso",
        Moneda: m.currency,
        Descripción: m.description || "",
        Importe: m.type === "ingreso" ? Number(m.amount || 0) : -Number(m.amount || 0),
        "Comisión %": m.commission_pct != null ? Number(m.commission_pct) : "",
        "Comisión monto": m.commission_amount != null ? Number(m.commission_amount) : "",
        Saldo: running,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 9 }, { wch: 7 }, { wch: 40 }, { wch: 14 }, { wch: 11 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const label = (tokenRow[0].label || "cc_financiera").replace(/[^a-z0-9_-]+/gi, "_");
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${label}_movimientos.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
