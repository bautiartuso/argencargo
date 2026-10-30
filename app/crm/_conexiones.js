"use client";
// Conexiones del CRM (solo admin). Es lo último que se hace: el sistema funciona vacío hasta que
// Bautista conecta las claves acá. Tres piezas:
//   · WhatsApp: el número comercial por Embedded Signup de Meta (coexistencia) + envío desde el sistema
//   · Meta Ads: lectura de la cuenta publicitaria para Campañas (token + id de cuenta en Vercel)
//   · Claude: la clave ya cargada para el bot sirve para los resúmenes de chats
import { useState, useEffect, useCallback, useRef } from "react";
import { C, MONO, Btn, Pill, Caja, Titulo, Cargando, hace } from "../gi/_base";
import { api, hora } from "./_comun";

function cargarFb(appId) {
  return new Promise((res) => {
    if (window.FB) return res(window.FB);
    window.fbAsyncInit = () => { window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version: "v26.0" }); res(window.FB); };
    const s = document.createElement("script"); s.src = "https://connect.facebook.net/es_LA/sdk.js"; s.async = true; s.defer = true; s.crossOrigin = "anonymous"; document.body.appendChild(s);
  });
}
const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID || "";
const ESTADO = { conectado: ["Conectado", "#22c55e"], desconectado: ["Desconectado", "#f87171"], reconectando: ["Reconectando", "#E8D098"] };

