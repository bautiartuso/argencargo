-- Seguimiento de clientes v2 (19/10/2026)
-- Solapa "Seguimiento" del admin: historial de contactos por cliente, estado de seguimiento,
-- fecha de próximo contacto y una sola consulta que arma el contexto de cada cliente
-- (ops, cotizaciones, bultos en depósito, último contacto) para decidir a quién escribirle.

-- 1) Estado de seguimiento en la ficha del cliente
alter table public.clients add column if not exists followup_status text not null default 'sin_contacto';
alter table public.clients add column if not exists followup_next_at date;
-- valores: sin_contacto · contactado · respondio · va_a_importar · mas_adelante · no_interesado · no_contactar

-- 2) Historial de contactos
create table if not exists public.client_followups (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  created_at  timestamptz not null default now(),
  channel     text not null default 'whatsapp',   -- whatsapp · email · llamada · nota
  outcome     text,                               -- enviado · respondio · sin_respuesta · va_a_importar · mas_adelante · no_interesado · no_contactar · nota
  note        text,
  next_at     date,
  created_by  uuid
);
create index if not exists client_followups_client_idx on public.client_followups (client_id, created_at desc);
alter table public.client_followups enable row level security;
drop policy if exists client_followups_admin on public.client_followups;
create policy client_followups_admin on public.client_followups
  for all using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- 3) Consulta: una fila por cliente con todo el contexto
drop function if exists public.seguimiento_clientes_v2();
create or replace function public.seguimiento_clientes_v2()
returns table (
  id uuid, client_code text, first_name text, last_name text, whatsapp text, email text,
  tax_condition text, created_at timestamptz, marketing_opt_out boolean,
  last_followup_at timestamptz, followup_status text, followup_next_at date,
  ops_total bigint, ops_activas bigint, ultima_op_code text, ultima_op_fecha timestamptz, ultima_op_status text, facturado_usd numeric,
  quotes_total bigint, ultima_quote_num text, ultima_quote_fecha timestamptz, ultima_quote_total numeric, ultima_quote_canal text,
  bultos_sin_op bigint,
  contactos bigint, ultimo_contacto_at timestamptz, ultimo_outcome text, ultimo_note text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.client_code, c.first_name, c.last_name, c.whatsapp, c.email,
         c.tax_condition, c.created_at, coalesce(c.marketing_opt_out,false),
         c.last_followup_at, c.followup_status, c.followup_next_at,
         coalesce(o.ops_total,0), coalesce(o.ops_activas,0), o.ultima_op_code, o.ultima_op_fecha, o.ultima_op_status, coalesce(o.facturado_usd,0),
         coalesce(q.quotes_total,0), q.ultima_quote_num, q.ultima_quote_fecha, q.ultima_quote_total, q.ultima_quote_canal,
         coalesce(p.bultos_sin_op,0),
         coalesce(f.contactos,0), f.ultimo_contacto_at, f.ultimo_outcome, f.ultimo_note
  from public.clients c
  left join lateral (
    select count(*) as ops_total,
           count(*) filter (where op.status not in ('operacion_cerrada','cancelada')) as ops_activas,
           sum(op.budget_total) filter (where op.status = 'operacion_cerrada') as facturado_usd,
           (array_agg(op.operation_code order by op.created_at desc))[1] as ultima_op_code,
           max(op.created_at) as ultima_op_fecha,
           (array_agg(op.status order by op.created_at desc))[1] as ultima_op_status
    from public.operations op where op.client_id = c.id
  ) o on true
  left join lateral (
    select count(*) as quotes_total,
           (array_agg(qq.quote_number order by qq.created_at desc))[1] as ultima_quote_num,
           max(qq.created_at) as ultima_quote_fecha,
           (array_agg(qq.total_cost order by qq.created_at desc))[1] as ultima_quote_total,
           (array_agg(coalesce(qq.client_selected_channel, qq.channel_name) order by qq.created_at desc))[1] as ultima_quote_canal
    from public.quotes qq where qq.client_id = c.id
  ) q on true
  left join lateral (
    select count(*) as bultos_sin_op from public.operation_packages pk where pk.client_id = c.id and pk.operation_id is null
  ) p on true
  left join lateral (
    select count(*) as contactos,
           max(cf.created_at) as ultimo_contacto_at,
           (array_agg(cf.outcome order by cf.created_at desc))[1] as ultimo_outcome,
           (array_agg(cf.note order by cf.created_at desc))[1] as ultimo_note
    from public.client_followups cf where cf.client_id = c.id
  ) f on true
  where (select public.current_user_role()) = 'admin';
$$;
grant execute on function public.seguimiento_clientes_v2() to authenticated;

-- 4) Plantillas nuevas de WhatsApp (editables desde Operativa y plantillas)
insert into public.message_templates (key, channel, label, body)
select 'wa_seguimiento_cotizo', 'whatsapp', 'WhatsApp — Seguimiento a cliente que cotizó y no importó',
E'Hola {{firstName}}! como estas?\n\nVi que cotizaste {{quoteCanal}} con nosotros hace {{quoteDias}} ({{quoteNum}}, USD {{quoteTotal}} todo incluido) y no llegamos a arrancar. Te quedo alguna duda con el numero o el proceso?\n\nSi queres lo repasamos juntos, o si ya lo trajiste por otro lado contame como te fue.'
where not exists (select 1 from public.message_templates where key = 'wa_seguimiento_cotizo');

insert into public.message_templates (key, channel, label, body)
select 'wa_seguimiento_bultos', 'whatsapp', 'WhatsApp — Seguimiento a cliente con bultos en depósito sin importación',
E'Hola {{firstName}}! como andas?\n\nTenes {{bultos}} en nuestro deposito de China que todavia no tienen importacion armada. Entras al portal, en la solapa Deposito, y en dos minutos la armas: https://argencargo.com.ar/portal\n\nSi te trabaste en algo decime y lo vemos.'
where not exists (select 1 from public.message_templates where key = 'wa_seguimiento_bultos');
