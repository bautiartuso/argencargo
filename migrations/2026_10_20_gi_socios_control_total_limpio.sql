
create or replace function public.es_socio_gi()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select is_gi_partner from public.profiles where id = auth.uid()), false); $$;
grant execute on function public.es_socio_gi() to authenticated;

create or replace function public.es_op_gi(p_op uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select service_type = 'gestion_integral' from public.operations where id = p_op), false); $$;
grant execute on function public.es_op_gi(uuid) to authenticated;

drop policy if exists gi_settings_solo_staff_ins on public.gi_settings;
drop policy if exists gi_settings_solo_staff_upd on public.gi_settings;
drop policy if exists gi_settings_solo_staff_del on public.gi_settings;
drop policy if exists gi_shipping_rates_solo_staff_ins on public.gi_shipping_rates;
drop policy if exists gi_shipping_rates_solo_staff_upd on public.gi_shipping_rates;
drop policy if exists gi_shipping_rates_solo_staff_del on public.gi_shipping_rates;
drop policy if exists gi_quote_requests_borrar_staff on public.gi_quote_requests;
drop policy if exists gi_partner_earnings_solo_staff_upd on public.gi_partner_earnings;
drop policy if exists gi_partner_earnings_solo_staff_del on public.gi_partner_earnings;

do $$
declare t text;
begin
  foreach t in array array[
    'gi_quote_requests', 'gi_quote_request_products', 'gi_quotes', 'gi_quote_products', 'gi_quote_packages',
    'gi_quote_communications', 'gi_partner_earnings', 'gi_settings', 'gi_shipping_rates',
    'gi_suppliers', 'gi_purchase_agents', 'gi_forwarders'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_socio_gi_todo', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.es_socio_gi())) with check ((select public.es_socio_gi()))', t || '_socio_gi_todo', t);
  end loop;
end $$;

drop policy if exists operations_socio_gi_todo on public.operations;
create policy operations_socio_gi_todo on public.operations for all to authenticated
  using ((select public.es_socio_gi()) and service_type = 'gestion_integral')
  with check ((select public.es_socio_gi()) and service_type = 'gestion_integral');

do $$
declare t text;
begin
  foreach t in array array['operation_items', 'operation_packages', 'operation_client_payments', 'operation_supplier_payments', 'tracking_events'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_socio_gi_todo', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.es_socio_gi()) and (select public.es_op_gi(operation_id))) with check ((select public.es_socio_gi()) and (select public.es_op_gi(operation_id)))', t || '_socio_gi_todo', t);
  end loop;
end $$;

drop policy if exists clients_socio_gi_editar on public.clients;
create policy clients_socio_gi_editar on public.clients for update to authenticated
  using ((select public.es_socio_gi())) with check ((select public.es_socio_gi()));
drop policy if exists clients_socio_gi_crear on public.clients;
create policy clients_socio_gi_crear on public.clients for insert to authenticated
  with check ((select public.es_socio_gi()));

drop policy if exists profiles_socio_gi_ver_equipo on public.profiles;
create policy profiles_socio_gi_ver_equipo on public.profiles for select to authenticated
  using ((select public.es_socio_gi()) and (coalesce(is_gi_partner, false) or role in ('admin', 'empleado')));
drop policy if exists profiles_socio_gi_editar_socios on public.profiles;
create policy profiles_socio_gi_editar_socios on public.profiles for update to authenticated
  using ((select public.es_socio_gi()) and coalesce(is_gi_partner, false))
  with check ((select public.es_socio_gi()));

drop policy if exists finance_entries_socio_gi_comisiones on public.finance_entries;
create policy finance_entries_socio_gi_comisiones on public.finance_entries for insert to authenticated
  with check ((select public.es_socio_gi()) and category = 'comisiones_socio');
drop policy if exists finance_entries_socio_gi_ver_gi on public.finance_entries;
create policy finance_entries_socio_gi_ver_gi on public.finance_entries for select to authenticated
  using ((select public.es_socio_gi()) and (category = 'comisiones_socio' or (operation_id is not null and (select public.es_op_gi(operation_id)))));
drop policy if exists credit_cards_socio_gi_ver on public.credit_cards;
create policy credit_cards_socio_gi_ver on public.credit_cards for select to authenticated
  using ((select public.es_socio_gi()));

do $$
declare t text;
begin
  foreach t in array array['tariffs', 'calc_config', 'client_tariff_overrides', 'ncm_database', 'antidumping_ncm', 'delivery_zones'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_socio_gi_ver', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.es_socio_gi()))', t || '_socio_gi_ver', t);
  end loop;
end $$;
