-- Estadísticas de la operativa (12/11/2026): kilos aéreos y metros cúbicos marítimos por mes.
-- Una sola función agrega todo en la base (sin bajar tablas al navegador):
--   aéreo    → kilos facturables de cada operación en su vuelo (flight_operations.weight_kg), en el mes en
--              que el vuelo se despachó, por país de origen de la operación.
--   marítimo → m³ de los envíos del depósito ya embarcados (maritime_packages.cbm, total del renglón), en el
--              mes en que salió el contenedor; y las operaciones marítimas sin envío del depósito (m³ del
--              contenedor FCL o de sus bultos), en el mes del embarque o del alta.
--              clave: 'lclfcl' (canal maritimo_blanco o mercadería blanca) | 'integral' (canal B).
-- Solo para el equipo (admin / empleado).
create or replace function public.estadisticas_operativa()
returns table (mes text, modo text, clave text, cantidad numeric, ops int, viajes int)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.exigir_equipo();
  return query
  with aereo as (
    select to_char(f.dispatched_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM') m,
           coalesce(nullif(btrim(o.origin), ''), 'Sin origen') k,
           sum(coalesce(fo.weight_kg, 0)) c, count(distinct o.id)::int n, count(distinct f.id)::int v
      from flights f
      join flight_operations fo on fo.flight_id = f.id
      join operations o on o.id = fo.operation_id
     where f.dispatched_at is not null and o.status::text <> 'cancelada'
     group by 1, 2
  ), env as (
    select to_char(coalesce(c.departed_at, s.shipped_to_ar_at) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM') m,
           case when o.channel::text = 'maritimo_blanco' or (o.id is null and s.mercaderia_tipo = 'blanca') then 'lclfcl' else 'integral' end k,
           (select coalesce(sum(p.cbm), 0) from maritime_packages p where p.shipment_id = s.id) c,
           s.id sid, c.id cid
      from maritime_shipments s
      left join maritime_containers c on c.id = s.container_id
      left join operations o on o.id = s.operation_id
     where coalesce(c.departed_at, s.shipped_to_ar_at) is not null and coalesce(o.status::text, '') <> 'cancelada'
  ), sueltas as (
    select to_char(coalesce(oc.departed_at::timestamptz, oc.etd::timestamptz, o.created_at) at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM') m,
           case when o.channel::text = 'maritimo_blanco' then 'lclfcl' else 'integral' end k,
           coalesce(oc.cbm, (select sum(p.length_cm * p.width_cm * p.height_cm / 1000000.0 * coalesce(p.quantity, 1)) from operation_packages p where p.operation_id = o.id), 0) c,
           o.id oid
      from operations o
      left join lateral (select x.cbm, x.departed_at, x.etd from operation_containers x where x.operation_id = o.id order by x.created_at limit 1) oc on true
     where o.channel::text like 'maritimo%' and o.status::text <> 'cancelada'
       and not exists (select 1 from maritime_shipments s where s.operation_id = o.id)
  )
  select a.m, 'aereo'::text, a.k, round(a.c, 2), a.n, a.v from aereo a
  union all
  select e.m, 'maritimo'::text, e.k, round(sum(e.c), 3), count(distinct e.sid)::int, count(distinct e.cid)::int from env e group by e.m, e.k
  union all
  select s.m, 'maritimo'::text, s.k, round(sum(s.c), 3), count(distinct s.oid)::int, 0 from sueltas s group by s.m, s.k;
end $$;
revoke all on function public.estadisticas_operativa() from public, anon;
grant execute on function public.estadisticas_operativa() to authenticated;
