"use client";
// Landing de ARGENMAQ (04/10/2026): corta y directa, porque no se lee. Una idea por bloque:
//   1. Hero: maquinaria importada, llave en mano. Un solo botón al catálogo.
//   2. Los cinco pasos, en amarillo, que se encienden a medida que se desliza.
//   3. Las máquinas, una sola vez.
//   4. Tarjetas animadas con lo que importa: precio final, pago en dos veces, 220 V, seguimiento, respaldo.
//   5. ¿No encontrás tu máquina? Te la conseguimos (y repuestos).
import { useEffect, useRef, useState } from "react";
import { useAM, Marco, MONO, WA, Ico } from "./kit";
import { Tarjeta, usePrecios } from "./Tienda";

const Y = "#FFD200";
// ── Gráficos con movimiento de las tarjetas ────────────────────────────────────────────────
const Barras = () => <svg className="anim" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">{[40, 90, 140, 190, 240, 290, 340].map((x, i) => <rect key={x} x={x} y={30} width="26" height="150" rx="4" fill={i === 5 ? Y : "rgba(255,255,255,0.16)"} style={{ transformOrigin: "50% 180px", transformBox: "fill-box", animation: `subir 1.8s ${i * 0.15}s ease-out infinite alternate` }} />)}<line x1="30" y1="180" x2="380" y2="180" stroke="rgba(255,255,255,0.3)" /></svg>;
const DosVeces = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(40 70)"><rect width="320" height="34" rx="17" fill="rgba(255,255,255,0.12)" /><rect width="320" height="34" rx="17" fill={Y} style={{ transformOrigin: "0 0", transformBox: "fill-box", animation: "llenarDos 4s ease-in-out infinite" }} /><text x="12" y="62" fontFamily={MONO} fontSize="11" letterSpacing="2" fill={Y}>HOY · ANTICIPO</text><text x="308" y="62" textAnchor="end" fontFamily={MONO} fontSize="11" letterSpacing="2" fill="rgba(255,255,255,0.6)">AL RECIBIR</text><line x1="190" y1="-8" x2="190" y2="42" stroke="rgba(255,255,255,0.5)" strokeDasharray="3 4" /></g></svg>;
const Enchufe = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(200 100)"><circle r="66" fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth="13" /><circle r="66" fill="none" stroke={Y} strokeWidth="13" strokeDasharray="110 310" strokeLinecap="round" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "girar 3s linear infinite" }} /><text textAnchor="middle" y="9" fontFamily={MONO} fontSize="25" fontWeight="600" fill="currentColor">220 V</text></g></svg>;
const Seguimiento = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><line x1="40" y1="100" x2="360" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="2" /><line x1="40" y1="100" x2="360" y2="100" stroke={Y} strokeWidth="2" style={{ strokeDasharray: 320, animation: "trazo 5s ease-in-out infinite" }} />{[40, 120, 200, 280, 360].map((x, i) => <g key={x}><circle cx={x} cy="100" r="9" fill="#15171A" stroke={Y} strokeWidth="2" style={{ animation: `tick 5s ${i * 0.8}s infinite` }} /><circle cx={x} cy="100" r="4" fill={Y} style={{ animation: `tick 5s ${i * 0.8}s infinite` }} /></g>)}</svg>;
const Respaldo = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(110 14)"><rect width="180" height="150" rx="14" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.2)" />{[0, 1, 2].map((i) => <g key={i} transform={`translate(22 ${26 + i * 40})`}><rect width="20" height="20" rx="6" fill="none" stroke={Y} /><path d="M5 10l4 4 7-8" fill="none" stroke={Y} strokeWidth="2.2" style={{ animation: `tick 2.4s ${i * 0.5}s infinite` }} /><rect x="34" y="5" width="100" height="10" rx="5" fill="rgba(255,255,255,0.22)" /></g>)}</g></svg>;

