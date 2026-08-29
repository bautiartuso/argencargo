# Bot de entregas por WhatsApp — guía de encendido

Todo el bot ya está programado y deployado. Para encenderlo solo hay que conectarle
el número de WhatsApp (cuenta de Meta) y cargar 4 plantillas. Nada más.

## Cómo funciona (resumen)

| Momento | Mensaje | ¿IA? (costo) |
|---|---|---|
| La carga queda lista (mismo gatillo que el mail) | Plantilla `carga_lista` con el link | No — $0 |
| No coordinó: cada 60 h (máx. 5 veces) | Plantilla `recordatorio_coordinar` | No — $0 |
| Coordinó por el link | Plantilla `coordinacion_confirmada` con día, franja, total y detalle de pago | No — $0 |
| Transferencia sin pagar, sin retirar, a los 7 días (cada 60 h, máx. 5) | Plantilla `recordatorio_pago` (semana 1 de almacenaje gratis, después pago o costo diario) | No — $0 |
| **El cliente escribe** | El agente responde: estado, reprogramar, cambiar pago/modalidad, agrupar cargas | Sí — centavos |
| El cliente manda comprobante | Se guarda en el sistema, se adjunta a la op y te notifica; el bot agradece | No confirma pagos |

El agente deriva a un humano (te llega notificación + push): reclamos, precios,
zonas fuera de reparto, números desconocidos, confirmar pagos, transportista externo.

## Paso 1 — Cuenta de Meta (~20 min, lo hacés vos)

1. Conseguí un número NUEVO dedicado (que nunca haya tenido WhatsApp).
2. Entrá a https://developers.facebook.com → **Create App** → tipo **Business**.
3. En la app: **Add product → WhatsApp** → asociá tu Meta Business y registrá el número.
4. En *WhatsApp → API Setup* copiá: **Phone number ID** y generá un **token permanente**
   (System User con permiso `whatsapp_business_messaging`).
5. Inventá un **verify token** (cualquier texto, ej. `argencargo-bot-2026`).
6. Cargá las 3 credenciales en Vercel (Settings → Environment Variables → Production):
   - `WA_TOKEN` — el token permanente
   - `WA_PHONE_ID` — el Phone number ID
   - `WA_VERIFY_TOKEN` — el que inventaste
7. En *WhatsApp → Configuration → Webhook*:
   - Callback URL: `https://www.argencargo.com.ar/api/bot/whatsapp`
   - Verify token: el mismo de arriba
   - Suscribirse al campo **messages**.
8. Redeploy en Vercel (o pedirle a Claude que pushee cualquier cosa) para que tome las env.

## Paso 2 — Plantillas (en Meta → WhatsApp Manager → Message templates)

Crear estas 4, categoría **Utility**, idioma **Spanish (ARG)** (`es_AR`), con estos
nombres y cuerpos EXACTOS (las variables `{{n}}` las completa el sistema):

**`carga_lista`**
> Hola {{1}}! 🎉 Tu carga de {{2}} ya está lista. Entrá acá para elegir cómo la recibís, el día y la forma de pago: {{3}}

**`recordatorio_coordinar`**
> Hola {{1}}! Te recordamos que tu carga de {{2}} sigue lista y pendiente de coordinar. Elegí el día, el horario y la forma de pago acá: {{3}}

**`coordinacion_confirmada`**
> {{1}}, quedó coordinada tu entrega de {{2}} ✅ {{3}}. Total a abonar: {{4}}. {{5}} Si necesitás cambiar el día, el horario o la forma de pago, respondé este mensaje.

**`recordatorio_pago`**
> Hola {{1}}! La operación {{2}} tiene un saldo pendiente de {{3}}. {{4}} Cualquier duda, respondé por acá.

La aprobación de Meta suele tardar de minutos a horas.

## Paso 3 — Probar

Escribile al número desde tu WhatsApp personal: el agente te responde (tu número
está cargado como cliente, o te pide identificarte). Marcá una carga como lista en
el panel: tiene que llegar el mail Y el WhatsApp.

## Detalles técnicos

- Webhook y agente: `app/api/bot/whatsapp/route.js` (historial en `bot_conversations`, 24 h).
- API de entregas: `app/api/bot/entrega/route.js` (auth `CRON_SECRET`).
- Envíos/plantillas/media: `lib/wa.js` — **sin credenciales todo es no-op**, no rompe nada.
- Recordatorios: cron `app/api/cron/bot-entregas` (cada hora, minuto 30). `?dry=1` simula.
- Aviso de carga lista: enganchado en `/api/notify` (trigger `retiro`), marca `sent_notifications.wa_retiro`.
- Modo test del agente sin WhatsApp: `POST /api/bot/whatsapp` con `{test:true, from, text}` y `Authorization: Bearer BOT_TEST_SECRET`.
