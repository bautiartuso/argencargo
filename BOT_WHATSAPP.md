# Bot de entregas por WhatsApp — guía de encendido

Todo el bot ya está programado y deployado. Para encenderlo solo hay que conectarle
el número de WhatsApp (cuenta de Meta) y cargar 5 plantillas. Nada más.

## Cómo funciona (resumen)

| Momento | Mensaje | ¿IA? (costo) |
|---|---|---|
| La carga queda lista (mismo gatillo que el mail) | `carga_lista` con el link | No — $0 |
| +60 h sin coordinar → 1º recordatorio | `recordatorio_coordinar` (simple) | No — $0 |
| +60 h → 2º recordatorio | `recordatorio_almacenaje` (paga = almacenaje gratis sin límite; sin pagar = puede correr costo diario) | No — $0 |
| +60 h → 3º y ÚLTIMO | `recordatorio_final` (sin coordinar y sin pagar: desde ahora corren gastos diarios) + **pasa a gestión humana** (te notifica) | No — $0 |
| Coordinó por el link | `coordinacion_confirmada`: día, franja, total, detalle de pago, "respondé para cambiar" | No — $0 |
| **El cliente escribe** | El agente responde: estado, reprogramar, cambiar pago/modalidad (calcula el costo de envío por zona), agrupar cargas | Sí — centavos |
| Manda un comprobante | Se guarda, queda adjunto a la op, te notifica, se reenvía a tu WhatsApp interno, y queda **precargado en el modal 💰 Cobrar** (al registrar el cobro fluye a la CC financiera) | No confirma pagos |

Después del 3º recordatorio el bot no insiste más — la gestión es tuya.
El agente deriva a humano: reclamos, precios, zonas fuera de reparto, números
desconocidos, confirmar pagos, transportista externo.

## Paso 1 — Cuenta de Meta (~20 min, lo hacés vos)

1. Conseguí un número NUEVO dedicado (que nunca haya tenido WhatsApp).
2. https://developers.facebook.com → **Create App** → tipo **Business**.
3. **Add product → WhatsApp** → asociá tu Meta Business y registrá el número.
4. En *WhatsApp → API Setup*: copiá el **Phone number ID** y generá un **token permanente**
   (System User con permiso `whatsapp_business_messaging`).
5. Inventá un **verify token** (cualquier texto, ej. `argencargo-bot-2026`).
6. Cargá en Vercel (Settings → Environment Variables → Production):
   - `WA_TOKEN` — token permanente
   - `WA_PHONE_ID` — Phone number ID
   - `WA_VERIFY_TOKEN` — el que inventaste
   - `WA_COMPROBANTES_TO` — (opcional) tu número personal, para que te reenvíe cada
     comprobante. Ojo: por regla de Meta solo llega si vos le escribiste al bot en las
     últimas 24 h (mandale un "hola" cada tanto). **A grupos no se puede** — la API
     oficial de WhatsApp no permite bots en grupos.
7. En *WhatsApp → Configuration → Webhook*:
   - Callback URL: `https://www.argencargo.com.ar/api/bot/whatsapp`
   - Verify token: el mismo · Suscribirse al campo **messages**.
8. Redeploy en Vercel para que tome las variables.

## Paso 2 — Plantillas (Meta → WhatsApp Manager → Message templates)

Crear estas 5, categoría **Utility**, idioma **Spanish (ARG)** (`es_AR`), con estos
nombres y cuerpos EXACTOS (las `{{n}}` las completa el sistema):

**`carga_lista`**
> Hola {{1}}! 🎉 Tu carga de {{2}} ya está lista. Entrá acá para elegir cómo la recibís, el día y la forma de pago: {{3}}

**`recordatorio_coordinar`**
> Hola {{1}}! Te recordamos que tu carga de {{2}} ya está lista y sigue pendiente de coordinar. Elegí el día, el horario y la forma de pago acá: {{3}}

**`recordatorio_almacenaje`**
> Hola {{1}}! Tu carga de {{2}} sigue pendiente de retirar. Si abonás el saldo, te la almacenamos sin cargo todo el tiempo que necesites; si no está paga, pueden correr costos de almacenaje diario. Coordiná y aboná acá: {{3}}

**`recordatorio_final`**
> Hola {{1}}! Tu carga de {{2}} sigue pendiente de coordinar y de pago. A partir de hoy comienzan a correr gastos diarios de almacenaje. Coordiná y aboná acá: {{3}}

**`coordinacion_confirmada`**
> {{1}}, quedó coordinada tu entrega de {{2}} ✅ {{3}}. Total a abonar: {{4}}. {{5}} Si necesitás cambiar el día, el horario o la forma de pago, respondé este mensaje.

La aprobación de Meta suele tardar de minutos a horas.

## Paso 3 — Probar

Escribile al número desde tu WhatsApp personal. Marcá una carga como lista en el
panel: tiene que llegar el mail Y el WhatsApp.

## Detalles técnicos

- Webhook y agente: `app/api/bot/whatsapp/route.js` (historial `bot_conversations`, 24 h).
- API de entregas: `app/api/bot/entrega/route.js` (auth `CRON_SECRET`).
- Envíos/plantillas/media/reenvío: `lib/wa.js` — **sin credenciales todo es no-op**.
- Recordatorios: cron `app/api/cron/bot-entregas` (cada hora al minuto 30). `?dry=1` simula.
- Aviso de carga lista: en `/api/notify` (trigger `retiro`), marca `sent_notifications.wa_retiro`.
- Modo test del agente sin WhatsApp: `POST /api/bot/whatsapp` con `{test:true, from, text}` y `Authorization: Bearer BOT_TEST_SECRET`.