const CSS = `
.amq .hero{padding:58px 0 40px;text-align:center}
.amq .kicker{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--borde);font-family:${MONO};font-size:12px;letter-spacing:0.06em;color:var(--gris);background:var(--card)}
.amq .kicker i{width:8px;height:8px;border-radius:50%;background:var(--y);display:inline-block;animation:pulso 1.6s infinite}
.amq .hero p.sub{font-size:19px;color:var(--gris);max-width:560px;margin:22px auto 28px;line-height:1.5}
.amq .hero .chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.amq .hero .chips span{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:var(--suave);font-size:13px;font-weight:700}
.amq .hero .chips span i{width:6px;height:6px;border-radius:50%;background:var(--y)}

/* Pasos: panel amarillo; en compu queda fijo mientras se desliza y los pasos se encienden de a uno */
.amq .pasosScroll{position:relative;height:210vh;margin-top:10px}
.amq .pasosPanel{position:sticky;top:max(96px,calc(50vh - 190px));background:var(--y);color:#15171A;border-radius:30px;padding:46px 40px 44px;overflow:hidden}
.amq .pasosPanel h2{font-size:clamp(26px,3.4vw,40px);letter-spacing:-0.035em;line-height:1.05;margin:0 auto 34px;text-align:center;max-width:760px}
.amq .pasosPanel .fila{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.amq .pasosPanel .riel{position:absolute;left:10%;right:10%;top:38px;height:3px;border-radius:3px;background:rgba(21,23,26,0.16)}
.amq .pasosPanel .riel i{display:block;height:100%;border-radius:3px;background:#15171A;transition:width 180ms linear}
.amq .pasoS{position:relative;text-align:center;opacity:0.42;transition:opacity 260ms ease}
.amq .pasoS.on{opacity:1}
.amq .pasoS .ico3{position:relative;z-index:1;width:78px;height:78px;margin:0 auto 14px;border-radius:22px;background:rgba(255,255,255,0.55);display:flex;align-items:center;justify-content:center;transition:transform 260ms cubic-bezier(.2,.8,.2,1),background 260ms,color 260ms}
.amq .pasoS.on .ico3{background:#15171A;color:${Y};transform:scale(1.06)}
.amq .pasoS .n{font-family:${MONO};font-size:11px;letter-spacing:0.12em}
.amq .pasoS b{display:block;font-size:16.5px;margin-top:4px;letter-spacing:-0.01em}
.amq .pasoS p{margin:6px auto 0;font-size:13.5px;line-height:1.4;max-width:190px;color:rgba(21,23,26,0.75)}

.amq .rubrosHome{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 18px}
/* Tarjetas animadas */
.amq .bento{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:270px;gap:14px}
.amq .bc{position:relative;border-radius:24px;overflow:hidden;background:#15171A;color:#fff;padding:22px 24px;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.amq .bc.ancha{grid-column:span 2}.amq .bc.clara{background:var(--suave);color:var(--ink);border:1px solid var(--borde)}
.amq .bc .tag2{position:absolute;top:20px;left:24px;font-size:15px;font-weight:700;border-bottom:2px solid var(--y);padding-bottom:3px}
.amq .bc .lug{font-family:${MONO};font-size:11px;letter-spacing:0.12em;opacity:0.6;margin-bottom:6px}
.amq .bc h3{margin:0;font-size:23px;letter-spacing:-0.02em;line-height:1.15}
.amq .bc .anim{position:absolute;left:0;right:0;top:44px;height:56%;width:100%;z-index:-1;opacity:0.6}

/* ¿No encontrás tu máquina? */
.amq .busca{display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:center;background:#15171A;color:#fff;border-radius:30px;padding:46px 44px}
.amq .busca h2{font-size:clamp(28px,3.8vw,46px);letter-spacing:-0.04em;line-height:1.02;margin:0}
.amq .busca h2 span{color:var(--y)}
.amq .busca p{color:#B9BEC4;font-size:17px;line-height:1.5;margin:14px 0 0;max-width:480px}
.amq .busca .acc{display:grid;gap:10px;justify-items:stretch}
.amq .busca .acc a{height:54px;font-size:15.5px}
.amq .busca .rep{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-radius:16px;border:1px solid #2B2E33;color:#fff;font-weight:700;font-size:14.5px}
.amq .busca .rep:hover{border-color:var(--y)}

@keyframes llenarDos{0%{transform:scaleX(0)}45%,85%{transform:scaleX(0.59)}100%{transform:scaleX(0.59)}}
@keyframes trazo{0%{stroke-dashoffset:320}70%,100%{stroke-dashoffset:0}}

@media(max-width:900px){
  .amq .pasosScroll{height:auto}
  .amq .pasosPanel{position:relative;top:auto;padding:32px 22px 30px;border-radius:24px}
  .amq .pasosPanel h2{margin-bottom:24px;text-align:left}
  .amq .pasosPanel .fila{grid-template-columns:1fr;gap:0}
  .amq .pasosPanel .riel{left:37px;right:auto;top:30px;bottom:30px;width:3px;height:auto}
  .amq .pasosPanel .riel i{width:100%!important;height:var(--h,0%);transition:height 220ms linear}
  .amq .pasoS{display:grid;grid-template-columns:76px 1fr;gap:14px;text-align:left;align-items:center;padding:8px 0}
  .amq .pasoS .ico3{margin:0;width:62px;height:62px;border-radius:18px}
  .amq .pasoS p{margin:4px 0 0;max-width:none}
  .amq .bento{grid-template-columns:1fr 1fr;grid-auto-rows:240px}
  .amq .busca{grid-template-columns:1fr;padding:32px 24px}
}
@media(max-width:600px){
  .amq .hero{padding:30px 0 22px}.amq .hero p.sub{font-size:16.5px;margin:16px auto 22px}
  .amq .rubrosHome{flex-wrap:nowrap;overflow-x:auto;margin:14px -16px 16px;padding:0 16px 4px;scrollbar-width:none}.amq .rubrosHome::-webkit-scrollbar{display:none}.amq .rubrosHome .chip{flex-shrink:0}
  .amq .bento{grid-template-columns:1fr;grid-auto-rows:220px;gap:10px}.amq .bc.ancha{grid-column:span 1}
  .amq .bc{padding:20px}.amq .bc h3{font-size:20px}
}
@media(prefers-reduced-motion:reduce){.amq .bc .anim *{animation:none!important}.amq .pasoS,.amq .pasoS .ico3{transition:none}}
`;

