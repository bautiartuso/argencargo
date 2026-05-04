// i18n minimal para el portal cliente. ES (default) / EN / ZH.
// Estrategia: skeleton — traduce nav + headings clave. El resto del portal queda en ES por ahora;
// se puede ir migrando gradualmente reemplazando strings por t(key).
//
// Uso:
//   import { useT, LANGS } from "@/lib/i18n-portal";
//   const { t, lang, setLang } = useT();
//   <h1>{t("nav.imports")}</h1>

import { useEffect, useState } from "react";

export const LANGS = [
  { code: "es", label: "Español", flag: "🇦🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文",    flag: "🇨🇳" },
];

const DICT = {
  // Navegación
  "nav.imports":       { es: "IMPORTACIONES",         en: "IMPORTS",            zh: "进口" },
  "nav.purchases":     { es: "COMPRAS EN CAMINO",     en: "PURCHASES IN TRANSIT", zh: "在途采购" },
  "nav.calculator":    { es: "CALCULADORA",           en: "CALCULATOR",         zh: "计算器" },
  "nav.quotes":        { es: "COTIZACIONES",          en: "QUOTES",             zh: "报价" },
  "nav.payments":      { es: "PAGOS INTERNACIONALES", en: "INTERNATIONAL PAYMENTS", zh: "国际支付" },
  "nav.account":       { es: "CUENTA CORRIENTE",      en: "ACCOUNT",            zh: "账户" },
  "nav.points":        { es: "PUNTOS",                en: "POINTS",             zh: "积分" },
  "nav.referrals":     { es: "REFERIDOS",             en: "REFERRALS",          zh: "推荐" },
  "nav.services":      { es: "SERVICIOS",             en: "SERVICES",           zh: "服务" },
  "nav.profile":       { es: "MI PERFIL",             en: "MY PROFILE",         zh: "我的资料" },
  "nav.support":       { es: "SOPORTE",               en: "SUPPORT",            zh: "客户支持" },
  // Comunes
  "common.client":     { es: "Cliente",               en: "Client",             zh: "客户" },
  "common.logout":     { es: "Cerrar sesión",         en: "Sign out",           zh: "退出登录" },
  "common.language":   { es: "Idioma",                en: "Language",           zh: "语言" },
  "common.loading":    { es: "Cargando…",             en: "Loading…",           zh: "加载中…" },
  "common.save":       { es: "Guardar",               en: "Save",               zh: "保存" },
  "common.cancel":     { es: "Cancelar",              en: "Cancel",             zh: "取消" },
  "common.send":       { es: "Enviar",                en: "Send",               zh: "发送" },
  // Tickets / soporte
  "support.title":     { es: "Soporte",               en: "Support",            zh: "客户支持" },
  "support.new":       { es: "Nuevo ticket",          en: "New ticket",         zh: "新工单" },
  "support.subject":   { es: "Asunto",                en: "Subject",            zh: "主题" },
  "support.description":{ es: "Descripción",          en: "Description",        zh: "描述" },
  "support.priority":  { es: "Prioridad",             en: "Priority",           zh: "优先级" },
  "support.category":  { es: "Categoría",             en: "Category",           zh: "类别" },
  "support.empty":     { es: "Todavía no abriste tickets.", en: "You haven't opened any tickets yet.", zh: "您还没有提交工单。" },
};

const STORAGE_KEY = "ac_portal_lang";

export function getLang() {
  if (typeof window === "undefined") return "es";
  return localStorage.getItem(STORAGE_KEY) || "es";
}

export function setLangPersist(lang) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent("ac_lang_change", { detail: lang }));
  }
}

export function translate(key, lang = "es") {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] || entry.es || key;
}

export function useT() {
  const [lang, setLang] = useState(() => getLang());
  useEffect(() => {
    const handler = (e) => setLang(e.detail);
    if (typeof window !== "undefined") window.addEventListener("ac_lang_change", handler);
    return () => { if (typeof window !== "undefined") window.removeEventListener("ac_lang_change", handler); };
  }, []);
  return {
    lang,
    setLang: (l) => { setLangPersist(l); setLang(l); },
    t: (key) => translate(key, lang),
  };
}
