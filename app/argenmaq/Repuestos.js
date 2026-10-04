"use client";
// Repuestos: un formulario corto. El cliente deja sus datos y describe el repuesto; nos llega al
// panel (A pedido) y por Telegram. Nada más: sin catálogo de repuestos, sin cuenta.
import { useState } from "react";
import { useAM, Marco, MONO, WA } from "./kit";

const CSS = `
.amq .rp{max-width:1080px;margin:0 auto;padding:44px 24px 80px;display:grid;grid-template-columns:1fr 1.15fr;gap:48px;align-items:start}
.amq .rp-kick{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--borde);font-family:${MONO};font-size:12px;letter-spacing:0.06em;color:var(--gris);background:var(--card)}
.amq .rp-kick i{width:8px;height:8px;border-radius:50%;background:var(--y);display:inline-block}
.amq .rp h1{font-size:clamp(34px,4.6vw,56px);line-height:1;letter-spacing:-0.045em;font-weight:800;margin:20px 0 0}
.amq .rp-sub{font-size:17.5px;line-height:1.55;color:var(--gris);margin:18px 0 0;max-width:440px}
.amq .rp-pasos{display:grid;gap:10px;margin-top:28px}
.amq .rp-pasos div{display:flex;gap:14px;align-items:flex-start}
.amq .rp-pasos b{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--y);color:#15171A;font-family:${MONO};font-size:12px;display:inline-flex;align-items:center;justify-content:center}
.amq .rp-pasos span{font-size:15px;line-height:1.45;padding-top:5px}
.amq .rp-form{border:1px solid var(--borde);border-radius:26px;background:var(--card);padding:26px;box-shadow:var(--sombra)}
.amq .rp-form h2{margin:0 0 4px;font-size:20px;letter-spacing:-0.02em}
.amq .rp-form .nota{margin:0 0 18px;font-size:13.5px;color:var(--gris)}
.amq .rp-campos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.amq .rp-campos .full{grid-column:1/-1}
.amq .rp-campos label{display:block}
.amq .rp-campos textarea{min-height:150px;resize:vertical;line-height:1.5;font-weight:500}
.amq .rp-err{margin:12px 0 0;color:#C0392B;font-size:13.5px;font-weight:700}
.amq .rp-ok{text-align:center;padding:26px 10px}
.amq .rp-ok .tilde{width:62px;height:62px;border-radius:50%;background:var(--y);color:#15171A;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px}
.amq .rp-trampa{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
@media(max-width:860px){.amq .rp{grid-template-columns:1fr;gap:28px;padding:26px 16px 60px}.amq .rp-form{padding:20px 16px}}
@media(max-width:480px){.amq .rp-campos{grid-template-columns:1fr}}
`;

const TXT = {
  es: { kick: "REPUESTOS", h1: "Te conseguimos el repuesto que estás buscando.", sub: "Contanos qué necesitás y lo buscamos en fábrica. Te escribimos con el precio y el tiempo de entrega.", pasos: ["Completás el formulario con el detalle del repuesto.", "Lo buscamos con la fábrica o el proveedor original.", "Te pasamos precio final y tiempo de entrega."], form: "Pedí tu repuesto", nota: "Te respondemos por WhatsApp en el día hábil.", nombre: "Nombre y apellido", tel: "Teléfono / WhatsApp", email: "Email", zona: "Zona", zonaPh: "Ciudad y provincia", desc: "Qué repuesto buscás", descPh: "Lo más detallado posible: qué máquina es (marca y modelo), qué pieza, medidas, número de parte si lo tenés, cuántas unidades.", enviar: "Enviar pedido", enviando: "Enviando…", okT: "¡Recibimos tu pedido!", okS: "Te escribimos por WhatsApp con lo que encontremos.", otro: "Pedir otro repuesto", wa: "¿Preferís escribirnos?", waB: "Hablar por WhatsApp", waMsg: "Hola ARGENMAQ, estoy buscando un repuesto", err: "No pudimos enviar el pedido. Probá de nuevo o escribinos por WhatsApp." },
  en: { kick: "SPARE PARTS", h1: "We'll find the spare part you're looking for.", sub: "Tell us what you need and we'll source it at the factory. We'll get back to you with price and lead time.", pasos: ["Fill in the form with the part details.", "We source it with the factory or original supplier.", "We send you the final price and lead time."], form: "Request your part", nota: "We reply on WhatsApp within one business day.", nombre: "Full name", tel: "Phone / WhatsApp", email: "Email", zona: "Area", zonaPh: "City and province", desc: "Which part do you need", descPh: "As detailed as possible: machine brand and model, which part, measurements, part number if you have it, quantity.", enviar: "Send request", enviando: "Sending…", okT: "We got your request!", okS: "We'll message you on WhatsApp with what we find.", otro: "Request another part", wa: "Rather write to us?", waB: "Chat on WhatsApp", waMsg: "Hi ARGENMAQ, I'm looking for a spare part", err: "We couldn't send your request. Try again or message us on WhatsApp." },
  ru: { kick: "ЗАПЧАСТИ", h1: "Найдём нужную вам запчасть.", sub: "Расскажите, что нужно, и мы найдём это на заводе. Сообщим цену и срок поставки.", pasos: ["Заполните форму с описанием запчасти.", "Ищем её у завода или оригинального поставщика.", "Сообщаем итоговую цену и срок."], form: "Запросить запчасть", nota: "Ответим в WhatsApp в течение рабочего дня.", nombre: "Имя и фамилия", tel: "Телефон / WhatsApp", email: "Email", zona: "Регион", zonaPh: "Город и провинция", desc: "Какая запчасть нужна", descPh: "Как можно подробнее: марка и модель машины, какая деталь, размеры, номер детали, количество.", enviar: "Отправить", enviando: "Отправка…", okT: "Запрос получен!", okS: "Напишем вам в WhatsApp, когда найдём.", otro: "Запросить ещё", wa: "Удобнее написать?", waB: "Написать в WhatsApp", waMsg: "Здравствуйте, ARGENMAQ! Ищу запчасть", err: "Не удалось отправить. Попробуйте ещё раз или напишите в WhatsApp." },
};
const VACIO = { nombre: "", telefono: "", email: "", zona: "", descripcion: "", sitio: "" };

