.amq .orden .cab{display:flex;align-items:center;justify-content:space-between;padding:22px 24px 18px;border-bottom:1px solid var(--borde)}
.amq .orden .cuerpo{flex:1;overflow-y:auto;padding:4px 24px}
.amq .orden .item{padding:18px 0;border-bottom:1px solid var(--borde)}
.amq .orden .itemCab{display:grid;grid-template-columns:78px 1fr auto;gap:14px;align-items:start}
.amq .orden .item img,.amq .orden .item .sinFoto{width:78px;height:78px;object-fit:cover;border-radius:10px;border:1px solid var(--borde);background:#fff;display:block}
.amq .orden .itemPie{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px}
.amq .orden .pie{padding:16px 24px 22px;border-top:1px solid var(--borde);background:var(--card)}
.amq .orden .pagoBox{border-left:4px solid var(--y);background:var(--ysuave);border-radius:12px;padding:14px 16px;margin:12px 0 14px}
.amq[data-tema="oscuro"] .orden .pagoBox{background:#2A2708}
.amq .orden .pagoBox .cirI{width:30px;height:30px;border-radius:50%;background:var(--y);color:#15171A;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
"use client";
// Sitio público de ARGENMAQ: tema claro/oscuro, idioma (es/en/ru), moneda (USD/ARS con el blue + 5),
// sesión del cliente (la misma cuenta que Argencargo), carrito y el marco (nav + pie).
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AM_URL, WA_NUM } from "./_marca";

export const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
export const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";
export const WA = (m) => `https://wa.me/${WA_NUM}?text=${encodeURIComponent(m)}`;

// ── Estilos: variables por tema, tipografía Montserrat ────────────────────────────────────
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap');
.amq{--bg:#FFFFFF;--card:#FFFFFF;--ink:#15171A;--gris:#5B6066;--borde:#E6E7EA;--suave:#F4F5F7;--y:#FFD200;--ysuave:#FFF3B0;--yink:#15171A;--ok:#1F7A2E;--sombra:0 14px 40px rgba(0,0,0,0.08);font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;min-height:100vh;display:flow-root}
.amq[data-tema="oscuro"]{--bg:#141517;--card:#1C1E21;--ink:#F3F3F1;--gris:#9DA3A9;--borde:#2B2E33;--suave:#23262A;--ysuave:#3A3305;--ok:#7BD88F;--sombra:0 14px 40px rgba(0,0,0,0.35)}
html,body{overflow-x:clip!important}
.amq *{box-sizing:border-box}.amq a{color:inherit;text-decoration:none}.amq button{font-family:inherit}
.amq .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.amq .grupoWrap{display:flex;justify-content:center;padding:12px 16px 0}
.amq .grupo{display:inline-flex;gap:8px}
.amq .grupo a{width:236px;height:42px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#15171A;border:2px solid transparent;box-shadow:0 6px 18px rgba(0,0,0,0.12);transition:transform 140ms}
.amq .grupo a:hover{transform:translateY(-1px)}.amq .grupo a.on{border-color:var(--y)}
.amq[data-tema="oscuro"] .grupo a{background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.4)}
.amq .grupo img{width:auto;display:block}.amq .grupo .iso{height:22px}.amq .grupo .txt{height:15px}.amq .grupo .argc .iso{height:19px}.amq .grupo .argc .txt{height:12px}
.amq .nav{position:sticky;top:10px;z-index:30;padding:0 20px;margin:12px 0 0}
.amq .isla{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:20px;height:68px;padding:0 14px 0 22px;border-radius:999px;background:color-mix(in srgb,var(--card) 90%,transparent);backdrop-filter:blur(16px);border:1px solid var(--borde);box-shadow:0 12px 34px rgba(0,0,0,0.10)}
.amq[data-tema="oscuro"] .isla{box-shadow:0 12px 34px rgba(0,0,0,0.45)}
.amq .nav .links{display:flex;gap:22px;font-size:14.5px;font-weight:600;color:var(--gris);flex:1;justify-content:center}
.amq .nav .links a.on{color:var(--ink)}
.amq .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 22px;border-radius:999px;font-weight:800;font-size:14.5px;border:1px solid var(--borde);background:var(--card);color:var(--ink);cursor:pointer;transition:transform 120ms;white-space:nowrap}
.amq .btn:hover{transform:translateY(-1px)}.amq .btn.y{background:var(--y);border-color:var(--y);color:var(--yink)}.amq .btn.k{background:var(--ink);border-color:var(--ink);color:var(--bg)}.amq .btn.s{padding:9px 14px;font-size:13px}
.amq .ico{width:36px;height:36px;border-radius:50%;border:1px solid var(--borde);background:transparent;color:var(--gris);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-family:${MONO};font-size:11px;font-weight:600}
.amq .card{background:var(--card);border:1px solid var(--borde);border-radius:20px;overflow:hidden;transition:transform 140ms,box-shadow 140ms;display:block}
.amq .card:hover{transform:translateY(-3px);box-shadow:var(--sombra)}
.amq .carril{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 16px;scroll-snap-type:x proximity;scrollbar-width:thin}
.amq .carril>*{flex:0 0 260px;scroll-snap-align:start}
.amq .chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid var(--borde);background:var(--card);font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.amq .chip.on{background:var(--ysuave);border-color:var(--y)}
.amq .tag{display:inline-block;font-family:${MONO};font-size:10px;letter-spacing:0.1em;padding:4px 8px;border-radius:6px;background:var(--y);color:var(--yink);font-weight:600}
.amq .inp{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--borde);background:var(--card);color:var(--ink);font-size:14.5px;font-weight:600;outline:none}
.amq .inp:focus{border-color:var(--y);box-shadow:0 0 0 3px var(--ysuave)}
.amq .lbl{display:block;font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--gris);margin-bottom:7px}
.amq footer{background:#15171A;color:rgba(255,255,255,0.72);padding:46px 0 24px;font-size:13.5px;margin-top:44px}
.amq[data-tema="oscuro"] footer{background:#0E0F11;border-top:1px solid var(--borde)}
.amq footer .wrap{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:30px;align-items:start}
.amq footer h4{margin:0 0 12px;font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-weight:600}
.amq footer .col a{display:block;color:#fff;font-weight:600;margin:0 0 9px;font-size:14px}
.amq footer .col a:hover{color:var(--y)}
.amq footer .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.16);color:#fff;font-size:12.5px;font-weight:700;margin:0 6px 6px 0}
.amq footer .pill.on{background:var(--y);color:#15171A;border-color:var(--y)}
.amq footer .abajo{max-width:1180px;margin:30px auto 0;padding:18px 24px 0;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:${MONO};font-size:11px;color:rgba(255,255,255,0.45)}
.amq .buscaIsla{flex:1;display:flex;align-items:center;max-width:520px;margin:0 auto;position:relative}
.amq .buscaIsla input{width:100%;height:42px;border-radius:999px;border:1px solid var(--borde);background:var(--suave);padding:0 16px 0 40px;font-size:14px;font-weight:600;color:var(--ink);outline:none;font-family:inherit}
.amq .buscaIsla input:focus{border-color:var(--y);box-shadow:0 0 0 3px var(--ysuave)}
.amq .buscaIsla svg{position:absolute;left:15px;top:13px;color:var(--gris);pointer-events:none}
.amq .franja{overflow:hidden;max-width:1180px;margin:10px auto 0;padding:0 8px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
.amq .franjaPista{display:flex;gap:8px;width:max-content;animation:desfile 55s linear infinite}
.amq .franja:hover .franjaPista{animation-play-state:paused}
@keyframes desfile{to{transform:translateX(-50%)}}
.amq .pillIso{height:36px;padding:0 12px 0 9px;border-radius:999px;border:1px solid var(--borde);background:var(--card);color:var(--ink);display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-family:${MONO};font-size:11.5px;font-weight:700;letter-spacing:0.02em;transition:border-color 120ms,background 120ms}
.amq .pillIso:hover{border-color:var(--ink)}
.amq .pillIso img{width:20px;height:14px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,0.12)}
.amq .pillIso.tema{padding:0;width:36px;justify-content:center}
.amq .pillIso.tema.dia{color:#E0A800}.amq .pillIso.tema.noche{color:var(--ink)}
.amq .velo{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px)}
.amq .orden{position:fixed;top:0;right:0;bottom:0;z-index:71;width:min(480px,100%);background:var(--card);display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,0.25);animation:entrar 220ms ease}
@keyframes entrar{from{transform:translateX(100%)}to{transform:translateX(0)}}
.amq .orden .cab{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--borde)}
.amq .orden .cuerpo{flex:1;overflow-y:auto;padding:8px 22px}
.amq .orden .item{display:grid;grid-template-columns:72px 1fr auto;gap:12px;padding:16px 0;border-bottom:1px solid var(--borde);align-items:start}
.amq .orden .item img{width:72px;height:72px;object-fit:cover;border-radius:12px;background:var(--suave)}
.amq .orden .pie{padding:16px 22px 22px;border-top:1px solid var(--borde);background:var(--card)}
.amq .orden .pagoBox{border-left:4px solid var(--y);background:var(--ysuave);border-radius:12px;padding:12px 14px;margin:12px 0}
.amq[data-tema="oscuro"] .orden .pagoBox{background:#2A2708}
.amq .chkGrid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:34px;align-items:start}
.amq .pasos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 26px}
.amq .pasos div{height:5px;border-radius:999px;background:var(--borde)}
.amq .pasos div.hecho{background:var(--ink)}.amq .pasos div.actual{background:var(--y)}
.amq .pasos span{display:block;margin-top:6px;font-family:${MONO};font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--gris)}
.amq .pasos span.on{color:var(--ink);font-weight:700}
.amq .resumen{position:sticky;top:96px;border:1px solid var(--borde);border-radius:22px;background:var(--card);padding:18px 20px}
.amq .resumen .item{display:grid;grid-template-columns:56px 1fr auto;gap:12px;padding:12px 0;border-bottom:1px solid var(--borde);align-items:start}
.amq .resumen .item img{width:56px;height:56px;object-fit:cover;border-radius:10px;background:var(--suave)}
.amq .dosVeces{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.amq .dosVeces div{border:1px solid var(--borde);border-radius:14px;padding:12px}
.amq .dosVeces div.hoy{background:var(--ysuave);border-color:var(--y)}
.amq .opcion{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid var(--borde);border-radius:16px;cursor:pointer;background:transparent;color:var(--ink);text-align:left;font-family:inherit;width:100%}
.amq .opcion.on{border-color:var(--y);background:var(--ysuave)}
.amq .opcion .radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--gris);flex-shrink:0}
.amq .opcion.on .radio{border-color:var(--ink);background:var(--ink);box-shadow:inset 0 0 0 3px var(--ysuave)}
.amq .waPref{display:grid;grid-template-columns:132px 1fr;gap:8px}
@media(max-width:900px){.amq .chkGrid{grid-template-columns:1fr}.amq .resumen{position:static}}
.amq .catGrid{display:grid;grid-template-columns:250px minmax(0,1fr);gap:28px;align-items:start}
.amq .rubros{position:sticky;top:96px;border:1px solid var(--borde);border-radius:20px;padding:14px 8px;background:var(--card)}
.amq .rubros p{padding:0 12px}
.amq .rubros a{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;font-weight:700;font-size:14px}
.amq .rubros a:hover{background:var(--suave)}.amq .rubros a.on{background:var(--ysuave)}
.amq .rubros a span{font-family:${MONO};font-size:11px;color:var(--gris)}
.amq .rubros hr{border:none;border-top:1px solid var(--borde);margin:8px 4px}
.amq .galeriaMain{position:relative;aspect-ratio:1/1;border-radius:22px;overflow:hidden;background:var(--suave);cursor:zoom-in}
.amq .galeriaMain img{width:100%;height:100%;object-fit:cover;display:block}
.amq .galeriaAcc{position:absolute;top:14px;right:14px;display:flex;gap:8px}
.amq .redondo{width:44px;height:44px;border-radius:50%;border:1px solid var(--borde);background:var(--card);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.12)}
.amq .redondo.on{background:#FF5A3C;border-color:#FF5A3C;color:#fff}
.amq .flecha{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid var(--borde);background:var(--card);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;line-height:1;box-shadow:0 6px 18px rgba(0,0,0,0.12)}
.amq .flecha.izq{left:14px}.amq .flecha.der{right:14px}
.amq .contador{position:absolute;left:14px;bottom:14px;font-family:${MONO};font-size:11px;padding:5px 10px;border-radius:999px;background:rgba(21,23,26,0.72);color:#fff}
.amq .miniaturas{display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:4px}
.amq .miniaturas button{flex:0 0 78px;height:62px;border-radius:12px;overflow:hidden;border:2px solid transparent;padding:0;background:var(--suave);cursor:pointer}
.amq .miniaturas button.on{border-color:var(--y)}
.amq .miniaturas img{width:100%;height:100%;object-fit:cover;display:block}
.amq .luz{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px}
.amq .luzCaja{position:relative;width:min(1100px,100%);max-height:96vh;background:var(--card);border-radius:26px;padding:18px;display:flex;flex-direction:column;gap:12px}
.amq .luzImg{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:var(--suave);border-radius:18px;overflow:hidden;position:relative}
.amq .luzImg img{max-width:100%;max-height:72vh;object-fit:contain;display:block}
.amq .fichaGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:34px;align-items:start}
.amq .cajaPrecio{border:1px solid var(--borde);border-radius:22px;padding:20px 22px;background:var(--card)}
.amq .tramos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 12px}
.amq .tramo{text-align:left;padding:12px 12px;border-radius:14px;border:1.5px solid var(--borde);background:transparent;color:var(--ink);cursor:pointer;font-family:inherit}
.amq .tramo.on{border-color:var(--y);background:var(--ysuave)}
.amq .tramo small{display:block;font-size:11.5px;color:var(--gris);font-weight:600;margin-top:2px}
.amq .tramo b{display:block;font-size:19px;letter-spacing:-0.02em;margin-top:3px}
.amq .tramo .desc{display:inline-block;font-family:${MONO};font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--y);color:#15171A;margin-top:6px}
.amq .granCard{border:1px solid var(--borde);border-radius:24px;padding:24px 26px;background:var(--card)}
.amq .detCard h3 .cir{width:34px;height:34px;border-radius:50%;background:var(--y);color:#15171A;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.amq .btn.verde{background:#22C55E;border-color:#22C55E;color:#062B14}
.amq .stepper{display:inline-flex;align-items:center;border:1px solid var(--borde);border-radius:999px;overflow:hidden;height:46px}
.amq .stepper button{width:44px;height:46px;border:none;background:transparent;color:var(--ink);font-size:20px;cursor:pointer;font-family:inherit}
.amq .stepper button:disabled{opacity:0.3;cursor:not-allowed}
.amq .stepper input{width:56px;height:46px;border:none;background:transparent;text-align:center;font-weight:800;font-size:16px;color:var(--ink);outline:none;font-family:inherit}
.amq .detGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.amq .detCard{border:1px solid var(--borde);border-radius:18px;padding:16px 18px;background:var(--card)}
.amq .detCard h3{margin:0 0 10px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:10px}
.amq .detCard .fila{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--borde);font-size:14px}
.amq .detCard .fila span:first-child{color:var(--gris)}
.amq .detCard .fila b{font-weight:700}
.amq .modoBtn{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:12px;border:1.5px solid var(--borde);background:transparent;color:var(--ink);cursor:pointer;text-align:left;font-family:inherit;min-width:150px}
.amq .modoBtn.on{border-color:var(--y);background:var(--ysuave)}
.amq .modoBtn small{font-size:11.5px;color:var(--gris);font-family:${MONO}}
.amq .h1{font-size:clamp(40px,8vw,104px);line-height:0.94;letter-spacing:-0.05em;font-weight:800;margin:0}
.amq .h2{font-size:clamp(28px,4vw,46px);letter-spacing:-0.04em;font-weight:800;margin:0;line-height:1.05}
.amq .ac{background:var(--y);color:#15171A;padding:0 0.12em;border-radius:0.12em;display:inline-block;transform:rotate(-1.2deg)}
.amq .fab{position:fixed;right:18px;bottom:18px;z-index:35;width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,0.25)}
@keyframes pulso{0%,100%{box-shadow:0 0 0 0 rgba(255,210,0,0.6)}70%{box-shadow:0 0 0 9px rgba(255,210,0,0)}}
@keyframes correr{to{stroke-dashoffset:-400}}
@keyframes viajar{0%{offset-distance:0%}100%{offset-distance:100%}}
@keyframes subir{0%{transform:scaleY(0.2)}100%{transform:scaleY(1)}}
@keyframes girar{to{transform:rotate(360deg)}}
@keyframes tick{0%,100%{opacity:0.2}50%{opacity:1}}
@keyframes flotar{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media(max-width:560px){.amq footer .wrap{grid-template-columns:1fr}}
@media(max-width:900px){.amq .nav .links{display:none}.amq footer .wrap{grid-template-columns:1fr 1fr}.amq .catGrid{grid-template-columns:1fr}.amq .rubros{position:static;display:flex;overflow-x:auto;gap:4px;padding:8px}.amq .rubros p{display:none}.amq .rubros a{white-space:nowrap}.amq .fichaGrid{grid-template-columns:1fr}.amq .tramos{grid-template-columns:1fr}.amq .buscaIsla{max-width:none}.amq .grupo a{width:168px;height:36px;padding:0 10px;gap:7px}.amq .grupo .iso{height:18px}.amq .grupo .txt{height:12px}.amq .grupo .argc .iso{height:15px}.amq .grupo .argc .txt{height:10px}.amq .carril>*{flex-basis:220px}.amq .nav{padding:0 12px}.amq .isla{height:62px;padding:0 10px 0 14px;gap:10px}}
`;

// ── Idiomas ───────────────────────────────────────────────────────────────────────────────
const T = {
  es: { catalogo:"Catálogo", como:"Cómo funciona", quienes:"Quiénes somos", ingresar:"Ingresar", cuenta:"Mi cuenta", carrito:"Carrito", salir:"Salir",
    verPrecio:"Ingresá para ver el precio", precioPuesto:"Precio puesto en nuestro depósito de CABA", envioAdicional:"Envío a domicilio adicional · retiro sin cargo",
    viaAerea:"Vía aérea", viaMaritima:"Vía marítima", tiempo:"Tiempo estimado", dias:"días", agregar:"Agregar al carrito", agregado:"En el carrito", verCarrito:"Ver carrito",
    consultar:"Consultar por WhatsApp", grupo:"Una empresa del grupo Argencargo", verTodo:"Ver todas", sinMaquinas:"Todavía no hay máquinas en este rubro.", buscar:"Buscar máquina…",
    nueva:"Nueva", usada:"Usada", masPedida:"Más pedida", garantia:"Garantía de fábrica", meses:"meses", produccion:"producción", noEsta:"¿No encontrás tu máquina?", noEstaSub:"Escribinos y la buscamos.",
    crear:"Crear cuenta", tengo:"Ya tengo cuenta", email:"Email", pass:"Contraseña", entrar:"Entrar", registrarse:"Registrarme",
    vacio:"Tu carrito está vacío.", pedir:"Confirmar pedido", pedido:"Pedido", total:"Total", cantidad:"Cantidad", quitar:"Quitar", misOps:"Mis operaciones", seguimiento:"Seguimiento", datos:"Mis datos",
    pieClaim:"Tu próxima máquina, resuelta de punta a punta.", pieSub:"Operación propia con Argencargo. Entrega en todo el país.", pais:"País", metodosPago:"Métodos de pago", transferencia:"Transferencia bancaria", efectivo:"Efectivo", cripto:"Cripto", comprar:"Comprar", comoComprar:"¿Cómo comprar?", nuestrasMaquinas:"Nuestras máquinas", paraTuNegocio:"Para tu negocio", grupoArg:"Grupo Argencargo", soporte:"Soporte", legal:"Legal", devoluciones:"Política de devoluciones", politicaCompra:"Política de compra", precioVolumen:"Precio por cantidad · final, sin sorpresas", inicial:"Inicial", precioUnit:"Precio unitario", unidades:"unidades", unidad:"unidad", desde:"desde", minimo:"Mínimo", precioTotal:"Precio total", llega:"Llega en", anticipoNota:"Anticipo hoy · saldo al llegar", volver:"Volver", inicio:"Inicio", rubros:"Rubros", todosRubros:"Todos los rubros", resultados:"Resultados para", detalles:"Detalles técnicos", producto:"Producto", codigo:"Código", categoria:"Categoría", subcategoria:"Subcategoría", condicion:"Condición", medidas:"Medidas de la máquina", largo:"Largo", ancho:"Ancho", alto:"Alto", peso:"Peso", packing:"Packing", bultos:"Bultos", bulto:"Bulto", descripcion:"Descripción", similares:"Máquinas similares", compartir:"Compartir", guardarFav:"Guardar", guardada:"Guardada", copiado:"Link copiado", sinDato:"A confirmar", viaEnvio:"Cómo viaja", noDisponibleQty:"No disponible para esa cantidad", tuOrden:"Tu orden", ahoraAlConfirmar:"Ahora, al confirmar", alLlegar:"Al llegar", totalPedido:"Total del pedido", procederPago:"Proceder al pago", comprarAhora:"Comprar ahora", consultarWa:"Consultar por WhatsApp", anticipo:"Anticipo", alRecibir:"Al recibir", misDatos:"Mis datos", guardarDatos:"Guardar datos", datosOk:"Datos guardados", completaDatos:"Completá tus datos para poder pedir.", seguirComprando:"Seguir comprando", paso:"Paso", envio:"Envío", pago:"Pago", confirmacion:"Confirmación", infoContacto:"Información de contacto", continuarEntrega:"Continuar al método de entrega", metodoEntrega:"Método de entrega", metodoEntregaSub:"Elegí cómo viaja cada máquina.", continuarPago:"Continuar al pago", elegiPago:"Elegí cómo querés pagar", transferenciaSub:"Te pasamos los datos de la cuenta al confirmar.", queCompras:"Qué estás comprando", lasCuentas:"Las cuentas", subtotal:"Subtotal", seDosVeces:"Se paga en dos veces", hoy:"Hoy", conEstoArranca:"Con esto arranca la producción en fábrica.", teAvisamos:"Te avisamos antes. Aprox.", confirmarPedido:"Confirmar pedido", volverDireccion:"Volver a los datos", volverEnvio:"Volver al envío", codigoPais:"Código de país", numero:"Número", legalT:"Términos y condiciones", legalP:"Política de privacidad", legalL:"Aviso legal" },
  en: { catalogo:"Catalog", como:"How it works", quienes:"About us", ingresar:"Sign in", cuenta:"My account", carrito:"Cart", salir:"Sign out",
    verPrecio:"Sign in to see the price", precioPuesto:"Price delivered to our warehouse in Buenos Aires", envioAdicional:"Home delivery extra · free pickup",
    viaAerea:"By air", viaMaritima:"By sea", tiempo:"Estimated time", dias:"days", agregar:"Add to cart", agregado:"In cart", verCarrito:"View cart",
    consultar:"Ask on WhatsApp", grupo:"A company of the Argencargo group", verTodo:"See all", sinMaquinas:"No machines in this category yet.", buscar:"Search machine…",
    nueva:"New", usada:"Used", masPedida:"Most requested", garantia:"Factory warranty", meses:"months", produccion:"production", noEsta:"Can't find your machine?", noEstaSub:"Message us and we'll source it.",
    crear:"Create account", tengo:"I have an account", email:"Email", pass:"Password", entrar:"Sign in", registrarse:"Sign up",
    vacio:"Your cart is empty.", pedir:"Confirm order", pedido:"Order", total:"Total", cantidad:"Quantity", quitar:"Remove", misOps:"My operations", seguimiento:"Tracking", datos:"My details",
    pieClaim:"Your next machine, sorted end to end.", pieSub:"Run in-house with Argencargo. Delivery nationwide.", pais:"Country", metodosPago:"Payment methods", transferencia:"Bank transfer", efectivo:"Cash", cripto:"Crypto", comprar:"Buy", comoComprar:"How to buy?", nuestrasMaquinas:"Our machines", paraTuNegocio:"For your business", grupoArg:"Argencargo Group", soporte:"Support", legal:"Legal", devoluciones:"Returns policy", politicaCompra:"Purchase policy", precioVolumen:"Volume pricing · final, no surprises", inicial:"Starting", precioUnit:"Unit price", unidades:"units", unidad:"unit", desde:"from", minimo:"Minimum", precioTotal:"Total price", llega:"Arrives in", anticipoNota:"Deposit today · balance on arrival", volver:"Back", inicio:"Home", rubros:"Categories", todosRubros:"All categories", resultados:"Results for", detalles:"Technical details", producto:"Product", codigo:"Code", categoria:"Category", subcategoria:"Subcategory", condicion:"Condition", medidas:"Machine dimensions", largo:"Length", ancho:"Width", alto:"Height", peso:"Weight", packing:"Packing", bultos:"Packages", bulto:"Package", descripcion:"Description", similares:"Similar machines", compartir:"Share", guardarFav:"Save", guardada:"Saved", copiado:"Link copied", sinDato:"To be confirmed", viaEnvio:"How it ships", noDisponibleQty:"Not available for that quantity", tuOrden:"Your order", ahoraAlConfirmar:"Now, on confirmation", alLlegar:"On arrival", totalPedido:"Order total", procederPago:"Proceed to payment", comprarAhora:"Buy now", consultarWa:"Ask on WhatsApp", anticipo:"Deposit", alRecibir:"On delivery", misDatos:"My details", guardarDatos:"Save details", datosOk:"Details saved", completaDatos:"Complete your details to order.", seguirComprando:"Keep shopping", paso:"Step", envio:"Shipping", pago:"Payment", confirmacion:"Confirmation", infoContacto:"Contact information", continuarEntrega:"Continue to delivery method", metodoEntrega:"Delivery method", metodoEntregaSub:"Choose how each machine ships.", continuarPago:"Continue to payment", elegiPago:"Choose how to pay", transferenciaSub:"We send you the bank details on confirmation.", queCompras:"What you are buying", lasCuentas:"The numbers", subtotal:"Subtotal", seDosVeces:"Paid in two parts", hoy:"Today", conEstoArranca:"This starts production at the factory.", teAvisamos:"We notify you first. Approx.", confirmarPedido:"Confirm order", volverDireccion:"Back to details", volverEnvio:"Back to shipping", codigoPais:"Country code", numero:"Number", legalT:"Terms and conditions", legalP:"Privacy policy", legalL:"Legal notice" },
  ru: { catalogo:"Каталог", como:"Как это работает", quienes:"О нас", ingresar:"Войти", cuenta:"Мой аккаунт", carrito:"Корзина", salir:"Выйти",
    verPrecio:"Войдите, чтобы увидеть цену", precioPuesto:"Цена с доставкой на наш склад в Буэнос-Айресе", envioAdicional:"Доставка на дом отдельно · самовывоз бесплатно",
    viaAerea:"Авиа", viaMaritima:"Морем", tiempo:"Ориентировочный срок", dias:"дней", agregar:"В корзину", agregado:"В корзине", verCarrito:"Открыть корзину",
    consultar:"Написать в WhatsApp", grupo:"Компания группы Argencargo", verTodo:"Смотреть все", sinMaquinas:"В этой категории пока нет машин.", buscar:"Поиск машины…",
    nueva:"Новая", usada:"Б/у", masPedida:"Популярная", garantia:"Гарантия завода", meses:"мес.", produccion:"производство", noEsta:"Не нашли свою машину?", noEstaSub:"Напишите нам — найдём.",
    crear:"Создать аккаунт", tengo:"У меня есть аккаунт", email:"Email", pass:"Пароль", entrar:"Войти", registrarse:"Зарегистрироваться",
    vacio:"Корзина пуста.", pedir:"Подтвердить заказ", pedido:"Заказ", total:"Итого", cantidad:"Количество", quitar:"Убрать", misOps:"Мои операции", seguimiento:"Отслеживание", datos:"Мои данные",
    pieClaim:"Ваша следующая машина — под ключ.", pieSub:"Собственная логистика с Argencargo. Доставка по всей стране.", pais:"Страна", metodosPago:"Способы оплаты", transferencia:"Банковский перевод", efectivo:"Наличные", cripto:"Крипто", comprar:"Купить", comoComprar:"Как купить?", nuestrasMaquinas:"Наши машины", paraTuNegocio:"Для бизнеса", grupoArg:"Группа Argencargo", soporte:"Поддержка", legal:"Правовая информация", devoluciones:"Политика возврата", politicaCompra:"Условия покупки", precioVolumen:"Цена по количеству · окончательная", inicial:"Базовая", precioUnit:"Цена за единицу", unidades:"шт.", unidad:"шт.", desde:"от", minimo:"Минимум", precioTotal:"Итого", llega:"Доставка через", anticipoNota:"Аванс сегодня · остаток по прибытии", volver:"Назад", inicio:"Главная", rubros:"Категории", todosRubros:"Все категории", resultados:"Результаты по запросу", detalles:"Технические данные", producto:"Товар", codigo:"Код", categoria:"Категория", subcategoria:"Подкатегория", condicion:"Состояние", medidas:"Габариты машины", largo:"Длина", ancho:"Ширина", alto:"Высота", peso:"Вес", packing:"Упаковка", bultos:"Мест", bulto:"Место", descripcion:"Описание", similares:"Похожие машины", compartir:"Поделиться", guardarFav:"Сохранить", guardada:"Сохранено", copiado:"Ссылка скопирована", sinDato:"Уточняется", viaEnvio:"Способ доставки", noDisponibleQty:"Недоступно для этого количества", tuOrden:"Ваш заказ", ahoraAlConfirmar:"Сейчас, при подтверждении", alLlegar:"По прибытии", totalPedido:"Итого заказа", procederPago:"Перейти к оплате", comprarAhora:"Купить сейчас", consultarWa:"Спросить в WhatsApp", anticipo:"Аванс", alRecibir:"При получении", misDatos:"Мои данные", guardarDatos:"Сохранить", datosOk:"Данные сохранены", completaDatos:"Заполните данные, чтобы заказать.", seguirComprando:"Продолжить покупки", paso:"Шаг", envio:"Доставка", pago:"Оплата", confirmacion:"Подтверждение", infoContacto:"Контактные данные", continuarEntrega:"К способу доставки", metodoEntrega:"Способ доставки", metodoEntregaSub:"Выберите, как едет каждая машина.", continuarPago:"К оплате", elegiPago:"Выберите способ оплаты", transferenciaSub:"Реквизиты пришлём при подтверждении.", queCompras:"Что вы покупаете", lasCuentas:"Расчёт", subtotal:"Подытог", seDosVeces:"Оплата в два этапа", hoy:"Сегодня", conEstoArranca:"С этого начинается производство.", teAvisamos:"Мы предупредим заранее. Ориентировочно", confirmarPedido:"Подтвердить заказ", volverDireccion:"Назад к данным", volverEnvio:"Назад к доставке", codigoPais:"Код страны", numero:"Номер", legalT:"Условия", legalP:"Конфиденциальность", legalL:"Правовая информация" },
};

// ── Contexto ──────────────────────────────────────────────────────────────────────────────
const Ctx = createContext(null);
export const useAM = () => useContext(Ctx);
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const jwtExp = (t) => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch { return 0; } };

export function Proveedor({ children }) {
  const [tema, setTemaSt] = useState("claro");
  const [lang, setLangSt] = useState("es");
  const [moneda, setMonedaSt] = useState("USD");
  const [tc, setTc] = useState(null);
  const [ses, setSes] = useState(null);      // {token, refresh, user}
  const [cliente, setCliente] = useState(null);
  const [carrito, setCarritoSt] = useState([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setTemaSt(leer("am_tema") === "oscuro" ? "oscuro" : "claro");
    const l = leer("am_lang"); if (["es", "en", "ru"].includes(l)) setLangSt(l);
    setMonedaSt(leer("am_moneda") === "ARS" ? "ARS" : "USD");
    try { setCarritoSt(JSON.parse(leer("am_carrito") || "[]")); } catch {}
    // La misma cuenta que Argencargo: si el portal ya tiene sesión (ac_s), la usamos.
    let s = null; try { s = JSON.parse(leer("am_s") || "null") || JSON.parse(leer("ac_s") || "null"); } catch {}
    if (s?.token) setSes({ token: s.token, refresh: s.refresh_token, user: s.user });
    fetch("/api/argenmaq/dolar").then((r) => r.json()).then((d) => { if (d?.tc) setTc(d.tc); }).catch(() => {});
    setListo(true);
  }, []);

  const setTema = (t) => { setTemaSt(t); guardar("am_tema", t); };
  const setLang = (l) => { setLangSt(l); guardar("am_lang", l); };
  const setMoneda = (m) => { setMonedaSt(m); guardar("am_moneda", m); };
  const setCarrito = (fn) => setCarritoSt((c) => { const n = typeof fn === "function" ? fn(c) : fn; guardar("am_carrito", JSON.stringify(n)); return n; });

  const sf = useCallback(async (p, o = {}) => { const r = await fetch(`${SB_URL}${p}`, { ...o, headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(o.headers || {}) } }); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; }, []);
  const guardarSes = (s) => { setSes(s); guardar("am_s", JSON.stringify(s ? { token: s.token, refresh_token: s.refresh, user: s.user } : null)); if (!s) try { localStorage.removeItem("am_s"); } catch {} };
  const refrescar = useCallback(async () => { if (!ses?.refresh) return null; const r = (await sf("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: ses.refresh }) })).body; if (r?.access_token) { const s2 = { token: r.access_token, refresh: r.refresh_token || ses.refresh, user: r.user || ses.user }; guardarSes(s2); return s2.token; } guardarSes(null); return null; }, [ses, sf]); // eslint-disable-line react-hooks/exhaustive-deps
  // Consulta REST con la sesión del cliente (si hay), renovando el token si venció.
  const dq = useCallback(async (t, { method = "GET", body, filters = "", prefer } = {}) => {
    let tk = ses?.token || null;
    if (tk && jwtExp(tk) && Date.now() > jwtExp(tk) - 60000) tk = (await refrescar()) || null;
    const pedir = (k) => sf(`/rest/v1/${t}${filters}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { ...(k ? { Authorization: `Bearer ${k}` } : {}), ...(prefer || method === "POST" || method === "PATCH" ? { Prefer: prefer || "return=representation" } : {}) } });
    let r = await pedir(tk); if (r.status === 401 && tk) { const nt = await refrescar(); if (nt) r = await pedir(nt); }
    if (r.status >= 400) throw new Error(r.body?.message || r.body?.error || `Error ${r.status}`);
    return r.body;
  }, [ses, sf, refrescar]);

  // Ficha del cliente (tabla clients de Argencargo) cuando hay sesión.
  useEffect(() => { if (!ses?.token || !listo) { setCliente(null); return; } (async () => { try { const r = await dq("clients", { filters: `?auth_user_id=eq.${ses.user?.id}&select=id,client_code,first_name,last_name,email,whatsapp,dni,cuit,company_name,tax_condition,street,floor_apt,city,province,postal_code&limit=1` }); setCliente(Array.isArray(r) && r[0] ? r[0] : null); } catch { setCliente(null); } })(); }, [ses?.token, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => { const r = (await sf("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })).body; if (!r?.access_token) throw new Error(r?.error_description || r?.msg || "Credenciales inválidas"); guardarSes({ token: r.access_token, refresh: r.refresh_token, user: r.user }); return r; };
  const salir = () => { guardarSes(null); setCliente(null); };
  const t = (k) => (T[lang] && T[lang][k]) || T.es[k] || k;
  const fmt = (usd) => { if (usd == null) return "—"; if (moneda === "ARS" && tc) return `$ ${Math.round(usd * tc).toLocaleString("es-AR")}`; return `USD ${Number(usd).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; };

  return <Ctx.Provider value={{ tema, setTema, lang, setLang, t, moneda, setMoneda, tc, fmt, ses, cliente, setCliente, login, salir, sf, dq, guardarSes, carrito, setCarrito, listo }}>
    <div className="amq" data-tema={tema === "oscuro" ? "oscuro" : undefined}><style dangerouslySetInnerHTML={{ __html: CSS }} />{children}</div>
  </Ctx.Provider>;
}

// ── Marco: barra del grupo + nav + pie ────────────────────────────────────────────────────
export function Logo({ alto = 34, blanco = false }) { const { tema } = useAM(); const inv = blanco || tema === "oscuro"; return <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><img src={inv ? "/argenmaq/isotipo-blanco.png" : "/argenmaq/isotipo.png"} alt="" style={{ height: alto, width: "auto" }} /><img src={inv ? "/argenmaq/texto-blanco.png" : "/argenmaq/texto.png"} alt="ARGENMAQ" style={{ height: alto * 0.62, width: "auto" }} /></span>; }
export function Ico({ d, size = 17 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d.map((x, i) => <path key={i} d={x} />)}</svg>; }


// ── Precios por cantidad: lo que ve el cliente, compartido por tarjetas, ficha, carrito y panel ──
import { escalonPara } from "../../lib/canales-maquinas";
export const precioVidriera = (pr) => {
  const e = pr?.escalera; const tr = e?.maritima?.[0] || e?.aerea?.[0];
  if (tr) return { unit: Number(tr.unit), via: tr.via, q: Number(tr.q) || 1 };
  const p = pr?.precios; if (!p) return null; let best = null;
  for (const k of Object.keys(p)) { const v = Number(p[k]?.total); if (Number.isFinite(v) && (best == null || v < best.unit)) best = { unit: v, via: k, q: 1 }; }
  return best;
};
// Los precios se leen solo con sesión (vista cat_maquinas_precios, RLS: authenticated).
export function usePrecios(ids) {
  const { ses, dq } = useAM();
  const [precios, setPrecios] = useState(null);
  const clave = (ids || []).join(",");
  useEffect(() => { if (!ses?.token || !clave) { setPrecios(null); return; } (async () => { try { const r = await dq("cat_maquinas_precios", { filters: `?select=id,precios,escalera&id=in.(${clave})` }); const o = {}; (Array.isArray(r) ? r : []).forEach((x) => { o[x.id] = x; }); setPrecios(o); } catch { setPrecios(null); } })(); }, [ses?.token, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return precios;
}
// Una línea del carrito con su escalón: cantidad efectiva, precio unitario, anticipo (máquina) y saldo (importación).
export const lineaCarrito = (i, precios) => { const pr = precios?.[i.id]; const esc = pr?.escalera; const modo = i.modo === "aerea" && esc?.aerea?.length ? "aerea" : "maritima"; const tramos = esc?.[modo] || []; const minQ = Number(tramos[0]?.q) || 1; const q = Math.max(minQ, i.qty || 1); const tr = escalonPara(tramos, q); const unit = tr ? Number(tr.unit) : (precioVidriera(pr)?.unit ?? null); return { modo, tramos, minQ, q, tr, unit, total: unit != null ? unit * q : null, anticipo: tr ? Number(tr.maquina) * q : null, saldo: tr ? Number(tr.argencargo) * q : null, via: tr?.via || null, esc }; };

// Panel lateral "Tu orden", como el de B2Box: se abre desde el carrito de la isla.
function PanelOrden({ onCerrar }) {
  const { t, fmt, ses, carrito, setCarrito, lang } = useAM();
  const precios = usePrecios(carrito.map((i) => i.id));
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onCerrar(); }; window.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [onCerrar]);
  const lineas = carrito.map((i) => ({ i, L: lineaCarrito(i, precios) }));
  const total = lineas.reduce((s, { L }) => s + (L.total || 0), 0);
  const anticipo = lineas.reduce((s, { L }) => s + (L.anticipo || 0), 0);
  const saldo = lineas.reduce((s, { L }) => s + (L.saldo || 0), 0);
  // Cuándo llega el saldo: producción de la máquina + viaje de la vía que le tocó, la más lejana del carrito.
  const diasMax = lineas.reduce((mx, { i, L }) => Math.max(mx, (L.via ? diasVia(L.via) : 60) + Number(i.dias_produccion || 0)), 0);
  const llega = new Date(Date.now() + Math.max(15, diasMax) * 864e5).toLocaleDateString(lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "es-AR", { day: "numeric", month: "long", year: "numeric" });
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const setQty = (id, q) => setCarrito((c) => c.map((x) => x.id === id ? { ...x, qty: Math.max(1, Math.round(q) || 1) } : x));
  const nU = carrito.reduce((s, i) => s + (i.qty || 1), 0);
  const TACHO = ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6", "M10 11v6", "M14 11v6"];
  return <><div className="velo" onClick={onCerrar} /><aside className="orden" role="dialog" aria-label={t("tuOrden")}>
    <div className="cab"><p style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("tuOrden")}</p><button className="ico" onClick={onCerrar} aria-label="Cerrar" style={{ width: 42, height: 42, fontSize: 15, background: "var(--suave)", border: "none" }}>✕</button></div>
    <div className="cuerpo">
      {carrito.length === 0 && <p style={{ color: "var(--gris)", padding: "24px 0" }}>{t("vacio")} <a href="/catalogo" style={{ fontWeight: 800 }} onClick={onCerrar}>{t("catalogo")} →</a></p>}
      {lineas.map(({ i, L }) => <div key={i.id} className="item">
        <div className="itemCab">
          <a href={`/m/${i.id}`}>{i.foto ? <img src={i.foto} alt="" /> : <div className="sinFoto" />}</a>
          <div style={{ minWidth: 0 }}><a href={`/m/${i.id}`} style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3, display: "block" }}>{i.nombre}</a><p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{i.codigo ? `${i.codigo} · ` : ""}{L.unit != null ? `${fmt(L.unit)} / ${t("unidad")}` : ""}{L.modo === "aerea" ? ` · ${t("viaAerea")}` : ""}</p></div>
          <button className="ico" style={{ width: 34, height: 34, border: "none" }} onClick={() => setCarrito((c) => c.filter((x) => x.id !== i.id))} aria-label={t("quitar")}><Ico d={TACHO} size={17} /></button>
        </div>
        <div className="itemPie">
          <div className="stepper" style={{ height: 40 }}><button style={{ height: 40, width: 40 }} onClick={() => setQty(i.id, L.q - 1)} disabled={L.q <= L.minQ}>−</button><input style={{ height: 40, width: 52 }} type="number" min={L.minQ} value={L.q} onChange={(e) => setQty(i.id, Number(e.target.value))} /><button style={{ height: 40, width: 40 }} onClick={() => setQty(i.id, L.q + 1)}>+</button></div>
          <div style={{ textAlign: "right" }}><p style={{ margin: 0, fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>{ses && L.total != null ? fmt(L.total) : "—"}</p><p style={{ margin: 0, fontFamily: MONO, fontSize: 10, color: "var(--gris)", letterSpacing: "0.1em" }}>TOTAL</p></div>
        </div>
      </div>)}
    </div>
    {carrito.length > 0 && <div className="pie">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}><span style={{ fontWeight: 800, fontSize: 16 }}>{t("totalPedido")}</span><b style={{ fontSize: 24, letterSpacing: "-0.02em" }}>{ses ? fmt(total) : "—"}</b></div>
      {ses && <div className="pagoBox">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span className="cirI"><Ico d={["M3 7h18v12H3z", "M3 11h18", "M7 15h3"]} size={15} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}><span style={{ fontWeight: 800, fontSize: 15.5 }}>{t("ahoraAlConfirmar")}</span><b style={{ fontSize: 21, letterSpacing: "-0.02em" }}>{fmt(anticipo)}</b></div>
            <p style={{ margin: "2px 0 10px", fontSize: 13, color: "var(--gris)" }}>{pct(anticipo)}% {t("total").toLowerCase()} · {t("anticipo").toLowerCase()}</p>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", fontSize: 13 }}><span style={{ color: "var(--gris)", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico d={["M3 5h18v16H3z", "M3 10h18", "M8 3v4", "M16 3v4"]} size={14} />{t("alLlegar")} · {llega} · {pct(saldo)}%</span><b style={{ fontSize: 15 }}>{fmt(saldo)}</b></div>
          </div>
        </div>
      </div>}
      {!ses && <p style={{ margin: "10px 0", fontSize: 13, color: "var(--gris)" }}>{t("verPrecio")}</p>}
      <a className="btn y" href={ses ? "/carrito" : "/cuenta?volver=/carrito"} style={{ width: "100%", height: 52 }}>{ses ? t("procederPago") : t("ingresar")}</a>
    </div>}
  </aside></>;
}

export function Marco({ actual, children, conGrupo, franja }) {
  const { tema, setTema, lang, setLang, t, moneda, setMoneda, tc, ses, cliente, carrito } = useAM();
  const n = carrito.reduce((s, i) => s + (i.qty || 1), 0);
  const inv = tema === "oscuro"; // pills invertidas respecto del fondo: oscuras sobre claro, blancas sobre oscuro
  const enTienda = actual === "catalogo";
  const [q, setQ] = useState("");
  useEffect(() => { try { setQ(new URLSearchParams(window.location.search).get("q") || ""); } catch {} }, []);
  const LUPA = ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"];
  const [orden, setOrden] = useState(false);
  const cerrarOrden = useCallback(() => setOrden(false), []);
  const BANDERA = { USD: "us", ARS: "ar", es: "es", en: "gb", ru: "ru" };
  const bandera = (k) => `https://flagcdn.com/w40/${BANDERA[k]}.png`;
  return <>
    {/* La barra del grupo (ARGENMAQ · ARGENCARGO) vive solo en la página principal (21/09/2026). */}
    {conGrupo && <div className="grupoWrap"><div className="grupo">
      <a className="on am" href="/" aria-label="ARGENMAQ"><img className="iso" src={inv ? "/argenmaq/isotipo.png" : "/argenmaq/isotipo-blanco.png"} alt="" /><img className="txt" src={inv ? "/argenmaq/texto.png" : "/argenmaq/texto-blanco.png"} alt="ARGENMAQ" /></a>
      <a className="argc" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer" aria-label="ARGENCARGO"><img className="iso" src={inv ? "/argencargo/isotipo.png" : "/argencargo/isotipo-blanco.png"} alt="" /><img className="txt" src={inv ? "/argencargo/texto.png" : "/argencargo/texto-blanco.png"} alt="ARGENCARGO" /></a>
    </div></div>}
    <header className="nav">
      <div className="isla">
        <a href="/" style={{ display: "flex", alignItems: "center" }}><Logo /></a>
        {enTienda
          ? <form className="buscaIsla" action="/catalogo" method="get" role="search"><Ico d={LUPA} size={16} /><input name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("buscar")} aria-label={t("buscar")} /></form>
          : <nav className="links">
            <a className={actual === "catalogo" ? "on" : ""} href="/catalogo">{t("catalogo")}</a>
            <a className={actual === "como" ? "on" : ""} href="/como-funciona">{t("como")}</a>
            <a className={actual === "quienes" ? "on" : ""} href="/quienes-somos">{t("quienes")}</a>
          </nav>}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="pillIso" onClick={() => setMoneda(moneda === "USD" ? "ARS" : "USD")} aria-label="Moneda"><img src={bandera(moneda)} alt="" /><span>{moneda === "USD" ? "US$" : "AR$"}</span></button>
          <button className="pillIso" onClick={() => setLang(lang === "es" ? "en" : lang === "en" ? "ru" : "es")} aria-label="Idioma"><img src={bandera(lang)} alt="" /><span>{lang.toUpperCase()}</span></button>
          <button className={`pillIso tema ${tema === "oscuro" ? "dia" : "noche"}`} onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")} aria-label="Tema">{tema === "oscuro" ? <Ico d={["M12 3v2", "M12 19v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M3 12h2", "M19 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]} size={15} /> : <Ico d={["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"]} size={15} />}</button>
          <a className="ico" href="/carrito" title={t("carrito")} style={{ position: "relative" }} onClick={(e) => { e.preventDefault(); setOrden(true); }}><Ico d={["M6 6h15l-1.5 8H7.5z", "M6 6L5 3H2", "M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"]} size={16} />{n > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--y)", color: "#15171A", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 6px" }}>{n}</span>}</a>
          <a className="btn s y" href="/cuenta">{ses ? (cliente?.first_name || t("cuenta")) : t("ingresar")}</a>
        </div>
      </div>
      {/* Rubros en desfile continuo debajo de la isla (dentro de una máquina), como las categorías de B2Box. */}
      {franja?.length > 0 && <div className="franja"><div className="franjaPista">{[...franja, ...franja].map((c, i) => <a key={`${c.slug}-${i}`} className="chip" href={`/catalogo/${c.slug}`}>{c.nombre}</a>)}</div></div>}
    </header>
    {orden && <PanelOrden onCerrar={cerrarOrden} />}
    {children}
    <footer>
      <div className="wrap">
        <div>
          <Logo alto={30} blanco />
          <p style={{ margin: "14px 0 4px", color: "var(--y)", fontWeight: 800, fontSize: 15 }}>{t("pieClaim")}</p>
          <p style={{ margin: "0 0 20px", fontSize: 13.5 }}>{t("pieSub")}</p>
          <h4>{t("pais")}</h4>
          <div style={{ marginBottom: 14 }}><span className="pill on">🇦🇷 Argentina</span></div>
          <h4>{t("metodosPago")}</h4>
          <div><span className="pill">{t("transferencia")}</span><span className="pill">{t("efectivo")}</span><span className="pill">{t("cripto")}</span></div>
        </div>
        <div className="col"><h4>{t("comprar")}</h4><a href="/como-funciona">{t("comoComprar")}</a><a href="/catalogo">{t("nuestrasMaquinas")}</a><a href="/metodos-de-pago">{t("metodosPago")}</a></div>
        <div className="col"><h4>{t("paraTuNegocio")}</h4><a href="/quienes-somos">{t("quienes")}</a><a href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer">{t("grupoArg")}</a><a href="/soporte">{t("soporte")}</a></div>
        <div className="col"><h4>{t("legal")}</h4><a href="/terminos">{t("legalT")}</a><a href="/privacidad">{t("legalP")}</a><a href="/devoluciones">{t("devoluciones")}</a><a href="/politica-de-compra">{t("politicaCompra")}</a><a href="/legal">{t("legalL")}</a></div>
      </div>
      <div className="abajo"><span>© 2026 ARGENMAQ · {t("grupo")}.</span><span>{t("precioPuesto")} · USD / ARS</span></div>
    </footer>
    <a className="fab" href={WA("Hola ARGENMAQ, quiero consultar por una máquina")} target="_blank" rel="noreferrer" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.5 3.9 1.7.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg></a>
  </>;
}

// Etiqueta pública de cada vía: el cliente nunca ve "LCL" ni "Integral".
export const viaLabel = (k, t) => k === "aereo" ? t("viaAerea") : t("viaMaritima");
export const diasVia = (k, dv) => Number((dv || {})[k] ?? (k === "aereo" ? 10 : 60));
export const primeraFoto = (m) => (Array.isArray(m.fotos) && m.fotos[0]) || null;
