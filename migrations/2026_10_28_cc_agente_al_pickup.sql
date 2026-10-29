-- Acuerdo con 飞殷 (Jinfei), 28/10/2026: el costo del vuelo se descuenta de su cuenta corriente
-- recién cuando el courier hace el pick-up (flights.carrier_pickup_at), no al despachar.
-- Aplicado con el MCP (migración cc_agente_descuenta_al_pickup).
alter table public.agent_signups add column if not exists cc_descuenta_al_pickup boolean not null default false;
update public.agent_signups set cc_descuenta_al_pickup = true where auth_user_id = '8d56aa2e-1112-4a2c-b63a-81699dc7526d';

create or replace function public.agente_cc_al_pickup(p_agent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cc_descuenta_al_pickup from agent_signups where auth_user_id = p_agent limit 1), false)
$$;

-- Deducción de vuelo de un agente "al pick-up": si el vuelo todavía no tiene pick-up no se inserta;
-- si ya lo tiene, queda con la fecha del pick-up.
create or replace function public.cc_agente_deduccion_pickup() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pick timestamptz;
begin
  if new.type = 'deduccion' and new.flight_id is not null and agente_cc_al_pickup(new.agent_id) then
    select carrier_pickup_at into v_pick from flights where id = new.flight_id;
    if v_pick is null then return null; end if;
    new.date := (v_pick at time zone 'America/Argentina/Buenos_Aires')::date;
  end if;
  return new;
end $$;

drop trigger if exists cc_agente_deduccion_pickup on public.agent_account_movements;
create trigger cc_agente_deduccion_pickup before insert on public.agent_account_movements
  for each row execute function public.cc_agente_deduccion_pickup();

-- Cuando llega el pick-up (sync del tracking o fecha manual UPS) se descuenta el costo del vuelo;
-- si se borra la fecha, se saca la deducción.
create or replace function public.cc_agente_vuelo_pickup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not agente_cc_al_pickup(new.agent_id) or coalesce(new.payment_method, '') <> 'cuenta_corriente' then return new; end if;
  if new.carrier_pickup_at is not null and old.carrier_pickup_at is null then
    if coalesce(new.total_cost_usd, 0) > 0 and not exists (select 1 from agent_account_movements where flight_id = new.id and type = 'deduccion') then
      insert into agent_account_movements (agent_id, type, amount_usd, description, flight_id, date)
      values (new.agent_id, 'deduccion', new.total_cost_usd, 'Costo vuelo ' || new.flight_code, new.id,
              (new.carrier_pickup_at at time zone 'America/Argentina/Buenos_Aires')::date);
    end if;
  elsif new.carrier_pickup_at is null and old.carrier_pickup_at is not null then
    delete from agent_account_movements where flight_id = new.id and type = 'deduccion';
  end if;
  return new;
end $$;

drop trigger if exists cc_agente_vuelo_pickup on public.flights;
create trigger cc_agente_vuelo_pickup after update of carrier_pickup_at on public.flights
  for each row execute function public.cc_agente_vuelo_pickup();

-- Vuelos de 飞殷 ya despachados y sin pick-up: se sacan las deducciones (vuelven solas al pick-up).
delete from public.agent_account_movements m using public.flights f
 where m.flight_id = f.id and m.type = 'deduccion' and f.agent_id = '8d56aa2e-1112-4a2c-b63a-81699dc7526d'
   and f.carrier_pickup_at is null and f.payment_method = 'cuenta_corriente';
