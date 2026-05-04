"use client";
// Chatbot del cliente: widget flotante en esquina inferior derecha.
// Conversa con Claude via /api/chatbot. Persiste el historial en localStorage.
// Usado solo en el portal del cliente.

import { useState, useEffect, useRef } from "react";

const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";
const NAVY = "#142038";

const STORAGE_KEY = "ac_chatbot_messages";

export default function Chatbot({ token, client }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const scrollRef = useRef(null);

  // Cargar historial del localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
    // Mensaje de bienvenida si no hay historial
    if (!localStorage.getItem(STORAGE_KEY)) {
      setMessages([{ role: "assistant", content: `¡Hola ${client?.first_name || ""}! 👋 Soy el asistente de Argencargo. Puedo ayudarte con dudas sobre tus envíos, cotizaciones o cualquier consulta que tengas. ¿En qué te ayudo?`, ts: Date.now() }]);
    }
  }, [client?.first_name]);

  // Persistir historial
  useEffect(() => {
    if (messages.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Marca "nuevo" si hay mensaje del bot y está cerrado
  useEffect(() => {
    if (!open && messages.length > 0 && messages[messages.length - 1]?.role === "assistant") {
      const lastTs = messages[messages.length - 1]?.ts || 0;
      if (Date.now() - lastTs < 3000) setHasNew(true);
    }
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setSending(true);
    try {
      const r = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }),
      });
      const j = await r.json();
      if (j.ok && j.message) {
        setMessages(p => [...p, { role: "assistant", content: j.message, ts: Date.now() }]);
      } else {
        setMessages(p => [...p, { role: "assistant", content: "Disculpá, tuve un problema técnico. Intentá de nuevo o escribí a Bautista por WhatsApp: https://wa.me/5491125088580", ts: Date.now() }]);
      }
    } catch (e) {
      setMessages(p => [...p, { role: "assistant", content: "Error de conexión. Por favor intentá de nuevo.", ts: Date.now() }]);
    }
    setSending(false);
  };

  const clearHistory = () => {
    if (!confirm("¿Borrar todo el historial de conversación?")) return;
    setMessages([{ role: "assistant", content: `¡Hola ${client?.first_name || ""}! Empezamos de nuevo. ¿En qué te ayudo?`, ts: Date.now() }]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const openChat = () => { setOpen(true); setHasNew(false); };

  // Detectar links en el mensaje del bot y hacerlos clickeables
  const renderContent = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: GOLD_LIGHT, textDecoration: "underline" }}>{part}</a>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return <>
    {/* Botón flotante — visible siempre */}
    {!open && (
      <button onClick={openChat} aria-label="Abrir chat con asistente"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 998,
          width: 60, height: 60, borderRadius: "50%",
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          border: "none", cursor: "pointer",
          boxShadow: "0 6px 24px rgba(184,149,106,0.4), 0 2px 8px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 200ms",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#0A1628" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {hasNew && <span style={{ position: "absolute", top: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "2px solid #fff" }} />}
      </button>
    )}

    {/* Panel del chat */}
    {open && (
      <div className="ac-chatbot-panel" style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 999,
        width: 380, maxWidth: "calc(100vw - 48px)",
        height: 560, maxHeight: "calc(100vh - 48px)",
        background: NAVY,
        borderRadius: 16, border: `1.5px solid ${GOLD}55`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px",
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(10,22,40,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#0A1628", margin: 0, letterSpacing: "-0.01em" }}>Asistente Argencargo</p>
              <p style={{ fontSize: 10, color: "rgba(10,22,40,0.7)", margin: 0, fontWeight: 600 }}>● Disponible 24/7</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={clearHistory} title="Borrar historial" style={{ background: "rgba(10,22,40,0.1)", border: "none", color: "#0A1628", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
            <button onClick={() => setOpen(false)} title="Cerrar" style={{ background: "rgba(10,22,40,0.1)", border: "none", color: "#0A1628", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10, background: "linear-gradient(180deg, #142038, #0F1A2D)" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%",
                padding: "10px 13px",
                borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                background: m.role === "user" ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` : "rgba(255,255,255,0.06)",
                color: m.role === "user" ? "#0A1628" : "#fff",
                fontSize: 13.5, lineHeight: 1.5,
                fontWeight: m.role === "user" ? 600 : 400,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
                {renderContent(m.content)}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "10px 13px", borderRadius: "12px 12px 12px 4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD_LIGHT, animation: "ac-typing 1.4s ease-in-out infinite" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD_LIGHT, animation: "ac-typing 1.4s ease-in-out 0.2s infinite" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD_LIGHT, animation: "ac-typing 1.4s ease-in-out 0.4s infinite" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribí tu consulta..."
              disabled={sending}
              autoFocus
              style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#fff", outline: "none" }}
              onFocus={e => e.target.style.borderColor = GOLD}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
            <button type="submit" disabled={sending || !input.trim()} style={{
              padding: "10px 14px", fontSize: 13, fontWeight: 700, borderRadius: 10,
              border: "none", cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              background: sending || !input.trim() ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
              color: "#0A1628",
              opacity: sending || !input.trim() ? 0.5 : 1,
              minWidth: 50,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </form>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "8px 0 0", textAlign: "center" }}>
            Asistente IA · Si necesitás hablar con Bautista, te paso por <a href="https://wa.me/5491125088580" target="_blank" rel="noopener noreferrer" style={{ color: GOLD_LIGHT, textDecoration: "none" }}>WhatsApp</a>
          </p>
        </div>

        <style>{`
          @keyframes ac-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        `}</style>
      </div>
    )}
  </>;
}
