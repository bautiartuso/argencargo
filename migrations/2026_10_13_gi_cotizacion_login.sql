-- GI · link de cotización con sesión (13/10/2026)
-- El cliente responde la cotización logueado: queda quién aceptó/rechazó, cuándo y por qué.

alter table public.gi_quotes add column if not exists responded_by uuid;
alter table public.gi_quotes add column if not exists rejected_at timestamptz;
alter table public.gi_quotes add column if not exists reject_reason text;

-- Los CHECK viejos de estado/tipo no contemplan 'rejected' ni los eventos nuevos
-- (account_created, rejected). Se sacan: los valores los controla la app.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.gi_quotes'::regclass, 'public.gi_quote_requests'::regclass, 'public.gi_quote_communications'::regclass)
      and (pg_get_constraintdef(c.oid) ilike '%status%' or pg_get_constraintdef(c.oid) ilike '%type%')
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;
