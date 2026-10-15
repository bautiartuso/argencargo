-- Kairo · Nutrición y suplementos (15/10/2026)
--
--   kairo_meal_plan     tu semana fija: qué comés cada día (0 = lunes … 6 = domingo) en cada comida,
--                       con cantidad y macros (los calcula la IA a partir de lo que escribís).
--   kairo_food_log      lo que comiste de verdad: al tildar algo del plan se copia acá (plan_item_id),
--                       y también lo que sumás ese día por fuera del plan.
--   kairo_supplements   tus suplementos (creatina, magnesio, omega 3…; la proteína en polvo va como
--                       comida) con dosis, horarios y días, para los recordatorios.
--   kairo_supp_log      cada toma tildada (una por suplemento, día y horario).
-- El análisis semanal de la IA se guarda en kairo_ai (kind = 'nutrition').

create table if not exists kairo_meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  dow int not null check (dow between 0 and 6),
  meal text not null,                    -- desayuno | almuerzo | merienda | cena | snacks
  sort_order int not null default 0,
  name text not null,
  qty text,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kairo_meal_plan_user_idx on kairo_meal_plan (user_id, dow);

create table if not exists kairo_food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  log_date date not null,
  meal text not null,
  name text not null,
  qty text,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  plan_item_id uuid references kairo_meal_plan(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kairo_food_log_user_idx on kairo_food_log (user_id, log_date);

create table if not exists kairo_supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  dose text,
  times text[] not null default '{}',     -- 'HH:MM' (hora Argentina)
  days int[] not null default '{0,1,2,3,4,5,6}',
  notes text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists kairo_supp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  supplement_id uuid not null references kairo_supplements(id) on delete cascade,
  log_date date not null,
  slot text not null default '',          -- el horario de esa toma ('09:00')
  created_at timestamptz not null default now(),
  unique (supplement_id, log_date, slot)
);

do $$
declare t text;
begin
  foreach t in array array['kairo_meal_plan','kairo_food_log','kairo_supplements','kairo_supp_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format('create policy %I on %I for all using (user_id = auth.uid() and is_kairo_user()) with check (user_id = auth.uid() and is_kairo_user())', t || '_own', t);
  end loop;
end $$;
