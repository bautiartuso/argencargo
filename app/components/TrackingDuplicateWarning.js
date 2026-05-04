"use client";
// Aviso visual de tracking duplicado. Llama a /api/tracking/check-duplicate
// con debounce y muestra un banner si encuentra el tracking en otra op/aviso.
//
// Uso:
//   <TrackingDuplicateWarning trackingCode={trk} excludeOpId={op.id} token={token} />

import { useState, useEffect } from "react";

const I18N_DUP = {
  es: { title: "Tracking duplicado", match: "coincidencia", matches: "coincidencias", already: "Este código ya existe en el sistema:", more: "más" },
  zh: { title: "重复的快递单号", match: "个匹配", matches: "个匹配", already: "该单号已存在于系统中：", more: "更多" },
};

export default function TrackingDuplicateWarning({ trackingCode, excludeOpId, token, onResult, lang = "es" }) {
  const tx = I18N_DUP[lang] || I18N_DUP.es;
  const [duplicates, setDuplicates] = useState([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const code = (trackingCode || "").trim();
    if (!code || code.length < 4 || !token) {
      setDuplicates([]);
      onResult?.([]);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const tm = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code });
        if (excludeOpId) params.set("exclude_op", excludeOpId);
        const r = await fetch(`/api/tracking/check-duplicate?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!cancelled) {
          const dups = Array.isArray(j.duplicates) ? j.duplicates : [];
          setDuplicates(dups);
          onResult?.(dups);
        }
      } catch (e) {
        if (!cancelled) {
          setDuplicates([]);
          onResult?.([]);
        }
      }
      if (!cancelled) setChecking(false);
    }, 600);
    return () => { cancelled = true; clearTimeout(tm); };
  }, [trackingCode, excludeOpId, token, onResult]);

  if (duplicates.length === 0) return null;

  return (
    <div style={{
      marginTop: 8,
      padding: "10px 14px",
      background: "linear-gradient(90deg, rgba(251,146,60,0.12), rgba(251,146,60,0.04))",
      border: "1.5px solid rgba(251,146,60,0.45)",
      borderRadius: 10,
      fontSize: 12,
      color: "#fff",
      lineHeight: 1.5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <strong style={{ color: "#fb923c", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 800 }}>
          {tx.title} · {duplicates.length} {duplicates.length > 1 ? tx.matches : tx.match}
        </strong>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: "0 0 6px" }}>
        {tx.already}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>
        {duplicates.slice(0, 5).map((d, i) => (
          <li key={i} style={{ marginBottom: 3 }}>
            <strong style={{ color: "#fff" }}>{d.where}</strong>
            {d.operation_code && <span style={{ color: "#fb923c", fontFamily: "monospace", marginLeft: 6, fontWeight: 600 }}>{d.operation_code}</span>}
            {d.client && <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.65)" }}>· {d.client}</span>}
          </li>
        ))}
        {duplicates.length > 5 && <li style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>+{duplicates.length - 5} {tx.more}</li>}
      </ul>
    </div>
  );
}
