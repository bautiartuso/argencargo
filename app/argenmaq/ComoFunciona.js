"use client";
// Cómo funciona (04/10/2026). Los mismos cinco pasos de la landing, con el detalle que necesita alguien
// que no nos conoce y va a pagar una máquina por una web: qué hace él, qué hacemos nosotros, cuánto
// paga y cuánto tarda cada paso; qué incluye el precio, cómo se paga, garantía y preguntas.
// Solo dice lo que hacemos: no hay inspección en fábrica ni video antes de embarcar.
import { useEffect, useRef, useState } from "react";
import { useAM, Marco, MONO, WA, Ico } from "./kit";
import { VisualPaso, CSS_VP, TXT_LANDING } from "./Landing";

const TILDE = ["M5 12l5 5L20 7"];
const CRUZ = ["M6 6l12 12", "M18 6L6 18"];
const MAS = ["M12 5v14", "M5 12h14"];

const CSS = `
.amq .cf-hero{padding:52px 0 34px}
.amq .cf-hero h1{font-size:clamp(40px,5.6vw,76px);letter-spacing:-0.05em;line-height:0.98;margin:0}
.amq .cf-hero p{font-size:19px;line-height:1.55;color:var(--gris);max-width:640px;margin:20px 0 0}
.amq .cf-indice{display:flex;gap:8px;flex-wrap:wrap;margin-top:28px}
.amq .cf-indice a{display:inline-flex;align-items:center;gap:9px;padding:9px 15px 9px 9px;border-radius:999px;border:1px solid var(--borde);background:var(--card);font-weight:700;font-size:14px}
.amq .cf-indice a b{width:28px;height:28px;border-radius:50%;background:var(--y);color:#15171A;font-family:${MONO};font-size:11.5px;display:inline-flex;align-items:center;justify-content:center}
.amq .cf-indice a:hover{border-color:var(--ink)}

.amq .cf-pasos{background:var(--y);color:#15171A;padding:56px 0 64px}
.amq .cf-pasos .grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:36px;align-items:start}
.amq .cf-lado{position:sticky;top:110px}
.amq .cf-lado h2{font-size:28px;letter-spacing:-0.035em;line-height:1.05;margin:0 0 20px}
.amq .cf-lado a{display:flex;align-items:center;gap:12px;padding:10px 0;font-weight:700;font-size:15px;opacity:0.5;transition:opacity 200ms}
.amq .cf-lado a.on{opacity:1}
.amq .cf-lado a span{width:34px;height:34px;border-radius:50%;border:2px solid rgba(21,23,26,0.3);display:inline-flex;align-items:center;justify-content:center;font-family:${MONO};font-size:12px;flex-shrink:0;transition:all 200ms}
.amq .cf-lado a.on span{background:#15171A;border-color:#15171A;color:var(--y)}
.amq .cf-lado a.hecho{opacity:0.85}.amq .cf-lado a.hecho span{border-color:#15171A}
.amq .cf-lista{display:grid;gap:22px}
.amq .cf-paso{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);background:#15171A;color:#fff;border-radius:28px;overflow:hidden;scroll-margin-top:110px;box-shadow:0 24px 50px rgba(21,23,26,0.22)}
.amq .cf-texto{padding:clamp(24px,3vw,40px)}
.amq .cf-num{display:flex;align-items:baseline;gap:14px;margin-bottom:14px}
.amq .cf-num b{font-size:48px;line-height:1;color:var(--y);letter-spacing:-0.04em}
.amq .cf-num span{font-family:${MONO};font-size:12.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--y);font-weight:600}
.amq .cf-texto h3{margin:0;font-size:clamp(22px,2.2vw,28px);letter-spacing:-0.025em;line-height:1.15}
.amq .cf-texto>p{margin:12px 0 0;color:#C2C7CC;font-size:15.5px;line-height:1.65}
.amq .cf-quien{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}
.amq .cf-quien div{padding:14px 16px;border-radius:16px;background:#202326;border:1px solid #2B2E33}
.amq .cf-quien h4{margin:0 0 8px;font-family:${MONO};font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#9DA3A9;font-weight:600}
.amq .cf-quien ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.amq .cf-quien li{display:flex;gap:9px;font-size:14px;line-height:1.4;color:#E4E6E8}
.amq .cf-quien li:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--y);flex-shrink:0;margin-top:7px}
.amq .cf-datos{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.amq .cf-datos span{display:inline-flex;gap:8px;align-items:center;padding:8px 13px;border-radius:999px;background:rgba(255,210,0,0.12);border:1px solid rgba(255,210,0,0.35);font-size:13px;color:#fff}
.amq .cf-datos span i{font-style:normal;font-family:${MONO};font-size:10.5px;letter-spacing:0.1em;color:var(--y)}
.amq .cf-visual{background:#1C1E21;border-left:1px solid #2B2E33;padding:clamp(20px,2.4vw,32px);display:flex;align-items:center}
${CSS_VP}

.amq .cf-sec{padding:64px 0 0}
.amq .cf-sec>.wrap>h2{font-size:clamp(28px,3.4vw,44px);letter-spacing:-0.04em;line-height:1.05;margin:0 0 8px}
.amq .cf-sec .lead{color:var(--gris);font-size:17px;line-height:1.5;margin:0 0 24px;max-width:680px}
.amq .cf-inc{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.amq .cf-inc>div{border-radius:24px;padding:26px 26px 22px;border:1px solid var(--borde);background:var(--card)}
.amq .cf-inc>div.si{background:var(--ysuave);border-color:var(--y)}
.amq .cf-inc h3{margin:0 0 14px;font-size:19px;letter-spacing:-0.02em}
.amq .cf-inc ul{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.amq .cf-inc li{display:flex;gap:11px;font-size:15px;line-height:1.45}
.amq .cf-inc li svg{flex-shrink:0;margin-top:2px}
.amq .cf-inc .si li svg{color:#1F7A2E}.amq .cf-inc .no li svg{color:var(--gris)}
.amq .cf-inc li small{display:block;color:var(--gris);font-size:13px;margin-top:2px}

.amq .cf-pago{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.amq .cf-cuota{border-radius:24px;padding:26px;background:#15171A;color:#fff;position:relative;overflow:hidden}
.amq .cf-cuota.dos{background:var(--suave);color:var(--ink);border:1px solid var(--borde)}
.amq .cf-cuota .n{font-family:${MONO};font-size:11.5px;letter-spacing:0.12em;color:var(--y);font-weight:600}
.amq .cf-cuota.dos .n{color:var(--gris)}
.amq .cf-cuota h3{margin:8px 0 6px;font-size:24px;letter-spacing:-0.025em}
.amq .cf-cuota p{margin:0;font-size:15px;line-height:1.55;opacity:0.82}
.amq .cf-cuota .cuando{display:inline-block;margin-top:14px;padding:7px 12px;border-radius:999px;background:var(--y);color:#15171A;font-weight:800;font-size:13px}
.amq .cf-cuota.dos .cuando{background:var(--ink);color:var(--bg)}
.amq .cf-medios{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.amq .cf-medios div{padding:16px 18px;border-radius:18px;border:1px solid var(--borde);background:var(--card)}
.amq .cf-medios b{display:block;font-size:15.5px}.amq .cf-medios span{display:block;margin-top:4px;font-size:13.5px;color:var(--gris);line-height:1.45}
.amq .cf-nota{margin:14px 0 0;padding:14px 18px;border-radius:16px;background:var(--suave);font-size:14px;color:var(--gris);line-height:1.5}
.amq .cf-nota b{color:var(--ink)}

.amq .cf-plazos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.amq .cf-plazos div{padding:22px;border-radius:22px;border:1px solid var(--borde);background:var(--card)}
.amq .cf-plazos b{display:block;font-size:34px;letter-spacing:-0.04em;line-height:1}
.amq .cf-plazos b small{font-size:15px;letter-spacing:0;color:var(--gris);font-weight:700;margin-left:4px}
.amq .cf-plazos h4{margin:12px 0 4px;font-size:16px}
.amq .cf-plazos p{margin:0;font-size:14px;color:var(--gris);line-height:1.5}

.amq .cf-faq{display:grid;gap:8px;max-width:900px}
.amq .cf-faq details{border:1px solid var(--borde);border-radius:18px;background:var(--card);padding:0 20px}
.amq .cf-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 0;font-weight:800;font-size:16px}
.amq .cf-faq summary::-webkit-details-marker{display:none}
.amq .cf-faq summary svg{flex-shrink:0;transition:transform 200ms}
.amq .cf-faq details[open] summary svg{transform:rotate(45deg)}
.amq .cf-faq details p{margin:0 0 18px;color:var(--gris);font-size:15px;line-height:1.6}
.amq .cf-faq details a{color:var(--ink);font-weight:700;text-decoration:underline;text-decoration-color:var(--y);text-decoration-thickness:2px}

.amq .cf-cta{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin:64px 0 30px;padding:34px 38px;border-radius:28px;background:#15171A;color:#fff}
.amq .cf-cta h2{margin:0;font-size:clamp(24px,3vw,36px);letter-spacing:-0.035em}
.amq .cf-cta p{margin:6px 0 0;color:#B9BEC4}
.amq .cf-cta .acc{display:flex;gap:10px;flex-wrap:wrap}

@media(max-width:1000px){.amq .cf-pasos .grid{grid-template-columns:1fr}.amq .cf-lado{display:none}}
@media(max-width:860px){
  .amq .cf-hero{padding:28px 0 22px}.amq .cf-hero p{font-size:16.5px}
  .amq .cf-pasos{padding:34px 0 40px}
  .amq .cf-paso{grid-template-columns:1fr;border-radius:22px}
  .amq .cf-visual{border-left:none;border-top:1px solid #2B2E33}
  .amq .cf-quien{grid-template-columns:1fr}
  .amq .cf-inc,.amq .cf-pago,.amq .cf-medios,.amq .cf-plazos{grid-template-columns:1fr}
  .amq .cf-cta{padding:26px 22px}
}
`;

