-- ARGENMAQ · Content Studio (panel › Marketing › Content Studio).
-- Piezas de Instagram armadas con datos reales del catálogo, los pedidos y A pedido.
-- Las imágenes se guardan en el bucket público `catalogo`, carpeta studio/.
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.

create table if not exists public.am_piezas (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('historia','post')),
  plantilla    text not null,                 -- maquina_dia, cuanto_sale, en_viaje, llego, pedidos, ficha, rubro
  titulo       text,                          -- cómo se muestra en el panel
  maquina_id   uuid,                          -- máquina protagonista, si la hay (para no repetirla seguido)
  datos        jsonb,                         -- lo que se usó para armar la pieza (snapshot: precio, fecha, etc.)
  caption      text,
  hashtags     text,
  imagenes     text[] not null default '{}',  -- URLs públicas, en orden (una historia puede tener 2)
  estado       text not null default 'aprobada' check (estado in ('aprobada','publicada','descartada')),
  ig_id        text,                          -- id que devuelve Instagram al publicar
  publicada_at timestamptz,
  creado_por   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists am_piezas_created_idx on public.am_piezas (created_at desc);
create index if not exists am_piezas_maquina_idx on public.am_piezas (maquina_id, created_at desc);

alter table public.am_piezas enable row level security;
drop policy if exists "equipo argenmaq lee piezas" on public.am_piezas;
drop policy if exists "equipo argenmaq escribe piezas" on public.am_piezas;
create policy "equipo argenmaq lee piezas"    on public.am_piezas for select to authenticated using (public.es_equipo_argenmaq());
create policy "equipo argenmaq escribe piezas" on public.am_piezas for all    to authenticated using (public.es_equipo_argenmaq()) with check (public.es_equipo_argenmaq());
