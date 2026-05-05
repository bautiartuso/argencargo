// i18n del portal cliente. ES (default) / EN / ZH.
// Uso:
//   import { useT, LANGS } from "@/lib/i18n-portal";
//   const { t, lang, setLang } = useT();
//   <h1>{t("nav.imports")}</h1>
//
// Convención de claves: {section}.{key} — ej: nav.imports, calc.title, common.save
// Si una clave no existe, devuelve la propia clave (útil para detectar faltantes).
//
// Para añadir una clave nueva: simplemente agregala al DICT con sus 3 traducciones.
// El runtime no requiere build step.

import { useEffect, useState } from "react";

export const LANGS = [
  { code: "es", label: "Español", flag: "🇦🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "zh", label: "中文",    flag: "🇨🇳" },
];

const DICT = {
  // ── NAVEGACIÓN ─────────────────────────────────
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

  // ── COMUNES ─────────────────────────────────
  "common.client":     { es: "Cliente",               en: "Client",             zh: "客户" },
  "common.logout":     { es: "Cerrar sesión",         en: "Sign out",           zh: "退出登录" },
  "common.language":   { es: "Idioma",                en: "Language",           zh: "语言" },
  "common.loading":    { es: "Cargando…",             en: "Loading…",           zh: "加载中…" },
  "common.save":       { es: "Guardar",               en: "Save",               zh: "保存" },
  "common.saving":     { es: "Guardando…",            en: "Saving…",            zh: "保存中…" },
  "common.cancel":     { es: "Cancelar",              en: "Cancel",             zh: "取消" },
  "common.send":       { es: "Enviar",                en: "Send",               zh: "发送" },
  "common.delete":     { es: "Eliminar",              en: "Delete",             zh: "删除" },
  "common.edit":       { es: "Editar",                en: "Edit",               zh: "编辑" },
  "common.close":      { es: "Cerrar",                en: "Close",              zh: "关闭" },
  "common.back":       { es: "Volver",                en: "Back",               zh: "返回" },
  "common.next":       { es: "Siguiente",             en: "Next",               zh: "下一步" },
  "common.confirm":    { es: "Confirmar",             en: "Confirm",            zh: "确认" },
  "common.search":     { es: "Buscar",                en: "Search",             zh: "搜索" },
  "common.view":       { es: "Ver",                   en: "View",               zh: "查看" },
  "common.viewDetail": { es: "Ver detalle",           en: "View detail",        zh: "查看详情" },
  "common.viewAll":    { es: "Ver todo",              en: "View all",           zh: "查看全部" },
  "common.add":        { es: "Agregar",               en: "Add",                zh: "添加" },
  "common.required":   { es: "Obligatorio",           en: "Required",           zh: "必填" },
  "common.optional":   { es: "Opcional",              en: "Optional",           zh: "可选" },
  "common.yes":        { es: "Sí",                    en: "Yes",                zh: "是" },
  "common.no":         { es: "No",                    en: "No",                 zh: "否" },
  "common.total":      { es: "Total",                 en: "Total",              zh: "合计" },
  "common.subtotal":   { es: "Subtotal",              en: "Subtotal",           zh: "小计" },
  "common.amount":     { es: "Monto",                 en: "Amount",             zh: "金额" },
  "common.date":       { es: "Fecha",                 en: "Date",               zh: "日期" },
  "common.status":     { es: "Estado",                en: "Status",             zh: "状态" },
  "common.notes":      { es: "Notas",                 en: "Notes",              zh: "备注" },
  "common.description":{ es: "Descripción",           en: "Description",        zh: "描述" },
  "common.empty":      { es: "Sin datos",             en: "No data",            zh: "无数据" },
  "common.error":      { es: "Error",                 en: "Error",              zh: "错误" },
  "common.retry":      { es: "Reintentar",            en: "Retry",              zh: "重试" },
  "common.copy":       { es: "Copiar",                en: "Copy",               zh: "复制" },
  "common.copied":     { es: "Copiado",               en: "Copied",             zh: "已复制" },
  "common.share":      { es: "Compartir",             en: "Share",              zh: "分享" },
  "common.from":       { es: "Desde",                 en: "From",               zh: "从" },
  "common.to":         { es: "A",                     en: "To",                 zh: "到" },
  "common.day":        { es: "día",                   en: "day",                zh: "天" },
  "common.days":       { es: "días",                  en: "days",               zh: "天" },
  "common.month":      { es: "mes",                   en: "month",              zh: "月" },
  "common.months":     { es: "meses",                 en: "months",             zh: "个月" },
  "common.year":       { es: "año",                   en: "year",               zh: "年" },
  "common.weight":     { es: "Peso",                  en: "Weight",             zh: "重量" },
  "common.volume":     { es: "Volumen",               en: "Volume",             zh: "体积" },
  "common.quantity":   { es: "Cantidad",              en: "Quantity",           zh: "数量" },
  "common.price":      { es: "Precio",                en: "Price",              zh: "价格" },
  "common.cost":       { es: "Costo",                 en: "Cost",               zh: "成本" },
  "common.paid":       { es: "Pagado",                en: "Paid",               zh: "已付" },
  "common.pending":    { es: "Pendiente",             en: "Pending",            zh: "待处理" },

  // ── AUTH (login / registro) ─────────────────────────────────
  "auth.login.title":      { es: "Iniciar sesión",                  en: "Sign in",                       zh: "登录" },
  "auth.login.subtitle":   { es: "Bienvenido de vuelta",            en: "Welcome back",                  zh: "欢迎回来" },
  "auth.email":            { es: "Email",                           en: "Email",                         zh: "邮箱" },
  "auth.password":         { es: "Contraseña",                      en: "Password",                      zh: "密码" },
  "auth.login.button":     { es: "Ingresar",                        en: "Sign in",                       zh: "登录" },
  "auth.login.loading":    { es: "Ingresando…",                     en: "Signing in…",                   zh: "登录中…" },
  "auth.noAccount":        { es: "¿No tenés cuenta?",               en: "Don't have an account?",        zh: "还没有账户？" },
  "auth.register.cta":     { es: "Registrate",                      en: "Sign up",                       zh: "注册" },
  "auth.register.title":   { es: "Crear cuenta",                    en: "Create account",                zh: "创建账户" },
  "auth.haveAccount":      { es: "¿Ya tenés cuenta?",               en: "Already have an account?",      zh: "已有账户？" },
  "auth.login.cta":        { es: "Iniciá sesión",                   en: "Sign in",                       zh: "登录" },
  "auth.firstName":        { es: "Nombre",                          en: "First name",                    zh: "名字" },
  "auth.lastName":         { es: "Apellido",                        en: "Last name",                     zh: "姓氏" },
  "auth.dni":              { es: "DNI",                             en: "ID number",                     zh: "身份证号" },
  "auth.cuit":             { es: "CUIT",                            en: "Tax ID",                        zh: "税号" },
  "auth.whatsapp":         { es: "WhatsApp",                        en: "WhatsApp",                      zh: "WhatsApp" },
  "auth.address":          { es: "Dirección",                       en: "Address",                       zh: "地址" },
  "auth.city":             { es: "Ciudad",                          en: "City",                          zh: "城市" },
  "auth.province":         { es: "Provincia",                       en: "State / Province",              zh: "省份" },
  "auth.taxCondition":     { es: "Condición fiscal",                en: "Tax condition",                 zh: "税务状况" },
  "auth.passwordConfirm":  { es: "Confirmar contraseña",            en: "Confirm password",              zh: "确认密码" },
  "auth.referredBy":       { es: "Código de referido (opcional)",   en: "Referral code (optional)",      zh: "推荐码（可选）" },
  "auth.invalid":          { es: "Credenciales inválidas",          en: "Invalid credentials",           zh: "凭证无效" },
  "auth.forgotPassword":   { es: "¿Olvidaste tu contraseña?",       en: "Forgot password?",              zh: "忘记密码？" },
  "auth.resetSent":        { es: "Te enviamos un email para restablecerla.", en: "We sent you an email to reset it.", zh: "我们已发送邮件以重置密码。" },
  "auth.register.success": { es: "Te registraste con éxito. Ya podés iniciar sesión.", en: "Successfully registered. You can sign in now.", zh: "注册成功。您可以登录了。" },

  // ── IMPORTS ─────────────────────────────────
  "imports.title":         { es: "Mis importaciones",               en: "My imports",                    zh: "我的进口" },
  "imports.empty.title":   { es: "Todavía no tenés importaciones",  en: "You don't have any imports yet",zh: "您还没有任何进口" },
  "imports.empty.desc":    { es: "Cuando hagas tu primera operación, va a aparecer acá.", en: "When you start your first operation, it will appear here.", zh: "当您开始第一次操作时，将显示在这里。" },
  "imports.active":        { es: "Activas",                         en: "Active",                        zh: "进行中" },
  "imports.closed":        { es: "Cerradas",                        en: "Closed",                        zh: "已关闭" },
  "imports.code":          { es: "Código",                          en: "Code",                          zh: "编号" },
  "imports.product":       { es: "Mercadería",                      en: "Goods",                         zh: "商品" },
  "imports.channel":       { es: "Canal",                           en: "Channel",                       zh: "渠道" },
  "imports.origin":        { es: "Origen",                          en: "Origin",                        zh: "来源" },
  "imports.eta":           { es: "ETA",                             en: "ETA",                           zh: "预计到达" },
  "imports.balance":       { es: "Saldo",                           en: "Balance",                       zh: "余额" },
  "imports.budgetTotal":   { es: "Total presupuesto",               en: "Quote total",                   zh: "报价总额" },
  "imports.paid":          { es: "Ya pagaste",                      en: "Already paid",                  zh: "已支付" },
  "imports.remaining":     { es: "Falta abonar",                    en: "Still due",                     zh: "尚未支付" },
  "imports.fullyPaid":     { es: "PAGADO EN SU TOTALIDAD",          en: "FULLY PAID",                    zh: "已全额支付" },
  "imports.payNow":        { es: "Pagar ahora",                     en: "Pay now",                       zh: "立即支付" },
  "imports.viewQuote":     { es: "Ver presupuesto",                 en: "View quote",                    zh: "查看报价" },
  "imports.viewSummary":   { es: "Ver resumen final",               en: "View final summary",            zh: "查看最终摘要" },
  "imports.timeline":      { es: "Línea de tiempo",                 en: "Timeline",                      zh: "时间线" },
  "imports.events":        { es: "Eventos",                         en: "Events",                        zh: "事件" },
  "imports.products":      { es: "Productos",                       en: "Products",                      zh: "产品" },
  "imports.packages":      { es: "Bultos",                          en: "Packages",                      zh: "包裹" },
  "imports.taxes":         { es: "Impuestos",                       en: "Duties",                        zh: "关税" },
  "imports.freight":       { es: "Flete internacional",             en: "International freight",         zh: "国际运费" },
  "imports.insurance":     { es: "Seguro",                          en: "Insurance",                     zh: "保险" },
  "imports.shipping":      { es: "Envío a domicilio",               en: "Home delivery",                 zh: "送货上门" },
  "imports.declareGoods":  { es: "Declarar productos",              en: "Declare goods",                 zh: "申报商品" },
  "imports.editGoods":     { es: "Editar productos",                en: "Edit goods",                    zh: "编辑商品" },
  "imports.consolidated":  { es: "CONSOLIDADO",                     en: "CONSOLIDATED",                  zh: "合并货物" },

  // ── PURCHASE NOTIFICATIONS ─────────────────────────────────
  "pnotif.title":          { es: "Compras en camino",               en: "Purchases in transit",          zh: "在途采购" },
  "pnotif.subtitle":       { es: "Avisanos cuando hagas una compra para que te la esperemos en el depósito.", en: "Let us know about your purchase so we can wait for it at the warehouse.", zh: "请告知您的采购，以便我们在仓库等待。" },
  "pnotif.new":            { es: "Nueva compra",                    en: "New purchase",                  zh: "新采购" },
  "pnotif.empty":          { es: "Sin compras en camino",           en: "No purchases in transit",       zh: "没有在途采购" },
  "pnotif.tracking":       { es: "Tracking de la compra",           en: "Tracking number",               zh: "追踪号" },
  "pnotif.trackings":      { es: "Trackings de la compra",          en: "Tracking numbers",              zh: "追踪号" },
  "pnotif.addTracking":    { es: "Agregar otro tracking",           en: "Add another tracking",          zh: "添加另一个追踪号" },
  "pnotif.shippingMethod": { es: "Modalidad",                       en: "Shipping method",               zh: "运输方式" },
  "pnotif.aereo":          { es: "Aéreo",                           en: "Air",                           zh: "空运" },
  "pnotif.maritimo":       { es: "Marítimo",                        en: "Sea",                           zh: "海运" },
  "pnotif.estimatedPkgs":  { es: "Bultos estimados",                en: "Estimated packages",            zh: "预计包裹数" },
  "pnotif.estimatedDate":  { es: "Fecha estimada de despacho",      en: "Estimated dispatch date",       zh: "预计发货日期" },
  "pnotif.statusPending":  { es: "Pendiente",                       en: "Pending",                       zh: "待处理" },
  "pnotif.statusPartial":  { es: "Parcial",                         en: "Partial",                       zh: "部分" },
  "pnotif.statusComplete": { es: "Completa",                        en: "Complete",                      zh: "完成" },
  "pnotif.statusCancelled":{ es: "Cancelada",                       en: "Cancelled",                     zh: "已取消" },
  "pnotif.cancel":         { es: "Cancelar aviso",                  en: "Cancel notice",                 zh: "取消通知" },
  "pnotif.dupWarning":     { es: "Tracking duplicado",              en: "Duplicate tracking",            zh: "重复追踪号" },

  // ── CALCULATOR ─────────────────────────────────
  "calc.title":            { es: "Calculadora de importación",      en: "Import calculator",             zh: "进口计算器" },
  "calc.subtitle":         { es: "Cotizá tu importación al instante", en: "Get an instant import quote", zh: "立即获取进口报价" },
  "calc.origin":           { es: "Origen",                          en: "Origin",                        zh: "来源" },
  "calc.products":         { es: "Productos",                       en: "Products",                      zh: "产品" },
  "calc.packages":         { es: "Bultos",                          en: "Packages",                      zh: "包裹" },
  "calc.delivery":         { es: "Entrega",                         en: "Delivery",                      zh: "交付" },
  "calc.results":          { es: "Resultados",                      en: "Results",                       zh: "结果" },
  "calc.addProduct":       { es: "+ Agregar producto",              en: "+ Add product",                 zh: "+ 添加产品" },
  "calc.addPackage":       { es: "+ Agregar bulto",                 en: "+ Add package",                 zh: "+ 添加包裹" },
  "calc.product":          { es: "Producto",                        en: "Product",                       zh: "产品" },
  "calc.qty":              { es: "Cantidad",                        en: "Qty",                           zh: "数量" },
  "calc.unitPrice":        { es: "Precio unitario (USD)",           en: "Unit price (USD)",              zh: "单价 (USD)" },
  "calc.dimensions":       { es: "Dimensiones (cm)",                en: "Dimensions (cm)",               zh: "尺寸 (cm)" },
  "calc.length":           { es: "Largo",                           en: "Length",                        zh: "长" },
  "calc.width":            { es: "Ancho",                           en: "Width",                         zh: "宽" },
  "calc.height":           { es: "Alto",                            en: "Height",                        zh: "高" },
  "calc.weight":           { es: "Peso (kg)",                       en: "Weight (kg)",                   zh: "重量 (kg)" },
  "calc.noDims":           { es: "Sin medidas (solo aéreo)",        en: "No dimensions (air only)",      zh: "无尺寸（仅空运）" },
  "calc.deliveryTitle":    { es: "¿Cómo querés recibirla?",         en: "How do you want to receive it?",zh: "您希望如何收货？" },
  "calc.pickup":           { es: "Retiro en depósito",              en: "Pickup at warehouse",           zh: "仓库自提" },
  "calc.pickupDesc":       { es: "Sin costo · CABA",                en: "Free · Buenos Aires",           zh: "免费 · 布宜诺斯艾利斯" },
  "calc.toDoor":            { es: "Envío a domicilio",              en: "Home delivery",                 zh: "送货上门" },
  "calc.toDoorDesc":        { es: "Costo según destino",            en: "Cost depends on destination",   zh: "费用取决于目的地" },
  "calc.totals":           { es: "Totales",                         en: "Totals",                        zh: "总计" },
  "calc.compareChannels":  { es: "Comparar canales",                en: "Compare channels",              zh: "比较渠道" },
  "calc.recommended":      { es: "Recomendado",                     en: "Recommended",                   zh: "推荐" },
  "calc.cheapest":         { es: "Más barato",                      en: "Cheapest",                      zh: "最便宜" },
  "calc.fastest":          { es: "Más rápido",                      en: "Fastest",                       zh: "最快" },
  "calc.requestQuote":     { es: "Pedir cotización",                en: "Request quote",                 zh: "请求报价" },
  "calc.saveQuote":        { es: "Guardar cotización",              en: "Save quote",                    zh: "保存报价" },
  "calc.saved":            { es: "Cotización guardada",             en: "Quote saved",                   zh: "报价已保存" },
  "calc.fobValue":         { es: "Valor FOB",                       en: "FOB value",                     zh: "离岸价" },
  "calc.cifValue":         { es: "Valor CIF",                       en: "CIF value",                     zh: "到岸价" },
  "calc.taxes":            { es: "Impuestos",                       en: "Duties + VAT",                  zh: "关税" },
  "calc.totalToPay":       { es: "Total a pagar",                   en: "Total to pay",                  zh: "应付总额" },

  // ── PROFILE ─────────────────────────────────
  "profile.title":         { es: "Mi perfil",                       en: "My profile",                    zh: "我的资料" },
  "profile.personalData":  { es: "Datos personales",                en: "Personal data",                 zh: "个人数据" },
  "profile.contactData":   { es: "Datos de contacto",               en: "Contact data",                  zh: "联系信息" },
  "profile.shippingData":  { es: "Datos de envío",                  en: "Shipping data",                 zh: "配送信息" },
  "profile.tier":          { es: "Tier",                            en: "Tier",                          zh: "等级" },
  "profile.changePassword":{ es: "Cambiar contraseña",              en: "Change password",               zh: "更改密码" },
  "profile.currentPassword":{ es: "Contraseña actual",              en: "Current password",              zh: "当前密码" },
  "profile.newPassword":   { es: "Nueva contraseña",                en: "New password",                  zh: "新密码" },
  "profile.changed":       { es: "Cambios guardados",               en: "Changes saved",                 zh: "更改已保存" },

  // ── ACCOUNT (cuenta corriente) ─────────────────────────────────
  "acc.title":             { es: "Cuenta corriente",                en: "Account",                       zh: "账户" },
  "acc.balance":           { es: "Saldo",                           en: "Balance",                       zh: "余额" },
  "acc.credit":            { es: "Saldo a favor",                   en: "Credit balance",                zh: "贷方余额" },
  "acc.debt":              { es: "Deuda",                           en: "Debt",                          zh: "欠款" },
  "acc.movements":         { es: "Movimientos",                     en: "Movements",                     zh: "交易记录" },
  "acc.empty":             { es: "Sin movimientos",                 en: "No movements",                  zh: "无交易记录" },
  "acc.movement":          { es: "Movimiento",                      en: "Movement",                      zh: "交易" },

  // ── POINTS ─────────────────────────────────
  "points.title":          { es: "Mis puntos Argencargo",           en: "My Argencargo points",          zh: "我的积分" },
  "points.balance":        { es: "Puntos disponibles",              en: "Available points",              zh: "可用积分" },
  "points.lifetime":       { es: "Acumulados de por vida",          en: "Lifetime earned",               zh: "终身累积" },
  "points.tier":           { es: "Nivel actual",                    en: "Current tier",                  zh: "当前等级" },
  "points.nextTier":       { es: "Próximo nivel",                   en: "Next tier",                     zh: "下一等级" },
  "points.toNextTier":     { es: "para el próximo nivel",           en: "to next tier",                  zh: "距下一等级" },
  "points.history":        { es: "Historial",                       en: "History",                       zh: "历史" },
  "points.earned":         { es: "Ganados",                         en: "Earned",                        zh: "已获得" },
  "points.redeemed":       { es: "Canjeados",                       en: "Redeemed",                      zh: "已兑换" },
  "points.expired":        { es: "Vencidos",                        en: "Expired",                       zh: "已过期" },
  "points.rewards":        { es: "Premios disponibles",             en: "Available rewards",             zh: "可用奖励" },
  "points.redeem":         { es: "Canjear",                         en: "Redeem",                        zh: "兑换" },
  "points.redeemed.ok":    { es: "Premio canjeado",                 en: "Reward redeemed",               zh: "奖励已兑换" },

  // ── REFERRALS ─────────────────────────────────
  "ref.title":             { es: "Programa de referidos",           en: "Referral program",              zh: "推荐计划" },
  "ref.subtitle":          { es: "Invitá amigos y ganá puntos cuando hagan su primera importación.", en: "Invite friends and earn points when they make their first import.", zh: "邀请朋友，当他们完成首次进口时您将获得积分。" },
  "ref.code":              { es: "Tu código",                       en: "Your code",                     zh: "您的代码" },
  "ref.link":              { es: "Tu link",                         en: "Your link",                     zh: "您的链接" },
  "ref.howWorks":          { es: "Cómo funciona",                   en: "How it works",                  zh: "如何运作" },
  "ref.shareLink":         { es: "Compartí tu link",                en: "Share your link",               zh: "分享您的链接" },
  "ref.theyRegister":      { es: "Tu amigo se registra y hace su primera importación", en: "Your friend signs up and makes their first import", zh: "您的朋友注册并完成首次进口" },
  "ref.youGet":            { es: "Ganás puntos al confirmar la importación", en: "You earn points when their import is confirmed", zh: "确认进口时您将获得积分" },
  "ref.invitedBy":         { es: "Invitados por vos",               en: "Invited by you",                zh: "您邀请的" },
  "ref.empty":             { es: "Todavía no invitaste a nadie",    en: "You haven't invited anyone yet",zh: "您还未邀请任何人" },

  // ── SERVICES ─────────────────────────────────
  "svc.title":             { es: "Nuestros servicios",              en: "Our services",                  zh: "我们的服务" },
  "svc.subtitle":          { es: "Todo lo que podemos hacer por vos", en: "Everything we can do for you",zh: "我们能为您提供的一切" },

  // ── QUOTES (cotizaciones guardadas) ─────────────────────────────────
  "quotes.title":          { es: "Mis cotizaciones",                en: "My quotes",                     zh: "我的报价" },
  "quotes.empty":          { es: "Todavía no guardaste cotizaciones",en: "You haven't saved any quotes yet", zh: "您还未保存任何报价" },
  "quotes.savedAt":        { es: "Guardada el",                     en: "Saved on",                      zh: "保存于" },
  "quotes.useThis":        { es: "Pedir esta cotización",           en: "Request this quote",            zh: "请求此报价" },
  "quotes.delete":         { es: "Eliminar cotización",             en: "Delete quote",                  zh: "删除报价" },

  // ── INTERNATIONAL PAYMENTS ─────────────────────────────────
  "pay.title":             { es: "Pagos internacionales",           en: "International payments",        zh: "国际支付" },
  "pay.subtitle":          { es: "Te pagamos a tu proveedor en el exterior.", en: "We pay your supplier abroad for you.", zh: "我们替您支付海外供应商。" },
  "pay.howWorks":          { es: "Cómo funciona",                   en: "How it works",                  zh: "如何运作" },
  "pay.requestNew":        { es: "Solicitar nuevo pago",            en: "Request new payment",           zh: "请求新支付" },

  // ── SUPPORT (tickets) ─────────────────────────────────
  "support.title":         { es: "Soporte",                         en: "Support",                       zh: "客户支持" },
  "support.subtitle":      { es: "Centro de ayuda y reclamos.",     en: "Help & complaints center.",     zh: "帮助与投诉中心。" },
  "support.new":           { es: "Nuevo ticket",                    en: "New ticket",                    zh: "新工单" },
  "support.subject":       { es: "Asunto",                          en: "Subject",                       zh: "主题" },
  "support.description":   { es: "Descripción",                     en: "Description",                   zh: "描述" },
  "support.priority":      { es: "Prioridad",                       en: "Priority",                      zh: "优先级" },
  "support.category":      { es: "Categoría",                       en: "Category",                      zh: "类别" },
  "support.empty":         { es: "Todavía no abriste tickets.",     en: "You haven't opened any tickets yet.", zh: "您还没有提交工单。" },
  "support.reply":         { es: "Responder",                       en: "Reply",                         zh: "回复" },
  "support.you":           { es: "Vos",                             en: "You",                           zh: "您" },

  // ── STATUS LABELS (op estados — versión portal corta) ─────────────────────────────────
  "opStatus.pendiente":           { es: "PROVEEDOR",                en: "SUPPLIER",                      zh: "供应商" },
  "opStatus.en_deposito_origen":  { es: "DEPÓSITO ARGENCARGO",      en: "ARGENCARGO WAREHOUSE",          zh: "ARGENCARGO 仓库" },
  "opStatus.en_preparacion":      { es: "DOCUMENTACIÓN",            en: "DOCUMENTATION",                 zh: "文件准备" },
  "opStatus.en_transito":         { es: "EN TRÁNSITO",              en: "IN TRANSIT",                    zh: "运输中" },
  "opStatus.arribo_argentina":    { es: "ARRIBÓ A ARGENTINA",       en: "ARRIVED IN ARGENTINA",          zh: "已抵达阿根廷" },
  "opStatus.en_aduana":           { es: "GESTIÓN ADUANERA",         en: "CUSTOMS PROCESSING",            zh: "海关处理" },
  "opStatus.entregada":           { es: "LISTA PARA RETIRAR",       en: "READY FOR PICKUP",              zh: "可提取" },
  "opStatus.operacion_cerrada":   { es: "OPERACIÓN CERRADA",        en: "CLOSED",                        zh: "已关闭" },
  "opStatus.cancelada":           { es: "CANCELADA",                en: "CANCELLED",                     zh: "已取消" },

  // ── HOME / DASHBOARD strings ─────────────────────────────────
  "home.hello":            { es: "Hola, {name}",                     en: "Hello, {name}",                 zh: "您好，{name}" },
  "home.subtitle":         { es: "Tu panel de importaciones en tiempo real", en: "Your real-time imports dashboard", zh: "您的实时进口面板" },
  "home.totalImports":     { es: "Total importaciones",              en: "Total imports",                 zh: "总进口数" },
  "home.inProgress":       { es: "En curso",                         en: "In progress",                   zh: "进行中" },
  "home.completed":        { es: "Finalizadas",                      en: "Completed",                     zh: "已完成" },
  "home.reports":          { es: "Reportes",                         en: "Reports",                       zh: "报告" },
  "home.consolidation.q":  { es: "Tu paquete llegó a nuestro depósito. ¿Vas a enviar más paquetes o es el único?", en: "Your package arrived at our warehouse. Will you send more packages or is this the only one?", zh: "您的包裹已到达我们的仓库。您还会再发更多包裹还是只有这一个？" },
  "home.consolidation.btn":{ es: "Es el único, pueden enviarlo",     en: "That's the only one, send it", zh: "只有这一个，可以发货" },
  "home.confirming":       { es: "Confirmando…",                     en: "Confirming…",                   zh: "确认中…" },
  "home.docMissing":       { es: "Completá la documentación de tu carga para avanzar", en: "Complete your shipment documentation to move forward", zh: "请完成货物文件以继续" },
  "home.addProducts":      { es: "+ Agregar productos",              en: "+ Add products",                zh: "+ 添加产品" },
  "home.tierDiscount":     { es: "Descuento {tier} aplicado",        en: "{tier} discount applied",       zh: "{tier} 折扣已应用" },
  "home.tierDiscountDesc": { es: "Se te aplicó automáticamente tu beneficio de tier", en: "Your tier benefit was applied automatically", zh: "您的等级优惠已自动应用" },
  "home.activeImports":    { es: "Importaciones activas",            en: "Active imports",                zh: "进行中的进口" },
  "home.closedImports":    { es: "Importaciones cerradas",           en: "Closed imports",                zh: "已关闭的进口" },

  // ── CHANNELS ─────────────────────────────────
  "channel.aereo_blanco":   { es: "Aéreo Courier Comercial",   en: "Air Commercial Courier",     zh: "商业空运快递" },
  "channel.aereo_negro":    { es: "Aéreo Integral AC",         en: "Air Full-Service AC",        zh: "AC 全包空运" },
  "channel.maritimo_blanco":{ es: "Marítimo Carga LCL/FCL",    en: "Sea LCL/FCL Cargo",          zh: "海运 LCL/FCL" },
  "channel.maritimo_negro": { es: "Marítimo Integral AC",      en: "Sea Full-Service AC",        zh: "AC 全包海运" },

  // ── ORIGINS ─────────────────────────────────
  "origin.china":          { es: "China",                            en: "China",                         zh: "中国" },
  "origin.usa":            { es: "Estados Unidos",                   en: "United States",                 zh: "美国" },
  "origin.españa":         { es: "España",                           en: "Spain",                         zh: "西班牙" },

  // ── TAX CONDITIONS ─────────────────────────────────
  "tax.consumidor_final":      { es: "Consumidor final",         en: "Final consumer",                zh: "最终消费者" },
  "tax.responsable_inscripto": { es: "Responsable inscripto",    en: "Registered taxpayer",           zh: "注册纳税人" },
  "tax.monotributista":        { es: "Monotributista",           en: "Sole proprietor (Monotributo)", zh: "个体经营者" },

  // ── TIERS ─────────────────────────────────
  "tier.standard":         { es: "Standard",                         en: "Standard",                      zh: "标准" },
  "tier.silver":           { es: "Silver",                           en: "Silver",                        zh: "银级" },
  "tier.gold":             { es: "Gold",                             en: "Gold",                          zh: "金级" },
  "tier.diamond":          { es: "Diamond",                          en: "Diamond",                       zh: "钻石级" },
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

export function translate(key, lang = "es", vars = null) {
  const entry = DICT[key];
  if (!entry) return key;
  let s = entry[lang] || entry.es || key;
  // Soporte simple de interpolación: t("foo.bar", { count: 3 }) => "... 3 ..."
  if (vars && typeof s === "string") {
    for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return s;
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
    t: (key, vars) => translate(key, lang, vars),
  };
}
