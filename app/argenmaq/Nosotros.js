"use client";
// Quiénes somos de ARGENMAQ. Estructura tomada de b2box.app/ar/nosotros: titular editorial con una
// idea, bloque oscuro con el problema, números, cómo lo resolvemos, las dos puntas de la operación,
// la pertenencia al grupo Argencargo (presente, sin ser el foco) y cierre.
import { useAM, Marco, MONO, WA } from "./kit";

const CSS = `
.amq .ns-hero{padding:56px 0 44px}
.amq .ns-kick{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid var(--borde);font-family:${MONO};font-size:12px;letter-spacing:0.06em;color:var(--gris);background:var(--card)}
.amq .ns-kick i{width:8px;height:8px;border-radius:50%;background:var(--y);display:inline-block;animation:pulso 1.6s infinite}
.amq .ns-h1{font-size:clamp(38px,6.2vw,80px);line-height:0.98;letter-spacing:-0.045em;font-weight:800;margin:24px 0 0;max-width:980px}
.amq .ns-sub{font-size:19px;color:var(--gris);max-width:680px;margin:22px 0 0;line-height:1.5}
.amq .ns-prob{background:#15171A;color:#fff;border-radius:28px;padding:56px 48px;display:grid;grid-template-columns:1fr 1.25fr;gap:48px;align-items:start}
.amq .ns-prob h2{font-size:clamp(30px,4vw,50px);letter-spacing:-0.04em;line-height:1.02;margin:0;position:sticky;top:110px}
.amq .ns-prob h2 span{color:var(--y)}
.amq .ns-prob p{color:#C9CDD2;font-size:17px;line-height:1.55;margin:0}.amq .ns-prob p+p{margin-top:18px}.amq .ns-prob p b{color:#fff}
.amq .ns-nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:26px 0 0}
.amq .ns-num{border-top:2px solid var(--ink);padding-top:14px}
.amq .ns-num b{display:block;font-size:clamp(34px,4.4vw,56px);letter-spacing:-0.045em;line-height:1;font-weight:800}
.amq .ns-num b small{font-size:0.5em;letter-spacing:-0.02em;margin-left:4px;color:var(--gris);font-weight:700}
.amq .ns-num span{display:block;margin-top:8px;font-family:${MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gris)}
.amq .ns-sec{padding:64px 0 0}
.amq .ns-sec h2{font-size:clamp(28px,3.6vw,44px);letter-spacing:-0.04em;line-height:1.05;margin:0 0 8px}
.amq .ns-sec .ns-lead{color:var(--gris);font-size:17px;line-height:1.5;margin:0 0 26px;max-width:640px}
.amq .ns-sol{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.amq .ns-sol div{padding:20px 20px 22px;border-radius:20px;border:1px solid var(--borde);background:var(--card)}
.amq .ns-sol i{display:block;font-family:${MONO};font-style:normal;font-size:12px;letter-spacing:0.1em;color:var(--gris);margin-bottom:14px}
.amq .ns-sol i:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--y);margin-right:8px;vertical-align:-1px}
.amq .ns-sol b{display:block;font-size:17px;letter-spacing:-0.01em;margin-bottom:6px}.amq .ns-sol span{color:var(--gris);font-size:14.5px;line-height:1.5}
.amq .ns-puntas{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.amq .ns-punta{border-radius:22px;padding:26px 26px 28px;border:1px solid var(--borde);background:var(--card)}
.amq .ns-punta.china{background:#15171A;color:#fff;border-color:#15171A}
.amq .ns-punta .flag{font-size:26px;line-height:1;display:block;margin-bottom:12px}
.amq .ns-punta h3{margin:0;font-size:26px;letter-spacing:-0.03em}
.amq .ns-punta .que{display:block;margin-top:8px;font-family:${MONO};font-size:11.5px;letter-spacing:0.08em;color:var(--gris)}.amq .ns-punta.china .que{color:var(--y)}
.amq .ns-punta p{margin:16px 0 0;font-size:15px;line-height:1.5;color:var(--gris)}.amq .ns-punta.china p{color:#C9CDD2}
.amq .ns-grupo{margin-top:64px;border-radius:24px;border:1px solid var(--borde);background:var(--suave);padding:30px 34px;display:grid;grid-template-columns:auto 1fr auto;gap:30px;align-items:center}
.amq .ns-grupo .logo{display:inline-flex;align-items:center;gap:9px}.amq .ns-grupo .logo img.iso{height:30px}.amq .ns-grupo .logo img.txt{height:18px}
.amq .ns-grupo .logo img.oscuro{display:none}.amq[data-tema="oscuro"] .ns-grupo .logo img.oscuro{display:inline}.amq[data-tema="oscuro"] .ns-grupo .logo img.claro{display:none}
.amq .ns-grupo .lbl{margin-bottom:6px}.amq .ns-grupo p{margin:0;font-size:15.5px;line-height:1.5;color:var(--gris)}.amq .ns-grupo p b{color:var(--ink)}
.amq .ns-cta{text-align:center;padding:90px 0 80px}.amq .ns-cta h2{font-size:clamp(34px,6vw,76px);letter-spacing:-0.05em;line-height:0.95;margin:0 0 20px}
@media(max-width:900px){.amq .ns-prob{grid-template-columns:1fr;padding:36px 26px;gap:22px}.amq .ns-prob h2{position:static}.amq .ns-nums{grid-template-columns:1fr 1fr}.amq .ns-sol{grid-template-columns:1fr 1fr}.amq .ns-puntas{grid-template-columns:1fr}.amq .ns-grupo{grid-template-columns:1fr;gap:16px;padding:24px 22px}}
@media(max-width:520px){.amq .ns-sol{grid-template-columns:1fr}.amq .ns-nums{gap:18px 12px}}
`;

