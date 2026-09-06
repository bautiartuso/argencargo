# LinkedIn — posts automáticos del perfil de Bautista (y de la página Argencargo)

Todo está programado. Para encenderlo hay que crear una app en LinkedIn Developers (10 minutos) y conectar la cuenta desde el admin.

## Cómo funciona

| Momento | Qué pasa | Costo |
|---|---|---|
| Lunes 8:45 (cron `linkedin-redactor`) | Encola los posts de la semana según "Posts por semana" (Conexión): resumen real de la semana, nota del blog, educativo, noticia, cómo trabajamos | $0 |
| Runner → contador LinkedIn | Lo mismo, a mano y con la cantidad que quieras | $0 |
| Tu Mac (`runner/runner.mjs`, `claude -p`) | Lee la memoria de marca y escribe `post.md` (600–1.300 caracteres, primera persona) + `meta.json`; si suma, una imagen 1200×1200 | $0 (suscripción) |
| Contenido | El post aparece con su texto; ✓ aprueba, ✎ pide cambios, ✕ descarta (anota en Aprendizajes) | — |
| Calendario | Programar día y hora; o "Publicar ahora". En modo automático se programa solo (lun a vie 9:30) | — |
| Vigilante (`studio-publisher`, cada minuto) | Publica por la Posts API: texto, imagen o la nota del blog como tarjeta; la mención `{{PAGINA}}` se convierte en @Argencargo | $0 |
| Telegram | Avisa 7 días antes de que venza el token (60 días) y si LinkedIn rechaza un post | — |

Los posts del **blog** llevan la nota como tarjeta (LinkedIn toma la portada del Open Graph de argencargo.com.ar/blog/…).

## Paso 1 — App en LinkedIn Developers (lo hacés vos)

1. https://www.linkedin.com/developers/apps/new → nombre **Argencargo Studio**, LinkedIn Page **Argencargo**, logo, aceptar términos.
2. Solapa **Settings** → **Verify** → abrí el link como administrador de la página y confirmá.
3. Solapa **Products** → **Request access** en:
   - **Share on LinkedIn** (publicar como vos) — instantáneo.
   - **Sign In with LinkedIn using OpenID Connect** (para saber quién sos) — instantáneo.
   - **Community Management API** (publicar como la página) — LinkedIn lo revisa (días/semanas). Hasta que lo aprueben, todo sale desde tu perfil con la página mencionada.
4. Solapa **Auth** → OAuth 2.0 settings → **Authorized redirect URLs** → agregar exactamente:
   `https://www.argencargo.com.ar/api/linkedin/callback`
5. En la misma solapa copiá **Client ID** y **Primary Client Secret** → Vercel → Settings → Environment Variables (Production):
   - `LINKEDIN_CLIENT_ID`
   - `LINKEDIN_CLIENT_SECRET`
   - (opcional) `LINKEDIN_API_VERSION` = `AAAAMM` si LinkedIn cambia la versión mensual; por defecto usa la de hace 3 meses.
6. Redeploy.

## Paso 2 — Conectar (admin → Content Studio → Conexión → LinkedIn)

- **Conectar LinkedIn** → LinkedIn pide permiso → vuelve al admin con "LinkedIn conectado".
- **ID de la página**: el número de la URL del panel de la página (`linkedin.com/company/12345678/admin/`). Con él, los posts mencionan a la página con link. Cuando la Community Management API esté aprobada, marcá "pedir también los permisos de la página" al reconectar: el ID se completa solo y aparece la opción de publicar *como* la página.
- **Posts por semana** (0 apaga el cron) y **Modo** (esperan tu ✓ / se programan solos).

El token dura 60 días y LinkedIn no lo renueva solo para apps comunes: Telegram avisa una semana antes y el botón **Reconectar** lo resuelve en 30 segundos.

## Detalles técnicos

- `lib/linkedin.js`: OAuth, `liPublish` (Posts API `POST /rest/posts`, header `LinkedIn-Version`), subida de imágenes (`/rest/images?action=initializeUpload`), escape del "little text format", temas (`encolarLinkedin`, `resumenSemana`, `notasSinPost`, `noticiasSinPost`), cron semanal, hueco automático.
- `app/api/linkedin/callback`: vuelta del OAuth (state en `cs_settings.linkedin`).
- `cs_pieces.kind = 'linkedin'`; columnas `li_author` (persona|pagina), `li_link` (nota del blog como tarjeta), `li_post_urn`; el texto va en `caption`.
- Runner Mac: `promptRedactorLinkedin` → `post.md` + `meta.json` (`imagen: true|false`) + `slide-1.html` opcional → `?op=done` con `post_text`.
