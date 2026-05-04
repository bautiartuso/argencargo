"use client";
// Banner que muestra estado de conexión + paquetes pendientes en la cola offline.
// Auto-sincroniza cuando vuelve la conexión.
// Usado en el portal del agente.

import { useState, useEffect, useCallback } from "react";
import { getPendingCount, processQueue, onQueueChange, getPending, clearQueue } from "../../lib/offline-queue";

// Diccionario interno: i18n minimal (recibe lang opcional, default es)
const I18N = {
  es: { no_conn: "Sin conexión", pending: "pendiente", pendings: "pendientes", to_sync: "de sincronizar", keep_loading: "podés seguir cargando paquetes", synced: "✓ Sincronizado", uploaded: "subido", uploaded_pl: "subidos", sync_now: "Sincronizar ahora", syncing: "· Sincronizando…", view: "Ver", hide: "Ocultar", detail: "detalle", in_queue: "Pendientes en cola", clear: "Limpiar todo", clear_confirm: "¿Borrar TODA la cola pendiente sin enviar? Esto NO se puede deshacer.", no_queue: "Sin pendientes", attempt: "intento", attempts: "intentos" },
  zh: { no_conn: "离线", pending: "待处理", pendings: "待处理", to_sync: "待同步", keep_loading: "您可以继续登记包裹", synced: "✓ 已同步", uploaded: "已上传", uploaded_pl: "已上传", sync_now: "立即同步", syncing: "· 同步中…", view: "查看", hide: "隐藏", detail: "详情", in_queue: "队列中待处理", clear: "全部清除", clear_confirm: "确定要清除所有未发送的队列吗？此操作无法撤销。", no_queue: "无待处理", attempt: "次尝试", attempts: "次尝试" },
};

export default function OfflineStatusBar({ token, onSyncDone, lang = "es" }) {
  const tx = I18N[lang] || I18N.es;
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState([]);

  const refreshCount = useCallback(async () => {
    setPending(await getPendingCount());
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => { setOnline(true); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Suscribirse a cambios en la cola
  useEffect(() => {
    refreshCount();
    const unsub = onQueueChange(refreshCount);
    const iv = setInterval(refreshCount, 5000);
    return () => { unsub(); clearInterval(iv); };
  }, [refreshCount]);

  const sync = useCallback(async () => {
    if (syncing || !token) return;
    setSyncing(true);
    setLastResult(null);
    const r = await processQueue(token);
    setLastResult(r);
    setSyncing(false);
    refreshCount();
    if (r.processed > 0 && onSyncDone) onSyncDone();
  }, [syncing, token, refreshCount, onSyncDone]);

  // Auto-sync cuando vuelve online y hay pendientes
  useEffect(() => {
    if (online && pending > 0 && !syncing) {
      sync();
    }
  }, [online, pending, syncing, sync]);

  // Toggle detalles muestra los items pendientes
  useEffect(() => {
    if (!showDetails) return;
    (async () => setDetails(await getPending()))();
  }, [showDetails, pending]);

  // Si está online y no hay pendientes y no hay actividad reciente → no mostrar nada
  if (online && pending === 0 && !lastResult) return null;

  const bgColor = !online ? "rgba(239,68,68,0.95)" : pending > 0 ? "rgba(251,146,60,0.95)" : "rgba(34,197,94,0.95)";
  const icon = !online ? "📡" : pending > 0 ? "⏳" : "✓";
  const msg = !online
    ? `${tx.no_conn} · ${pending > 0 ? `${pending} ${pending > 1 ? tx.pendings : tx.pending} ${tx.to_sync}` : tx.keep_loading}`
    : pending > 0
      ? `${pending} ${pending > 1 ? tx.pendings : tx.pending} ${tx.to_sync}`
      : `${tx.synced} · ${lastResult?.processed || 0} ${(lastResult?.processed || 0) > 1 ? tx.uploaded_pl : tx.uploaded}`;

  return <>
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: bgColor, color: "#fff", padding: "8px 16px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      fontSize: 12, fontWeight: 600,
      backdropFilter: "blur(8px)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{msg}</span>
      {pending > 0 && online && !syncing && (
        <button onClick={sync} style={{ marginLeft: 6, padding: "3px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer" }}>{tx.sync_now}</button>
      )}
      {syncing && <span style={{ fontSize: 11, opacity: 0.85 }}>{tx.syncing}</span>}
      {pending > 0 && (
        <button onClick={() => setShowDetails(p => !p)} style={{ padding: "3px 8px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer" }}>{showDetails ? tx.hide : tx.view} {tx.detail}</button>
      )}
    </div>

    {showDetails && (
      <div style={{ position: "fixed", top: 38, right: 12, zIndex: 101, background: "#142038", border: "1.5px solid rgba(184,149,106,0.35)", borderRadius: 10, padding: "12px 14px", maxWidth: 340, width: "calc(100vw - 24px)", maxHeight: 400, overflow: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>{tx.in_queue}</p>
          <button onClick={async () => { if (confirm(tx.clear_confirm)) { await clearQueue(); refreshCount(); } }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(255,80,80,0.3)", background: "rgba(255,80,80,0.1)", color: "#ff6b6b", cursor: "pointer", fontWeight: 600 }}>{tx.clear}</button>
        </div>
        {details.length === 0 ? <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0, fontStyle: "italic" }}>{tx.no_queue}</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {details.map((d, i) => (
              <div key={d.id} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 11 }}>
                <p style={{ margin: 0, color: "#fff", fontWeight: 600 }}>{d.body?.national_tracking || `Item ${i + 1}`}</p>
                <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.5)" }}>{d.body?.gross_weight_kg ? `${d.body.gross_weight_kg} kg` : ""}{d.photoBlob ? " · 📷" : ""}{d.attempts > 0 ? ` · ${d.attempts} ${d.attempts > 1 ? tx.attempts : tx.attempt}` : ""}</p>
                {d.lastError && <p style={{ margin: "2px 0 0", color: "#ff6b6b", fontSize: 10 }}>⚠ {d.lastError.slice(0, 80)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </>;
}