const TXT = {
  es: {
    kick: "SOBRE ARGENMAQ",
    h1: ["Traer una máquina de China,", "sin ser importador."],
    sub: "ARGENMAQ importa maquinaria de fábricas en China y la entrega en Argentina con un precio final. Vos elegís y pagás la máquina; nosotros hacemos fábrica, control, importación y entrega.",
    probT: ["Traer una máquina está roto.", "Lo estamos arreglando."],
    prob: [
      ["Quien quiere traer una máquina hoy negocia con la fábrica en otro idioma, gira dólares a China sin haberla visto funcionar y después tiene que conseguir un forwarder, un despachante y alguien que la reciba. ", "Cada uno con su tiempo, su lenguaje y su factura."],
      ["El problema no es la fábrica ni el despachante. El problema es que nadie se hace cargo del todo: ", "el que compra termina siendo el importador de su propia máquina, sin serlo."],
      ["ARGENMAQ hace todo eso como una sola operación. ", "Precio final antes de pagar, video de la máquina funcionando antes de embarcar y una sola cara con quien hablar si algo pasa."],
    ],
    nums: { maq: "máquinas en catálogo", rub: "rubros", ops: "operaciones del grupo", h: "para arrepentirte después de la seña" },
    solT: "Qué resolvemos",
    solS: "Cuatro cosas que hoy el que importa por su cuenta tiene que pelear solo.",
    sol: [["01", "Precio final antes de pagar", "Máquina, flete, seguro, aduana y depósito en un solo número, puesto en CABA. Sin sorpresas después."], ["02", "Pagás en dos veces", "Al confirmar pagás la máquina y la fábrica arranca. La importación se abona cuando llega a Buenos Aires."], ["03", "La ves funcionar antes de embarcar", "Antes de que salga de fábrica te mandamos foto o video de tu máquina andando."], ["04", "Una sola cara", "Si algo pasa hablás con ARGENMAQ, no con la fábrica. Seguís cada hito desde tu cuenta."]],
    puntasT: "Dos puntas, una operación.",
    puntasS: "La máquina se controla donde se fabrica y se entrega donde la vas a usar.",
    china: ["China", "FÁBRICAS · PRODUCCIÓN · CONTROL", "Trabajamos con fábricas que ya producen las máquinas del catálogo. Cada unidad se controla y se filma funcionando antes de embarcar."],
    baires: ["Buenos Aires", "OFICINA · DEPÓSITO · ENTREGA", "Oficina y depósito propios en CABA. Retirás sin cargo o te la enviamos a cualquier punto del país."],
    grupoK: "PARTE DEL GRUPO ARGENCARGO",
    grupoP: ["La importación de cada máquina la hace Argencargo: ", "flete, seguro y aduana con un equipo que opera importaciones desde Buenos Aires todos los días. ARGENMAQ es su división de maquinaria."],
    grupoB: "Conocer Argencargo",
    ctaT: "Contanos qué máquina necesitás.",
    ctaP: "Te decimos cuánto sale puesta en Argentina y, si te cierra, arrancamos.",
    b1: "Ver el catálogo", b2: "Hablar por WhatsApp",
    wa: "Hola ARGENMAQ, quiero saber cuánto sale una máquina puesta en Argentina",
  },
  en: {
    kick: "ABOUT ARGENMAQ",
    h1: ["Bring a machine from China,", "without being an importer."],
    sub: "ARGENMAQ imports machinery from factories in China and delivers it in Argentina at a final price. You choose and pay for the machine; we handle factory, quality check, import and delivery.",
    probT: ["Bringing a machine in is broken.", "We're fixing it."],
    prob: [
      ["Whoever wants a machine today negotiates with the factory in another language, wires dollars to China without seeing it run, and then has to find a forwarder, a customs broker and someone to receive it. ", "Each with their own timing, language and invoice."],
      ["The problem isn't the factory or the broker. The problem is that nobody owns the whole thing: ", "the buyer ends up being the importer of their own machine, without being one."],
      ["ARGENMAQ runs all of that as a single operation. ", "Final price before you pay, video of the machine running before shipping, and one face to talk to if anything happens."],
    ],
    nums: { maq: "machines in the catalog", rub: "trades", ops: "group operations", h: "to change your mind after the deposit" },
    solT: "What we solve",
    solS: "Four things anyone importing on their own has to fight alone today.",
    sol: [["01", "Final price before paying", "Machine, freight, insurance, customs and warehouse in one number, landed in Buenos Aires. No surprises later."], ["02", "Pay in two parts", "On confirmation you pay for the machine and the factory starts. Import costs are paid when it reaches Buenos Aires."], ["03", "See it run before shipping", "Before it leaves the factory we send you a photo or video of your machine working."], ["04", "One face", "If anything happens you talk to ARGENMAQ, not the factory. Follow every milestone from your account."]],
    puntasT: "Two ends, one operation.",
    puntasS: "The machine is checked where it's made and delivered where you'll use it.",
    china: ["China", "FACTORIES · PRODUCTION · QC", "We work with factories already producing the machines in the catalog. Each unit is checked and filmed running before shipping."],
    baires: ["Buenos Aires", "OFFICE · WAREHOUSE · DELIVERY", "Our own office and warehouse in Buenos Aires. Pick up free of charge or we ship anywhere in the country."],
    grupoK: "PART OF THE ARGENCARGO GROUP",
    grupoP: ["Every machine is imported by Argencargo: ", "freight, insurance and customs by a team that runs imports from Buenos Aires every day. ARGENMAQ is its machinery division."],
    grupoB: "About Argencargo",
    ctaT: "Tell us which machine you need.",
    ctaP: "We'll tell you the landed price in Argentina and, if it works for you, we start.",
    b1: "See the catalog", b2: "Chat on WhatsApp",
    wa: "Hi ARGENMAQ, I'd like to know the landed price of a machine in Argentina",
  },
  ru: {
    kick: "О КОМПАНИИ ARGENMAQ",
    h1: ["Привезти машину из Китая,", "не будучи импортёром."],
    sub: "ARGENMAQ импортирует оборудование с заводов Китая и доставляет его в Аргентину по итоговой цене. Вы выбираете и оплачиваете машину; завод, контроль, импорт и доставку берём на себя мы.",
    probT: ["Привезти машину сегодня сложно.", "Мы это исправляем."],
    prob: [
      ["Тот, кто хочет привезти машину, договаривается с заводом на чужом языке, переводит доллары в Китай, не видя её в работе, а потом ищет экспедитора, таможенного брокера и того, кто её примет. ", "У каждого свои сроки, свой язык и свой счёт."],
      ["Проблема не в заводе и не в брокере. Проблема в том, что никто не отвечает за всё целиком: ", "покупатель становится импортёром собственной машины, не будучи им."],
      ["ARGENMAQ делает всё это как одну операцию. ", "Итоговая цена до оплаты, видео работающей машины перед отправкой и один контакт, если что-то случится."],
    ],
    nums: { maq: "машин в каталоге", rub: "отраслей", ops: "операций группы", h: "чтобы передумать после аванса" },
    solT: "Что мы решаем",
    solS: "Четыре вещи, с которыми тот, кто импортирует сам, сегодня борется в одиночку.",
    sol: [["01", "Итоговая цена до оплаты", "Машина, фрахт, страховка, таможня и склад — одна цифра, с доставкой в Буэнос-Айрес. Без сюрпризов."], ["02", "Оплата в два этапа", "При подтверждении вы платите за машину, и завод начинает. Импорт оплачивается по прибытии в Буэнос-Айрес."], ["03", "Видите её в работе до отправки", "Перед отгрузкой с завода мы присылаем фото или видео вашей работающей машины."], ["04", "Один контакт", "Если что-то случится, вы говорите с ARGENMAQ, а не с заводом. Каждый этап видно в аккаунте."]],
    puntasT: "Две точки, одна операция.",
    puntasS: "Машину проверяют там, где делают, и доставляют туда, где вы будете работать.",
    china: ["Китай", "ЗАВОДЫ · ПРОИЗВОДСТВО · КОНТРОЛЬ", "Мы работаем с заводами, которые уже производят машины из каталога. Каждую единицу проверяют и снимают в работе перед отправкой."],
    baires: ["Буэнос-Айрес", "ОФИС · СКЛАД · ДОСТАВКА", "Собственный офис и склад в Буэнос-Айресе. Самовывоз бесплатно или доставка в любую точку страны."],
    grupoK: "ЧАСТЬ ГРУППЫ ARGENCARGO",
    grupoP: ["Импорт каждой машины выполняет Argencargo: ", "фрахт, страховка и таможня силами команды, которая ежедневно ведёт импорт из Буэнос-Айреса. ARGENMAQ — её подразделение по оборудованию."],
    grupoB: "Об Argencargo",
    ctaT: "Расскажите, какая машина нужна.",
    ctaP: "Назовём цену с доставкой в Аргентину и, если подходит, начнём.",
    b1: "Каталог", b2: "Написать в WhatsApp",
    wa: "Здравствуйте, ARGENMAQ! Хочу узнать цену машины с доставкой в Аргентину",
  },
};

