-- 27/11/2026 — Los clientes de MyBox no entran en el Seguimiento del CRM.
-- Quien opera u operó con MyBox (aunque antes haya sido cliente de Argencargo) no se lista, no se le
-- prepara mensaje y la IA no le escribe. MyBox vive en otro proyecto: /api/cron/mybox-clientes trae a
-- los clientes de allá que tienen al menos una operación o una carga marítima y los deja en esta tabla.
-- El cruce es por los últimos 10 dígitos del teléfono o por el mail.

create table if not exists public.crm_mybox_clientes (
  mybox_id uuid primary key,
  tel10 text,
  email text,
  nombre text,
  operaciones integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists crm_mybox_clientes_tel_idx on public.crm_mybox_clientes(tel10) where tel10 is not null;
create index if not exists crm_mybox_clientes_email_idx on public.crm_mybox_clientes(email) where email is not null;
alter table public.crm_mybox_clientes enable row level security;
revoke all on public.crm_mybox_clientes from anon, authenticated;

-- La vista suma es_mybox al final y lo descuenta de ia_apto. Se arma sobre la definición vigente para
-- no repetir acá las 200 líneas de la vista.
do $$
declare def text; ex text;
begin
  def := pg_get_viewdef('public.crm_personas_v'::regclass, true);
  if position('es_mybox' in def) > 0 then return; end if;
  ex := '(EXISTS ( SELECT 1 FROM public.crm_mybox_clientes m WHERE (m.tel10 IS NOT NULL AND m.tel10 IN ("right"(regexp_replace(COALESCE(c.phone, ''''::text), ''[^0-9]''::text, ''''::text, ''g''::text), 10), "right"(regexp_replace(COALESCE(c.whatsapp, ''''::text), ''[^0-9]''::text, ''''::text, ''g''::text), 10))) OR (m.email IS NOT NULL AND m.email = lower(btrim(COALESCE(c.email, ''''::text))))))';
  def := regexp_replace(def, '\s+AS ia_apto\s+FROM calc c;\s*$', ' AND NOT ' || ex || ' AS ia_apto, ' || ex || ' AS es_mybox FROM calc c');
  if position('es_mybox' in def) = 0 then raise exception 'No se pudo sumar es_mybox a crm_personas_v'; end if;
  execute 'create or replace view public.crm_personas_v as ' || def;
end $$;
revoke all on public.crm_personas_v from anon, authenticated;

-- Tampoco se analizan solos (no se les prepara mensaje).
create or replace function public.crm_analisis_pendientes(p_limit integer default 20)
 returns setof public.crm_personas_v language sql stable security definer set search_path to 'public' as $$
  select * from public.crm_personas_v v
   where (v.firma_analisis is distinct from v.firma or v.analizado_at < now() - interval '30 days')
     and not (v.analisis_error is not null and v.analizado_at > now() - interval '6 hours')
     and (v.last_msg_at is not null or v.quotes_total > 0 or v.ops_total > 0 or v.mar_total > 0)
     and (v.last_msg_at is null or v.last_msg_at < now() - interval '2 hours')
     and not v.marketing_opt_out and coalesce(v.followup_status, '') <> 'no_contactar'
     and not v.es_mybox
     and (v.last_msg_at is not null or (v.ops_activas = 0 and v.mar_activos = 0))
   order by (v.last_msg_at is not null) desc, greatest(v.last_msg_at, v.ultima_quote_fecha, v.ultima_op_cierre, v.mar_ultima_fecha) desc nulls last
   limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;
revoke all on function public.crm_analisis_pendientes(integer) from public, anon, authenticated;
grant execute on function public.crm_analisis_pendientes(integer) to service_role;
