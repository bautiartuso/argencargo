-- Familias de mercadería (20/11/2026): todas las variantes de un mismo producto (otra medida,
-- color o modelo) llevan una sola posición arancelaria. Ver lib/ncm-familia.js y /api/ncm.
-- Solo service_role: con la clave pública nadie puede cambiarle la posición a una familia.
create table if not exists public.ncm_familias (
  familia text primary key,
  ncm_code text not null,
  description text,
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ncm_familias enable row level security;
revoke all on public.ncm_familias from anon, authenticated;

-- Fija la posición de la familia si todavía no tiene y devuelve la que quedó (la primera gana:
-- así dos renglones de la misma lista clasificados en paralelo terminan con la misma).
create or replace function public.ncm_familia_fijar(p_familia text, p_ncm text, p_desc text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v text;
begin
  if coalesce(p_familia, '') = '' or coalesce(p_ncm, '') = '' then return null; end if;
  insert into ncm_familias (familia, ncm_code, description)
  values (p_familia, p_ncm, left(p_desc, 300))
  on conflict (familia) do nothing;
  select ncm_code into v from ncm_familias where familia = p_familia;
  return v;
end $$;
revoke all on function public.ncm_familia_fijar(text, text, text) from public, anon, authenticated;
grant execute on function public.ncm_familia_fijar(text, text, text) to service_role;
