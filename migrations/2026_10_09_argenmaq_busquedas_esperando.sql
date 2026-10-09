-- ARGENMAQ · A pedido: estado "esperando" (entre Nueva y Buscando).
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.
alter table public.cat_busquedas drop constraint if exists cat_busquedas_estado_check;
alter table public.cat_busquedas add constraint cat_busquedas_estado_check
  check (estado in ('nueva','esperando','buscando','cotizada','ganada','perdida'));
