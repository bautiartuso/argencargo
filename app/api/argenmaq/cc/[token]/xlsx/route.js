// GET /api/argenmaq/cc/[token]/xlsx — la misma CC en Excel, para el mismo link.
import * as XLSX from "xlsx";
import { validarToken, movimientos } from "../route";
export const dynamic = "force-dynamic";

const fmtDate = (d) => { const s = String(d || "").slice(0, 10); const [y, m, dd] = s.split("-"); return y ? `${dd}/${m}/${y}` : ""; };
const TIPO = { ingreso: "Ingreso", retiro: "Retiro", ajuste: "Ajuste", dolarizacion: "Dolarización" };

export async function GET(_req, { params }) {
  try {
    const t = await validarToken(params?.token);
    if (!t) return new Response("Link inválido o revocado", { status: 404 });
    const movs = (await movimientos()).slice().reverse(); // cronológico para el saldo
    let ars = 0, usd = 0;
    const filas = movs.map((m) => {
      const signo = m.tipo === "retiro" ? -1 : 1;
      const neto = Number(m.acreditado ?? m.monto) * signo;
      if (m.moneda === "USD") usd += neto; else ars += neto;
      return { Fecha: fmtDate(m.fecha), Tipo: TIPO[m.tipo] || m.tipo, Moneda: m.moneda, Descripción: m.concepto || "", Importe: Number(m.monto), "Comisión %": m.comision_pct ?? "", Comisión: Number(m.comision || 0), Acreditado: Number(m.acreditado ?? m.monto), "Saldo ARS": Math.round(ars * 100) / 100, "Saldo USD": Math.round(usd * 100) / 100 };
    }).reverse();
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [{ wch: 11 }, { wch: 13 }, { wch: 8 }, { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CC Financiera");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="argenmaq-cc-financiera-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (e) { return new Response(e.message, { status: 500 }); }
}
