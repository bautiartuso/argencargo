"use client";
// /factura/vista-previa — borrador de una factura del facturador, sin emitir (17/11/2026).
// El admin deja los datos del formulario en este navegador (localStorage "ac_factura_previa") y abre
// esta página: se ve la misma hoja que va a recibir el cliente, con un cartel de que no tiene validez.
// No toca ARCA ni la base.
import { useEffect, useState } from "react";
import FacturaVista, { listaMercaderias } from "../FacturaVista";

export default function FacturaVistaPrevia() {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    try { setD(JSON.parse(localStorage.getItem("ac_factura_previa") || "null")); } catch { setD(null); }
    document.title = "Vista previa de factura";
  }, []);
  if (d === undefined) return null;
  if (!d?.inv) return <div style={{ minHeight: "100vh", background: "#0A1628", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}><p style={{ opacity: 0.6 }}>No hay ninguna vista previa armada. Abrila desde el facturador.</p></div>;
  return <FacturaVista inv={d.inv} cfg={d.cfg || {}} mercaderias={listaMercaderias(d.mercaderias)} previa />;
}
