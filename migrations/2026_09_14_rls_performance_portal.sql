-- Performance del portal del cliente (14/09/2026)
--
-- PROBLEMA: las policies de RLS se anidaban en cascada. Una lectura de
-- operation_packages consultaba operations, cuyas 5 policies consultaban clients,
-- cuyas 5 policies consultaban profiles. Postgres armaba un plan con 119 subplanes
-- para leer una tabla de 554 filas: 35,8 ms de planning contra 2,6 ms de ejecucion.
-- PostgREST no reusa prepared statements, asi que ese planning se pagaba en cada request.
-- Medido en produccion: 180-290 ms promedio por consulta, picos de 2 s.
--
-- SOLUCION: funciones STABLE SECURITY DEFINER que resuelven la identidad una sola vez
-- por sentencia y no re-entran en el RLS de las tablas que consultan. Las policies pasan
-- a comparar columnas contra un valor escalar, indexable y sin subplanes.
-- Todas las llamadas van envueltas en (select f()) para que Postgres las promueva a
-- InitPlan y las evalue una vez, no por fila.
--
-- RESULTADO: operation_items 80,8 ms -> 5,0 ms. operation_packages 38,4 ms -> 3,8 ms.
-- Las 9 consultas de la carga del portal: 33,8 ms en total.
--
-- Verificado: filas visibles identicas antes y despues para cliente (x2), agente,
-- empleado, admin y anon, sobre 12 tablas. Cero diferencias.

-- ---------------------------------------------------------------- funciones auxiliares

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path to 'public'
as $$ select id from clients where auth_user_id = auth.uid() limit 1; $$;

create or replace function public.current_client_op_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select o.id from operations o
     where o.client_id = (select id from clients where auth_user_id = auth.uid() limit 1); $$;

create or replace function public.gi_partner_client_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select id from clients where gi_partner_id = auth.uid(); $$;

create or replace function public.gi_partner_op_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select o.id from operations o
     where o.service_type = 'gestion_integral'
       and coalesce(o.gi_admin_owned,false) = false
       and (o.gi_partner_id = auth.uid()
            or (o.gi_partner_id is null
                and o.client_id in (select id from clients where gi_partner_id = auth.uid()))); $$;

create or replace function public.agente_op_ids()
returns setof uuid language sql stable security definer set search_path to 'public'
as $$ select id from operations
     where created_by_agent_id = auth.uid() and channel = 'aereo_blanco'::channel_type; $$;

comment on function public.current_client_id() is 'clients.id del usuario logueado.';
comment on function public.current_client_op_ids() is 'Operaciones del cliente logueado.';
comment on function public.gi_partner_client_ids() is 'Clientes donde el usuario es socio GI.';
comment on function public.gi_partner_op_ids() is 'Operaciones visibles para el socio GI.';
comment on function public.agente_op_ids() is 'Operaciones del agente logueado (canal aereo_blanco).';

grant execute on function
  public.current_client_id(), public.current_client_op_ids(),
  public.gi_partner_client_ids(), public.gi_partner_op_ids(), public.agente_op_ids()
  to authenticated, anon;
-- anon queda con EXECUTE a proposito: las policies son {public} y un usuario anonimo
-- que lee una tabla las evalua igual. Sin el grant daria "permission denied" en lugar
-- de false, y romperia los links publicos. Para anon las funciones devuelven vacio
-- porque auth.uid() es null. Mismo criterio que current_user_role(), que ya era asi.

-- ---------------------------------------------------------------- clients

alter policy clients_select_admin  on clients using ((select current_user_role()) = 'admin');
alter policy clients_update_admin  on clients using ((select current_user_role()) = 'admin');
alter policy clients_delete_admin  on clients using ((select current_user_role()) = 'admin');
alter policy clients_insert_admin  on clients with check ((select current_user_role()) = 'admin');
alter policy clients_select_agente on clients using ((select current_user_role()) = 'agente');
alter policy emp_cl_sel on clients using ((select current_user_role()) = 'empleado');
alter policy emp_cl_ins on clients with check ((select current_user_role()) = 'empleado');
alter policy emp_cl_upd on clients
  using ((select current_user_role()) = 'empleado')
  with check ((select current_user_role()) = 'empleado');

-- ---------------------------------------------------------------- operations

alter policy ops_select_admin on operations using ((select current_user_role()) = 'admin');
alter policy ops_update_admin on operations using ((select current_user_role()) = 'admin');
alter policy ops_delete_admin on operations using ((select current_user_role()) = 'admin');
alter policy ops_insert_admin on operations with check ((select current_user_role()) = 'admin');
alter policy emp_op_sel on operations using ((select current_user_role()) = 'empleado');
alter policy emp_op_upd on operations using ((select current_user_role()) = 'empleado');
alter policy emp_op_ins on operations with check ((select current_user_role()) = 'empleado');

alter policy ops_select_client on operations using (client_id = (select current_client_id()));

alter policy ops_select_agente_own on operations using (
  (select current_user_role()) = 'agente'
  and created_by_agent_id = (select auth.uid())
  and channel = 'aereo_blanco'::channel_type);
alter policy ops_update_agente_own on operations using (
  (select current_user_role()) = 'agente'
  and created_by_agent_id = (select auth.uid())
  and channel = 'aereo_blanco'::channel_type);
