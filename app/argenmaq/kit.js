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
.amq{--bg:#FFFFFF;--card:#FFFFFF;--ink:#15171A;--gris:#5B6066;--borde:#E6E7EA;--suave:#F4F5F7;--y:#FFD200;--ysuave:#FFF3B0;--yink:#15171A;--ok:#1F7A2E;--sombra:0 14px 40px rgba(0,0,0,0.08);font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;min-height:100vh}
.amq[data-tema="oscuro"]{--bg:#141517;--card:#1C1E21;--ink:#F3F3F1;--gris:#9DA3A9;--borde:#2B2E33;--suave:#23262A;--ysuave:#3A3305;--ok:#7BD88F;--sombra:0 14px 40px rgba(0,0,0,0.35)}
html,body{overflow-x:clip!important}
.amq *{box-sizing:border-box}.amq a{color:inherit;text-decoration:none}.amq button{font-family:inherit}
.amq .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.amq .grupoWrap{display:flex;justify-content:center;padding:7px 16px;background:#15171A}
.amq .grupo{display:inline-flex;gap:6px}
.amq .grupo a{height:34px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;background:#fff;opacity:0.68;transition:opacity 140ms}
.amq .grupo a:hover,.amq .grupo a.on{opacity:1}
.amq .grupo img{width:auto;display:block}.amq .grupo .iso{height:18px}.amq .grupo .txt{height:11px}
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
.amq footer{border-top:1px solid var(--borde);padding:34px 0;font-size:13.5px;color:var(--gris)}
.amq footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center}
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
@media(max-width:900px){.amq .nav .links{display:none}.amq .grupo a{padding:0 12px;height:30px}.amq .grupo .iso{height:16px}.amq .grupo .txt{height:10px}.amq .carril>*{flex-basis:220px}.amq .nav{padding:0 12px}.amq .isla{height:62px;padding:0 10px 0 14px;gap:10px}}
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
    legalT:"Términos y condiciones", legalP:"Política de privacidad", legalL:"Aviso legal" },
  en: { catalogo:"Catalog", como:"How it works", quienes:"About us", ingresar:"Sign in", cuenta:"My account", carrito:"Cart", salir:"Sign out",
    verPrecio:"Sign in to see the price", precioPuesto:"Price delivered to our warehouse in Buenos Aires", envioAdicional:"Home delivery extra · free pickup",
    viaAerea:"By air", viaMaritima:"By sea", tiempo:"Estimated time", dias:"days", agregar:"Add to cart", agregado:"In cart", verCarrito:"View cart",
    consultar:"Ask on WhatsApp", grupo:"A company of the Argencargo group", verTodo:"See all", sinMaquinas:"No machines in this category yet.", buscar:"Search machine…",
    nueva:"New", usada:"Used", masPedida:"Most requested", garantia:"Factory warranty", meses:"months", produccion:"production", noEsta:"Can't find your machine?", noEstaSub:"Message us and we'll source it.",
    crear:"Create account", tengo:"I have an account", email:"Email", pass:"Password", entrar:"Sign in", registrarse:"Sign up",
    vacio:"Your cart is empty.", pedir:"Confirm order", pedido:"Order", total:"Total", cantidad:"Quantity", quitar:"Remove", misOps:"My operations", seguimiento:"Tracking", datos:"My details",
    legalT:"Terms and conditions", legalP:"Privacy policy", legalL:"Legal notice" },
  ru: { catalogo:"Каталог", como:"Как это работает", quienes:"О нас", ingresar:"Войти", cuenta:"Мой аккаунт", carrito:"Корзина", salir:"Выйти",
    verPrecio:"Войдите, чтобы увидеть цену", precioPuesto:"Цена с доставкой на наш склад в Буэнос-Айресе", envioAdicional:"Доставка на дом отдельно · самовывоз бесплатно",
    viaAerea:"Авиа", viaMaritima:"Морем", tiempo:"Ориентировочный срок", dias:"дней", agregar:"В корзину", agregado:"В корзине", verCarrito:"Открыть корзину",
    consultar:"Написать в WhatsApp", grupo:"Компания группы Argencargo", verTodo:"Смотреть все", sinMaquinas:"В этой категории пока нет машин.", buscar:"Поиск машины…",
    nueva:"Новая", usada:"Б/у", masPedida:"Популярная", garantia:"Гарантия завода", meses:"мес.", produccion:"производство", noEsta:"Не нашли свою машину?", noEstaSub:"Напишите нам — найдём.",
    crear:"Создать аккаунт", tengo:"У меня есть аккаунт", email:"Email", pass:"Пароль", entrar:"Войти", registrarse:"Зарегистрироваться",
    vacio:"Корзина пуста.", pedir:"Подтвердить заказ", pedido:"Заказ", total:"Итого", cantidad:"Количество", quitar:"Убрать", misOps:"Мои операции", seguimiento:"Отслеживание", datos:"Мои данные",
    legalT:"Условия", legalP:"Конфиденциальность", legalL:"Правовая информация" },
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
  useEffect(() => { if (!ses?.token || !listo) { setCliente(null); return; } (async () => { try { const r = await dq("clients", { filters: `?auth_user_id=eq.${ses.user?.id}&select=id,client_code,first_name,last_name,company_name,email,whatsapp,tax_condition,city,province&limit=1` }); setCliente(Array.isArray(r) && r[0] ? r[0] : null); } catch { setCliente(null); } })(); }, [ses?.token, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => { const r = (await sf("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })).body; if (!r?.access_token) throw new Error(r?.error_description || r?.msg || "Credenciales inválidas"); guardarSes({ token: r.access_token, refresh: r.refresh_token, user: r.user }); return r; };
  const salir = () => { guardarSes(null); setCliente(null); };
  const t = (k) => (T[lang] && T[lang][k]) || T.es[k] || k;
  const fmt = (usd) => { if (usd == null) return "—"; if (moneda === "ARS" && tc) return `$ ${Math.round(usd * tc).toLocaleString("es-AR")}`; return `USD ${Number(usd).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; };

  return <Ctx.Provider value={{ tema, setTema, lang, setLang, t, moneda, setMoneda, tc, fmt, ses, cliente, setCliente, login, salir, sf, dq, guardarSes, carrito, setCarrito, listo }}>
    <div className="amq" data-tema={tema === "oscuro" ? "oscuro" : undefined}><style dangerouslySetInnerHTML={{ __html: CSS }} />{children}</div>
  </Ctx.Provider>;
}

// ── Marco: barra del grupo + nav + pie ────────────────────────────────────────────────────
export function Logo({ alto = 34 }) { const { tema } = useAM(); const inv = tema === "oscuro"; return <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><img src={inv ? "/argenmaq/isotipo-blanco.png" : "/argenmaq/isotipo.png"} alt="" style={{ height: alto, width: "auto" }} /><img src={inv ? "/argenmaq/texto-blanco.png" : "/argenmaq/texto.png"} alt="ARGENMAQ" style={{ height: alto * 0.62, width: "auto" }} /></span>; }
export function Ico({ d, size = 17 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d.map((x, i) => <path key={i} d={x} />)}</svg>; }

export function Marco({ actual, children, sinGrupo }) {
  const { tema, setTema, lang, setLang, t, moneda, setMoneda, tc, ses, cliente, carrito } = useAM();
  const n = carrito.reduce((s, i) => s + (i.qty || 1), 0);
  return <>
    {!sinGrupo && <div className="grupoWrap"><div className="grupo">
      <a className="on" href="/" aria-label="ARGENMAQ"><img className="iso" src="/argenmaq/isotipo.png" alt="" /><img className="txt" src="/argenmaq/texto.png" alt="ARGENMAQ" /></a>
      <a href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer" aria-label="ARGENCARGO"><img className="iso" src="/argencargo/isotipo.png" alt="" /><img className="txt" src="/argencargo/texto.png" alt="ARGENCARGO" /></a>
    </div></div>}
    <header className="nav">
      <div className="isla">
        <a href="/" style={{ display: "flex", alignItems: "center" }}><Logo /></a>
        <nav className="links">
          <a className={actual === "catalogo" ? "on" : ""} href="/catalogo">{t("catalogo")}</a>
          <a className={actual === "como" ? "on" : ""} href="/como-funciona">{t("como")}</a>
          <a className={actual === "quienes" ? "on" : ""} href="/quienes-somos">{t("quienes")}</a>
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ico" onClick={() => setMoneda(moneda === "USD" ? "ARS" : "USD")} title={tc ? `Blue ${tc - 5} + 5 = ${tc}` : "Cotización"}>{moneda === "USD" ? "US$" : "AR$"}</button>
          <button className="ico" onClick={() => setLang(lang === "es" ? "en" : lang === "en" ? "ru" : "es")} title="Idioma">{lang.toUpperCase()}</button>
          <button className="ico" onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")} title="Tema">{tema === "oscuro" ? <Ico d={["M12 3v2", "M12 19v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M3 12h2", "M19 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]} size={15} /> : <Ico d={["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"]} size={15} />}</button>
          <a className="ico" href="/carrito" title={t("carrito")} style={{ position: "relative" }}><Ico d={["M6 6h15l-1.5 8H7.5z", "M6 6L5 3H2", "M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"]} size={16} />{n > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--y)", color: "#15171A", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 6px" }}>{n}</span>}</a>
          <a className="btn s y" href="/cuenta">{ses ? (cliente?.first_name || t("cuenta")) : t("ingresar")}</a>
        </div>
      </div>
    </header>
    {children}
    <footer>
      <div className="wrap">
        <div><Logo alto={28} /><div style={{ marginTop: 8 }}>{t("grupo")}. <a href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>argencargo.com.ar</a></div></div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}><a href="/terminos">{t("legalT")}</a><a href="/privacidad">{t("legalP")}</a><a href="/legal">{t("legalL")}</a><a href="/admin">Panel</a></div>
      </div>
    </footer>
    <a className="fab" href={WA("Hola ARGENMAQ, quiero consultar por una máquina")} target="_blank" rel="noreferrer" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.3.8 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3z" /></svg></a>
  </>;
}

// Etiqueta pública de cada vía: el cliente nunca ve "LCL" ni "Integral".
export const viaLabel = (k, t) => k === "aereo" ? t("viaAerea") : t("viaMaritima");
export const diasVia = (k, dv) => Number((dv || {})[k] ?? (k === "aereo" ? 10 : 60));
export const primeraFoto = (m) => (Array.isArray(m.fotos) && m.fotos[0]) || null;
