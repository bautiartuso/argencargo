-- ARGENMAQ · A pedido, segunda vuelta.
-- Situación del cliente pasa a dos opciones (gestión integral / ya buscó un proveedor), se agrega
-- "cómo viene la búsqueda" (pendiente, averiguando, cotizado), datos del proveedor con el que se
-- está hablando, y las notas pasan a ser un historial. Se van email, urgencia y por dónde llegó.
-- Correr en el SQL Editor del proyecto de Argencargo. Se puede correr más de una vez.

-- 1. Situación: dos opciones
alter table public.cat_busquedas drop constraint if exists cat_busquedas_situacion_check;
update public.cat_busquedas set situacion = case when situacion in ('con_cotizacion','por_cerrar','ya_busco_proveedor') then 'ya_busco_proveedor' else 'gestion_integral' end;
alter table public.cat_busquedas alter column situacion set default 'gestion_integral';
alter table public.cat_busquedas add constraint cat_busquedas_situacion_check check (situacion in ('gestion_integral','ya_busco_proveedor'));

-- 2. Cómo viene la búsqueda + proveedor con el que hablamos; fuera lo que no hace falta
alter table public.cat_busquedas
  add column if not exists avance           text not null default 'pendiente' check (avance in ('pendiente','averiguando','cotizado')),
  add column if not exists proveedor_nombre text,   -- fábrica o vendedor con el que estamos hablando
  add column if not exists proveedor_link   text,   -- publicación de Alibaba / 1688 / etc.
  add column if not exists proveedor_info   text,   -- precio, MOQ, contacto, lo que haga falta
  drop column if exists urgencia,
  drop column if exists origen,
  drop column if exists email;

-- 3. Historial de notas (una por entrada, con quién y cuándo)
create table if not exists public.cat_busquedas_notas (
  id          uuid primary key default gen_random_uuid(),
  busqueda_id uuid not null references public.cat_busquedas(id) on delete cascade,
  texto       text not null,
  autor       uuid references auth.users(id) on delete set null,
  autor_email text,
  created_at  timestamptz not null default now()
);
create index if not exists cat_busquedas_notas_busq_idx on public.cat_busquedas_notas (busqueda_id, created_at desc);
alter table public.cat_busquedas_notas enable row level security;
drop policy if exists "equipo argenmaq lee notas" on public.cat_busquedas_notas;
drop policy if exists "equipo argenmaq escribe notas" on public.cat_busquedas_notas;
create policy "equipo argenmaq lee notas"    on public.cat_busquedas_notas for select to authenticated using (public.es_equipo_argenmaq());
create policy "equipo argenmaq escribe notas" on public.cat_busquedas_notas for all    to authenticated using (public.es_equipo_argenmaq()) with check (public.es_equipo_argenmaq());

-- Las notas que ya estaban escritas pasan al historial y la columna se va
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='cat_busquedas' and column_name='notas') then
    insert into public.cat_busquedas_notas (busqueda_id, texto, created_at)
      select id, notas, updated_at from public.cat_busquedas where notas is not null and length(trim(notas)) > 0;
    alter table public.cat_busquedas drop column notas;
  end if;
end $$;
