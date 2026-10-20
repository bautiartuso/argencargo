-- Cotizador GI v2 (20/10/2026)
-- 1) El origen (China / USA) es de la cotización, no de cada producto.
-- 2) Los bultos son de la cotización y cada uno dice qué productos lleva (varios productos en una
--    caja, o un producto en varias cajas). Antes el embalaje iba pegado a cada producto.
-- 3) Cada producto puede tener varias fotos.

alter table public.gi_quote_requests add column if not exists origin text not null default 'china';
alter table public.gi_quote_products add column if not exists photo_urls text[];

create table if not exists public.gi_quote_packages (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references public.gi_quotes(id) on delete cascade,
  display_order int not null default 0,
  pkg_count     int not null default 1,          -- cuántas cajas iguales
  length_cm     numeric,
  width_cm      numeric,
  height_cm     numeric,
  weight_kg     numeric,                         -- kg de cada caja
  product_idx   int[] not null default '{}',     -- display_order de los productos que van adentro
  created_at    timestamptz not null default now()
);
create index if not exists gi_quote_packages_quote_idx on public.gi_quote_packages (quote_id, display_order);

create or replace function public.es_socio_gi()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select is_gi_partner from public.profiles where id = auth.uid()), false); $$;

alter table public.gi_quote_packages enable row level security;
drop policy if exists gi_quote_packages_equipo on public.gi_quote_packages;
create policy gi_quote_packages_equipo on public.gi_quote_packages for all to authenticated
  using ((select public.current_user_role()) in ('admin','empleado') or (select public.es_socio_gi()))
  with check ((select public.current_user_role()) in ('admin','empleado') or (select public.es_socio_gi()));
-- El cliente ve los bultos de su cotización por el link público (service role en la API), no hace falta policy.
