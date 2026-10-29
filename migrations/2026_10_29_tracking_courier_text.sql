-- Seguimiento tal cual el courier (28-29/10/2026): courier_text = texto exacto del courier (admin);
-- title = el mismo texto sin la marca (cliente). DHL se pide en castellano (language=es).
alter table public.tracking_events add column if not exists courier_text text;
