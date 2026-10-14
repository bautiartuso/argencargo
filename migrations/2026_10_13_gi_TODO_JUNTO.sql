-- GI 13/10/2026: pegar TODO esto en Supabase → SQL Editor → Run (es seguro correrlo más de una vez).

-- GI · link de cotización con sesión (13/10/2026)
-- El cliente responde la cotización logueado: queda quién aceptó/rechazó, cuándo y por qué.

alter table public.gi_quotes add column if not exists responded_by uuid;
alter table public.gi_quotes add column if not exists rejected_at timestamptz;
alter table public.gi_quotes add column if not exists reject_reason text;

-- Los CHECK viejos de estado/tipo no contemplan 'rejected' ni los eventos nuevos
-- (account_created, rejected). Se sacan: los valores los controla la app.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.gi_quotes'::regclass, 'public.gi_quote_requests'::regclass, 'public.gi_quote_communications'::regclass)
      and (pg_get_constraintdef(c.oid) ilike '%status%' or pg_get_constraintdef(c.oid) ilike '%type%')
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

-- GI · socios y liquidación (13/10/2026)
--
-- 1) Una sola fórmula para la comisión del socio, a la vista (antes vivía en un trigger que no
--    estaba en el repo):
--      ganancia = cobrado al cliente − (pagos al proveedor − reembolsos + costos de la op:
--                 flete, impuestos, gasto documental, seguro, flete local, otros)
--      comisión = ganancia × % del socio   (si hay pérdida, el socio la absorbe en la misma proporción)
--    % del socio: el de la op, si no el de la ficha del cliente, si no el general del socio.
--    Pagos al proveedor en pesos todavía sin dolarizar se estiman con el TC de gi_settings
--    (la liquidación queda "estimada" y no se puede pagar hasta dolarizar).
--    Se recalcula sola cuando la op se cierra y cada vez que cambia un cobro o un costo de una op
--    cerrada, salvo que la comisión ya se le haya pagado al socio.
-- 2) "Yo (admin)" guardaba al admin como socio: esas ops pasan a ser de Argencargo.
-- 3) Los socios no pueden tocar configuración, tarifas, ni borrar pedidos, ni marcar sus
--    comisiones como pagadas (políticas RESTRICTIVE: se suman a las que ya existen).

-- ── 1. Liquidación ──
-- Las funciones/trigger viejos que escribían gi_partner_earnings se reemplazan por los de abajo.
do $$
declare r record;
begin
  for r in
    select t.tgname, t.tgrelid::regclass as tabla
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal and p.prosrc ilike '%gi_partner_earnings%'
  loop
    execute format('drop trigger if exists %I on %s', r.tgname, r.tabla);
  end loop;
end $$;

-- Una liquidación por op (se queda con la pagada o la más nueva).
delete from public.gi_partner_earnings a
using public.gi_partner_earnings b
where a.operation_id = b.operation_id and a.id <> b.id
  and not coalesce(a.paid_to_partner, false)
  and (coalesce(b.paid_to_partner, false) or a.created_at < b.created_at);
create unique index if not exists gi_partner_earnings_op_uq on public.gi_partner_earnings (operation_id);

