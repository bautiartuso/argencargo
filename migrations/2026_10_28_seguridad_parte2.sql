-- Seguridad (28/10/2026), parte 2 — YA APLICADO en producción con el MCP de Supabase.
-- Estado final de cada objeto (las migraciones intermedias quedaron en supabase_migrations).

-- ── Quién es "interno" / "equipo" ─────────────────────────────────────────────
-- Interno = sin claims de JWT (triggers, SQL directo) o service role. Un visitante anónimo por la
-- API tiene claims con role 'anon' y NO es interno.
create or replace function public.es_interno()
returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '') in ('', 'null')
      or coalesce(auth.role(), '') = 'service_role';
$$;
create or replace function public.es_equipo()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_interno()
      or exists (select 1 from profiles where id = auth.uid() and role in ('admin','empleado'));
$$;
create or replace function public.exigir_equipo()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_equipo() then raise exception 'No autorizado' using errcode = '42501'; end if;
end $$;

-- ── Alta de cuentas: siempre cliente ──────────────────────────────────────────
-- Antes el rol salía de raw_user_meta_data (lo manda quien se registra): cualquiera podía
-- registrarse con data.role = 'admin'. Los demás roles los asigna el servidor después.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.profiles (id, role, email) values (new.id, 'cliente'::public.user_role, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- ── Perfiles: rol, socio GI y ARGENMAQ ────────────────────────────────────────
create or replace function public.profiles_bloquear_rol()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare es_admin boolean;
begin
  if public.es_interno() then return new; end if;
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin') into es_admin;
  if es_admin then return new; end if;
  if new.role is distinct from old.role or new.id is distinct from old.id then
    raise exception 'No autorizado a cambiar el rol' using errcode = '42501';
  end if;
  -- El rol de ARGENMAQ (da lectura de costos) solo lo cambia el admin o el servidor.
  if new.argenmaq_role is distinct from old.argenmaq_role then
    raise exception 'No autorizado a cambiar permisos' using errcode = '42501';
  end if;
  -- Un socio GI puede ajustar el % de otro socio o quitarle el acceso, nunca dárselo ni tocarse a sí mismo.
  if (new.is_gi_partner is distinct from old.is_gi_partner or new.gi_partner_pct is distinct from old.gi_partner_pct)
     and not (old.id <> auth.uid() and coalesce((select es_socio_gi()), false)
              and coalesce(old.is_gi_partner, false) and new.is_gi_partner is not true or
              (old.id <> auth.uid() and coalesce((select es_socio_gi()), false) and coalesce(old.is_gi_partner,false) and new.is_gi_partner is not distinct from old.is_gi_partner)) then
    raise exception 'No autorizado a cambiar permisos' using errcode = '42501';
  end if;
  return new;
end $$;

-- ── Rol de base "staff": admin, empleado, socios GI y equipo ARGENMAQ ─────────
-- Sus sesiones traen role=staff en el JWT (auth.users.role); solo ese rol lee columnas de costos.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'staff') then create role staff nologin inherit; end if;
end $$;
grant authenticated to staff;
grant staff to authenticator;
grant usage on schema public to staff;
create or replace function public.rol_auth_de(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from profiles p where p.id = p_uid and (p.role in ('admin','empleado') or coalesce(p.is_gi_partner,false) or p.argenmaq_role is not null))
              then 'staff' else 'authenticated' end;
$$;
create or replace function public.sincronizar_rol_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update auth.users set role = public.rol_auth_de(new.id) where id = new.id and role is distinct from public.rol_auth_de(new.id);
  return new;
end $$;
drop trigger if exists sincronizar_rol_auth on public.profiles;
create trigger sincronizar_rol_auth after insert or update of role, is_gi_partner, argenmaq_role on public.profiles
  for each row execute function public.sincronizar_rol_auth();
update auth.users u set role = public.rol_auth_de(u.id) where u.role is distinct from public.rol_auth_de(u.id);

