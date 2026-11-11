-- Cartel BULTOS del vuelo (11/11/2026): se apaga cuando el equipo ya tocó los bultos después de que el
-- agente subió el desglose del courier — a mano o con "Extraer bultos con IA". Antes solo se apagaba con la IA.
alter table public.flights add column if not exists bultos_revisados_at timestamptz;

create or replace function public.marcar_bultos_revisados()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_op uuid;
begin
  -- Solo cuenta lo que toca el equipo (el agente o los procesos del servidor no apagan el cartel).
  if coalesce(current_user_role(),'') not in ('admin','empleado') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then v_op := old.operation_id; else v_op := new.operation_id; end if;
  if v_op is not null then
    update flights f set bultos_revisados_at = now()
      from flight_operations fo
     where fo.flight_id = f.id and fo.operation_id = v_op
       and f.dispatch_photo_url is not null and f.bultos_revisados_at is null and f.status::text <> 'recibido';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists trg_marcar_bultos_revisados on public.operation_packages;
create trigger trg_marcar_bultos_revisados
  after insert or delete or update of quantity, length_cm, width_cm, height_cm, gross_weight_kg, operation_id
  on public.operation_packages for each row execute function public.marcar_bultos_revisados();

-- Si se sube otro desglose, el cartel vuelve a aparecer.
create or replace function public.vuelo_desglose_nuevo()
returns trigger language plpgsql as $$
begin
  if new.dispatch_photo_url is distinct from old.dispatch_photo_url then new.bultos_revisados_at := null; end if;
  return new;
end $$;
drop trigger if exists trg_vuelo_desglose_nuevo on public.flights;
create trigger trg_vuelo_desglose_nuevo before update of dispatch_photo_url on public.flights
  for each row execute function public.vuelo_desglose_nuevo();

grant select (bultos_revisados_at) on public.flights to authenticated;
