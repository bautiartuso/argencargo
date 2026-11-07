-- Foto de la etiqueta del envío (07/11/2026): el agente la adjunta (o pega con Ctrl+V) al marcar
-- Enviado un reenvío; es obligatoria. El admin la ve en la solapa Reenvíos. Vive en package-photos,
-- así que el cron /api/cleanup/photos la tiene en su lista de columnas referenciadas.
alter table public.forward_requests add column if not exists etiqueta_url text;