const TXT = {
  es: {
    h1: "Cómo funciona",
    sub: "Comprar una máquina en ARGENMAQ, paso a paso: qué hacés vos, qué hacemos nosotros, cuánto pagás y cuánto tarda cada etapa.",
    pasosT: "Paso a paso",
    vos: "Vos", nos: "Nosotros", pagas: "PAGÁS", tarda: "TIEMPO",
    pasos: [
      { et: "Elegís tu máquina", t: "Elegís la máquina en el catálogo", p: "Cada máquina tiene fotos, ficha técnica, medidas y el precio final por cantidad. Si comprás más de una unidad, el precio por unidad baja. Si la que buscás no está en el catálogo, nos escribís y la buscamos con nuestras fábricas.", vos: ["Elegís la máquina y la cantidad", "Elegís cómo viaja: marítima o aérea, según la máquina", "La agregás al carrito"], nos: ["Te mostramos el precio final antes de pagar", "Te calculamos la fecha aproximada de llegada", "Respondemos tus dudas por WhatsApp"], paga: "Nada todavía", tiempo: "Lo que necesites" },
      { et: "Ves el precio final", t: "Un solo número, puesto en Argentina", p: "El precio que ves incluye la máquina, el flete internacional, los impuestos de importación y la gestión, puesto en nuestro depósito de CABA. Está en dólares y lo podés ver en pesos al dólar del día. No hay costos escondidos después.", vos: ["Comparás con lo que te cotizaron", "Consultás lo que necesites antes de decidir"], nos: ["Calculamos el costo completo de la importación", "Separamos el precio en dos pagos"], paga: "Nada todavía", tiempo: "Lo ves al instante" },
      { et: "Confirmás con el anticipo", t: "Con la primera cuota, la fábrica arranca", p: "Te creás una cuenta, cargás tus datos y elegís cómo pagar. Te escribimos por WhatsApp con los datos para el anticipo, que es el precio de la máquina. Cuando se acredita, la fábrica empieza a producirla. Tenés 24 horas desde la seña para arrepentirte sin costo.", vos: ["Creás tu cuenta y cargás tus datos", "Pagás el anticipo por transferencia, efectivo o cripto"], nos: ["Te pasamos los datos para pagar", "Hacemos el pedido a la fábrica", "Te mostramos la fecha estimada en tu cuenta"], paga: "1ª cuota: el precio de la máquina", tiempo: "Producción: entre 5 y 25 días según la máquina" },
      { et: "Viaja a Argentina", t: "Nos ocupamos de toda la importación", p: "Cuando la máquina está lista, sale de China por la vía que elegiste. Argencargo, nuestro equipo de logística internacional y despacho de aduana, coordina el flete, el seguro y la aduana. Vos seguís cada etapa desde tu cuenta y te avisamos por mail en cada cambio.", vos: ["Seguís el estado desde tu cuenta", "No tenés que hablar con nadie en China"], nos: ["Coordinamos el embarque y el flete", "Hacemos el despacho de aduana", "Te avisamos en cada etapa"], paga: "Nada en este paso", tiempo: "Marítima 60 a 70 días · aérea 7 a 10 días" },
      { et: "La recibís lista", t: "Pagás el saldo y la ponés a trabajar", p: "Cuando la máquina llega a Buenos Aires te avisamos y pagás la segunda cuota, que es la importación. La retirás sin cargo de nuestro depósito en CABA o te la enviamos a cualquier punto del país, con costo aparte. Todas se importan a 220 V.", vos: ["Pagás el saldo", "La retirás o recibís el envío"], nos: ["Te avisamos que llegó", "Coordinamos el retiro o el envío", "Gestionamos la garantía con la fábrica si hace falta"], paga: "2ª cuota: la importación", tiempo: "Cuando llega a Buenos Aires" },
    ],
    incT: "Qué incluye el precio", incS: "El precio final es puesto en nuestro depósito de CABA. Esto es lo que entra y lo que se cotiza aparte.",
    si: "Incluye", siL: [["La máquina", "Al precio de fábrica en China."], ["Flete internacional", "Marítimo o aéreo, según elijas."], ["Impuestos de importación", "Aranceles y tributos de aduana."], ["Despacho y gestión", "Todo el trámite lo hacemos nosotros."], ["Retiro en CABA", "Sin cargo, en nuestro depósito."]],
    no: "Se cotiza aparte", noL: [["Envío a tu dirección", "Te lo cotizamos según el destino."], ["Instalación y puesta en marcha", "Te podemos ayudar a conseguir un técnico."], ["Obra civil y conexiones", "Base, instalación eléctrica o de gas."], ["Maniobras especiales de descarga", "Grúa o autoelevador si la máquina lo necesita."]],
    pagoT: "Cómo pagás", pagoS: "Dos pagos: la máquina al confirmar y la importación cuando llega.",
    c1: ["1ª CUOTA · ANTICIPO", "El precio de la máquina", "Con esto la fábrica empieza a producirla.", "Al confirmar el pedido"],
    c2: ["2ª CUOTA · SALDO", "La importación", "Flete, impuestos y gestión de aduana.", "Cuando llega a Buenos Aires"],
    medios: [["Transferencia bancaria", "Te pasamos los datos de la cuenta al confirmar."], ["Efectivo", "En nuestra oficina de CABA, en dólares o en pesos."], ["Cripto", "Te pasamos los datos al confirmar."]],
    nota: ["24 horas para arrepentirte. ", "Desde la seña tenés 24 horas para cancelar sin costo. Después, la máquina entra en producción."],
    plazosT: "Cuánto tarda", plazosS: "Los plazos son estimados. En cada máquina ves la fecha aproximada de llegada.",
    plazos: [["5–25", "días", "Producción en fábrica", "Depende de la máquina. Está en cada ficha."], ["60–70", "días", "Viaje marítimo", "La vía más económica, para casi todas las máquinas."], ["7–10", "días", "Viaje aéreo", "Para máquinas livianas, cuando la ficha lo permite."]],
    garT: "Garantía y respaldo",
    garS: "Las máquinas tienen la garantía del fabricante, que en la mayoría es de 12 meses y figura en cada ficha. Cubre defectos de fabricación. El reclamo lo hacés con nosotros: ARGENMAQ lo gestiona con la fábrica y no tenés que tratar con nadie en China.",
    faqT: "Preguntas frecuentes",
    faq: [
      ["¿Tengo que ser importador o tener un despachante?", "No. La importación la hacemos nosotros con Argencargo. Vos comprás la máquina como en cualquier comercio y la recibís en Argentina."],
      ["¿Hay costos que no estén en el precio?", "El precio incluye la máquina, el flete, los impuestos de importación y la gestión, puesto en CABA. Lo único que se suma es lo que figura en \"Se cotiza aparte\": envío a domicilio, instalación, obra civil y descargas especiales."],
      ["¿Qué pasa si la máquina se demora?", "Los plazos son estimados y pueden extenderse por causas como demoras de fábrica, feriados en China o la aduana. Si pasa, te avisamos y lo ves en tu cuenta."],
      ["¿Puedo cancelar?", "Sí, dentro de las 24 horas desde la seña y sin costo. Después la máquina ya está en producción; mirá la política de devoluciones."],
      ["¿La máquina viene lista para enchufar en Argentina?", "Sí. Todas se importan a 220 V. La instalación y la puesta en marcha se cotizan aparte."],
      ["¿Y si la máquina que busco no está en el catálogo?", "Escribinos por WhatsApp: la buscamos con nuestras fábricas y te pasamos el precio final puesta en Argentina."],
      ["¿Consiguen repuestos?", "Sí, los gestionamos con la misma fábrica. Pedilos desde la sección Repuestos."],
    ],
    ctaT: "¿Listo para elegir tu máquina?", ctaS: "Mirá el catálogo o escribinos y te ayudamos.", b1: "Ver catálogo", b2: "Hablar por WhatsApp", wa: "Hola ARGENMAQ, tengo una consulta sobre cómo comprar una máquina",
    devol: "política de devoluciones", rep: "Repuestos",
  },
  en: {
    h1: "How it works",
    sub: "Buying a machine from ARGENMAQ, step by step: what you do, what we do, what you pay and how long each stage takes.",
    pasosT: "Step by step",
    vos: "You", nos: "Us", pagas: "YOU PAY", tarda: "TIME",
    pasos: [
      { et: "Pick your machine", t: "Pick the machine in the catalog", p: "Every machine has photos, specs, measurements and the final price by quantity. Buy more than one and the unit price drops. If what you need isn't there, message us and we'll source it with our factories.", vos: ["Pick the machine and quantity", "Choose how it ships: sea or air, depending on the machine", "Add it to the cart"], nos: ["We show the final price before you pay", "We estimate the arrival date", "We answer your questions on WhatsApp"], paga: "Nothing yet", tiempo: "As long as you need" },
      { et: "See the final price", t: "One number, landed in Argentina", p: "The price includes the machine, international freight, import taxes and handling, delivered to our Buenos Aires warehouse. It's in dollars and you can see it in pesos at today's rate. No hidden costs later.", vos: ["Compare with other quotes", "Ask anything before deciding"], nos: ["We calculate the full import cost", "We split the price into two payments"], paga: "Nothing yet", tiempo: "Instantly" },
      { et: "Confirm with a deposit", t: "The first instalment starts the factory", p: "Create an account, fill in your details and choose how to pay. We message you on WhatsApp with the deposit details: the deposit is the machine price. Once it clears, the factory starts production. You have 24 hours from the deposit to cancel at no cost.", vos: ["Create your account", "Pay the deposit by transfer, cash or crypto"], nos: ["We send you the payment details", "We place the order with the factory", "We show the estimated date in your account"], paga: "1st instalment: the machine price", tiempo: "Production: 5 to 25 days depending on the machine" },
      { et: "It ships to Argentina", t: "We handle the whole import", p: "When the machine is ready it leaves China by the method you chose. Argencargo, our international freight and customs team, coordinates freight, insurance and customs. You follow every stage from your account and we email you at each change.", vos: ["Follow the status from your account", "No need to talk to anyone in China"], nos: ["We coordinate shipping and freight", "We clear customs", "We update you at each stage"], paga: "Nothing at this step", tiempo: "Sea 60 to 70 days · air 7 to 10 days" },
      { et: "You get it ready", t: "Pay the balance and put it to work", p: "When the machine reaches Buenos Aires we let you know and you pay the second instalment: the import. Pick it up free of charge at our Buenos Aires warehouse or we ship it anywhere in the country at extra cost. Every machine is imported at 220 V.", vos: ["Pay the balance", "Pick it up or receive the delivery"], nos: ["We tell you it arrived", "We arrange pickup or delivery", "We handle the warranty with the factory if needed"], paga: "2nd instalment: the import", tiempo: "When it reaches Buenos Aires" },
    ],
    incT: "What the price includes", incS: "The final price is delivered to our Buenos Aires warehouse. Here's what's in and what's quoted separately.",
    si: "Includes", siL: [["The machine", "At factory price in China."], ["International freight", "Sea or air, your choice."], ["Import taxes", "Duties and customs taxes."], ["Customs and handling", "We do all the paperwork."], ["Pickup in Buenos Aires", "Free, at our warehouse."]],
    no: "Quoted separately", noL: [["Delivery to your address", "Quoted by destination."], ["Installation and start-up", "We can help you find a technician."], ["Civil works and connections", "Base, electrical or gas installation."], ["Special unloading", "Crane or forklift if needed."]],
    pagoT: "How you pay", pagoS: "Two payments: the machine on confirmation and the import on arrival.",
    c1: ["1ST · DEPOSIT", "The machine price", "This starts production at the factory.", "On confirmation"],
    c2: ["2ND · BALANCE", "The import", "Freight, taxes and customs handling.", "When it reaches Buenos Aires"],
    medios: [["Bank transfer", "We send the account details on confirmation."], ["Cash", "At our Buenos Aires office, in dollars or pesos."], ["Crypto", "We send the details on confirmation."]],
    nota: ["24 hours to change your mind. ", "From the deposit you have 24 hours to cancel at no cost. After that, the machine goes into production."],
    plazosT: "How long it takes", plazosS: "Times are estimates. Every machine shows its approximate arrival date.",
    plazos: [["5–25", "days", "Factory production", "Depends on the machine. Shown on each page."], ["60–70", "days", "Sea freight", "The cheapest option, for almost every machine."], ["7–10", "days", "Air freight", "For light machines, when the page allows it."]],
    garT: "Warranty and backing",
    garS: "Machines carry the manufacturer's warranty, 12 months for most, shown on each page. It covers manufacturing defects. You claim it with us: ARGENMAQ handles it with the factory, so you never deal with anyone in China.",
    faqT: "FAQ",
    faq: [
      ["Do I need to be an importer or have a customs broker?", "No. We handle the import with Argencargo. You buy the machine like in any store and receive it in Argentina."],
      ["Are there costs not included in the price?", "The price includes the machine, freight, import taxes and handling, delivered to Buenos Aires. Only the items under \"Quoted separately\" are added: home delivery, installation, civil works and special unloading."],
      ["What if the machine is delayed?", "Times are estimates and can extend due to factory delays, holidays in China or customs. If it happens, we let you know and you see it in your account."],
      ["Can I cancel?", "Yes, within 24 hours of the deposit at no cost. After that the machine is in production; see the returns policy."],
      ["Is the machine ready to plug in in Argentina?", "Yes. Every machine is imported at 220 V. Installation and start-up are quoted separately."],
      ["What if the machine I need isn't in the catalog?", "Message us on WhatsApp: we source it with our factories and send you the final landed price."],
      ["Can you get spare parts?", "Yes, we source them from the same factory. Request them in Spare parts."],
    ],
    ctaT: "Ready to pick your machine?", ctaS: "Browse the catalog or message us and we'll help.", b1: "See catalog", b2: "Chat on WhatsApp", wa: "Hi ARGENMAQ, I have a question about buying a machine",
    devol: "returns policy", rep: "Spare parts",
  },
};

