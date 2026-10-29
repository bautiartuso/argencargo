-- Marítimo FCL (29/10/2026): contenedores enteros de una operación de Marítimo A. Una op puede
-- llevar uno o varios contenedores; cada uno tiene sus datos del BL, los hitos del puerto (descarga,
-- liberación, retiro de la terminal, entrega, devolución del vacío con sus días libres) y el
-- seguimiento automático de la naviera (mismo cron que los contenedores del Marítimo B).
alter table operations add column if not exists maritime_mode text check (maritime_mode in ('lcl','fcl'));

create table if not exists operation_containers (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations(id) on delete cascade,
  container_number text not null,
  size text,                 -- 20 · 40 · 40HC · 45HC · 20RF · 40RF
  seal text,
  shipping_line text,        -- nombre de lib/navieras.js
  vessel text, voyage text,
  mbl text, hbl text,
  forwarder text,            -- quien emite el HBL (CIMC Wetrans…)
  destination_agent text,    -- agente en destino donde se retira (Liner Shipping Services…)
  pol text, pod text,
  packages integer, gross_kg numeric, cbm numeric,
  etd date, eta date,
  free_days integer,         -- días libres para devolver el vacío
  departed_at date,          -- zarpó
  discharged_at date,        -- descargado en Buenos Aires
  released_at date,          -- liberado por aduana
  picked_up_at date,         -- retirado de la terminal
  delivered_at date,         -- entregado al cliente
  empty_returned_at date,    -- vacío devuelto
  bl_url text,
  tracking_events jsonb, tracking_last text, tracking_vessel text, tracking_updated_at timestamptz, tracking_error text, eta_naviera date,
  created_at timestamptz not null default now()
);
create index if not exists operation_containers_op_idx on operation_containers(operation_id);
alter table operation_containers enable row level security;
create policy opc_admin_all on operation_containers for all using ((select current_user_role())='admin') with check ((select current_user_role())='admin');
create policy opc_emp_all on operation_containers for all using ((select current_user_role())='empleado') with check ((select current_user_role())='empleado');
create policy opc_client_select on operation_containers for select using (operation_id in (select current_client_op_ids()));
