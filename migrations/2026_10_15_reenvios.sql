-- Reenvíos a otro depósito (15/10/2026): Bautista le pide al agente que mande uno o varios bultos
-- a otro depósito con otro shipping mark. El agente lo ve en su panel y responde Enviado (con el
-- tracking del envío) o No se puede (con el motivo). Al enviarse, los bultos salen de su depósito.
--
-- RLS según migrations/2026_09_14_rls_performance_portal.sql: solo (select current_user_role()).

create table if not exists public.forward_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid,                                   -- agente que tiene los bultos
  package_ids uuid[] not null default '{}',        -- operation_packages a reenviar
  client_id uuid references public.clients(id) on delete set null,
  operation_id uuid references public.operations(id) on delete set null,
  destino_nombre text not null,
  destino_datos text,                              -- dirección, contacto, teléfono
  shipping_mark text not null,
  note text,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado', 'no_se_puede', 'cancelado')),
  tracking_envio text,                             -- tracking del envío al otro depósito
  agent_notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists forward_requests_status_idx on public.forward_requests (status);
create index if not exists forward_requests_agent_idx on public.forward_requests (agent_id);

alter table public.operation_packages add column if not exists reenviado_at timestamptz;
alter table public.operation_packages add column if not exists reenvio_id uuid;

alter table public.forward_requests enable row level security;

drop policy if exists forward_requests_staff on public.forward_requests;
create policy forward_requests_staff on public.forward_requests for all
  using ((select current_user_role()) in ('admin', 'empleado'))
  with check ((select current_user_role()) in ('admin', 'empleado'));

drop policy if exists forward_requests_agente_select on public.forward_requests;
create policy forward_requests_agente_select on public.forward_requests for select
  using ((select current_user_role()) = 'agente' and agent_id = (select auth.uid()));

drop policy if exists forward_requests_agente_update on public.forward_requests;
create policy forward_requests_agente_update on public.forward_requests for update
  using ((select current_user_role()) = 'agente' and agent_id = (select auth.uid()))
  with check ((select current_user_role()) = 'agente' and agent_id = (select auth.uid()));

grant select, insert, update, delete on public.forward_requests to authenticated;
