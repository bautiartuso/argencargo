-- ARGENMAQ · Búsquedas a pedido (panel › Comercial › A pedido).
-- Máquinas que un cliente pide y no están en el catálogo: quién la pide, cómo contactarlo y qué busca.
-- Correr en el SQL Editor de Supabase del proyecto de Argencargo (nhfslvixhlbiyfmedmbr).

create table if not exists public.cat_busquedas (
  id          uuid primary key default gen_random_uuid(),
  numero      serial,
  cliente     text not null,                       -- nombre de la persona o empresa
  contacto    text,                                -- teléfono / WhatsApp
  email       text,
  descripcion text not null,                       -- qué máquina busca
  estado      text not null default 'nueva' check (estado in ('nueva','buscando','cotizada','ganada','perdida')),
  notas       text,                                -- seguimiento interno
  client_id   uuid references public.clients(id) on delete set null,   -- si ya es cliente de la base
  creado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cat_busquedas_estado_idx on public.cat_busquedas (estado, created_at desc);

create or replace function public.cat_busquedas_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists cat_busquedas_touch on public.cat_busquedas;
create trigger cat_busquedas_touch before update on public.cat_busquedas for each row execute function public.cat_busquedas_touch();

-- Quién es "equipo ARGENMAQ": la misma regla que usa el panel para dejar entrar
-- (admin/empleado de Argencargo, socio GI o cualquier argenmaq_role).
create or replace function public.es_equipo_argenmaq() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('admin','empleado') or p.is_gi_partner = true or p.argenmaq_role is not null)
  );
$$;

alter table public.cat_busquedas enable row level security;
drop policy if exists "equipo argenmaq lee busquedas" on public.cat_busquedas;
drop policy if exists "equipo argenmaq escribe busquedas" on public.cat_busquedas;
create policy "equipo argenmaq lee busquedas"    on public.cat_busquedas for select to authenticated using (public.es_equipo_argenmaq());
create policy "equipo argenmaq escribe busquedas" on public.cat_busquedas for all    to authenticated using (public.es_equipo_argenmaq()) with check (public.es_equipo_argenmaq());
