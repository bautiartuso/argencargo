-- Seguimiento de clientes v3 (27/10/2026)
-- Reglas nuevas: el que tiene algo en curso (op abierta, marítimo en tránsito o en depósito, bultos
-- sin importación, reclamo pendiente) no se contacta; "importó" se mide por la fecha de entrega/cierre,
-- no por la creación; los marítimos entregados cuentan como importaciones; cadencia propia de cada
-- cliente; intentos sin respuesta; marca de "no contactar" con fecha y nota.
-- El empleado también puede usar la solapa (antes era solo admin).

drop policy if exists client_followups_admin on public.client_followups;
create policy client_followups_admin on public.client_followups
  for all using ((select public.current_user_role()) in ('admin','empleado'))
  with check ((select public.current_user_role()) in ('admin','empleado'));

drop function if exists public.seguimiento_clientes_v3();
create or replace function public.seguimiento_clientes_v3()
returns table (
  id uuid, client_code text, first_name text, last_name text, company_name text, whatsapp text, email text,
  tax_condition text, created_at timestamptz, marketing_opt_out boolean,
  last_followup_at timestamptz, followup_status text, followup_next_at date,
  ops_total bigint, ops_activas bigint, ops_cerradas bigint, ultima_op_code text, ultima_op_fecha timestamptz, ultima_op_cierre timestamptz,
  ultima_op_status text, ultima_op_canal text, primera_op_fecha timestamptz, cadencia_dias numeric, facturado_usd numeric,
  quotes_total bigint, ultima_quote_num text, ultima_quote_fecha timestamptz, ultima_quote_total numeric, ultima_quote_canal text,
  bultos_sin_op bigint, claims_pendientes bigint,
  mar_total bigint, mar_activos bigint, mar_ultima_fecha timestamptz,
  contactos bigint, ultimo_contacto_at timestamptz, ultimo_outcome text, ultimo_note text, intentos_sin_respuesta bigint,
  no_contactar_at timestamptz, no_contactar_nota text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.client_code, c.first_name, c.last_name, c.company_name, c.whatsapp, c.email,
         c.tax_condition, c.created_at, coalesce(c.marketing_opt_out,false),
         c.last_followup_at, c.followup_status, c.followup_next_at,
         coalesce(o.ops_total,0), coalesce(o.ops_activas,0), coalesce(o.ops_cerradas,0), o.ultima_op_code, o.ultima_op_fecha, o.ultima_op_cierre,
         o.ultima_op_status, o.ultima_op_canal, o.primera_op_fecha, o.cadencia_dias, coalesce(o.facturado_usd,0),
         coalesce(q.quotes_total,0), q.ultima_quote_num, q.ultima_quote_fecha, q.ultima_quote_total, q.ultima_quote_canal,
         coalesce(p.bultos_sin_op,0), coalesce(dc.claims_pendientes,0),
         coalesce(m.mar_total,0), coalesce(m.mar_activos,0), m.mar_ultima_fecha,
         coalesce(f.contactos,0), f.ultimo_contacto_at, f.ultimo_outcome, f.ultimo_note, coalesce(f.intentos_sin_respuesta,0),
         f.no_contactar_at, f.no_contactar_nota
  from public.clients c
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
    from public.operations op where op.client_id = c.id and op.status <> 'cancelada'
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
    select count(*) as claims_pendientes from public.deposit_claims d where d.client_id = c.id and d.status = 'pendiente'
  ) dc on true
  left join lateral (
    -- Marítimo: en curso si todavía no tiene operación y no llegó (proveedor, en depósito, o en el
    -- agua / arribado hace poco). Lo que llegó cuenta como importación (mar_ultima_fecha).
    select count(*) as mar_total,
           count(*) filter (where ms.operation_id is null and (
             ms.status in ('proveedor','en_deposito')
             or (ms.status = 'en_camino_ar' and (mc.id is null or mc.status <> 'arribado' or coalesce(mc.port_arrived_at::timestamptz, mc.arrived_at, now()) > now() - interval '60 days'))
           )) as mar_activos,
           max(coalesce(mc.port_arrived_at::timestamptz, mc.arrived_at, ms.shipped_to_ar_at::timestamptz, ms.created_at)) filter (where mc.status = 'arribado') as mar_ultima_fecha
    from public.maritime_shipments ms left join public.maritime_containers mc on mc.id = ms.container_id
    where ms.client_id = c.id
  ) m on true
  left join lateral (
    select count(*) as contactos,
           max(cf.created_at) as ultimo_contacto_at,
           (array_agg(cf.outcome order by cf.created_at desc))[1] as ultimo_outcome,
           (array_agg(cf.note order by cf.created_at desc))[1] as ultimo_note,
           count(*) filter (where cf.outcome in ('enviado','sin_respuesta') and cf.created_at > coalesce((select max(x.created_at) from public.client_followups x where x.client_id = c.id and x.outcome in ('respondio','va_a_importar','mas_adelante','no_interesado')), '1970-01-01'::timestamptz)) as intentos_sin_respuesta,
           max(cf.created_at) filter (where cf.outcome = 'no_contactar') as no_contactar_at,
           (array_agg(cf.note order by cf.created_at desc) filter (where cf.outcome = 'no_contactar'))[1] as no_contactar_nota
    from public.client_followups cf where cf.client_id = c.id
  ) f on true
  where (select public.current_user_role()) in ('admin','empleado');
$$;
grant execute on function public.seguimiento_clientes_v3() to authenticated;