export default function Repuestos() {
  const { lang } = useAM();
  const x = TXT[lang] || TXT.es;
  const [f, setF] = useState(VACIO);
  const [estado, setEstado] = useState("");   // "" | "enviando" | "ok"
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const enviar = async (e) => {
    e.preventDefault(); setErr(""); setEstado("enviando");
    try {
      const r = await fetch("/api/argenmaq/repuesto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || x.err); setEstado(""); return; }
      setEstado("ok"); setF(VACIO);
    } catch { setErr(x.err); setEstado(""); }
  };
  return <Marco actual="repuestos">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="rp">
      <div>
        <span className="rp-kick"><i /> {x.kick}</span>
        <h1>{x.h1}</h1>
        <p className="rp-sub">{x.sub}</p>
        <div className="rp-pasos">{x.pasos.map((p, i) => <div key={p}><b>0{i + 1}</b><span>{p}</span></div>)}</div>
      </div>
      <div className="rp-form">
        {estado === "ok"
          ? <div className="rp-ok">
            <span className="tilde"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
            <h2>{x.okT}</h2>
            <p className="nota" style={{ marginTop: 6 }}>{x.okS}</p>
            <button className="btn" onClick={() => setEstado("")}>{x.otro}</button>
          </div>
          : <form onSubmit={enviar}>
            <h2>{x.form}</h2>
            <p className="nota">{x.nota}</p>
            <div className="rp-campos">
              <label className="full"><span className="lbl">{x.nombre} *</span><input className="inp" value={f.nombre} onChange={set("nombre")} required autoComplete="name" /></label>
              <label><span className="lbl">{x.tel} *</span><input className="inp" value={f.telefono} onChange={set("telefono")} required inputMode="tel" autoComplete="tel" placeholder="11 2345 6789" /></label>
              <label><span className="lbl">{x.email}</span><input className="inp" type="email" value={f.email} onChange={set("email")} autoComplete="email" /></label>
              <label className="full"><span className="lbl">{x.zona}</span><input className="inp" value={f.zona} onChange={set("zona")} placeholder={x.zonaPh} autoComplete="address-level2" /></label>
              <label className="full"><span className="lbl">{x.desc} *</span><textarea className="inp" value={f.descripcion} onChange={set("descripcion")} required placeholder={x.descPh} /></label>
              <label className="rp-trampa" aria-hidden="true">Sitio<input tabIndex={-1} autoComplete="off" value={f.sitio} onChange={set("sitio")} /></label>
            </div>
            {err && <p className="rp-err">{err}</p>}
            <button className="btn y" type="submit" disabled={estado === "enviando"} style={{ width: "100%", height: 52, marginTop: 16, fontSize: 15.5 }}>{estado === "enviando" ? x.enviando : x.enviar}</button>
            <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--gris)", textAlign: "center" }}>{x.wa} <a href={WA(x.waMsg)} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: "var(--ink)" }}>{x.waB} →</a></p>
          </form>}
      </div>
    </section>
  </Marco>;
}