alter policy ops_insert_agente on operations with check (
  (select current_user_role()) = 'agente' and channel = 'aereo_blanco'::channel_type);
alter policy ops_update_agente_flight on operations using (
  (select current_user_role()) = 'agente'
  and id in (select fo.operation_id from flight_operations fo
             join flights f on f.id = fo.flight_id where f.agent_id = (select auth.uid())));

alter policy ops_select_gi_partner on operations using (
  service_type = 'gestion_integral' and coalesce(gi_admin_owned,false) = false
  and ((gi_partner_id = (select auth.uid()))
       or (gi_partner_id is null and client_id in (select gi_partner_client_ids()))));

alter policy ops_update_client_consolidation on operations
  using (client_id = (select current_client_id())
         and status = 'en_deposito_origen'::operation_status
         and consolidation_confirmed = false)
  with check (client_id = (select current_client_id())
         and status = any(array['en_deposito_origen'::operation_status,
                                'en_preparacion'::operation_status]));

-- ---------------------------------------------------------------- operation_items

alter policy items_select_admin  on operation_items using ((select current_user_role()) = 'admin');
alter policy items_update_admin  on operation_items using ((select current_user_role()) = 'admin');
alter policy items_delete_admin  on operation_items using ((select current_user_role()) = 'admin');
alter policy items_insert_admin  on operation_items with check ((select current_user_role()) = 'admin');
alter policy items_select_agente on operation_items using ((select current_user_role()) = 'agente');
alter policy items_update_agente on operation_items using ((select current_user_role()) = 'agente');
alter policy items_insert_agente on operation_items with check ((select current_user_role()) = 'agente');
alter policy emp_opi_all        on operation_items using ((select current_user_role()) = 'empleado');
alter policy items_select_client     on operation_items using (operation_id in (select current_client_op_ids()));
alter policy items_select_gi_partner on operation_items using (operation_id in (select gi_partner_op_ids()));

-- ---------------------------------------------------------------- tracking_events

alter policy tracking_select_admin on tracking_events using ((select current_user_role()) = 'admin');
alter policy tracking_update_admin on tracking_events using ((select current_user_role()) = 'admin');
alter policy tracking_delete_admin on tracking_events using ((select current_user_role()) = 'admin');
alter policy tracking_insert_admin on tracking_events with check ((select current_user_role()) = 'admin');
alter policy tracking_select_agente_own on tracking_events using (
  (select current_user_role()) = 'agente' and operation_id in (select agente_op_ids()));

-- ---------------------------------------------------------------- operation_packages

alter policy "Admins full access packages" on operation_packages using ((select current_user_role()) = 'admin');
alter policy emp_opk_all                   on operation_packages using ((select current_user_role()) = 'empleado');
alter policy "Clients read own packages"   on operation_packages using (operation_id in (select current_client_op_ids()));
alter policy pkgs_select_client_by_client  on operation_packages using (client_id = (select current_client_id()));
alter policy pkgs_select_gi_partner        on operation_packages using (operation_id in (select gi_partner_op_ids()));
alter policy pkgs_agente_registrados on operation_packages
  using ((select current_user_role()) = 'agente' and registered_by_agent_id = (select auth.uid()))
  with check ((select current_user_role()) = 'agente' and registered_by_agent_id = (select auth.uid()));
alter policy pkgs_select_agente_own on operation_packages using (
  (select current_user_role()) = 'agente' and operation_id in (select agente_op_ids()));
alter policy pkgs_update_agente_own on operation_packages using (
  (select current_user_role()) = 'agente' and operation_id in (select agente_op_ids()));
alter policy pkgs_delete_agente_own on operation_packages using (
  (select current_user_role()) = 'agente' and operation_id in (select agente_op_ids()));
alter policy pkgs_insert_agente_own on operation_packages with check (
  (select current_user_role()) = 'agente' and operation_id in (select agente_op_ids()));

-- ---------------------------------------------------------------- pagos, cotis, premios, tarifas

alter policy client_payments_admin_all on operation_client_payments
  using ((select current_user_role()) = 'admin')
  with check ((select current_user_role()) = 'admin');
alter policy client_payments_client_select_own on operation_client_payments
  using (operation_id in (select current_client_op_ids()));
alter policy ocp_select_gi_partner on operation_client_payments
  using (operation_id in (select gi_partner_op_ids()));

alter policy pm_client_select on payment_management using (client_id = (select current_client_id()));

alter policy quotes_admin_all     on quotes using ((select current_user_role()) = 'admin');
alter policy quotes_client_select on quotes using (client_id = (select current_client_id()));
alter policy quotes_client_delete on quotes using (client_id = (select current_client_id()));

alter policy tier_rewards_admin_all   on tier_rewards using ((select current_user_role()) = 'admin');
alter policy tier_rewards_select_own  on tier_rewards using (client_id = (select current_client_id()));

alter policy overrides_admin_all     on client_tariff_overrides using ((select current_user_role()) = 'admin');
alter policy overrides_client_select on client_tariff_overrides using (client_id = (select current_client_id()));

alter policy fii_admin        on flight_invoice_items using ((select current_user_role()) = 'admin');
alter policy flight_ops_admin on flight_operations    using ((select current_user_role()) = 'admin');
alter policy repack_admin_all on repack_requests      using ((select current_user_role()) = 'admin');
