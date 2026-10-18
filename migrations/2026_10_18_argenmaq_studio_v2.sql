-- ARGENMAQ · Content Studio v2: carruseles, programación y errores de publicación.
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.

alter table public.am_piezas drop constraint if exists am_piezas_tipo_check;
alter table public.am_piezas add constraint am_piezas_tipo_check check (tipo in ('historia','post','carrusel'));

alter table public.am_piezas drop constraint if exists am_piezas_estado_check;
alter table public.am_piezas add constraint am_piezas_estado_check check (estado in ('aprobada','programada','publicada','descartada','error'));

alter table public.am_piezas add column if not exists programada_at timestamptz;   -- cuándo sale (la publica el cron)
alter table public.am_piezas add column if not exists error text;                  -- último error de Instagram
alter table public.am_piezas add column if not exists link text;                   -- ficha de la máquina (para el sticker a mano)

create index if not exists am_piezas_programada_idx on public.am_piezas (programada_at) where estado = 'programada';