create or replace function public.gi_liquidar(p_op uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o record;
  v_partner uuid;
  v_pct numeric;
  v_rev numeric;
  v_cost numeric;
  v_ars numeric;
  v_fx numeric;
  v_est boolean := false;
begin
  select op.*, c.gi_partner_id as cl_partner, c.gi_commission_pct as cl_pct
    into o
    from operations op left join clients c on c.id = op.client_id
   where op.id = p_op;
  if not found or o.service_type is distinct from 'gestion_integral' then return; end if;
  if exists (select 1 from gi_partner_earnings where operation_id = p_op and paid_to_partner) then return; end if;
  if o.status is distinct from 'operacion_cerrada' then
    delete from gi_partner_earnings where operation_id = p_op;
    return;
  end if;

  v_partner := case when coalesce(o.gi_admin_owned, false) then null else coalesce(o.gi_partner_id, o.cl_partner) end;
  if v_partner is not null and not exists (select 1 from profiles where id = v_partner and is_gi_partner) then
    v_partner := null;
  end if;
  if v_partner is null then
    delete from gi_partner_earnings where operation_id = p_op;
    return;
  end if;

  v_pct := coalesce(o.gi_commission_pct, o.cl_pct, (select gi_partner_pct from profiles where id = v_partner), 0);

  select coalesce(sum(amount_usd), 0) into v_rev from operation_client_payments where operation_id = p_op;
  select coalesce(sum(case when type = 'refund' then -1 else 1 end * coalesce(amount_usd, 0)), 0)
    into v_cost from operation_supplier_payments where operation_id = p_op;
  select coalesce(sum(case when type = 'refund' then -1 else 1 end * amount_ars), 0)
    into v_ars from operation_supplier_payments
   where operation_id = p_op and coalesce(amount_usd, 0) = 0 and coalesce(amount_ars, 0) <> 0;
  if v_ars <> 0 then
    select default_fx_rate into v_fx from gi_settings limit 1;
    if coalesce(v_fx, 0) > 0 then v_cost := v_cost + v_ars / v_fx; v_est := true; end if;
  end if;
  v_cost := v_cost + coalesce(o.cost_flete, 0) + coalesce(o.cost_impuestos_reales, 0) + coalesce(o.cost_gasto_documental, 0)
                   + coalesce(o.cost_seguro, 0) + coalesce(o.cost_flete_local, 0) + coalesce(o.cost_otros, 0);

  insert into gi_partner_earnings (partner_id, operation_id, client_id, closed_at, revenue_usd, total_costs_usd,
                                   net_profit_usd, commission_pct, commission_usd, is_estimated, estimated_fx_rate)
  values (v_partner, p_op, o.client_id, coalesce(o.closed_at, now()), round(v_rev, 2), round(v_cost, 2),
          round(v_rev - v_cost, 2), v_pct, round((v_rev - v_cost) * v_pct / 100, 2), v_est, case when v_est then v_fx end)
  on conflict (operation_id) do update set
    partner_id = excluded.partner_id, client_id = excluded.client_id, closed_at = excluded.closed_at,
    revenue_usd = excluded.revenue_usd, total_costs_usd = excluded.total_costs_usd,
    net_profit_usd = excluded.net_profit_usd, commission_pct = excluded.commission_pct,
    commission_usd = excluded.commission_usd, is_estimated = excluded.is_estimated,
    estimated_fx_rate = excluded.estimated_fx_rate;
end $$;

create or replace function public.gi_liquidar_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'operations' then
    if new.service_type = 'gestion_integral' then perform gi_liquidar(new.id); end if;
  else
    perform gi_liquidar(coalesce(new.operation_id, old.operation_id));
  end if;
  return null;
end $$;

drop trigger if exists gi_liquidar_ops on public.operations;
create trigger gi_liquidar_ops after update of status, gi_partner_id, gi_admin_owned, gi_commission_pct, closed_at,
  cost_flete, cost_impuestos_reales, cost_gasto_documental, cost_seguro, cost_flete_local, cost_otros
  on public.operations for each row execute function public.gi_liquidar_trg();

drop trigger if exists gi_liquidar_cobros on public.operation_client_payments;
create trigger gi_liquidar_cobros after insert or update or delete on public.operation_client_payments
  for each row execute function public.gi_liquidar_trg();

drop trigger if exists gi_liquidar_costos on public.operation_supplier_payments;
create trigger gi_liquidar_costos after insert or update or delete on public.operation_supplier_payments
  for each row execute function public.gi_liquidar_trg();

grant execute on function public.gi_liquidar(uuid) to authenticated;

-- ── 2. "Yo (admin)" → op de Argencargo ──
update public.operations o
   set gi_admin_owned = true, gi_partner_id = null
 where o.service_type = 'gestion_integral'
   and o.gi_partner_id in (select id from public.profiles where role = 'admin' and not coalesce(is_gi_partner, false));

-- Recalcula las cerradas sin pagar con la fórmula nueva.
select public.gi_liquidar(id) from public.operations
 where service_type = 'gestion_integral' and status = 'operacion_cerrada';

-- ── 3. Permisos de los socios ──
create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'empleado'));
$$;
grant execute on function public.es_staff() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['gi_settings', 'gi_shipping_rates'] loop
    execute format('drop policy if exists %I on public.%I', t || '_solo_staff_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_solo_staff_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_solo_staff_del', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.es_staff()))', t || '_solo_staff_ins', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.es_staff()))', t || '_solo_staff_upd', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select public.es_staff()))', t || '_solo_staff_del', t);
  end loop;
end $$;

drop policy if exists gi_quote_requests_borrar_staff on public.gi_quote_requests;
create policy gi_quote_requests_borrar_staff on public.gi_quote_requests as restrictive for delete to authenticated
  using ((select public.es_staff()));

drop policy if exists gi_partner_earnings_solo_staff_upd on public.gi_partner_earnings;
create policy gi_partner_earnings_solo_staff_upd on public.gi_partner_earnings as restrictive for update to authenticated
  using ((select public.es_staff()));
drop policy if exists gi_partner_earnings_solo_staff_del on public.gi_partner_earnings;
create policy gi_partner_earnings_solo_staff_del on public.gi_partner_earnings as restrictive for delete to authenticated
  using ((select public.es_staff()));
