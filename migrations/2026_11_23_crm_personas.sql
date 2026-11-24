-- CRM · Contactos y Seguimiento sobre una sola base (23/11/2026).
-- Una "persona" es un cliente (con su ficha de WhatsApp, si la tiene) o un lead que escribió y todavía
-- no se registró. La vista crm_personas_v junta todo lo que se sabe de cada una: importaciones,
-- cotizaciones, lo que tiene en curso, el chat, los contactos de seguimiento y el análisis de la IA.
-- La leen Contactos y Seguimiento (crm_personas), el cron que analiza (crm_analisis_pendientes) y el
-- que manda los saludos automáticos (crm_ia_candidatos). Reglas en un solo lugar: ia_apto.

-- 1. Seguimiento también para leads (fichas sin cliente)
alter table public.client_followups add column if not exists contact_id uuid references public.crm_contacts(id) on delete cascade;
alter table public.client_followups alter column client_id drop not null;
create index if not exists client_followups_contact_idx on public.client_followups(contact_id) where contact_id is not null;
alter table public.crm_contacts add column if not exists followup_status text;

-- 2. Análisis de la IA, uno por persona. clave = 'c:<cliente>' o 'k:<ficha>'
create table if not exists public.crm_analisis (
  clave text primary key,
  client_id uuid references public.clients(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete cascade,
  temperatura text,            -- caliente | tibio | frio
  lectura text,                -- en qué está esta persona
  siguiente text,              -- qué conviene hacer
  mensaje text,                -- el WhatsApp sugerido
  quien text,                  -- humano | ia (lo que decidió el análisis)
  quien_manual text,           -- humano | ia (lo que eligió una persona; manda)
  firma text,                  -- huella de los datos con los que se analizó
  modelo text,
  error text,
  analizado_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.crm_analisis enable row level security;
drop policy if exists crm_analisis_staff on public.crm_analisis;
create policy crm_analisis_staff on public.crm_analisis for all
  using ((select public.current_user_role()) in ('admin','empleado'))
  with check ((select public.current_user_role()) in ('admin','empleado'));

-- 3. Saludos que mandó la IA
create table if not exists public.crm_ia_envios (
  id uuid primary key default gen_random_uuid(),
  clave text not null,
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  phone text not null,
  nombre text,
  plantilla text,
  estado text not null default 'enviado',   -- enviado | fallo | respondio
  wamid text,
  error text,
  created_at timestamptz not null default now(),
  respondio_at timestamptz
);
create index if not exists crm_ia_envios_phone_idx on public.crm_ia_envios(phone, created_at desc);
create index if not exists crm_ia_envios_clave_idx on public.crm_ia_envios(clave, created_at desc);
alter table public.crm_ia_envios enable row level security;
drop policy if exists crm_ia_envios_staff on public.crm_ia_envios;
create policy crm_ia_envios_staff on public.crm_ia_envios for select
  using ((select public.current_user_role()) in ('admin','empleado'));

alter table public.crm_numbers add column if not exists ia_enabled boolean not null default false;
alter table public.crm_numbers add column if not exists ia_por_dia integer not null default 10;

-- 4. La vista
drop function if exists public.crm_personas();
drop function if exists public.crm_analisis_pendientes(integer);
drop function if exists public.crm_ia_candidatos(integer);
drop view if exists public.crm_personas_v;
create view public.crm_personas_v as
with base as (
  select 'c:' || c.id::text as clave, c.id as id, k.id as contact_id,
         c.client_code, c.first_name, c.last_name, c.company_name, c.whatsapp, c.email, c.tax_condition, c.created_at,
         coalesce(c.marketing_opt_out, false) as marketing_opt_out, c.last_followup_at,
         c.followup_status, coalesce(c.followup_next_at, k.next_contact_at) as followup_next_at,
         coalesce(k.phone, public.crm_norm_tel(c.whatsapp)) as phone,
         k.wa_name, k.stage, k.source, k.campaign_name, k.last_in_at, k.last_out_at, k.last_msg_at, k.last_direction,
         k.last_preview, coalesce(k.unread, 0) as unread, k.summary, k.pending, k.notes
    from public.clients c
    left join lateral (select x.* from public.crm_contacts x where x.client_id = c.id order by x.last_msg_at desc nulls last, x.created_at limit 1) k on true
  union all
  select 'k:' || k.id::text, null::uuid, k.id,
         null, coalesce(k.name, k.wa_name), null, null, k.phone, null, null, coalesce(k.first_in_at, k.created_at),
         false, null::timestamptz,
         k.followup_status, k.next_contact_at,
         k.phone,
         k.wa_name, k.stage, k.source, k.campaign_name, k.last_in_at, k.last_out_at, k.last_msg_at, k.last_direction,
         k.last_preview, coalesce(k.unread, 0), k.summary, k.pending, k.notes
    from public.crm_contacts k where k.client_id is null
), dat as (
  select b.*,
         coalesce(o.ops_total,0) as ops_total, coalesce(o.ops_activas,0) as ops_activas, coalesce(o.ops_cerradas,0) as ops_cerradas,
         o.ultima_op_code, o.ultima_op_fecha, o.ultima_op_cierre, o.ultima_op_status, o.ultima_op_canal, o.primera_op_fecha, o.cadencia_dias,
         coalesce(o.facturado_usd,0) as facturado_usd,
         coalesce(q.quotes_total,0) as quotes_total, q.ultima_quote_num, q.ultima_quote_fecha, q.ultima_quote_total, q.ultima_quote_canal,
         coalesce(p.bultos_sin_op,0) as bultos_sin_op, coalesce(dc.claims_pendientes,0) as claims_pendientes,
         coalesce(m.mar_total,0) as mar_total, coalesce(m.mar_activos,0) as mar_activos, m.mar_ultima_fecha,
         coalesce(f.contactos,0) as contactos, f.ultimo_contacto_at, f.ultimo_outcome, f.ultimo_note,
         coalesce(f.intentos_sin_respuesta,0) as intentos_sin_respuesta, f.no_contactar_at, f.no_contactar_nota,
         a.temperatura, a.lectura, a.siguiente, a.mensaje, a.quien, a.quien_manual, a.analizado_at, a.firma as firma_analisis, a.error as analisis_error,
         ia.ia_ultimo_at, ia.ia_ultimo_estado, coalesce(ia.ia_enviados,0) as ia_enviados
    from base b
    left join lateral (
      select count(*) as ops_total,
             count(*) filter (where op.status not in ('operacion_cerrada','cancelada')) as ops_activas,
             count(*) filter (where op.status = 'operacion_cerrada' or op.delivery_completed_at is not null) as ops_cerradas,
             sum(op.budget_total) filter (where op.status = 'operacion_cerrada') as facturado_usd,
             (array_agg(op.operation_code order by op.created_at desc))[1] as ultima_op_code,
             max(op.created_at) as ultima_op_fecha,
             max(coalesce(op.delivery_completed_at, op.closed_at, op.created_at)) filter (where op.status = 'operacion_cerrada' or op.delivery_completed_at is not null) as ultima_op_cierre,
             (array_agg(op.status order by op.created_at desc))[1] as ultima_op_status,
             (array_agg(op.channel order by op.created_at desc))[1] as ultima_op_canal,
             min(op.created_at) as primera_op_fecha,
             case when count(*) >= 2 then extract(epoch from (max(op.created_at) - min(op.created_at))) / 86400.0 / (count(*) - 1) end as cadencia_dias
        from public.operations op where op.client_id = b.id and op.status <> 'cancelada'
    ) o on true
    left join lateral (
      select count(*) as quotes_total,
             (array_agg(qq.quote_number order by qq.created_at desc))[1] as ultima_quote_num,
             max(qq.created_at) as ultima_quote_fecha,
             (array_agg(qq.total_cost order by qq.created_at desc))[1] as ultima_quote_total,
             (array_agg(coalesce(qq.client_selected_channel, qq.channel_name) order by qq.created_at desc))[1] as ultima_quote_canal
        from public.quotes qq where qq.client_id = b.id
    ) q on true
    left join lateral (
      select count(*) as bultos_sin_op from public.operation_packages pk where pk.client_id = b.id and pk.operation_id is null
    ) p on true
    left join lateral (
      select count(*) as claims_pendientes from public.deposit_claims d where d.client_id = b.id and d.status = 'pendiente'
    ) dc on true
    left join lateral (
      select count(*) as mar_total,
             count(*) filter (where ms.operation_id is null and (
               ms.status in ('proveedor','en_deposito')
               or (ms.status = 'en_camino_ar' and (mc.id is null or mc.status <> 'arribado' or coalesce(mc.port_arrived_at::timestamptz, mc.arrived_at, now()) > now() - interval '60 days'))
             )) as mar_activos,
             max(coalesce(mc.port_arrived_at::timestamptz, mc.arrived_at, ms.shipped_to_ar_at::timestamptz, ms.created_at)) filter (where mc.status = 'arribado') as mar_ultima_fecha
        from public.maritime_shipments ms left join public.maritime_containers mc on mc.id = ms.container_id
       where ms.client_id = b.id
    ) m on true
    left join lateral (
      select count(*) as contactos,
             max(cf.created_at) as ultimo_contacto_at,
             (array_agg(cf.outcome order by cf.created_at desc))[1] as ultimo_outcome,
             (array_agg(cf.note order by cf.created_at desc))[1] as ultimo_note,
             -- Un intento deja de contar cuando la persona contestó: lo registró alguien o entró un mensaje suyo por WhatsApp.
             count(*) filter (where cf.outcome in ('enviado','sin_respuesta') and cf.created_at > greatest(
               coalesce((select max(x.created_at) from public.client_followups x where (x.client_id = b.id or x.contact_id = b.contact_id) and x.outcome in ('respondio','va_a_importar','mas_adelante','no_interesado')), '1970-01-01'::timestamptz),
               coalesce(b.last_in_at, '1970-01-01'::timestamptz))) as intentos_sin_respuesta,
             max(cf.created_at) filter (where cf.outcome = 'no_contactar') as no_contactar_at,
             (array_agg(cf.note order by cf.created_at desc) filter (where cf.outcome = 'no_contactar'))[1] as no_contactar_nota
        from public.client_followups cf where cf.client_id = b.id or cf.contact_id = b.contact_id
    ) f on true
    left join public.crm_analisis a on a.clave = b.clave
    left join lateral (
      select max(e.created_at) as ia_ultimo_at,
             (array_agg(e.estado order by e.created_at desc))[1] as ia_ultimo_estado,
             count(*) filter (where e.estado = 'enviado') as ia_enviados
        from public.crm_ia_envios e where e.clave = b.clave and e.estado <> 'fallo'
    ) ia on true
), calc as (
  select d.*,
         md5(concat_ws('|', d.last_msg_at, d.quotes_total, d.ultima_quote_fecha, d.ops_total, d.ops_activas, d.ops_cerradas, d.ultima_op_cierre,
                       d.mar_total, d.mar_activos, d.mar_ultima_fecha, d.bultos_sin_op, d.contactos, d.ultimo_contacto_at, d.followup_status, d.followup_next_at)) as firma,
         greatest(d.last_followup_at, d.ultimo_contacto_at, d.last_msg_at) as ultimo_toque,
         greatest(d.ultima_op_cierre, d.mar_ultima_fecha) as ultima_imp,
         -- Quién la lleva: lo que eligió una persona, si no lo que dijo el análisis; sin análisis, la IA solo
         -- se queda con quien nunca cotizó, nunca importó y nunca habló.
         coalesce(d.quien_manual, d.quien, case when d.ops_total = 0 and d.quotes_total = 0 and d.mar_total = 0 and d.last_msg_at is null then 'ia' else 'humano' end) as quien_ef
    from dat d
)
select c.*,
       -- ¿La IA le puede escribir hoy? Mismos descansos que el seguimiento a mano.
       ( c.quien_ef = 'ia'
         and length(coalesce(c.phone, '')) >= 10
         and not c.marketing_opt_out
         and coalesce(c.followup_status, '') <> 'no_contactar'
         and coalesce(c.stage, '') <> 'perdido'
         and c.ops_activas = 0 and c.mar_activos = 0 and c.bultos_sin_op = 0 and c.claims_pendientes = 0
         and c.unread = 0
         and c.followup_next_at is null
         and c.created_at < now() - interval '7 days'
         and (c.ultima_imp is null or c.ultima_imp < now() - interval '45 days')
         and (c.ultimo_toque is null or c.ultimo_toque < now() - interval '21 days')
         and not (c.intentos_sin_respuesta >= 2 and c.ultimo_toque > now() - interval '90 days')
         and not (coalesce(c.followup_status, '') = 'no_interesado' and c.ultimo_toque > now() - interval '120 days')
         and c.ia_enviados < 3
       ) as ia_apto
  from calc c;

revoke all on public.crm_personas_v from public, anon, authenticated;

-- 5. Lo que leen las pantallas (equipo) y los crons (service_role)
create or replace function public.crm_personas()
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v where (select public.current_user_role()) in ('admin','empleado');
$$;
revoke all on function public.crm_personas() from public, anon;
grant execute on function public.crm_personas() to authenticated, service_role;

-- A quién le falta el análisis (o le cambió algo desde el último). Solo gente con algo para leer:
-- un chat, una cotización o una importación. La charla tiene que llevar 2 h quieta.
create or replace function public.crm_analisis_pendientes(p_limit integer default 20)
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v v
   where (v.firma_analisis is distinct from v.firma or v.analizado_at < now() - interval '30 days')
     and (v.last_msg_at is not null or v.quotes_total > 0 or v.ops_total > 0 or v.mar_total > 0)
     and (v.last_msg_at is null or v.last_msg_at < now() - interval '2 hours')
     and not v.marketing_opt_out and coalesce(v.followup_status, '') <> 'no_contactar'
     and (v.last_msg_at is not null or (v.ops_activas = 0 and v.mar_activos = 0))
   order by (v.last_msg_at is not null) desc, greatest(v.last_msg_at, v.ultima_quote_fecha, v.ultima_op_cierre, v.mar_ultima_fecha) desc nulls last
   limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;
revoke all on function public.crm_analisis_pendientes(integer) from public, anon, authenticated;
grant execute on function public.crm_analisis_pendientes(integer) to service_role;

-- A quién le escribe la IA, en orden: primero los que cotizaron o se registraron más cerca.
create or replace function public.crm_ia_candidatos(p_limit integer default 5)
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v v
   where v.ia_apto
   order by greatest(v.ultima_quote_fecha, v.ultima_imp, v.created_at) desc nulls last
   limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;
revoke all on function public.crm_ia_candidatos(integer) from public, anon, authenticated;
grant execute on function public.crm_ia_candidatos(integer) to service_role;

-- 6. Ajustes del mismo día: un análisis que falló se reintenta recién a las 6 h; a quien no se le pudo
-- mandar el saludo (número inválido, sin nombre) no se lo vuelve a intentar por 14 días.
create or replace function public.crm_analisis_pendientes(p_limit integer default 20)
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v v
   where (v.firma_analisis is distinct from v.firma or v.analizado_at < now() - interval '30 days')
     and not (v.analisis_error is not null and v.analizado_at > now() - interval '6 hours')
     and (v.last_msg_at is not null or v.quotes_total > 0 or v.ops_total > 0 or v.mar_total > 0)
     and (v.last_msg_at is null or v.last_msg_at < now() - interval '2 hours')
     and not v.marketing_opt_out and coalesce(v.followup_status, '') <> 'no_contactar'
     and (v.last_msg_at is not null or (v.ops_activas = 0 and v.mar_activos = 0))
   order by (v.last_msg_at is not null) desc, greatest(v.last_msg_at, v.ultima_quote_fecha, v.ultima_op_cierre, v.mar_ultima_fecha) desc nulls last
   limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;
create or replace function public.crm_ia_candidatos(p_limit integer default 5)
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v v
   where v.ia_apto
     and not exists (select 1 from public.crm_ia_envios e where e.clave = v.clave and e.estado = 'fallo' and e.created_at > now() - interval '14 days')
   order by greatest(v.ultima_quote_fecha, v.ultima_imp, v.created_at) desc nulls last
   limit greatest(1, least(coalesce(p_limit, 5), 50));
$$;