-- Costos, notas internas y comisiones: solo staff. Clientes y agentes leen el resto de las columnas.
-- OJO: una columna NUEVA en estas tablas que el portal o el agente necesiten leer hay que darla con
-- grant select (columna) to authenticated, anon; y sumarla en lib/columnas-seguras.js.
do $$
declare t text; cols text;
begin
  foreach t in array array['operations','operation_items','clients'] loop
    select string_agg(quote_ident(column_name), ',') into cols from information_schema.columns
     where table_schema='public' and table_name=t
       and not (t='operations' and (column_name like 'cost\_%' or column_name in ('admin_notes','gi_commission_pct')))
       and not (t='operation_items' and column_name='unit_cost_usd')
       and not (t='clients' and column_name='gi_commission_pct');
    execute format('revoke select on public.%I from authenticated, anon', t);
    execute format('grant select (%s) on public.%I to authenticated, anon', cols, t);
    execute format('grant select, insert, update, delete on public.%I to staff', t);
  end loop;
end $$;

-- ── Tablas sin RLS de la cola de WhatsApp ─────────────────────────────────────
alter table public.wa_forward_queue enable row level security;
alter table public.wa_template_queue enable row level security;
alter table public.wa_template_status enable row level security;

-- ── Funciones con permisos elevados ───────────────────────────────────────────
revoke execute on function public.aplicar_saldo_cc(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.apply_tier_voucher_to_op(uuid) from public, anon, authenticated;
revoke execute on function public.compute_points_for_op(uuid) from public, anon, authenticated;
revoke execute on function public.gi_liquidar(uuid) from public, anon, authenticated;
revoke execute on function public.listar_objetos_bucket(text) from public, anon, authenticated;
revoke execute on function public.recompute_client_account_balance(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_client_loyalty(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_client_points_balance(uuid) from public, anon, authenticated;
revoke execute on function public.seguimiento_clientes_v2() from public, anon;
revoke execute on function public.seguimiento_clientes_v3() from public, anon;
revoke execute on function public.eliminar_operacion(uuid) from public, anon;
revoke execute on function public.set_flight_dispatch_photo(uuid, text) from public, anon;
revoke execute on function public.gi_tomar_cliente(uuid) from public, anon;
grant execute on function public.aplicar_saldo_cc(uuid, uuid), public.apply_tier_voucher_to_op(uuid), public.compute_points_for_op(uuid),
  public.gi_liquidar(uuid), public.listar_objetos_bucket(text), public.recompute_client_account_balance(uuid),
  public.recompute_client_loyalty(uuid), public.recompute_client_points_balance(uuid) to service_role;
-- Las que usa el panel llevan "perform public.exigir_equipo();" al principio del cuerpo:
-- apply_redemption_to_op, cancel_redemption, next_agp_code, next_delivery_receipt_number,
-- next_receipt_number, next_operation_code. redeem_reward valida que el cliente sea el dueño.

-- ── Configuración y tarifas ───────────────────────────────────────────────────
drop policy if exists calc_config_select_all on public.calc_config;
drop policy if exists calc_config_select_publica on public.calc_config;
create policy calc_config_select_publica on public.calc_config for select using (
  key not in ('cost_aereo_usd_kg','cost_maritimo_a_usd_cbm','cost_maritimo_b_usd_cbm','costo_financiero_pct','cert_flete_maritimo_real','delivery_margin_usd')
  or (select public.es_equipo()) or (select public.es_socio_gi())
);
create or replace view public.tarifas_publicas with (security_invoker = false) as
  select id, service_key, type, min_qty, max_qty, rate, unit, label, notes, sort_order, created_at, effective_from, effective_to, tax_scope
  from public.tariffs where service_key <> 'costo_aereo_dhl';
grant select on public.tarifas_publicas to anon, authenticated;
drop policy if exists tariffs_select_all on public.tariffs;
drop policy if exists tariffs_select_equipo on public.tariffs;
create policy tariffs_select_equipo on public.tariffs for select using ((select public.es_equipo()) or (select public.es_socio_gi()));

-- ARGENMAQ: la vista pública de precios mostraba EXW, gestión y costo financiero de cada escalón.
create or replace view public.cat_maquinas_precios as
 select p.id,
   (select jsonb_object_agg(c.k, jsonb_build_object('total', ((c.v->'precio')->>'total')::numeric, 'maquina', ((c.v->'precio')->>'maquina')::numeric, 'argencargo', ((c.v->'precio')->>'argencargo')::numeric))
      from jsonb_each(coalesce(p.canales,'{}'::jsonb)) c(k,v)
     where c.k <> 'escalera' and (c.v->>'mostrar')::boolean) as precios,
   case when p.canales ? 'escalera' then
     (select jsonb_object_agg(e.k, (select coalesce(jsonb_agg(jsonb_build_object('q', t->'q', 'unit', t->'unit', 'maquina', t->'maquina', 'argencargo', t->'argencargo', 'via', t->'via')), '[]'::jsonb) from jsonb_array_elements(e.v) t))
        from jsonb_each(p.canales->'escalera') e(k,v) where jsonb_typeof(e.v)='array')
   end as escalera,
   p.dias_produccion
 from public.cat_productos p
 where p.estado = 'publicado';

-- ── Políticas de alta y agentes ───────────────────────────────────────────────
create or replace function public.agente_vuelo_op_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select id from operations where created_by_agent_id = auth.uid() and channel = 'aereo_blanco'::channel_type
      union
      select fo.operation_id from flight_operations fo join flights f on f.id = fo.flight_id where f.agent_id = auth.uid() $$;
revoke execute on function public.agente_vuelo_op_ids() from anon;
grant execute on function public.agente_vuelo_op_ids() to authenticated;
drop policy if exists items_select_agente on public.operation_items;
create policy items_select_agente on public.operation_items for select
  using ((select current_user_role()) = 'agente' and operation_id in (select public.agente_vuelo_op_ids()));
drop policy if exists items_update_agente on public.operation_items;
drop policy if exists agent_acc_agente_insert on public.agent_account_movements;
create policy agent_acc_agente_insert on public.agent_account_movements for insert
  with check (agent_id = (select auth.uid()) and type = 'deduccion'
              and flight_id is not null and flight_id in (select id from flights where agent_id = (select auth.uid())));
drop policy if exists notif_insert_any_authenticated on public.notifications;
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert
  with check (
    (select public.es_equipo()) or (select current_user_role()) = 'agente'
    or (portal = 'admin' and (link is null or link ~ '^[/?]')
        and user_id in (select id from profiles where role in ('admin','empleado')))
  );
drop policy if exists quotes_client_insert on public.quotes;
create policy quotes_client_insert on public.quotes for insert with check (client_id = (select current_client_id()));
drop policy if exists op_feedback_public_insert on public.op_feedback;
drop policy if exists referrals_insert_authenticated on public.referrals;

-- ── Storage ───────────────────────────────────────────────────────────────────
create or replace function public.es_staff_o_agente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (role in ('admin','empleado','agente') or coalesce(is_gi_partner,false) or argenmaq_role is not null));
$$;
-- Los buckets públicos sirven cada archivo por URL; la política de SELECT abierta solo servía
-- para LISTAR el bucket entero (comprobantes de transferencias incluidos) con la clave anónima.
drop policy if exists package_photos_public_read on storage.objects;
drop policy if exists solfin_comprob_public_read on storage.objects;
drop policy if exists package_photos_staff_read on storage.objects;
drop policy if exists solfin_comprob_equipo_read on storage.objects;
create policy package_photos_staff_read on storage.objects for select using (bucket_id = 'package-photos' and (select public.es_staff_o_agente()));
create policy solfin_comprob_equipo_read on storage.objects for select using (bucket_id = 'solfin-comprobantes' and (select public.es_equipo()));
drop policy if exists package_photos_auth_insert on storage.objects;
drop policy if exists package_photos_auth_update on storage.objects;
drop policy if exists package_photos_auth_delete on storage.objects;
drop policy if exists solfin_comprob_auth_insert on storage.objects;
drop policy if exists solfin_comprob_auth_update on storage.objects;
drop policy if exists solfin_comprob_auth_delete on storage.objects;
create policy package_photos_auth_insert on storage.objects for insert with check (bucket_id = 'package-photos' and (select public.es_staff_o_agente()));
create policy package_photos_auth_update on storage.objects for update using (bucket_id = 'package-photos' and (select public.es_staff_o_agente()));
create policy package_photos_auth_delete on storage.objects for delete using (bucket_id = 'package-photos' and (select public.es_equipo()));
create policy solfin_comprob_auth_insert on storage.objects for insert with check (bucket_id = 'solfin-comprobantes' and (select public.es_equipo()));
create policy solfin_comprob_auth_update on storage.objects for update using (bucket_id = 'solfin-comprobantes' and (select public.es_equipo()));
create policy solfin_comprob_auth_delete on storage.objects for delete using (bucket_id = 'solfin-comprobantes' and (select public.es_equipo()));