const Dato = ({ k, v, mal }) => <div><p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</p><p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 700, color: mal ? C.red : C.txt }}>{v}</p></div>;
const Fila = ({ children }) => <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.line}` }}>{children}</div>;

export default function Conexiones() {
  const [st, setSt] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState(null);
  const datos = useRef({});
  const agregar = (t) => setLog((l) => [...l, `${hora(new Date())} · ${t}`]);
  const cargar = useCallback(async () => setSt(await api("/api/crm/conectar")), []);
  useEffect(() => { cargar(); }, [cargar]);
  // Los ids del número llegan por postMessage mientras el usuario está en la ventana de Meta.
  useEffect(() => {
    const onMsg = (e) => {
      if (!String(e.origin || "").endsWith("facebook.com")) return;
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      agregar(`Meta: ${d.event || "?"}${d.data?.current_step ? ` · paso ${d.data.current_step}` : ""}${d.data?.error_message ? ` · ${d.data.error_message}` : ""}${d.data?.error_id ? ` (${d.data.error_id})` : ""}`);
      if (d.data?.phone_number_id || d.data?.waba_id) datos.current = { ...datos.current, phone_number_id: d.data.phone_number_id, waba_id: d.data.waba_id, business_id: d.data.business_id };
    };
    window.addEventListener("message", onMsg); return () => window.removeEventListener("message", onMsg);
  }, []);
  const mostrar = (r) => { for (const p of r.pasos || []) agregar(`${p.ok ? "✓" : "✗"} ${p.t}`); if (r.error) agregar(`✗ ${r.error}`); };

  const conectar = async () => {
    if (!APP_ID || !CONFIG_ID) { agregar("Faltan en Vercel NEXT_PUBLIC_META_APP_ID y/o NEXT_PUBLIC_META_ES_CONFIG_ID."); return; }
    setBusy(true); datos.current = {}; agregar("Abriendo el alta de Meta…");
    const FB = await cargarFb(APP_ID);
    FB.login(async (resp) => {
      const code = resp?.authResponse?.code;
      if (!code) { agregar("Alta cancelada o sin permiso: Meta no devolvió el código."); setBusy(false); return; }
      for (let i = 0; i < 25 && !datos.current.phone_number_id; i++) await new Promise((r) => setTimeout(r, 200));
      if (!datos.current.phone_number_id) { agregar("Meta devolvió el código pero no el id del número. ¿Se completó el alta hasta el final?"); setBusy(false); return; }
      agregar("Terminando la conexión…");
      mostrar(await api("/api/crm/conectar", { code, ...datos.current }));
      setBusy(false); cargar();
    }, { config_id: CONFIG_ID, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } });
  };
  const accion = async (body, antes) => { setBusy(true); if (antes) agregar(antes); mostrar(await api("/api/crm/conectar", body)); setBusy(false); cargar(); };
  const probarAds = async () => { setBusy(true); const r = await api("/api/crm/conectar", { accion: "probar_ads" }); setAds(r); agregar(r.ok ? `✓ Meta Ads: cuenta "${r.nombre}" en ${r.moneda}` : `✗ Meta Ads: ${r.error}`); setBusy(false); };
  const traerGasto = async () => { setBusy(true); agregar("Trayendo los últimos 30 días de gasto…"); const r = await api("/api/cron/crm-ads", { dias: 30 }); agregar(r.ok ? `✓ ${r.filas} filas de gasto · ${r.nombrados} leads con nombre de campaña` : `✗ ${r.error || r.motivo}`); setBusy(false); };

  const nums = st?.numeros || [];
  return <div style={{ maxWidth: 820 }}>
    <Titulo eyebrow="Ajustes" sub="Lo último: el sistema anda vacío hasta que conectás cada cosa.">Conexiones</Titulo>
    {st === null ? <Cargando /> : <>
      <Caja title="WhatsApp" right={<Btn v="gold" small onClick={conectar} disabled={busy}>{nums.length ? "Conectar otro número" : "Conectar WhatsApp"}</Btn>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: nums.length ? 6 : 0 }}>
          <Dato k="App de Meta" v={st.env?.app_id ? "cargada" : "falta NEXT_PUBLIC_META_APP_ID"} mal={!st.env?.app_id} />
          <Dato k="Configuración del alta" v={st.env?.config_id ? "cargada" : "falta NEXT_PUBLIC_META_ES_CONFIG_ID"} mal={!st.env?.config_id} />
          <Dato k="Clave secreta" v={st.env?.secreto ? "cargada" : "falta"} mal={!st.env?.secreto} />
          {st.campos && <Dato k="Campos del webhook" v={st.campos.error ? st.campos.error : st.campos.faltan?.length ? `faltan ${st.campos.faltan.join(", ")}` : "completos"} mal={!!(st.campos.error || st.campos.faltan?.length)} />}
          <Dato k="Chats · mensajes" v={`${st.contactos} · ${st.mensajes}`} />
        </div>
        {nums.map((n) => { const e = ESTADO[n.status] || ESTADO.conectado; const mes = new Date().toISOString().slice(0, 7); const usados = n.send_month === mes ? n.send_count : 0; return <div key={n.phone_number_id}>
          <Fila>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: MONO }}>{n.display_phone ? `+${n.display_phone.replace(/\D/g, "")}` : n.phone_number_id}</span>
            <Pill c={e[1]}>{e[0]}</Pill>
            <span style={{ fontSize: 12, color: C.sub }}>desde {hace(n.connected_at)}</span>
            {n.is_on_biz_app === false && <Pill c={C.red}>Ya no está en la app del celu</Pill>}
            {n.disconnect_reason && <span style={{ fontSize: 12, color: C.red }}>{n.disconnect_reason}</span>}
            <span style={{ fontSize: 12, color: C.sub }}>Historial: {n.history_progress == null ? (n.sync_history_at ? "pedido, esperando" : "no pedido") : n.history_progress < 0 ? "el celu no lo compartió" : `${n.history_progress}%`}</span>
            <Btn small onClick={() => accion({ accion: "reintentar", phone_number_id: n.phone_number_id }, `Revisando la conexión de ${n.display_phone || n.phone_number_id}…`)} disabled={busy}>Revisar conexión</Btn>
          </Fila>
          <Fila>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Responder desde el sistema</span>
            <Pill c={n.send_enabled ? "#22c55e" : C.sub}>{n.send_enabled ? "Encendido" : "Apagado"}</Pill>
            <span style={{ fontSize: 12, color: C.sub }}>{usados} de {n.send_cap} este mes · solo dentro de las 24 h del último mensaje del cliente</span>
            <Btn small onClick={() => accion({ accion: "envio", phone_number_id: n.phone_number_id, enabled: !n.send_enabled })} disabled={busy}>{n.send_enabled ? "Apagar" : "Encender"}</Btn>
          </Fila>
        </div>; })}
      </Caja>
      <div style={{ height: 12 }} />
      <Caja title="Meta Ads" right={<div style={{ display: "flex", gap: 6 }}><Btn small onClick={probarAds} disabled={busy || !st.env?.ads}>Probar</Btn><Btn small v="gold" onClick={traerGasto} disabled={busy || !st.env?.ads}>Traer últimos 30 días</Btn></div>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Dato k="Cuenta publicitaria" v={st.env?.ads ? "cargada" : "faltan META_ADS_TOKEN y META_AD_ACCOUNT_ID"} mal={!st.env?.ads} />
          {ads && <Dato k="Prueba" v={ads.ok ? `${ads.nombre} · ${ads.moneda}` : ads.error} mal={!ads.ok} />}
        </div>
      </Caja>
      <div style={{ height: 12 }} />
      <Caja title="Claude (resúmenes de chats)">
        <Dato k="Clave" v={st.env?.anthropic ? "cargada" : "falta ANTHROPIC_API_KEY"} mal={!st.env?.anthropic} />
      </Caja>
      {log.length > 0 && <><div style={{ height: 12 }} /><Caja title="Registro"><div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: "pre-wrap" }}>{log.join("\n")}</div></Caja></>}
    </>}
  </div>;
}