export default function Nosotros({ stats }) {
  const { lang } = useAM();
  const x = TXT[lang] || TXT.es;
  const ops = stats?.ops ? Math.floor(stats.ops / 10) * 10 : null;
  const nums = [
    stats?.maquinas >= 10 ? [stats.maquinas, "", x.nums.maq] : null,
    stats?.rubros ? [stats.rubros, "", x.nums.rub] : null,
    ops ? [ops, "+", x.nums.ops] : null,
    [24, "h", x.nums.h],
  ].filter(Boolean);
  return <Marco actual="quienes">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="ns-hero"><div className="wrap">
      <span className="ns-kick"><i /> {x.kick}</span>
      <h1 className="ns-h1">{x.h1[0]}<br /><span className="ac">{x.h1[1]}</span></h1>
      <p className="ns-sub">{x.sub}</p>
    </div></section>

    <section><div className="wrap">
      <div className="ns-prob">
        <h2>{x.probT[0]}<br /><span>{x.probT[1]}</span></h2>
        <div>{x.prob.map(([a, b]) => <p key={a}>{a}<b>{b}</b></p>)}</div>
      </div>
      <div className="ns-nums">{nums.map(([n, suf, l]) => <div className="ns-num" key={l}><b>{n.toLocaleString("es-AR")}<small>{suf}</small></b><span>{l}</span></div>)}</div>
    </div></section>

    <section className="ns-sec"><div className="wrap">
      <h2>{x.solT}</h2><p className="ns-lead">{x.solS}</p>
      <div className="ns-sol">{x.sol.map(([n, tt, d]) => <div key={n}><i>{n}</i><b>{tt}</b><span>{d}</span></div>)}</div>
    </div></section>

    <section className="ns-sec"><div className="wrap">
      <h2>{x.puntasT}</h2><p className="ns-lead">{x.puntasS}</p>
      <div className="ns-puntas">
        <div className="ns-punta china"><span className="flag" aria-hidden>🇨🇳</span><h3>{x.china[0]}</h3><span className="que">{x.china[1]}</span><p>{x.china[2]}</p></div>
        <div className="ns-punta"><span className="flag" aria-hidden>🇦🇷</span><h3>{x.baires[0]}</h3><span className="que">{x.baires[1]}</span><p>{x.baires[2]}</p></div>
      </div>
      <div className="ns-grupo">
        <a className="logo" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer" aria-label="Argencargo">
          <img className="iso claro" src="/argencargo/isotipo.png" alt="" /><img className="txt claro" src="/argencargo/texto.png" alt="Argencargo" />
          <img className="iso oscuro" src="/argencargo/isotipo-blanco.png" alt="" /><img className="txt oscuro" src="/argencargo/texto-blanco.png" alt="Argencargo" />
        </a>
        <div><p className="lbl">{x.grupoK}</p><p>{x.grupoP[0]}<b>{x.grupoP[1]}</b></p></div>
        <a className="btn" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer">{x.grupoB} →</a>
      </div>
    </div></section>

    <section className="ns-cta"><div className="wrap">
      <h2>{x.ctaT}</h2>
      <p style={{ color: "var(--gris)", fontSize: 18, margin: "0 auto 24px", maxWidth: 560 }}>{x.ctaP}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><a className="btn y" href="/catalogo">{x.b1}</a><a className="btn" href={WA(x.wa)} target="_blank" rel="noreferrer">{x.b2}</a></div>
    </div></section>
  </Marco>;
}
