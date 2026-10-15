-- Kairo · Perfil (15/10/2026)
--
-- El perfil pasa a ser el centro de la app (objetivo mixto gym + nutrición):
--   kairo_profile      + nombre, foto, matiz del objetivo, objetivo en tus palabras, reglas para la IA
--                        (entrenamiento y alimentación) y la estrategia que arma la IA.
--   kairo_body_logs    peso y medidas cuando quieras (todo opcional menos la fecha).
-- user_id queda listo para cuando haya varios usuarios (por ahora hay uno solo).

alter table kairo_profile add column if not exists user_id uuid default auth.uid();
alter table kairo_profile add column if not exists nombre text;
alter table kairo_profile add column if not exists avatar text;            -- imagen chica en data URL
alter table kairo_profile add column if not exists tendencia text;         -- matiz del objetivo
alter table kairo_profile add column if not exists objetivo_detalle text;  -- el objetivo en tus palabras
alter table kairo_profile add column if not exists reglas_gym text;
alter table kairo_profile add column if not exists reglas_nutricion text;
alter table kairo_profile add column if not exists estrategia jsonb;
alter table kairo_profile add column if not exists estrategia_at timestamptz;

create table if not exists kairo_body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  log_date date not null default current_date,
  peso_kg numeric,
  grasa_pct numeric,
  cintura_cm numeric,
  pecho_cm numeric,
  brazo_cm numeric,
  muslo_cm numeric,
  cadera_cm numeric,
  cuello_cm numeric,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists kairo_body_logs_date_idx on kairo_body_logs (log_date desc);

alter table kairo_body_logs enable row level security;
drop policy if exists kairo_body_logs_admin on kairo_body_logs;
create policy kairo_body_logs_admin on kairo_body_logs for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