export default function ComoFunciona({ fotos = [] }) {
  const { lang } = useAM();
  const x = TXT[lang] || (lang === "ru" ? TXT.en : TXT.es);
  const xv = TXT_LANDING[lang] || TXT_LANDING.es;
  const refs = useRef([]);
  const [activo, setActivo] = useState(0);
  useEffect(() => {
    const medir = () => {
      const lim = window.innerHeight * 0.45;
      let a = 0; refs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top < lim) a = i; });
      setActivo(a);
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true }); window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, []);
  const lnk = (t, href) => <a href={href}>{t}</a>;
  return <Marco actual="como">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="cf-hero"><div className="wrap">
      <h1>{x.h1}</h1>
      <p>{x.sub}</p>
      <nav className="cf-indice">{x.pasos.map((p, i) => <a key={p.et} href={`#paso-${i + 1}`}><b>0{i + 1}</b>{p.et}</a>)}</nav>
    </div></section>

    <section className="cf-pasos"><div className="wrap grid">
      <aside className="cf-lado">
        <h2>{x.pasosT}</h2>
        {x.pasos.map((p, i) => <a key={p.et} href={`#paso-${i + 1}`} className={i === activo ? "on" : i < activo ? "hecho" : ""}><span>{i < activo ? <Ico d={TILDE} size={15} /> : `0${i + 1}`}</span>{p.et}</a>)}
      </aside>
      <div className="cf-lista">{x.pasos.map((p, i) => <article key={p.et} id={`paso-${i + 1}`} className="cf-paso" ref={(el) => { refs.current[i] = el; }}>
        <div className="cf-texto">
          <div className="cf-num"><b>0{i + 1}</b><span>{p.et}</span></div>
          <h3>{p.t}</h3>
          <p>{p.p}</p>
          <div className="cf-quien">
            <div><h4>{x.vos}</h4><ul>{p.vos.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div><h4>{x.nos}</h4><ul>{p.nos.map((t) => <li key={t}>{t}</li>)}</ul></div>
          </div>
          <div className="cf-datos"><span><i>{x.pagas}</i>{p.paga}</span><span><i>{x.tarda}</i>{p.tiempo}</span></div>
        </div>
        <div className="cf-visual"><VisualPaso i={i} x={xv} fotos={fotos} /></div>
      </article>)}</div>
    </div></section>

    <section className="cf-sec"><div className="wrap">
      <h2>{x.incT}</h2><p className="lead">{x.incS}</p>
      <div className="cf-inc">
        <div className="si"><h3>{x.si}</h3><ul>{x.siL.map(([a, b]) => <li key={a}><Ico d={TILDE} size={18} /><span><b>{a}</b><small>{b}</small></span></li>)}</ul></div>
        <div className="no"><h3>{x.no}</h3><ul>{x.noL.map(([a, b]) => <li key={a}><Ico d={MAS} size={18} /><span><b>{a}</b><small>{b}</small></span></li>)}</ul></div>
      </div>
    </div></section>

    <section className="cf-sec"><div className="wrap">
      <h2>{x.pagoT}</h2><p className="lead">{x.pagoS}</p>
      <div className="cf-pago">
        <div className="cf-cuota"><span className="n">{x.c1[0]}</span><h3>{x.c1[1]}</h3><p>{x.c1[2]}</p><span className="cuando">{x.c1[3]}</span></div>
        <div className="cf-cuota dos"><span className="n">{x.c2[0]}</span><h3>{x.c2[1]}</h3><p>{x.c2[2]}</p><span className="cuando">{x.c2[3]}</span></div>
      </div>
      <div className="cf-medios">{x.medios.map(([a, b]) => <div key={a}><b>{a}</b><span>{b}</span></div>)}</div>
      <p className="cf-nota"><b>{x.nota[0]}</b>{x.nota[1]}</p>
    </div></section>

    <section className="cf-sec"><div className="wrap">
      <h2>{x.plazosT}</h2><p className="lead">{x.plazosS}</p>
      <div className="cf-plazos">{x.plazos.map(([n, u, t, d]) => <div key={t}><b>{n}<small>{u}</small></b><h4>{t}</h4><p>{d}</p></div>)}</div>
    </div></section>

    <section className="cf-sec"><div className="wrap">
      <h2>{x.garT}</h2><p className="lead" style={{ marginBottom: 0 }}>{x.garS}</p>
    </div></section>

    <section className="cf-sec"><div className="wrap">
      <h2 style={{ marginBottom: 20 }}>{x.faqT}</h2>
      <div className="cf-faq">{x.faq.map(([q, a], i) => <details key={q}><summary>{q}<Ico d={MAS} size={18} /></summary><p>{a}{i === 3 && <> {lnk(x.devol, "/devoluciones")}.</>}{i === 6 && <> {lnk(x.rep, "/repuestos")}.</>}</p></details>)}</div>
    </div></section>

    <div className="wrap"><div className="cf-cta">
      <div><h2>{x.ctaT}</h2><p>{x.ctaS}</p></div>
      <div className="acc"><a className="btn y" href="/catalogo">{x.b1} →</a><a className="btn" href={WA(x.wa)} target="_blank" rel="noreferrer" style={{ background: "transparent", color: "#fff", borderColor: "#3A3D42" }}>{x.b2}</a></div>
    </div></div>
  </Marco>;
}
