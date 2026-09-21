"use client";
// Landing de ARGENMAQ. Estructura tomada de b2box.app / b2box.pro: barra del grupo, nav fija,
// titular enorme con una sola idea, tres promesas, cómo funciona, tarjetas con mini animaciones,
// el catálogo abierto (precio solo con cuenta), cómo se paga, confianza y cierre.
import { useAM, Marco, MONO, WA } from "./kit";
import { Tarjeta, usePrecios } from "./Tienda";

const Y = "#FFD200";
const Ruta = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none"><path d="M40 200 C 120 60, 260 60, 360 40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="8 10" style={{ animation: "correr 6s linear infinite" }} /><circle r="6" fill={Y} style={{ offsetPath: "path('M40 200 C 120 60, 260 60, 360 40')", animation: "viajar 5s ease-in-out infinite" }} /><circle cx="40" cy="200" r="10" fill="none" stroke="rgba(255,255,255,0.5)" /><circle cx="360" cy="40" r="10" fill="none" stroke={Y} /><text x="52" y="222" fill="rgba(255,255,255,0.6)" fontFamily={MONO} fontSize="10" letterSpacing="2">CHINA</text><text x="262" y="30" fill="rgba(255,255,255,0.6)" fontFamily={MONO} fontSize="10" letterSpacing="2">BUENOS AIRES</text></svg>;
const Barras = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none">{[40, 90, 140, 190, 240, 290, 340].map((x, i) => <rect key={x} x={x} y={60} width="26" height="150" rx="4" fill={i === 5 ? Y : "rgba(255,255,255,0.18)"} style={{ transformOrigin: "50% 210px", transformBox: "fill-box", animation: `subir 1.8s ${i * 0.15}s ease-out infinite alternate` }} />)}<line x1="30" y1="210" x2="380" y2="210" stroke="rgba(255,255,255,0.35)" /></svg>;
const Check = () => <svg className="anim" viewBox="0 0 400 240"><g transform="translate(120 34)"><rect width="160" height="180" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" />{[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(20 ${28 + i * 36})`}><rect width="18" height="18" rx="5" fill="none" stroke={Y} /><path d="M4 9l4 4 7-8" fill="none" stroke={Y} strokeWidth="2.2" style={{ animation: `tick 2.4s ${i * 0.5}s infinite` }} /><rect x="30" y="4" width="86" height="10" rx="5" fill="rgba(255,255,255,0.25)" /></g>)}</g></svg>;
const Enchufe = () => <svg className="anim" viewBox="0 0 400 240"><g transform="translate(200 120)"><circle r="70" fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth="14" /><circle r="70" fill="none" stroke={Y} strokeWidth="14" strokeDasharray="120 320" strokeLinecap="round" style={{ transformOrigin: "center", animation: "girar 3s linear infinite" }} /><text textAnchor="middle" y="10" fontFamily={MONO} fontSize="26" fontWeight="600" fill="currentColor">220 V</text></g></svg>;
const Pasos = () => <svg className="anim" viewBox="0 0 400 240"><line x1="40" y1="120" x2="360" y2="120" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />{[40, 120, 200, 280, 360].map((x, i) => <g key={x}><circle cx={x} cy="120" r="9" fill="#15171A" stroke={Y} strokeWidth="2" style={{ animation: `tick 3s ${i * 0.6}s infinite` }} /><circle cx={x} cy="120" r="4" fill={Y} style={{ animation: `tick 3s ${i * 0.6}s infinite` }} /></g>)}</svg>;
const Fabrica = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none"><path d="M30 200 V120 l60 -40 v40 l60 -40 v40 l60 -40 V200 Z" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" /><rect x="60" y="150" width="28" height="30" fill={Y} opacity="0.85" style={{ animation: "tick 2.2s infinite" }} /><rect x="120" y="150" width="28" height="30" fill="rgba(255,255,255,0.35)" /><rect x="180" y="150" width="28" height="30" fill={Y} opacity="0.85" style={{ animation: "tick 2.2s 0.8s infinite" }} /><g style={{ animation: "flotar 3s ease-in-out infinite" }}><rect x="270" y="90" width="90" height="70" rx="10" fill="rgba(255,255,255,0.12)" stroke={Y} /><text x="315" y="132" textAnchor="middle" fontFamily={MONO} fontSize="12" fill={Y} letterSpacing="2">VIDEO OK</text></g></svg>;

