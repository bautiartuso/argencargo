-- Fotos de prueba del vuelo (15/11/2026): si el agente marca que la carga lleva baterías o marca,
-- adjunta una o más fotos que lo prueban (no es obligatorio; puede hacerlo después de despachar).
-- Son dos listas separadas. Las URLs son del bucket package-photos: /api/cleanup/photos las cuenta
-- como referencias vivas.
alter table public.flights add column if not exists battery_photo_urls text[] not null default '{}';
alter table public.flights add column if not exists brand_photo_urls text[] not null default '{}';

-- Igual que set_flight_dispatch_photo: el agente dueño del vuelo (o el equipo) reemplaza la lista.
create or replace function public.set_flight_proof_photos(p_flight_id uuid, p_tipo text, p_urls text[])
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n int;
begin
  if p_tipo not in ('bateria', 'marca') then return false; end if;
  update flights
     set battery_photo_urls = case when p_tipo = 'bateria' then coalesce(p_urls, '{}') else battery_photo_urls end,
         brand_photo_urls   = case when p_tipo = 'marca'   then coalesce(p_urls, '{}') else brand_photo_urls end
   where id = p_flight_id
     and (agent_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'empleado')));
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

revoke all on function public.set_flight_proof_photos(uuid, text, text[]) from public, anon;
grant execute on function public.set_flight_proof_photos(uuid, text, text[]) to authenticated;
