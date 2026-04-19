# Argencargo — Roadmap de mejoras

Ideas priorizadas por impacto/esfuerzo. Ver sesión de planning del 2026-04-19.

## 🟢 Hechas (check)
- [x] Top clientes por rentabilidad (admin financial dashboard)
- [x] PDF de cotizaciones (admin quotes)
- [x] Dashboard alertas (ops estancadas, ETA pasada, etc.)
- [x] Auto-sync de presupuestos al editar productos/bultos
- [x] Token refresh en los 3 portales
- [x] Status cards en tab Pagos
- [x] Monto real cobrado vs esperado en payment_management

## 🟡 En progreso / este sprint
- [x] Cohorts de clientes (retención, LTV)
- [x] Tiempos promedio por ruta
- [x] Botón "recordar cotización abandonada" en quotes admin
- [x] Tests básicos de calcOpBudget
- [x] Scaffold Sentry — archivos de config + wrap next.config listos. Falta: npm install + env vars.
- [x] Scaffold Meta/Google pixels — layout.js listo. Falta: env vars.
- [x] PDF del presupuesto en portal cliente (botón en la card de PRESUPUESTO)
- [x] API route /api/reviews + sección en landing (aparece sola cuando hay env vars)

## 🔵 Pendientes priorizados

### Alto impacto
- [ ] **Blog + SEO** — 4-6 artículos iniciales tipo "cómo importar desde China a Argentina 2026".
      Generar tráfico orgánico cualificado. Lento pero compuesto.
- [ ] **Notificaciones automáticas al cambiar estado** — WA/email se dispara sin click manual.
- [ ] **TC automático USD/ARS** (BCRA/DolarAPI).

### Setup pendiente (código listo, falta configurar env vars / npm install)
- [ ] **Sentry activar**: `npm install @sentry/nextjs` + en Vercel env vars:
      `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.
- [ ] **Pixels Meta/Google activar**: env vars en Vercel:
      `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GTAG_ID`.
- [ ] **Reseñas Google activar**: env vars en Vercel:
      `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID`. Place ID se saca desde:
      https://developers.google.com/maps/documentation/places/web-service/place-id

### Medio
- [ ] **Audit log** — tabla + middleware para trackear quién cambió qué y cuándo.
- [ ] **Recordatorio automático de pago** — op en lista_retiro con saldo > 0 por >2 días.
- [ ] **Alerta de márgenes bajos** — ops cerradas con ganancia < 10%.
- [ ] **Auto-close ops entregadas >30 días**.
- [ ] **Importador masivo CSV** para ops históricas.
- [ ] **Plantillas de mensajes editables desde UI** (hoy están hardcoded).
- [ ] **Centro de documentos** por op (BL, facturas, fotos).
- [ ] **Calendario de vencimientos** + Google Calendar.

### Bajo (nice-to-have)
- [ ] **Reporte mensual automático por email** con KPIs.
- [ ] **Programa de referidos** (points_balance ya existe en DB, activar flujo).
- [ ] **Análisis de productos top** importados por trimestre.
- [ ] **Conciliación bancaria** (import extracto + match).
- [ ] **Proyección de cash flow 30/60/90 días**.
- [ ] **Integración WhatsApp Business API**.
- [ ] **Integración MercadoPago** para cobros online.
- [ ] **Integración Stripe** para cobros del exterior en USD.
- [ ] **App mobile / PWA**.
- [ ] **Chat embebido** (Tawk/Crisp) en landing.

## 🔐 Infra / confiabilidad
- [ ] **Monitoreo errores con Sentry** (DSN pendiente).
- [ ] **Tests automáticos** más allá del calcOpBudget básico.
- [ ] **2FA para admin**.
- [ ] **Logs de auditoría** (ver "audit log" arriba).
- [ ] **Backups semanales exportados** al drive (Supabase ya hace diarios).
- [ ] **Rate limiting** en APIs públicas.
- [ ] **Versionado de presupuestos** (historial de cambios).
