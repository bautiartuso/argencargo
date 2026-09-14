-- 14/09/2026 — dos cosas.

-- 1) BUG CRITICO: las cotizaciones del portal no se guardaban desde el 12/09.
-- quotes_assign_number() no era SECURITY DEFINER, asi que leia `quotes` con el RLS del
-- que inserta. Un cliente solo ve SUS cotizaciones: el trigger calculaba max(quote_number)
-- sobre 0 filas, decidia que el numero 1 estaba libre y chocaba contra quotes_quote_number_uniq.
-- Las manuales del admin funcionaban porque el admin ve la tabla completa.
-- Encima dq() del portal no lanza en error HTTP, asi que el fallo no dejaba ni un log.
create or replace function public.quotes_assign_number()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare libre integer;
begin
  if new.quote_number is null then
    perform pg_advisory_xact_lock(hashtext('quotes_quote_number'));
    select min(g.num) into libre
      from generate_series(1,(select coalesce(max(quote_number),0)+1 from quotes)) as g(num)
     where not exists (select 1 from quotes q where q.quote_number = g.num);
    new.quote_number := coalesce(libre,1);
  end if;
  return new;
end $function$;

-- 2) Antidumping: la tabla decia QUE producto tenia medida, no CUANTO.
alter table antidumping_ncm
  add column if not exists medida_tipo text,       -- derecho_especifico | valor_criterio | ad_valorem
  add column if not exists valor numeric,
  add column if not exists unidad text,            -- USD/kg | USD/u | USD/par | USD/m2 | %
  add column if not exists resolucion text,
  add column if not exists vigencia_hasta date;

comment on column antidumping_ncm.valor is 'Monto de la medida. NULL = todavia no cargado; sale de la resolucion oficial, el sistema no lo puede inferir.';

-- Unico valor real que el sistema ya tenia: el piso de calzado, que vivia en calc_config.
update antidumping_ncm
   set medida_tipo='valor_criterio', unidad='USD/par',
       valor=(select value from calc_config where key='antidumping_calzado_usd_par'),
       nota='Valor criterio por par. El sistema ya aplica este piso al calcular impuestos.'
 where ncm_prefix='64' and valor is null;

-- La tabla estaba expuesta por PostgREST SIN RLS: cualquiera con la clave publica podia
-- escribirla. Lectura abierta (la necesita /api/ncm con la clave anon y es info publica),
-- escritura solo admin/empleado.
alter table antidumping_ncm enable row level security;
drop policy if exists antidumping_select_all on antidumping_ncm;
create policy antidumping_select_all on antidumping_ncm for select using (true);
drop policy if exists antidumping_write_admin on antidumping_ncm;
create policy antidumping_write_admin on antidumping_ncm for all
  using ((select current_user_role()) in ('admin','empleado'))
  with check ((select current_user_role()) in ('admin','empleado'));
