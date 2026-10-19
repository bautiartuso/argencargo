-- ARGENMAQ · Content Studio v3: guiones de reels (piezas sin imagen; el cron avisa por Telegram cuando toca filmar).
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.

alter table public.am_piezas drop constraint if exists am_piezas_tipo_check;
alter table public.am_piezas add constraint am_piezas_tipo_check check (tipo in ('historia','post','carrusel','guion'));
