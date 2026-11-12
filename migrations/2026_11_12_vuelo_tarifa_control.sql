-- Control del despacho contra la tarifa cargada por el agente (12/11/2026).
-- flights.tarifa_control guarda la foto del momento del despacho: qué tarifa por kg le correspondía
-- según lo que el agente tiene cargado (origen + servicio + tramo de kilos) y cuál cobró. Lo escribe
-- el servidor (/api/aereo/control-tarifa); el equipo solo le agrega visto_at al revisarlo.
--   { estado: ok|distinta|otro_courier|sin_tarifa|sin_dato|sin_pedido, pedido, courier, kg,
--     cobrada, esperada, min, max, tarifas_al, at, visto_at }
alter table public.flights add column if not exists tarifa_control jsonb;

-- El agente puede actualizar sus vuelos en preparación: que no pueda escribirse el control él mismo.
create or replace function public.proteger_tarifa_control()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tarifa_control is distinct from old.tarifa_control
     and coalesce(auth.role(), '') = 'authenticated'
     and coalesce(current_user_role(), '') not in ('admin', 'empleado') then
    new.tarifa_control := old.tarifa_control;
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_tarifa_control on public.flights;
create trigger trg_proteger_tarifa_control before update of tarifa_control on public.flights
  for each row execute function public.proteger_tarifa_control();

grant select (tarifa_control) on public.flights to authenticated;
