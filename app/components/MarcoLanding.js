"use client";
// Marco de la landing de Argencargo (04/10/2026): barra del grupo (ARGENMAQ · ARGENCARGO), isla
// flotante y pie. Mismo estilo que el sitio de ARGENMAQ (app/argenmaq/kit.js): la barra del grupo
// queda arriba y se va al scrollear; la isla queda pegada.
// Idioma compartido con el portal (ac_portal_lang). El tema se guarda en ac_landing_tema.
import { createContext, useContext, useEffect, useState } from "react";
import { AM_URL } from "../argenmaq/_marca";

const WA_NUM = "5491125088580";
const WA_TXT = "+54 9 11 2508-8580";
const MAIL = "info@argencargo.com.ar";
const LANG_KEY = "ac_portal_lang";
const TEMA_KEY = "ac_landing_tema";

// Redes: las que todavía no tienen link se muestran igual (sin enlace) para que se note que faltan.
const REDES = [
  { k: "instagram", url: "https://www.instagram.com/argencargo_", d: ["M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z", "M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z", "M17.5 6.5h.01"] },
  { k: "linkedin", url: null, d: ["M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z", "M2 9h4v12H2z", "M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"] },
  { k: "facebook", url: null, d: ["M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"] },
  { k: "tiktok", url: null, d: ["M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5"] },
  { k: "youtube", url: null, d: ["M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 1.9 2c1.7.4 8.6.4 8.6.4s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2 29 29 0 0 0 .5-5.5 29 29 0 0 0-.5-5.6z", "M9.8 15.5l5.7-3.5-5.7-3.3z"] },
];

const IDIOMAS = [
  { k: "es", flag: "ar", nombre: "Español" },
  { k: "en", flag: "gb", nombre: "English" },
  { k: "zh", flag: "cn", nombre: "中文" },
  { k: "ru", flag: "ru", nombre: "Русский" },
];

const T = {
  es: { servicios: "Servicios", aprender: "Aprender", quienes: "Quiénes somos", calculadora: "Calculadora", cuenta: "Mi cuenta", claim: "Logística internacional para negocios argentinos.", sub: "Importaciones desde China a Argentina. Flete aéreo y marítimo, con aduana y entrega en todo el país.", contacto: "Contacto", oficina: "Oficina Argentina", horario: "Lun a Vie · 10:00 a 18:00 hs", origen: "Warehouse China", origenTxt: "Operativo 24 hs · los 365 días", atencion: "Atención", navegacion: "Navegación", blog: "Blog", portalCli: "Portal de clientes", portalAg: "Portal de agentes", legal: "Legal", terminos: "Términos y condiciones", privacidad: "Política de privacidad", aviso: "Aviso legal", derechos: "Todos los derechos reservados", lugar: "Buenos Aires · Argentina", grupo: "Grupo Argencargo" },
  en: { servicios: "Services", aprender: "Learn", quienes: "About us", calculadora: "Calculator", cuenta: "My account", claim: "International logistics for Argentine businesses.", sub: "Imports from China to Argentina. Air and sea freight, with customs clearance and delivery nationwide.", contacto: "Contact", oficina: "Argentina office", horario: "Mon to Fri · 10 am to 6 pm", origen: "China warehouse", origenTxt: "Open 24/7 · 365 days a year", atencion: "Support", navegacion: "Navigation", blog: "Blog", portalCli: "Client portal", portalAg: "Agent portal", legal: "Legal", terminos: "Terms and conditions", privacidad: "Privacy policy", aviso: "Legal notice", derechos: "All rights reserved", lugar: "Buenos Aires · Argentina", grupo: "Argencargo Group" },
  zh: { servicios: "服务", aprender: "学习", quienes: "关于我们", calculadora: "计算器", cuenta: "我的账户", claim: "为阿根廷企业提供国际物流。", sub: "从中国进口到阿根廷。空运和海运，含清关及全国配送。", contacto: "联系方式", oficina: "阿根廷办公室", horario: "周一至周五 · 10:00–18:00", origen: "中国仓库", origenTxt: "全年365天 · 24小时运营", atencion: "客服", navegacion: "导航", blog: "博客", portalCli: "客户门户", portalAg: "代理门户", legal: "法律信息", terminos: "条款与条件", privacidad: "隐私政策", aviso: "法律声明", derechos: "版权所有", lugar: "阿根廷 · 布宜诺斯艾利斯", grupo: "Argencargo 集团" },
  ru: { servicios: "Услуги", aprender: "Обучение", quienes: "О нас", calculadora: "Калькулятор", cuenta: "Кабинет", claim: "Международная логистика для аргентинского бизнеса.", sub: "Импорт из Китая в Аргентину. Авиа- и морская доставка, таможня и доставка по всей стране.", contacto: "Контакты", oficina: "Офис в Аргентине", horario: "Пн–Пт · 10:00–18:00", origen: "Склад в Китае", origenTxt: "Работает 24/7 · 365 дней в году", atencion: "Поддержка", navegacion: "Навигация", blog: "Блог", portalCli: "Кабинет клиента", portalAg: "Кабинет агента", legal: "Правовая информация", terminos: "Условия", privacidad: "Конфиденциальность", aviso: "Правовое уведомление", derechos: "Все права защищены", lugar: "Буэнос-Айрес · Аргентина", grupo: "Группа Argencargo" },
};

