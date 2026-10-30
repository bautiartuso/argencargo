"use client";
// Campañas (30/10/2026): qué anuncio trae leads que importan. Por campaña → conjunto → anuncio:
// gasto (Meta Ads), leads que escribieron por ese anuncio, cuántos hablaron, cotizaron e importaron,
// facturado y costo por lead / por importador. La plata la ve solo el admin (la RPC la devuelve null
// al empleado). Abajo, los que escribieron sin anuncio, para comparar.
import { useState, useEffect, useCallback, useMemo } from "react";
import { C, MONO, dq, arr, Vacio, Cargando } from "../gi/_base";
import { usd } from "./_comun";

const RANGOS = [["30", "30 días"], ["90", "90 días"], ["mes", "Este mes"], ["365", "12 meses"]];
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const n0 = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

export default function Campanas({ ctx }) {
  const { token, admin, movil } = ctx;
  const [rango, setRango] = useState("30");
  const [filas, setFilas] = useState(null);
  const [organico, setOrganico] = useState(null);
  const [abiertas, setAbiertas] = useState({});
  const fechas = useMemo(() => { const hoy = new Date(); if (rango === "mes") return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) }; return { desde: iso(Date.now() - Number(rango) * 864e5), hasta: iso(hoy) }; }, [rango]);
  const cargar = useCallback(async () => {
    setFilas(null);
    const [r, o] = await Promise.all([
      dq("rpc/crm_campanas", { token, method: "POST", body: { p_desde: fechas.desde, p_hasta: fechas.hasta } }),
      dq("crm_contacts", { token, filters: `?select=stage&source=eq.organico&first_in_at=gte.${fechas.desde}&limit=1000` }),
    ]);
    setFilas(arr(r)); const oo = arr(o); setOrganico({ leads: oo.length, hablaron: oo.filter((c) => ["hablando", "cotizo", "importo"].includes(c.stage)).length, cotizaron: oo.filter((c) => ["cotizo", "importo"].includes(c.stage)).length, importaron: oo.filter((c) => c.stage === "importo").length });
  }, [token, fechas]);
  useEffect(() => { cargar(); }, [cargar]);

  // Campaña → conjunto → anuncio, con totales en cada nivel.
  const arbol = useMemo(() => {
    const suma = (acc, f) => { for (const k of ["spend", "impressions", "clicks", "conversaciones", "leads", "hablaron", "cotizaron", "importaron", "facturado"]) acc[k] = (acc[k] || 0) + Number(f[k] || 0); return acc; };
    const camps = {};
    for (const f of filas || []) {
      const ck = f.campaign_id || "sin", ak = f.adset_id || "sin";
      camps[ck] = camps[ck] || { id: ck, nombre: f.campaign_name || "Sin campaña", t: {}, sets: {} };
      suma(camps[ck].t, f);
      camps[ck].sets[ak] = camps[ck].sets[ak] || { id: ak, nombre: f.adset_name || "Sin conjunto", t: {}, ads: [] };
      suma(camps[ck].sets[ak].t, f); camps[ck].sets[ak].ads.push(f);
    }
    const orden = (a, b) => (b.t.leads - a.t.leads) || (b.t.spend - a.t.spend);
    return Object.values(camps).sort(orden).map((c) => ({ ...c, sets: Object.values(c.sets).sort(orden).map((s) => ({ ...s, ads: s.ads.sort((x, y) => (y.leads - x.leads) || (y.spend - x.spend)) })) }));
  }, [filas]);
  const total = useMemo(() => arbol.reduce((acc, c) => { for (const k in c.t) acc[k] = (acc[k] || 0) + c.t[k]; return acc; }, {}), [arbol]);

  const cols = admin ? "minmax(220px,2fr) 90px 60px 70px 70px 70px 90px 90px 100px" : "minmax(220px,2fr) 60px 70px 70px 70px";
  const Celda = ({ children, c, mono = true, b }) => <span style={{ fontSize: 12.5, color: c || C.txt, fontFamily: mono ? MONO : "inherit", textAlign: "right", fontWeight: b ? 800 : 500, whiteSpace: "nowrap" }}>{children}</span>;
  const Nums = ({ t, b }) => <>
    {admin && <Celda b={b}>{t.spend > 0 ? usd(t.spend) : "—"}</Celda>}
    <Celda b={b}>{n0(t.leads)}</Celda>
    <Celda b={b} c={C.sub}>{n0(t.hablaron)}</Celda>
    <Celda b={b} c="#a78bfa">{n0(t.cotizaron)}</Celda>
    <Celda b={b} c={C.green}>{n0(t.importaron)}</Celda>
    {admin && <Celda b={b}>{t.facturado > 0 ? usd(t.facturado) : "—"}</Celda>}
    {admin && <Celda b={b} c={C.sub}>{t.leads > 0 && t.spend > 0 ? usd(t.spend / t.leads) : "—"}</Celda>}
    {admin && <Celda b={b} c={C.sub}>{t.importaron > 0 && t.spend > 0 ? usd(t.spend / t.importaron) : "—"}</Celda>}
  </>;
  const Fila = ({ nivel, nombre, t, abierta, onClick, sub, b }) => <button onClick={onClick} style={{ display: "grid", gridTemplateColumns: cols, gap: 10, alignItems: "center", width: "100%", padding: `8px 10px 8px ${10 + nivel * 18}px`, borderRadius: 10, border: "none", background: nivel === 0 ? "rgba(255,255,255,0.03)" : "transparent", cursor: onClick ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", color: C.txt }}>
    <span style={{ fontSize: nivel === 0 ? 13.5 : 12.5, fontWeight: nivel === 0 ? 800 : nivel === 1 ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: nivel === 2 ? C.sub : C.txt }}>{onClick ? <span style={{ display: "inline-block", width: 14, color: C.mute }}>{abierta ? "▾" : "▸"}</span> : <span style={{ display: "inline-block", width: 14 }} />}{nombre}{sub && <span style={{ color: C.mute, fontWeight: 500, marginLeft: 8, fontSize: 11.5 }}>{sub}</span>}</span>
    <Nums t={t} b={b} />
  </button>;

  const linea = filas === null ? "Cargando…" : !filas.length ? "Sin anuncios en este período." :
    `${admin && total.spend > 0 ? `Gastaste ${usd(total.spend)} · ` : ""}${n0(total.leads)} leads · ${n0(total.cotizaron)} cotizaron · ${n0(total.importaron)} importaron${admin && total.leads > 0 && total.spend > 0 ? ` · ${usd(total.spend / total.leads)} por lead` : ""}${admin && total.importaron > 0 && total.spend > 0 ? ` · ${usd(total.spend / total.importaron)} por importador` : ""}`;

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: C.sub }}>{linea}</p>
      <div style={{ display: "flex", gap: 4 }}>{RANGOS.map(([k, l]) => <button key={k} onClick={() => setRango(k)} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${rango === k ? C.goldHi : C.line}`, background: rango === k ? "rgba(232,208,152,0.14)" : "transparent", color: rango === k ? C.goldHi : C.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}</div>
    </div>
    {filas === null ? <Cargando /> : !filas.length ? <Vacio>Todavía no hay anuncios con gasto ni leads en este período. Cuando conectes Meta Ads en Conexiones y corran las campañas, aparecen acá.</Vacio> :
      movil ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {arbol.map((c) => <div key={c.id} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}` }}>
          <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 800 }}>{c.nombre}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: C.sub }}>{admin && c.t.spend > 0 ? `${usd(c.t.spend)} · ` : ""}{n0(c.t.leads)} leads · {n0(c.t.cotizaron)} cotizaron · <span style={{ color: C.green }}>{n0(c.t.importaron)} importaron</span>{admin && c.t.leads > 0 && c.t.spend > 0 ? ` · ${usd(c.t.spend / c.t.leads)}/lead` : ""}</p>
        </div>)}
      </div> : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 10, padding: "4px 10px", fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <span>Campaña</span>{admin && <span style={{ textAlign: "right" }}>Gasto</span>}<span style={{ textAlign: "right" }}>Leads</span><span style={{ textAlign: "right" }}>Hablaron</span><span style={{ textAlign: "right" }}>Cotizaron</span><span style={{ textAlign: "right" }}>Importaron</span>{admin && <><span style={{ textAlign: "right" }}>Facturado</span><span style={{ textAlign: "right" }}>Por lead</span><span style={{ textAlign: "right" }}>Por importador</span></>}
        </div>
        {arbol.map((c) => <div key={c.id}>
          <Fila nivel={0} nombre={c.nombre} t={c.t} abierta={!!abiertas[c.id]} onClick={() => setAbiertas((a) => ({ ...a, [c.id]: !a[c.id] }))} sub={`${pct(c.t.importaron, c.t.leads)} importan`} />
          {abiertas[c.id] && c.sets.map((s) => <div key={s.id}>
            <Fila nivel={1} nombre={s.nombre} t={s.t} abierta={!!abiertas[c.id + s.id]} onClick={() => setAbiertas((a) => ({ ...a, [c.id + s.id]: !a[c.id + s.id] }))} />
            {abiertas[c.id + s.id] && s.ads.map((f) => <Fila key={f.ad_id} nivel={2} nombre={f.ad_name || f.ad_id} t={f} sub={f.impressions > 0 ? `${n0(f.impressions)} vistas · ${n0(f.clicks)} clics` : ""} />)}
          </div>)}
        </div>)}
        <div style={{ borderTop: `1px solid ${C.lineHi}`, marginTop: 4 }}><Fila nivel={0} nombre="Total" t={total} b /></div>
        {organico && <Fila nivel={0} nombre="Sin anuncio (escribieron solos)" t={{ ...organico, spend: 0, facturado: 0 }} sub={`${pct(organico.importaron, organico.leads)} importan`} />}
      </div>}
  </div>;
}