const ICOS_PASOS = [
  ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  ["M12 2v20", "M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  ["M3 6h18v12H3z", "M3 10h18", "M7 15h3"],
  ["M2 20c2 1 4 1 6 0s4-1 6 0 4 1 6 0", "M4 16l-1-5h18l-2 5", "M6 11V7h12v4", "M12 3v4"],
  ["M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z", "M9 12l2 2 4-4"],
];

const TXT = {
  es: {
    kicker: "MAQUINARIA IMPORTADA · LLAVE EN MANO", h1a: "Tu máquina de China,", h1b: "llave en mano.",
    sub: "Elegís la máquina y ves el precio final puesto en Argentina. Del resto nos ocupamos nosotros.",
    b1: "Ver el catálogo", chips: ["Precio final", "Pagás en dos veces", "Lista para enchufar"],
    pasosT: "Una sola operación, de la fábrica en China a tu taller.",
    pasos: [["Elegís tu máquina", "Del catálogo, o nos pedís la que buscás."], ["Ves el precio final", "Puesto en Argentina, sin sorpresas."], ["Confirmás con el anticipo", "Con eso la fábrica arranca."], ["Viaja a Argentina", "Te avisamos en cada paso."], ["La recibís lista para usar", "Y recién ahí pagás el saldo."]],
    catT: "Máquinas para tu oficio", catS: "Precio puesto en nuestro depósito de CABA.",
    bentoT: "Llave en mano, de verdad.",
    b: { precio: ["Precio final", "PUESTO EN CABA", "Sin sorpresas: máquina, flete, aduana y entrega en un solo número."], dos: ["Pagás en dos veces", "ANTICIPO + SALDO", "La importación la pagás cuando llega."], v220: ["Lista para usar", "220 V · 50 HZ", "Todas se importan a 220 V. Llega para enchufar."], seg: ["Seguimiento", "PRODUCCIÓN → EMBARQUE → ADUANA → ENTREGA", "Sabés dónde está tu máquina."], resp: ["Respaldo", "ARGENMAQ SIEMPRE PRESENTE", "Si algo pasa, hablás con nosotros, no con la fábrica."] },
    buscaT: ["¿No encontrás la máquina", "que buscás?"], buscaP: "Te la conseguimos. Contanos qué necesitás y te pasamos el precio final puesta en Argentina.",
    buscaB: "Pedila por WhatsApp", buscaWa: "Hola ARGENMAQ, estoy buscando una máquina que no está en el catálogo", rep: "¿Buscás un repuesto?",
  },
  en: {
    kicker: "IMPORTED MACHINERY · TURNKEY", h1a: "Your machine from China,", h1b: "turnkey.",
    sub: "Pick the machine and see the final price landed in Argentina. We handle everything else.",
    b1: "See the catalog", chips: ["Final price", "Pay in two parts", "Ready to plug in"],
    pasosT: "One operation, from the factory in China to your workshop.",
    pasos: [["Pick your machine", "From the catalog, or ask us for the one you need."], ["See the final price", "Landed in Argentina, no surprises."], ["Confirm with the deposit", "That gets the factory started."], ["It ships to Argentina", "We update you at every step."], ["You get it ready to use", "Only then you pay the balance."]],
    catT: "Machines for your trade", catS: "Price delivered to our warehouse in Buenos Aires.",
    bentoT: "Turnkey, for real.",
    b: { precio: ["Final price", "LANDED IN BUENOS AIRES", "No surprises: machine, freight, customs and delivery in one number."], dos: ["Pay in two parts", "DEPOSIT + BALANCE", "You pay the import when it arrives."], v220: ["Ready to use", "220 V · 50 HZ", "Every machine is imported at 220 V. Ready to plug in."], seg: ["Tracking", "PRODUCTION → SHIPPING → CUSTOMS → DELIVERY", "You know where your machine is."], resp: ["Backing", "ARGENMAQ ALWAYS THERE", "If anything happens, you talk to us, not the factory."] },
    buscaT: ["Can't find the machine", "you need?"], buscaP: "We'll source it. Tell us what you need and we'll send you the final landed price in Argentina.",
    buscaB: "Ask on WhatsApp", buscaWa: "Hi ARGENMAQ, I'm looking for a machine that isn't in the catalog", rep: "Looking for a spare part?",
  },
  ru: {
    kicker: "ИМПОРТНОЕ ОБОРУДОВАНИЕ · ПОД КЛЮЧ", h1a: "Ваша машина из Китая —", h1b: "под ключ.",
    sub: "Выберите машину и увидите итоговую цену в Аргентине. Остальное — наша забота.",
    b1: "Каталог", chips: ["Итоговая цена", "Оплата в два этапа", "Готова к работе"],
    pasosT: "Одна операция: с завода в Китае в ваш цех.",
    pasos: [["Выбираете машину", "Из каталога или под ваш запрос."], ["Видите итоговую цену", "С доставкой в Аргентину, без сюрпризов."], ["Вносите аванс", "Завод начинает производство."], ["Машина едет в Аргентину", "Сообщаем о каждом этапе."], ["Получаете готовой к работе", "И только тогда платите остаток."]],
    catT: "Машины для вашего дела", catS: "Цена с доставкой на наш склад в Буэнос-Айресе.",
    bentoT: "Под ключ — по-настоящему.",
    b: { precio: ["Итоговая цена", "НА СКЛАДЕ В БУЭНОС-АЙРЕСЕ", "Без сюрпризов: машина, фрахт, таможня и доставка — одна цифра."], dos: ["Оплата в два этапа", "АВАНС + ОСТАТОК", "Импорт оплачиваете по прибытии."], v220: ["Готова к работе", "220 В · 50 ГЦ", "Все машины — на 220 В. Просто включите."], seg: ["Отслеживание", "ПРОИЗВОДСТВО → ОТГРУЗКА → ТАМОЖНЯ → ДОСТАВКА", "Вы знаете, где ваша машина."], resp: ["Поддержка", "ARGENMAQ ВСЕГДА РЯДОМ", "Если что-то случится, вы говорите с нами, а не с заводом."] },
    buscaT: ["Не нашли нужную", "машину?"], buscaP: "Найдём. Расскажите, что нужно, и мы назовём итоговую цену с доставкой в Аргентину.",
    buscaB: "Написать в WhatsApp", buscaWa: "Здравствуйте, ARGENMAQ! Ищу машину, которой нет в каталоге", rep: "Ищете запчасть?",
  },
};

// Los cinco pasos. En compu el panel queda fijo y el avance sale del scroll dentro de su tramo;
// en celular el panel se recorre normal y cada paso se enciende al pasar por la mitad de la pantalla.
function PasosScroll({ x }) {
  const ref = useRef(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setProg(1); return; }
    // Cálculo directo en cada scroll: es una lectura de posición y React no re-renderiza si el valor no cambia.
    const medir = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect(); const vh = window.innerHeight;
      if (window.innerWidth > 900) {
        const p = r.height - vh > 0 ? -r.top / (r.height - vh) : 1;
        setProg(Math.min(1, Math.max(0, Math.round(p * 50) / 50)));
      } else {
        const pasados = [...el.querySelectorAll(".pasoS")].filter((n) => n.getBoundingClientRect().top < vh * 0.7).length;
        setProg(pasados ? (pasados - 0.5) / 5 : -1);
      }
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true }); window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, []);
  const activo = prog < 0 ? -1 : Math.min(4, Math.floor(prog * 5));
  const relleno = `${(Math.max(0, activo) / 4) * 100}%`;
  return <div className="pasosScroll" ref={ref}>
    <div className="pasosPanel" id="como">
      <h2>{x.pasosT}</h2>
      <div className="fila">
        <div className="riel" aria-hidden="true"><i style={{ width: relleno, "--h": relleno }} /></div>
        {x.pasos.map(([tt, d], i) => <div className={`pasoS${i <= activo ? " on" : ""}`} key={tt}>
          <div className="ico3"><Ico d={ICOS_PASOS[i]} size={30} /></div>
          <div><span className="n">0{i + 1}</span><b>{tt}</b><p>{d}</p></div>
        </div>)}
      </div>
    </div>
  </div>;
}

