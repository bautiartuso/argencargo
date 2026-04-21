"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
// Abre el perfil de Argencargo en Google (kgmid). El cliente toca 'Escribir una reseña' ahí.
// TODO: cuando Google Business esté verificado, reemplazar con el link directo tipo https://g.page/r/XXX/review
const GOOGLE_REVIEW_URL = "https://www.google.com/search?q=Argencargo&kgmid=/g/11z0lfp088";

const NAVY = "#152D54"; const AC = "#3B7DD8"; const BG = "#0a1223";

function FeedbackPageInner() {
  const searchParams = useSearchParams();
  const opCode = searchParams.get("op");
  const preRating = Number(searchParams.get("r") || 0);
  const [step, setStep] = useState(preRating >= 1 && preRating <= 5 ? (preRating >= 4 ? "high" : "low") : "rate");
  const [rating, setRating] = useState(preRating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [opId, setOpId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!opCode) return;
    fetch(`${SB_URL}/rest/v1/operations?operation_code=eq.${opCode}&select=id`, {
      headers: { apikey: SB_KEY },
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d) && d[0]) {
        setOpId(d[0].id);
        // Si venimos del email con ?r= ya grabado, guardamos el rating inicial sin comentario
        if (preRating >= 1 && preRating <= 5) {
          fetch(`${SB_URL}/rest/v1/op_feedback`, {
            method: "POST",
            headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ operation_id: d[0].id, rating: preRating }),
          }).catch(() => {});
        }
      } else setError("No encontramos esa operación");
    }).catch(() => setError("Error al cargar"));
  }, [opCode, preRating]);

  const submit = async (finalRating, finalComment) => {
    if (!opId) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/op_feedback`, {
        method: "POST",
        headers: {
          apikey: SB_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          operation_id: opId,
          rating: finalRating,
          comment: finalComment || null,
        }),
      });
      if (!r.ok && r.status !== 201 && r.status !== 200 && r.status !== 204) {
        const err = await r.json().catch(() => null);
        // Si ya existe feedback previo, igual consideramos enviado
        if (err?.code !== "23505") throw new Error(err?.message || "Error al guardar");
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
    if (finalRating >= 4) setStep("high");
    else setStep("low");
  };

  const markGoogleClicked = () => {
    if (!opId) return;
    fetch(`${SB_URL}/rest/v1/op_feedback?operation_id=eq.${opId}`, {
      method: "PATCH",
      headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ clicked_google_review: true }),
    }).catch(() => {});
  };

  if (error) {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 16, color: "#ff6b6b" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!opCode) {
    return (
      <div style={wrapperStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 16, color: "#fff" }}>Falta el código de operación en el link.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 26, color: "#fff", margin: "0 0 8px", fontWeight: 800 }}>Argencargo</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0, fontFamily: "monospace" }}>{opCode}</p>
        </div>

        {step === "rate" && (
          <>
            <h2 style={{ fontSize: 22, color: "#fff", margin: "0 0 8px", textAlign: "center" }}>¿Cómo fue tu experiencia?</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: "0 0 32px", textAlign: "center" }}>Tu opinión nos ayuda a mejorar</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => { setRating(n); setStep("comment"); }}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  style={{
                    fontSize: 44,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: (hover || rating) >= n ? "#fbbf24" : "rgba(255,255,255,0.2)",
                    transition: "all 0.15s",
                    transform: hover === n ? "scale(1.2)" : "scale(1)",
                  }}
                >★</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: 0 }}>Tocá una estrella</p>
          </>
        )}

        {step === "comment" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ fontSize: 32, color: rating >= n ? "#fbbf24" : "rgba(255,255,255,0.15)" }}>★</span>
              ))}
            </div>
            <h2 style={{ fontSize: 18, color: "#fff", margin: "0 0 16px", textAlign: "center" }}>
              {rating >= 4 ? "¡Gracias! ¿Querés agregar algo?" : "Contanos qué podríamos mejorar"}
            </h2>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={rating >= 4 ? "Comentario (opcional)" : "Tu comentario nos ayuda a mejorar..."}
              rows={4}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 14,
                borderRadius: 10,
                border: "1.5px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />
            <button
              onClick={() => submit(rating, comment)}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background: `linear-gradient(135deg,${AC},${NAVY})`,
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Enviando..." : "Enviar feedback"}
            </button>
          </>
        )}

        {step === "high" && (
          <>
            <div style={{ fontSize: 64, textAlign: "center", marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, color: "#fff", margin: "0 0 12px", textAlign: "center", fontWeight: 700 }}>
              ¡Gracias por tu feedback!
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", textAlign: "center", margin: "0 0 28px", lineHeight: 1.6 }}>
              Nos encanta saber que tu experiencia fue buena. ¿Nos ayudás compartiéndola en Google? Toma 30 segundos y nos ayuda muchísimo a crecer.
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={markGoogleClicked}
              style={{
                display: "block",
                width: "100%",
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 10,
                background: "#fff",
                color: NAVY,
                textDecoration: "none",
                textAlign: "center",
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span style={{ marginRight: 8 }}>⭐</span>Dejanos tu reseña en Google
            </a>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", margin: "16px 0 0" }}>O cerrá esta pestaña. ¡Gracias!</p>
          </>
        )}

        {step === "low" && (
          <>
            <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>💙</div>
            <h2 style={{ fontSize: 22, color: "#fff", margin: "0 0 12px", textAlign: "center", fontWeight: 700 }}>
              Lamento que no haya sido lo que esperabas
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
              Quiero escuchar qué salió mal para poder resolverlo. Contame con tus palabras y te escribo en el día.
            </p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="¿Qué podríamos mejorar?"
              rows={4}
              style={{
                width: "100%", padding: 12, fontSize: 14, borderRadius: 10,
                border: "1.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                color: "#fff", outline: "none", fontFamily: "inherit", resize: "vertical",
                boxSizing: "border-box", marginBottom: 16,
              }}
            />
            <button
              onClick={async () => {
                if (!opId) return;
                setSubmitting(true);
                await fetch(`${SB_URL}/rest/v1/op_feedback?operation_id=eq.${opId}`, {
                  method: "PATCH",
                  headers: { apikey: SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
                  body: JSON.stringify({ comment: comment || null }),
                }).catch(() => {});
                setSubmitting(false);
                setStep("thanks");
              }}
              disabled={submitting || !comment.trim()}
              style={{
                width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, borderRadius: 10,
                border: "none", background: comment.trim() ? `linear-gradient(135deg,${AC},${NAVY})` : "rgba(255,255,255,0.1)",
                color: comment.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                cursor: submitting || !comment.trim() ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Enviando..." : "Enviar"}
            </button>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "16px 0 0" }}>
              O contactame directo: <a href="https://wa.me/5491125088580" style={{ color: AC, textDecoration: "none" }}>WhatsApp</a>
            </p>
          </>
        )}

        {step === "thanks" && (
          <>
            <div style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🙏</div>
            <h2 style={{ fontSize: 22, color: "#fff", margin: "0 0 12px", textAlign: "center", fontWeight: 700 }}>
              Gracias por tomarte el tiempo
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              Lo voy a revisar personalmente en las próximas horas y me pongo en contacto si corresponde.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const wrapperStyle = {
  minHeight: "100vh",
  background: BG,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "'Segoe UI',system-ui,sans-serif",
};

const cardStyle = {
  maxWidth: 480,
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: "40px 32px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
};

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div style={wrapperStyle}><div style={cardStyle}><p style={{color:"#fff"}}>Cargando...</p></div></div>}>
      <FeedbackPageInner />
    </Suspense>
  );
}