const CSS = `
.amq .hero{padding:52px 0 30px;text-align:center}
.amq .kicker{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--borde);font-family:${MONO};font-size:12px;letter-spacing:0.06em;color:var(--gris);background:var(--card)}
.amq .kicker i{width:8px;height:8px;border-radius:50%;background:var(--y);display:inline-block;animation:pulso 1.6s infinite}
.amq .hero p.sub{font-size:19px;color:var(--gris);max-width:640px;margin:22px auto 26px;line-height:1.5}
.amq .promesas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:960px;margin:30px auto 0}
.amq .promesa{padding:16px 18px;border-radius:18px;background:var(--ysuave);border:1px solid var(--y);text-align:left}
.amq .promesa b{display:block;font-size:15px;margin-bottom:2px}.amq .promesa span{font-size:13px;color:var(--gris)}
.amq .pasos{background:var(--suave);border:1px solid var(--borde);border-radius:28px;padding:42px 34px;margin:34px auto 0;max-width:1080px}
.amq .pasos h2{font-size:clamp(24px,3.4vw,36px);letter-spacing:-0.03em;margin:0 0 30px;text-align:center}
.amq .pasos .fila{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.amq .paso{text-align:center;position:relative}.amq .paso .ico2{width:78px;height:78px;margin:0 auto 14px;border-radius:22px;background:var(--card);border:1px solid var(--borde);display:flex;align-items:center;justify-content:center}
.amq .paso .n{font-family:${MONO};font-size:11px;color:var(--gris);letter-spacing:0.1em}.amq .paso b{display:block;font-size:16px;margin-top:4px}
.amq .paso:not(:last-child):after{content:"+";position:absolute;right:-9px;top:30px;color:#B7BBC1;font-size:18px}
.amq .bento{display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-auto-rows:240px;gap:14px}
.amq .bc{position:relative;border-radius:22px;overflow:hidden;background:#15171A;color:#fff;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.amq .bc.alta{grid-row:span 2}.amq .bc.clara{background:var(--suave);color:var(--ink);border:1px solid var(--borde)}
.amq .bc .tag2{position:absolute;top:18px;left:22px;font-size:15px;font-weight:700;border-bottom:2px solid var(--y);padding-bottom:3px}
.amq .bc .lug{font-family:${MONO};font-size:11px;letter-spacing:0.12em;opacity:0.6;margin-bottom:6px}.amq .bc h3{margin:0;font-size:22px;letter-spacing:-0.02em;line-height:1.15}.amq .bc.alta h3{font-size:34px}
.amq .bc p{margin:8px 0 0;font-size:14px;opacity:0.75;line-height:1.45;max-width:420px}
.amq .anim{position:absolute;inset:0;z-index:-1;opacity:0.55}.amq .grilla{background-image:linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px);background-size:34px 34px}
.amq .pago{background:#15171A;color:#fff;border-radius:28px;padding:56px 40px;display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:center}
.amq .pago h2{font-size:clamp(30px,4vw,48px);letter-spacing:-0.04em;margin:0 0 14px;line-height:1.02}.amq .pago p{color:#9DA3A9;font-size:17px;line-height:1.5;margin:0}
.amq .pago .caja{background:#1C1E21;border:1px solid #2B2E33;border-radius:20px;padding:22px}.amq .pago .lin{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #2B2E33;font-size:15px}.amq .pago .lin:last-child{border:none}
.amq .pago .lin i{font-family:${MONO};font-style:normal;font-size:11px;letter-spacing:0.1em;padding:4px 8px;border-radius:6px;background:#3A3305;color:${Y}}
.amq .cta{text-align:center;padding:90px 0}.amq .cta h2{font-size:clamp(34px,6vw,76px);letter-spacing:-0.05em;line-height:0.95;margin:0 0 22px}
@media(max-width:900px){.amq .promesas{grid-template-columns:1fr}.amq .bento{grid-template-columns:1fr 1fr;grid-auto-rows:220px}.amq .bc.alta{grid-row:span 1;grid-column:span 2}.amq .pago{grid-template-columns:1fr;padding:34px 24px}.amq .pasos .fila{grid-template-columns:repeat(2,1fr);gap:22px}.amq .paso:after{display:none}}
@media(max-width:560px){.amq .bento{grid-template-columns:1fr}.amq .bc.alta{grid-column:span 1}}
`;