export default function Landing({ arbol, destacadas, diasVia }) {
  const { lang } = useAM();
  const x = TXT[lang] || TXT.es;
  const precios = usePrecios(destacadas.map((m) => m.id));
  const b = x.b;
  return <Marco actual="inicio" conGrupo>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="hero"><div className="wrap">
      <span className="kicker"><i /> {x.kicker}</span>
      <h1 className="h1" style={{ margin: "26px 0 0" }}>{x.h1a}<br /><span className="ac">{x.h1b}</span></h1>
      <p className="sub">{x.sub}</p>
      <a className="btn k" href="/catalogo" style={{ height: 54, padding: "0 30px", fontSize: 15.5 }}>{x.b1} →</a>
      <div className="chips">{x.chips.map((c) => <span key={c}><i />{c}</span>)}</div>
    </div></section>

    <section><div className="wrap"><PasosScroll x={x} /></div></section>

    <section style={{ padding: "60px 0 10px" }}><div className="wrap">
      <h2 className="h2">{x.catT}</h2>
      <div className="rubrosHome">{arbol.map((c) => <a key={c.slug} className="chip" href={`/catalogo/${c.slug}`}>{c.nombre}</a>)}</div>
      {destacadas.length > 0 && <div className="carril">{destacadas.map((m) => <Tarjeta key={m.id} m={m} precios={precios} diasVia={diasVia} />)}</div>}
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{x.catS}</p>
    </div></section>

    <section style={{ padding: "50px 0" }}><div className="wrap">
      <h2 className="h2" style={{ marginBottom: 20 }}>{x.bentoT}</h2>
      <div className="bento">
        <div className="bc ancha"><Barras /><span className="tag2">{b.precio[0]}</span><div className="lug">{b.precio[1]}</div><h3>{b.precio[2]}</h3></div>
        <div className="bc"><DosVeces /><span className="tag2">{b.dos[0]}</span><div className="lug">{b.dos[1]}</div><h3>{b.dos[2]}</h3></div>
        <div className="bc clara"><Enchufe /><span className="tag2">{b.v220[0]}</span><div className="lug" style={{ opacity: 0.7 }}>{b.v220[1]}</div><h3>{b.v220[2]}</h3></div>
        <div className="bc"><Seguimiento /><span className="tag2">{b.seg[0]}</span><div className="lug">{b.seg[1]}</div><h3>{b.seg[2]}</h3></div>
        <div className="bc"><Respaldo /><span className="tag2">{b.resp[0]}</span><div className="lug">{b.resp[1]}</div><h3>{b.resp[2]}</h3></div>
      </div>
    </div></section>

    <section style={{ padding: "10px 0 80px" }}><div className="wrap"><div className="busca">
      <div><h2>{x.buscaT[0]} <span>{x.buscaT[1]}</span></h2><p>{x.buscaP}</p></div>
      <div className="acc">
        <a className="btn y" href={WA(x.buscaWa)} target="_blank" rel="noreferrer">{x.buscaB}</a>
        <a className="rep" href="/repuestos"><span>{x.rep}</span><span aria-hidden="true">→</span></a>
      </div>
    </div></div></section>
  </Marco>;
}
