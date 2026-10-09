-- Reclamos de depósito (09/10/2026): paquetes que el cliente dice que llegaron al depósito del
-- agente pero el agente no registró. Bautista carga tracking + cliente desde el admin; el agente
-- los ve en su panel y al registrarlos el cliente queda asignado solo.
--
-- RLS según migrations/2026_09_14_rls_performance_portal.sql: nada de subconsultas a tablas con
-- RLS, solo (select current_user_role()).

create table if not exists public.deposit_claims (
  id uuid primary key default gen_random_uuid(),
  tracking text not null,
  -- Sin espacios/guiones y en mayúsculas: es contra lo que se compara al registrar.
  tracking_norm text generated always as (upper(regexp_replace(tracking, '[^A-Za-z0-9]', '', 'g'))) stored,
  client_id uuid not null references public.clients(id) on delete cascade,
  origin text,                       -- 'China' / 'USA'; null = lo ve cualquier agente
  note text,
  status text not null default 'pendiente' check (status in ('pendiente', 'recibido', 'no_encontrado', 'cancelado')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create index if not exists deposit_claims_status_idx on public.deposit_claims (status);
create index if not exists deposit_claims_norm_idx on public.deposit_claims (tracking_norm);

alter table public.deposit_claims enable row level security;

drop policy if exists deposit_claims_staff on public.deposit_claims;
create policy deposit_claims_staff on public.deposit_claims for all
  using ((select current_user_role()) in ('admin', 'empleado'))
  with check ((select current_user_role()) in ('admin', 'empleado'));

drop policy if exists deposit_claims_agente_select on public.deposit_claims;
create policy deposit_claims_agente_select on public.deposit_claims for select
  using ((select current_user_role()) = 'agente');

drop policy if exists deposit_claims_agente_update on public.deposit_claims;
create policy deposit_claims_agente_update on public.deposit_claims for update
  using ((select current_user_role()) = 'agente')
  with check ((select current_user_role()) = 'agente');

grant select, insert, update, delete on public.deposit_claims to authenticated;

-- 09/10/2026 (segunda tanda): cada reclamo va a un agente puntual; solo depósito de China.
alter table public.deposit_claims add column if not exists agent_id uuid;
create index if not exists deposit_claims_agent_idx on public.deposit_claims (agent_id);
