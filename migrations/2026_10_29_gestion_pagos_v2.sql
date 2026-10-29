-- Gestión de pagos v2 (29/10/2026): los pagos del cliente van en su propia tabla (puede pagar en
-- varias veces, en efectivo o por transferencia con comprobante) y la transferencia al proveedor
-- guarda su comprobante. Los movimientos que esto genera en la CC de SolFin quedan atados a la
-- gestión (no a una operación) y se borran solos si se borra el pago o la gestión.
create table if not exists payment_management_cobros (
  id uuid primary key default gen_random_uuid(),
  payment_management_id uuid not null references payment_management(id) on delete cascade,
  date date not null,
  method text not null check (method in ('efectivo','transferencia','cripto')),
  currency text not null check (currency in ('USD','ARS')),
  amount numeric not null check (amount > 0),
  exchange_rate numeric,
  amount_usd numeric not null,
  commission_pct numeric,
  commission_usd numeric,
  receipt_url text,
  created_at timestamptz not null default now()
);
create index if not exists pm_cobros_pm_idx on payment_management_cobros(payment_management_id);
alter table payment_management_cobros enable row level security;
create policy pm_cobros_admin_all on payment_management_cobros for all
  using ((select current_user_role()) = 'admin') with check ((select current_user_role()) = 'admin');
create policy pm_cobros_emp_all on payment_management_cobros for all
  using ((select current_user_role()) = 'empleado') with check ((select current_user_role()) = 'empleado');

alter table payment_management
  add column if not exists giro_receipt_url text,
  add column if not exists cable_pct numeric,
  add column if not exists cable_fijo_usd numeric,
  add column if not exists costo_cable_usd numeric,
  add column if not exists margen_pct numeric;

alter table cc_solfin_movements
  add column if not exists payment_management_id uuid references payment_management(id) on delete cascade,
  add column if not exists pm_cobro_id uuid references payment_management_cobros(id) on delete cascade;
create index if not exists cc_solfin_pm_idx on cc_solfin_movements(payment_management_id);

-- Las gestiones viejas: lo que ya estaba en cost_comision_giro es el costo del giro, y si el
-- cliente ya había pagado, ese pago pasa a la tabla nueva (sin movimiento en la CC: es histórico).
update payment_management set costo_cable_usd = coalesce(cost_comision_giro,0) where costo_cable_usd is null;
insert into payment_management_cobros (payment_management_id,date,method,currency,amount,amount_usd)
select id, coalesce(client_paid_date,date,created_at::date), coalesce(nullif(client_payment_method,''),'efectivo'), 'USD',
       coalesce(client_paid_amount_usd,client_amount_usd), coalesce(client_paid_amount_usd,client_amount_usd)
from payment_management p
where client_paid and coalesce(client_paid_amount_usd,client_amount_usd,0) > 0
  and not exists (select 1 from payment_management_cobros c where c.payment_management_id=p.id);

-- v3 (29/10/2026): los pesos que entran por transferencia se dolarizan días después a otro TC.
-- La gestión no se cierra hasta cargar a qué TC se dolarizó cada pago; ahí se recalcula amount_usd.
alter table payment_management_cobros add column if not exists dolar_rate numeric, add column if not exists dolar_date date;

-- El giro de las gestiones nuevas es "cable" (Cable China por SolFin): el check no lo aceptaba.
alter table payment_management drop constraint payment_management_giro_payment_method_check;
alter table payment_management add constraint payment_management_giro_payment_method_check check (giro_payment_method = any (array['efectivo','transferencia','tarjeta_credito','cable']));

-- Portal (30/10/2026): el cliente ve sus pagos de cada gestión (con el comprobante). Función
-- SECURITY DEFINER para no anidar RLS (ver 2026_09_14_rls_performance_portal.sql).
create or replace function current_client_pm_ids() returns setof uuid language sql stable security definer set search_path=public as $$
  select id from payment_management where client_id = (select current_client_id());
$$;
create policy pm_cobros_client_select on payment_management_cobros for select using (payment_management_id in (select current_client_pm_ids()));
