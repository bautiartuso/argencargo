-- Escaneos originales de los bultos (24/11/2026).
-- Cuando un bulto se borra (reempaque del agente, reembalaje en el despacho, corrección a mano), su
-- fila desaparecía y el cron de limpieza borraba la foto como huérfana a los 2 días: después de un
-- reempaque ya no se podía ver cómo había llegado cada paquete al depósito.
-- Desde ahora un trigger guarda el escaneo en operation_package_scans antes de que la fila se vaya,
-- por cualquier camino. Lo ven el admin y el cliente en la importación, debajo de los bultos.

create table if not exists public.operation_package_scans (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid,                 -- sin FK: si se borra la operación, el cron limpia estas filas
  client_id uuid,
  package_number integer,
  quantity integer,
  national_tracking text,
  length_cm numeric, width_cm numeric, height_cm numeric, gross_weight_kg numeric,
  photo_urls text[] not null,
  photo_uploaded_at timestamptz,
  registered_at timestamptz,
  archived_at timestamptz not null default now()
);
create index if not exists operation_package_scans_op_idx on public.operation_package_scans(operation_id);

alter table public.operation_package_scans enable row level security;
drop policy if exists scans_equipo on public.operation_package_scans;
create policy scans_equipo on public.operation_package_scans for select
  using ((select public.current_user_role()) in ('admin','empleado'));
drop policy if exists scans_cliente on public.operation_package_scans;
create policy scans_cliente on public.operation_package_scans for select
  using (operation_id in (select public.current_client_op_ids()));
drop policy if exists scans_agente on public.operation_package_scans;
create policy scans_agente on public.operation_package_scans for select
  using ((select public.current_user_role()) = 'agente' and operation_id in (select public.agente_op_ids()));
grant select on public.operation_package_scans to authenticated;

create or replace function public.guardar_escaneo_original() returns trigger
 language plpgsql security definer set search_path to 'public' as $$
declare fotos text[];
begin
  fotos := array(select distinct u from unnest(array[old.photo_url] || coalesce(old.photo_urls, '{}')) u where u is not null and u <> '');
  if coalesce(array_length(fotos, 1), 0) = 0 then return old; end if;
  -- Bulto suelto, o la operación entera se está borrando: no hay importación donde mostrarlo.
  if old.operation_id is null or not exists (select 1 from public.operations where id = old.operation_id) then return old; end if;
  -- El mismo escaneo ya guardado (pantallas que borran y vuelven a crear los bultos).
  if exists (select 1 from public.operation_package_scans s where s.operation_id = old.operation_id and s.photo_urls && fotos) then return old; end if;
  insert into public.operation_package_scans (operation_id, client_id, package_number, quantity, national_tracking, length_cm, width_cm, height_cm, gross_weight_kg, photo_urls, photo_uploaded_at, registered_at)
  values (old.operation_id, old.client_id, old.package_number, old.quantity, old.national_tracking, old.length_cm, old.width_cm, old.height_cm, old.gross_weight_kg, fotos, old.photo_uploaded_at, old.created_at);
  return old;
end $$;

drop trigger if exists trg_guardar_escaneo_original on public.operation_packages;
create trigger trg_guardar_escaneo_original before delete on public.operation_packages
  for each row execute function public.guardar_escaneo_original();