const Ctx = createContext({ lang: "es", tema: "oscuro", t: (k) => T.es[k] || k });
export const useLanding = () => useContext(Ctx);

const Ico = ({ d, size = 17 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x, i) => <path key={i} d={x} />)}</svg>;
const bandera = (f) => `https://flagcdn.com/w40/${f}.png`;
const WA_D = "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4A9.9 9.9 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 12 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4z";

const ICOS = {
  servicios: ["M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z", "M3.3 7l8.7 5 8.7-5", "M12 22V12"],
  aprender: ["M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z", "M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"],
  quienes: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  calc: ["M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M8 6h8v4H8z", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01", "M16 18h.01"],
  blog: ["M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2", "M18 14h-8", "M15 18h-5", "M10 6h8v4h-8z"],
  sol: ["M12 3v2", "M12 19v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M3 12h2", "M19 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  luna: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
.acl{--card:#FFFFFF;--ink:#0F1B2D;--gris:#5A6578;--borde:#E3E7EE;--suave:#F3F6FA;--ac:#3B7DD8;--acsuave:#E6EFFB;--bg:#F4F6FA;--cel:#3A86D6;--sup:#FFFFFF;--supB:#E2E7EF;--txt:#26334A;--txt2:#5A6578;--mrDot:rgba(15,27,45,0.1);--mrViaj:#0F1B2D;font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--ink)}
.acl[data-tema="oscuro"]{--card:#101B30;--ink:#F2F5FA;--gris:#9AA6B8;--borde:#22314A;--suave:#16233B;--acsuave:rgba(59,125,216,0.2);--bg:#0A1223;--cel:#74ACDF;--sup:rgba(255,255,255,0.04);--supB:rgba(255,255,255,0.09);--txt:rgba(255,255,255,0.86);--txt2:rgba(255,255,255,0.6);--mrDot:rgba(255,255,255,0.24);--mrViaj:#FFFFFF}
html,body{overflow-x:clip!important}
.acl *{box-sizing:border-box}.acl a{text-decoration:none;color:inherit}.acl button{font-family:inherit}
.acl .grupoWrap{display:flex;justify-content:center;padding:12px 16px 0}
.acl .grupo{display:inline-flex;gap:8px}
.acl .grupo a{width:236px;height:42px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:2px solid transparent;box-shadow:0 6px 18px rgba(0,0,0,0.4);transition:transform 140ms}
.acl .grupo a:hover{transform:translateY(-1px)}.acl .grupo a.on{border-color:var(--ac)}
.acl[data-tema="claro"] .grupo a{background:#0A1223;box-shadow:0 6px 18px rgba(0,0,0,0.14)}
.acl .grupo img{width:auto;display:block}.acl .grupo .am .iso{height:22px}.acl .grupo .am .txt{height:15px}.acl .grupo .argc .iso{height:19px}.acl .grupo .argc .txt{height:12px}
.acl .nav{position:sticky;top:10px;z-index:100;padding:0 20px;margin:12px 0 0}
.acl .isla{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:20px;height:68px;padding:0 14px 0 22px;border-radius:999px;background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--borde);box-shadow:0 12px 34px rgba(0,0,0,0.35);color:var(--ink)}
.acl .logo{display:flex;align-items:center;gap:10px;flex-shrink:0}.acl .logo .iso{height:26px;width:auto}.acl .logo .txt{height:15px;width:auto}
.acl .links{display:flex;gap:26px;font-size:14.5px;font-weight:700;color:var(--ink);flex:1;justify-content:center}
.acl .links a:hover{opacity:0.7}.acl .links svg{display:none}
.acl .linksCel{display:none}
.acl .der{display:flex;gap:8px;align-items:center}
.acl .pill{height:36px;padding:0 14px 0 10px;border-radius:999px;border:1px solid var(--borde);background:var(--card);color:var(--ink);display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;white-space:nowrap}
.acl .pill:hover{border-color:var(--ink)}
.acl .pill img{width:20px;height:14px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,0.12)}
.acl .ico{width:36px;height:36px;padding:0;border-radius:50%;border:1px solid var(--borde);background:var(--card);color:var(--ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.acl .ico:hover{border-color:var(--ink)}.acl .ico.dia{color:#E0A800}
.acl .cta{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 20px;border-radius:999px;background:var(--ac);color:#fff;font-weight:800;font-size:14.5px;white-space:nowrap;box-shadow:0 6px 16px rgba(59,125,216,0.35);transition:transform 120ms}
.acl .cta:hover{transform:translateY(-1px)}
.acl .menuLang{position:absolute;top:44px;right:0;z-index:120;min-width:170px;padding:6px;border-radius:16px;background:var(--card);border:1px solid var(--borde);box-shadow:0 16px 40px rgba(0,0,0,0.3)}
.acl .menuLang button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:none;background:transparent;border-radius:10px;color:var(--ink);font-size:14px;font-weight:600;cursor:pointer;text-align:left}
.acl .menuLang button:hover,.acl .menuLang button.on{background:var(--suave)}
.acl .menuLang img{width:20px;height:14px;object-fit:cover;border-radius:3px}
.acl footer{background:#070E1C;color:rgba(255,255,255,0.62);padding:40px 0 28px;font-size:14px;border-top:1px solid rgba(255,255,255,0.06)}
.acl .pieGrid{max-width:1180px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;column-gap:72px;row-gap:40px;align-items:start}
.acl footer h4{margin:0 0 18px;font-size:11.5px;letter-spacing:0.16em;text-transform:uppercase;color:#fff;font-weight:700}
.acl footer .col a,.acl footer .col span.l{display:block;color:rgba(255,255,255,0.62);margin:0 0 12px;font-weight:500;line-height:1.4}
.acl footer .col a:hover{color:#fff}
.acl footer .k{display:block;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.42);font-weight:700;margin:0 0 5px}
.acl footer .dato{margin:0 0 18px;color:rgba(255,255,255,0.78);font-weight:500;line-height:1.45}
.acl footer .mono{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:13.5px;letter-spacing:0.02em}
.acl footer .redes{display:flex;gap:10px;margin-top:22px}
.acl footer .redes a{width:42px;height:42px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);display:inline-flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.8);transition:border-color 120ms,color 120ms}
.acl footer .redes a:hover{border-color:var(--ac);color:#fff}.acl footer .redes a.falta{cursor:default}
.acl footer .fila{display:flex;gap:14px;align-items:baseline;margin:0 0 18px;white-space:nowrap}.acl footer .fila .k{margin:0;min-width:74px}
.acl footer .razon{display:block;color:#7FA8E6;font-weight:600;font-size:14px;letter-spacing:0.04em;margin:0 0 18px}
.acl footer .abajo{max-width:1180px;margin:44px auto 0;padding:22px 24px 0;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12.5px;color:rgba(255,255,255,0.45)}
@media(max-width:900px){.acl .links{display:none}.acl .pieGrid{grid-template-columns:1fr 1fr;gap:36px 24px}.acl .pieGrid>div:first-child{grid-column:1/-1}.acl .grupo a{width:168px;height:36px;padding:0 10px;gap:7px}.acl .nav{padding:0 12px}.acl .isla{height:62px;padding:0 10px 0 16px;gap:10px}.acl .isla .der{margin-left:auto}}
@media(max-width:900px){
.acl .linksCel{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;max-width:620px;margin:10px auto 0;padding:0 12px}
.acl .linksCel a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:11px 2px 10px;border-radius:16px;background:var(--suave);border:1px solid var(--borde);color:var(--ink);font-size:12px;font-weight:800;text-align:center;line-height:1.15}
.acl .linksCel a:active{transform:scale(0.97)}
}
@media(max-width:640px){
.acl .nav{padding:0 10px;margin:8px 0 0}
.acl .isla{flex-wrap:wrap;height:auto;padding:10px 10px 10px 16px;gap:10px;border-radius:24px}
.acl .logo{gap:6px}.acl .logo .iso{height:18px}.acl .logo .txt{height:10.5px}
.acl .isla .der{margin-left:auto;gap:6px;display:contents}
.acl .isla .der>div{margin-left:auto}
.acl .ico{width:34px;height:34px}.acl .pill{height:34px;padding:0 12px 0 9px;font-size:12.5px}.acl .pill img{width:18px;height:13px}
.acl .cta{order:3;flex-basis:100%;justify-content:center;height:46px;font-size:15.5px;border-radius:14px}
.acl .linksCel{padding:0 10px}
.acl .grupoWrap{padding:8px 10px 0}
.acl .grupo{display:grid;grid-template-columns:1fr 1fr;width:100%;max-width:420px;padding:4px;gap:0;border-radius:999px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.4)}
.acl .grupo a{width:auto;height:34px;padding:0 8px;gap:6px;box-shadow:none;border-width:1.5px;min-width:0}
.acl .grupo .am .iso{height:17px}.acl .grupo .am .txt{height:11px}.acl .grupo .argc .iso{height:14px}.acl .grupo .argc .txt{height:9px}
.acl[data-tema="claro"] .grupo{background:#0A1223}.acl[data-tema="claro"] .grupo a{box-shadow:none}
.acl footer{padding:48px 0 96px}
.acl .pieGrid{grid-template-columns:1fr;gap:30px}
.acl footer .abajo{flex-direction:column;margin-top:32px}
}
@media(max-width:360px){.acl .logo .txt{height:9px}.acl .pill{padding:0 9px 0 8px}}
`;

export default function MarcoLanding({ children }) {
  const [lang, setLangSt] = useState("es");
  const [tema, setTemaSt] = useState("oscuro");
  const [menuLang, setMenuLang] = useState(false);
  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (T[l]) setLangSt(l);
      const tm = localStorage.getItem(TEMA_KEY);
      if (tm === "claro" || tm === "oscuro") setTemaSt(tm);
    } catch {}
  }, []);
  // El fondo de la página (y la barra de desplazamiento del navegador) toma el color del tema:
  // si no, el costado se veía blanco con la landing en oscuro.
  useEffect(() => {
    const h = document.documentElement;
    const antes = { bg: h.style.background, cs: h.style.colorScheme };
    h.style.background = tema === "claro" ? "#F4F6FA" : "#0A1223";
    h.style.colorScheme = tema === "claro" ? "light" : "dark";
    return () => { h.style.background = antes.bg; h.style.colorScheme = antes.cs; };
  }, [tema]);
  const setLang = (l) => { setLangSt(l); setMenuLang(false); try { localStorage.setItem(LANG_KEY, l); } catch {} };
  const setTema = (v) => { setTemaSt(v); try { localStorage.setItem(TEMA_KEY, v); } catch {} };
  const t = (k) => (T[lang] || T.es)[k] || T.es[k] || k;
  const claro = tema === "claro";
  const idioma = IDIOMAS.find((x) => x.k === lang) || IDIOMAS[0];
  const ir = (id) => (e) => { const el = document.getElementById(id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); } };

  return <Ctx.Provider value={{ lang, tema, t }}>
    <div className="acl" data-tema={tema}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Barra del grupo: se va al scrollear. */}
      <div className="grupoWrap"><div className="grupo">
        <a className="on argc" href="/" aria-label="ARGENCARGO"><img className="iso" src={claro ? "/argencargo/isotipo-blanco.png" : "/argencargo/isotipo.png"} alt="" /><img className="txt" src={claro ? "/argencargo/texto-blanco.png" : "/argencargo/texto.png"} alt="ARGENCARGO" /></a>
        <a className="am" href={AM_URL} target="_blank" rel="noopener noreferrer" aria-label="ARGENMAQ"><img className="iso" src={claro ? "/argenmaq/isotipo-blanco.png" : "/argenmaq/isotipo.png"} alt="" /><img className="txt" src={claro ? "/argenmaq/texto-blanco.png" : "/argenmaq/texto.png"} alt="ARGENMAQ" /></a>
      </div></div>

      {/* Isla: queda pegada arriba. */}
      <header className="nav">
        <div className="isla">
          <a className="logo" href="/" aria-label="Argencargo">
            <img className="iso" src={claro ? "/argencargo/isotipo.png" : "/argencargo/isotipo-blanco.png"} alt="" />
            <img className="txt" src={claro ? "/argencargo/texto.png" : "/argencargo/texto-blanco.png"} alt="Argencargo" />
          </a>
          <nav className="links">
            <a href="/servicios"><Ico d={ICOS.servicios} />{t("servicios")}</a>
            <a href="/blog"><Ico d={ICOS.aprender} />{t("aprender")}</a>
            <a href="/#quienes-somos" onClick={ir("quienes-somos")}><Ico d={ICOS.quienes} />{t("quienes")}</a>
            <a href="/blog"><Ico d={ICOS.blog} />{t("blog")}</a>
          </nav>
          <div className="der">
            <div style={{ position: "relative" }}>
              <button className="pill" onClick={() => setMenuLang((v) => !v)} aria-label="Idioma" aria-haspopup="menu" aria-expanded={menuLang}><img src={bandera(idioma.flag)} alt="" /><span>{idioma.nombre}</span></button>
              {menuLang && <>
                <div onClick={() => setMenuLang(false)} style={{ position: "fixed", inset: 0, zIndex: 110 }} />
                <div className="menuLang" role="menu">
                  {IDIOMAS.map((x) => <button key={x.k} className={x.k === lang ? "on" : ""} onClick={() => setLang(x.k)} role="menuitem"><img src={bandera(x.flag)} alt="" />{x.nombre}</button>)}
                </div>
              </>}
            </div>
            <button className={`ico tema ${claro ? "" : "dia"}`} onClick={() => setTema(claro ? "oscuro" : "claro")} aria-label="Tema"><Ico d={claro ? ICOS.luna : ICOS.sol} size={15} /></button>
            <a className="cta" href="/portal"><Ico d={ICOS.calc} size={16} />{t("calculadora")}</a>
          </div>
        </div>
      </header>
      {/* En el celu los títulos van en la página (no en la isla pegada). */}
      <nav className="linksCel">
        <a href="/servicios"><Ico d={ICOS.servicios} />{t("servicios")}</a>
        <a href="/blog"><Ico d={ICOS.aprender} />{t("aprender")}</a>
        <a href="/#quienes-somos" onClick={ir("quienes-somos")}><Ico d={ICOS.quienes} />{t("quienes")}</a>
        <a href="/blog"><Ico d={ICOS.blog} />{t("blog")}</a>
      </nav>

      {children}

      <footer>
        <div className="pieGrid">
          <div>
            <a href="/" aria-label="Argencargo" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <img src="/argencargo/isotipo-blanco.png" alt="" style={{ height: 26, width: "auto" }} />
              <img src="/argencargo/texto-blanco.png" alt="Argencargo" style={{ height: 15, width: "auto" }} />
            </a>
            <p style={{ margin: "18px 0 10px", color: "#fff", fontWeight: 700, fontSize: 16 }}>{t("claim")}</p>
            <p style={{ margin: 0, lineHeight: 1.65, maxWidth: 340 }}>{t("sub")}</p>
            <div className="redes">
              {REDES.map((r) => r.url ? <a key={r.k} href={r.url} target="_blank" rel="noopener noreferrer" aria-label={r.k}><Ico d={r.d} size={18} /></a> : <a key={r.k} className="falta" title={`Falta el link de ${r.k}`} aria-label={r.k}><Ico d={r.d} size={18} /></a>)}
              <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={WA_D} /></svg></a>
            </div>
          </div>
          <div className="col">
            <h4>{t("contacto")}</h4>
            <p className="dato"><a href={`mailto:${MAIL}`} style={{ color: "rgba(255,255,255,0.78)" }}>{MAIL}</a></p>
            <p className="fila"><span className="k">{t("atencion")}</span><a className="mono" href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.78)" }}>{WA_TXT}</a></p>
            <span className="k">{t("oficina")}</span>
            <p className="dato">{t("horario")}</p>
            <span className="k">{t("origen")}</span>
            <p className="dato" style={{ marginBottom: 0 }}>{t("origenTxt")}</p>
          </div>
          <div className="col">
            <h4>{t("navegacion")}</h4>
            <a href="/servicios">{t("servicios")}</a>
            <a href="/blog">{t("aprender")}</a>
            <a href="/#quienes-somos" onClick={ir("quienes-somos")}>{t("quienes")}</a>
            <a href="/blog">{t("blog")}</a>
            <a href="/portal">{t("calculadora")}</a>
          </div>
          <div className="col">
            <h4>{t("legal")}</h4>
            <span className="razon">ARGENCARGO</span>
            <a href="/terminos">{t("terminos")}</a>
            <a href="/privacidad">{t("privacidad")}</a>
            <a href="/legal">{t("aviso")}</a>
          </div>
        </div>
        <div className="abajo"><span>© 2026 Argencargo — {t("derechos")}</span><span>{t("lugar")}</span></div>
      </footer>
    </div>
  </Ctx.Provider>;
}
