-- Ficha del CRM con más datos del cliente (23/11/2026): condición fiscal, CUIT, localidad, y por
-- operación el canal, la descripción, la llegada estimada y lo que falta cobrar (solo admin).
create or replace function public.crm_ficha(p_contact_id uuid)
returns json language sql stable security definer set search_path to 'public' as $function$
  select json_build_object(
    'cliente', (select json_build_object('id', cl.id, 'client_code', cl.client_code, 'nombre', nullif(trim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), ''), 'company_name', cl.company_name, 'email', cl.email, 'created_at', cl.created_at,
                  'tax_condition', cl.tax_condition, 'cuit', cl.cuit, 'city', cl.city, 'province', cl.province)
                from public.clients cl where cl.id = c.client_id),
    'ops', coalesce((select json_agg(json_build_object('id', o.id, 'code', o.operation_code, 'status', o.status, 'created_at', o.created_at, 'delivered_at', coalesce(o.delivery_completed_at, o.closed_at), 'total', o.budget_total,
                       'entregada', (o.status = 'operacion_cerrada' or o.delivery_completed_at is not null),
                       'channel', o.channel, 'description', o.description, 'eta', o.eta,
                       'saldo', case when (select public.current_user_role()) = 'admin' and not coalesce(o.is_collected, false) and o.status <> 'operacion_cerrada'
                                then greatest(coalesce(o.budget_total, 0) + coalesce(o.debt_applied_usd, 0) - coalesce(o.total_anticipos, 0) - coalesce(o.credit_applied_usd, 0) - coalesce(o.discount_applied_usd, 0)
                                     - coalesce((select sum(p.amount_usd) from public.operation_client_payments p where p.operation_id = o.id), 0), 0) else null end) order by o.created_at desc)
                     from public.operations o where o.client_id = c.client_id and o.status <> 'cancelada'), '[]'::json),
    'cots', coalesce((select json_agg(json_build_object('id', q.id, 'code', case when q.quote_number is null then null else 'AGC-' || lpad(q.quote_number::text, 5, '0') end, 'status', q.status, 'created_at', q.created_at, 'total', q.total_cost, 'channel_name', q.channel_name) order by q.created_at desc)
                      from public.quotes q where q.client_id = c.client_id), '[]'::json),
    'facturado', case when (select public.current_user_role()) = 'admin'
                 then coalesce((select sum(o.budget_total) from public.operations o where o.client_id = c.client_id and o.status = 'operacion_cerrada'), 0) else null end,
    'mensajes', (select count(*) from public.crm_messages m where m.contact_id = c.id and m.type is distinct from 'reaction')
  )
  from public.crm_contacts c
  where c.id = p_contact_id and (select public.current_user_role()) in ('admin', 'empleado');
$function$;