const TXT = {
  es: { kicker: "MAQUINARIA · DE LA FÁBRICA EN CHINA A TU TALLER", h1a: "Tu próxima máquina,", h1b: "resuelta de punta a punta.", sub: "Elegís en el catálogo, ves el precio final puesto en Argentina, pagás la máquina y nosotros hacemos el resto: fábrica, control, importación y entrega. Vos la enchufás.",
    b1: "Ver el catálogo", b2: "Cómo funciona", p1: ["Un solo precio final", "Puesto en nuestro depósito de CABA. Sin sorpresas."], p2: ["Pagás la máquina, el resto contra entrega", "La importación se abona cuando llega a Buenos Aires."], p3: ["Importa Argencargo", "Flete, seguro y aduana con un equipo que ya lo hace todos los días."],
    pasosT: "Una sola operación, de la fábrica a tu taller.", pasos: ["Elegís", "Precio final", "Pagás la máquina", "Producción y control", "Importación y entrega"],
    catT: "Máquinas para tu oficio", catS: "Carpintería, gastronomía, heladería, metalúrgica, impresión, textil, construcción y más.", verCat: "Ver todo el catálogo",
    pagoT: ["Pagás la máquina.", "La importación, contra entrega."], pagoP: "El precio de la máquina se abona al confirmar y con eso la fábrica arranca. La importación se paga cuando la máquina llega a Buenos Aires. Tenés 24 horas después de la seña para arrepentirte.",
    lin: [["Anticipo · máquina", "AL CONFIRMAR"], ["Producción en fábrica", "SEGÚN LA MÁQUINA"], ["Video antes de embarcar", "SIEMPRE"], ["Importación · contra entrega", "AL LLEGAR"]],
    ctaT: "Contanos qué máquina necesitás.", ctaP: "Te decimos cuánto sale puesta en Argentina y, si te cierra, arrancamos.", ctaB: "Hablar por WhatsApp" },
  en: { kicker: "MACHINERY · FROM THE FACTORY IN CHINA TO YOUR WORKSHOP", h1a: "Your next machine,", h1b: "handled end to end.", sub: "Pick it from the catalog, see the final price landed in Argentina, pay for the machine and we do the rest: factory, quality check, import and delivery.",
    b1: "See the catalog", b2: "How it works", p1: ["One final price", "Delivered to our warehouse in Buenos Aires. No surprises."], p2: ["Pay the machine now, the rest on delivery", "Import costs are paid when it arrives in Buenos Aires."], p3: ["Imported by Argencargo", "Freight, insurance and customs by a team that does it every day."],
    pasosT: "One operation, from the factory to your workshop.", pasos: ["Choose", "Final price", "Pay the machine", "Production & QC", "Import & delivery"],
    catT: "Machines for your trade", catS: "Woodworking, food, ice cream, metalwork, printing, textile, construction and more.", verCat: "See the whole catalog",
    pagoT: ["Pay for the machine.", "Import costs on delivery."], pagoP: "The machine price is paid on confirmation and production starts. Import costs are paid when the machine reaches Buenos Aires. You have 24 hours after the deposit to change your mind.",
    lin: [["Deposit · machine", "ON CONFIRMATION"], ["Factory production", "PER MACHINE"], ["Video before shipping", "ALWAYS"], ["Import · on delivery", "ON ARRIVAL"]],
    ctaT: "Tell us which machine you need.", ctaP: "We'll tell you the landed price in Argentina and, if it works for you, we start.", ctaB: "Chat on WhatsApp" },
  ru: { kicker: "ОБОРУДОВАНИЕ · С ЗАВОДА В КИТАЕ В ВАШ ЦЕХ", h1a: "Ваша следующая машина —", h1b: "под ключ.", sub: "Выбираете в каталоге, видите итоговую цену в Аргентине, оплачиваете машину — остальное делаем мы: завод, контроль, импорт и доставка.",
    b1: "Каталог", b2: "Как это работает", p1: ["Одна итоговая цена", "На нашем складе в Буэнос-Айресе. Без сюрпризов."], p2: ["Платите за машину сейчас, остальное при получении", "Импорт оплачивается по прибытии в Буэнос-Айрес."], p3: ["Импортирует Argencargo", "Фрахт, страховка и таможня — командой, которая делает это каждый день."],
    pasosT: "Одна операция: с завода в ваш цех.", pasos: ["Выбор", "Итоговая цена", "Оплата машины", "Производство и контроль", "Импорт и доставка"],
    catT: "Машины для вашего дела", catS: "Дерево, общепит, мороженое, металл, печать, текстиль, стройка и другое.", verCat: "Весь каталог",
    pagoT: ["Платите за машину.", "Импорт — при получении."], pagoP: "Цена машины оплачивается при подтверждении, и завод начинает производство. Импорт оплачивается, когда машина прибывает в Буэнос-Айрес. 24 часа после аванса на отказ.",
    lin: [["Аванс · машина", "ПРИ ПОДТВЕРЖДЕНИИ"], ["Производство", "ПО МАШИНЕ"], ["Видео перед отправкой", "ВСЕГДА"], ["Импорт · при получении", "ПО ПРИБЫТИИ"]],
    ctaT: "Расскажите, какая машина нужна.", ctaP: "Назовём цену с доставкой в Аргентину и, если подходит, начнём.", ctaB: "Написать в WhatsApp" },
};

