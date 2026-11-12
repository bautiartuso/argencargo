-- Estadísticas de la operativa (12/11/2026): una fila por operación embarcada, para que la pantalla
-- (Finanzas → Estadísticas) arme los totales, la evolución mensual y los desgloses sin bajar tablas.
--   d = fecha (AAAA-MM-DD, hora de Argentina) del despacho o embarque.
--   t = 'a' aéreo: q = kilos facturables de la op en su vuelo (flight_operations.weight_kg), d = día en que
--       se despachó el vuelo, o = país de origen, k = courier, v = vuelo.
--   t = 'm' marítimo: q = m³ (maritime_packages.cbm ya es el total del renglón), m = mes en que salió el
--       contenedor (o del embarque/alta si la op no pasó por el depósito), c = 'lclfcl' | 'integral',
--       v = contenedor.
--   cl / nm = cliente · op = operación o envío.
-- Devuelve un solo jsonb (no la corta el tope de 1000 filas). Solo para el equipo.
create or replace function public.estadisticas_operativa_v2()
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare res jsonb;
begin
  perform public.exigir_equipo();
  with aereo as (
    select to_char(f.dispatched_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') d, 'a'::text t,
           coalesce(nullif(btrim(o.origin), ''), 'Sin origen') o,
           case when o.channel::text = 'aereo_negro' then 'B' else 'A' end c,
           coalesce(nullif(btrim(f.international_carrier), ''), 'Sin courier') k,
           cl.client_code cl, btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')) nm,
           round(coalesce(fo.weight_kg, 0), 2) q, f.flight_code v, o.operation_code op
      from flights f
      join flight_operations fo on fo.flight_id = f.id
      join operations o on o.id = fo.operation_id
      left join clients cl on cl.id = o.client_id
     where f.dispatched_at is not null and o.status::text <> 'cancelada'
  ), env as (
    select to_char(coalesce(c.departed_at, s.shipped_to_ar_at) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') d, 'm'::text t,
           initcap(coalesce(nullif(btrim(s.origin), ''), 'Sin origen')) o,
           case when o.channel::text = 'maritimo_blanco' or (o.id is null and s.mercaderia_tipo = 'blanca') then 'lclfcl' else 'integral' end c,
           null::text k,
           cl.client_code cl, coalesce(nullif(btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), ''), s.client_name_snapshot) nm,
           round((select coalesce(sum(p.cbm), 0) from maritime_packages p where p.shipment_id = s.id), 3) q,
           c.code v, coalesce(o.operation_code, s.shipment_code) op
      from maritime_shipments s
      left join maritime_containers c on c.id = s.container_id
      left join operations o on o.id = s.operation_id
      left join clients cl on cl.id = coalesce(o.client_id, s.client_id)
     where coalesce(c.departed_at, s.shipped_to_ar_at) is not null and coalesce(o.status::text, '') <> 'cancelada'
  ), sueltas as (
    select to_char(coalesce(oc.departed_at::timestamptz, oc.etd::timestamptz, o.created_at) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') d, 'm'::text t,
           initcap(coalesce(nullif(btrim(o.origin), ''), 'Sin origen')) o,
           case when o.channel::text = 'maritimo_blanco' then 'lclfcl' else 'integral' end c,
           null::text k,
           cl.client_code cl, btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')) nm,
           round(coalesce(oc.cbm, (select sum(p.length_cm * p.width_cm * p.height_cm / 1000000.0 * coalesce(p.quantity, 1)) from operation_packages p where p.operation_id = o.id), 0), 3) q,
           oc.container_number v, o.operation_code op
      from operations o
      left join lateral (select x.cbm, x.departed_at, x.etd, x.container_number from operation_containers x where x.operation_id = o.id order by x.created_at limit 1) oc on true
      left join clients cl on cl.id = o.client_id
     where o.channel::text like 'maritimo%' and o.status::text <> 'cancelada'
       and not exists (select 1 from maritime_shipments s where s.operation_id = o.id)
  ), todo as (select * from aereo union all select * from env union all select * from sueltas)
  select coalesce(jsonb_agg(to_jsonb(todo)), '[]'::jsonb) into res from todo;
  return res;
end $$;
revoke all on function public.estadisticas_operativa_v2() from public, anon;
grant execute on function public.estadisticas_operativa_v2() to authenticated;
drop function if exists public.estadisticas_operativa();
