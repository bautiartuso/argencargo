# Bot de entregas por WhatsApp — guía de encendido

Todo el bot ya está programado y deployado. Para encenderlo solo hay que conectarle
el número de WhatsApp (cuenta de Meta) y cargar 5 plantillas. Nada más.

## Cómo funciona (resumen)

| Momento | Mensaje | ¿IA? (costo) |
|---|---|---|
| La carga queda lista (mismo gatillo que el mail) | `carga_lista` con el link | No — $0 |
| +60 h sin coordinar → 1º recordatorio | `recordatorio_coordinar` (simple) | No — $0 |
| +60 h → 2º y ÚLTIMO recordatorio | `recordatorio_almacenaje` (paga = gratis sin límite; sin pagar = USD 0,5/día por kg) + **pasa a gestión humana** (te notifica) | No — $0 |
| Coordinó por el link | `coordinacion_confirmada`: día, franja, total, detalle de pago, "respondé para cambiar" | No — $0 |
| **El cliente escribe** | El agente responde: estado, reprogramar, cambiar pago/modalidad (calcula el costo de envío por zona), agrupar cargas | Sí — centavos |
| Manda un comprobante | Se guarda, queda adjunto a la op, te notifica, se reenvía a tu WhatsApp interno, y queda **precargado en el modal 💰 Cobrar** (al registrar el cobro fluye a la CC financiera) | No confirma pagos |

Después del 2º recordatorio el bot no insiste más — la gestión es tuya.
El agente deriva a humano: reclamos, precios, zonas fuera de reparto, números
desconocidos, confirmar pagos, transportista externo.

## Paso 1 — Cuenta de Meta (~20 min, lo hacés vos)

1. Conseguí un número NUEVO dedicado (que nunca haya tenido WhatsApp).
2. https://developers.facebook.com → **Create App** → tipo **Business**.
3. **Add product → WhatsApp** → asociá tu Meta Business y registrá el número.
   Como **display name** del número poné **"Argencargo Entregas"** (Meta exige que el
   nombre se relacione con el negocio; la marca visible además evita que los clientes
   desconfíen del número nuevo). Dentro del chat, el asistente se presenta como **Argy**.
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
> Hola {{1}}! 🎉
>
> Tu carga de {{2}} ya está lista en la oficina de Buenos Aires.
>
> Entrá acá para elegir cómo la recibís, el día y la forma de pago:
> {{3}}

**`recordatorio_coordinar`**
> Buenas {{1}}!
>
> Te recordamos que tu carga de {{2}} sigue pendiente de coordinar.
>
> Elegí el día, el horario y la forma de pago acá: {{3}}

**`recordatorio_almacenaje`**
> Hola {{1}}!
>
> Por favor recordá que tu carga de {{2}} sigue pendiente de coordinar.
>
> Podemos almacenar la mercadería durante el tiempo que necesites, pero necesitamos el pago!
>
> En caso de que no se realice el pago, empezará a regir un *costo de almacenaje de USD 0,5 diarios por kg*.
>
> Si abonás el saldo, te la almacenamos sin cargo todo el tiempo que necesites. Coordiná y aboná acá: {{3}}

**`ri_entregada`** *(solo clientes RI con entrega directa por courier)*
> Hola {{1}}! 📦
>
> Tu carga de {{2}} ya fue entregada en tu domicilio.
>
> Acá tenés el detalle completo, la documentación y los datos para abonar:
> {{3}}

**`coordinacion_confirmada`**
> {{1}}, quedó coordinada tu entrega de {{2}} ✅ {{3}}. Total a abonar: {{4}}. {{5}} Si necesitás cambiar el día, el horario o la forma de pago, respondé este mensaje.

En {{2}} de los primeros tres va la carga como "descripción (AC-0123)". En la
confirmación, {{5}} lleva el detalle del pago: transferencia con alias y titular de la
cuenta cargada (Vantum), efectivo con el aviso del cambio, o cripto con la billetera
cargada y la aclaración de la red TRC-20.

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
