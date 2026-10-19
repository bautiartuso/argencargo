-- ARGENMAQ · Máquinas con varios videos y documentos (manual de uso, ficha técnica).
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.

alter table public.cat_productos add column if not exists videos   text[] not null default '{}';  -- varios videos (video_url queda como el primero, por compatibilidad)
alter table public.cat_productos add column if not exists archivos jsonb  not null default '[]';  -- [{tipo:'manual'|'ficha'|'otro', nombre, url}]

-- Migra el video único que ya estaba cargado.
update public.cat_productos set videos = array[video_url] where video_url is not null and video_url <> '' and cardinality(videos) = 0;

-- Vista pública chica con los medios de las máquinas publicadas (la vista cat_maquinas_publicas no se toca).
create or replace view public.cat_maquinas_medios as
  select id, videos, archivos from public.cat_productos where estado = 'publicado';
grant select on public.cat_maquinas_medios to anon, authenticated;
