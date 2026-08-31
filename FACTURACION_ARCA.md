# Facturación electrónica ARCA — guía de encendido

El sistema ya emite Factura C (monotributo) directo contra los web services oficiales
de ARCA, con PDF de diseño propio y QR oficial. La integración es de UNA VÍA: ARCA no
ve nada del sistema — solo recibe las facturas que vos decidís emitir, op por op.

## Lo que hay que hacer (una sola vez, con tu clave fiscal)

### 1. Generar el certificado digital

En tu compu (Terminal):
```bash
openssl req -new -newkey rsa:2048 -nodes -keyout arca.key -out arca.csr -subj "/C=AR/O=Argencargo/CN=argencargo-web/serialNumber=CUIT TUCUIT"
```
(reemplazá `TUCUIT` por tu CUIT sin guiones — quedan dos archivos: `arca.key` y `arca.csr`)

En [ARCA](https://www.afip.gob.ar) con clave fiscal:
1. **Administración de Certificados Digitales** → Agregar alias (ej. `argencargo-web`) → pegá el contenido de `arca.csr` → descargá el certificado (`arca.crt`).
2. **Administrador de Relaciones de Clave Fiscal** → Nueva relación → autorizá al alias los servicios:
   - **Facturación Electrónica (wsfe)**
   - **Consulta de padrón / Constancia de inscripción (ws_sr_constancia_inscripcion)**
3. **Comprobantes en línea → Administración de puntos de venta** → dar de alta un punto
   de venta nuevo con modalidad **"Web Services - Factura Electrónica"** (anotá el número).

> Para PROBAR antes con facturas de mentira: en ARCA existe **WSASS (autoservicio de
> homologación)** donde generás un certificado de prueba con el mismo CSR. El sistema
> arranca en modo homologación hasta que lo pasemos a producción.

### 2. Cargar las credenciales en Vercel

(Settings → Environment Variables → Production)
```bash
base64 -i arca.crt | pbcopy   # → pegar como ARCA_CERT
base64 -i arca.key | pbcopy   # → pegar como ARCA_KEY
```
- `ARCA_CUIT` — tu CUIT sin guiones
- `ARCA_CERT` — el certificado en base64
- `ARCA_KEY` — la clave privada en base64 (¡no la compartas por chat!)

Después, redeploy.

### 3. Completar los datos del emisor

Pasame (o cargá en la tabla `arca_config` de Supabase): razón social como figura en
ARCA, domicilio fiscal, fecha de inicio de actividades y el número de punto de venta.
El campo `environment` arranca en `homologacion`; cuando las pruebas cierren lo
pasamos a `produccion`.

## Cómo se usa

Admin → **Finanzas → Facturación → 🧾 Nueva factura**: ponés el código de op y "Traer
datos" precarga cliente, documento y el importe cobrado en pesos; con CUIT, el botón
**🔍 Padrón** trae razón social, domicilio y condición IVA desde ARCA (como Comprobantes
en línea). Emitir pide el CAE a ARCA y abre la factura con el diseño de Argencargo en
`/factura/{token}` — imprimible y compartible con el cliente por link.

## Técnica

- `lib/arca.js`: WSAA (firma CMS del ticket con node-forge, cache 12 h en `arca_config`),
  WSFEv1 (`FECAESolicitar`, Factura C con `CondicionIVAReceptorId` RG 5616), padrón
  (`getPersona_v2`) y QR RG 4892.
- Endpoints: `POST/GET /api/facturas` · `GET /api/facturas/padron?cuit=` (admin only).
- Registro local: tabla `invoices` (RLS admin). La factura pública: `/factura/[public_token]`.
- Ambientes: homologación ↔ producción según `arca_config.environment`.