export default function Landing({ arbol, destacadas, diasVia }) {
  const { lang, t } = useAM();
  const x = TXT[lang] || TXT.es;
  const precios = usePrecios(destacadas.map((m) => m.id));
  const iconos = ["M4 6h16M4 12h10M4 18h7", "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", "M2 7h20v10H2zM6 12h.01M18 12h.01", "M3 20V9l6-4v4l6-4v4l6-4v15zM7 15h2M11 15h2M15 15h2", "M3 9l9-6 9 6-9 6-9-6zM3 9v6l9 6 9-6V9"];
  return <Marco actual="inicio" conGrupo>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="hero"><div className="wrap">
      <span className="kicker"><i /> {x.kicker}</span>
      <h1 className="h1" style={{ margin: "26px 0 0" }}>{x.h1a}<br /><span className="ac">{x.h1b}</span></h1>
      <p className="sub">{x.sub}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><a className="btn k" href="/catalogo">{x.b1}</a><a className="btn" href="/como-funciona">{x.b2}</a></div>
      <div className="promesas">{[x.p1, x.p2, x.p3].map(([a, b]) => <div className="promesa" key={a}><b>{a}</b><span>{b}</span></div>)}</div>
      <div className="pasos" id="como">
        <h2>{x.pasosT}</h2>
        <div className="fila">{x.pasos.map((tt, i) => <div className="paso" key={tt}><div className="ico2"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={iconos[i]} /></svg></div><span className="n">0{i + 1}</span><b>{tt}</b></div>)}</div>
      </div>
    </div></section>

    <section style={{ padding: "60px 0 20px" }}><div className="wrap">
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}><div><h2 className="h2">{x.catT}</h2><p style={{ color: "var(--gris)", fontSize: 17, margin: "6px 0 0" }}>{x.catS}</p></div><a className="btn" href="/catalogo">{x.verCat} →</a></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 18px" }}>{arbol.map((c) => <a key={c.slug} className="chip" href={`/catalogo/${c.slug}`}>{c.nombre}</a>)}</div>
      {destacadas.length > 0 && <div className="carril">{destacadas.map((m) => <Tarjeta key={m.id} m={m} precios={precios} diasVia={diasVia} />)}</div>}
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("verPrecio")}.</p>
    </div></section>

    <section style={{ padding: "50px 0" }}><div className="wrap"><div className="bento">
      <div className="bc alta"><div className="anim grilla" /><Ruta /><span className="tag2">Argencargo</span><div className="lug">CHINA → ARGENTINA</div><h3>La importación la hace Argencargo.</h3><p>Flete, seguro, aduana y entrega con el mismo equipo que opera importaciones todos los días. Vos ves cada paso, sin hablar con nadie en China.</p></div>
      <div className="bc"><Barras /><span className="tag2">Precio final</span><div className="lug">PUESTO EN CABA</div><h3>Sin sorpresas.</h3></div>
      <div className="bc"><Fabrica /><span className="tag2">Control</span><div className="lug">ANTES DE EMBARCAR</div><h3>Video de tu máquina funcionando.</h3></div>
      <div className="bc clara"><Enchufe /><span className="tag2">Lista para usar</span><div className="lug" style={{ opacity: 0.7 }}>220 V · 50 HZ</div><h3>Llega para enchufar.</h3></div>
      <div className="bc"><Pasos /><span className="tag2">Seguimiento</span><div className="lug">PRODUCCIÓN → EMBARQUE → ADUANA → ENTREGA</div><h3>Sabés dónde está tu máquina.</h3></div>
      <div className="bc" style={{ gridColumn: "span 2" }}><Check /><span className="tag2">Respaldo</span><div className="lug">ARGENMAQ SIEMPRE PRESENTE</div><h3>Si algo pasa, hablás con nosotros, no con la fábrica.</h3></div>
    </div></div></section>

    <section id="pago" style={{ padding: "10px 0 70px" }}><div className="wrap"><div className="pago">
      <div><h2>{x.pagoT[0]}<br />{x.pagoT[1]}</h2><p>{x.pagoP}</p></div>
      <div className="caja">{x.lin.map(([a, b]) => <div className="lin" key={a}><span>{a}</span><i>{b}</i></div>)}</div>
    </div></div></section>

    <section className="cta"><div className="wrap">
      <h2>{x.ctaT}</h2>
      <p style={{ color: "var(--gris)", fontSize: 18, margin: "0 auto 24px", maxWidth: 560 }}>{x.ctaP} {t("grupo")}.</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><a className="btn y" href="/catalogo">{x.b1}</a><a className="btn" href={WA("Hola ARGENMAQ, quiero saber cuánto sale una máquina puesta en Argentina")} target="_blank" rel="noreferrer">{x.ctaB}</a></div>
    </div></section>
  </Marco>;
}
