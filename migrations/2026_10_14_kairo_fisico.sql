-- Kairo · Físico (14/10/2026)
--
-- Rutinas estilo Hevy + registro de entrenamientos + lo que dice la IA.
--   kairo_exercises          biblioteca de ejercicios (precargada; se pueden sumar propios)
--   kairo_routines           rutinas con nombre y días de la semana (0 = lunes … 6 = domingo)
--   kairo_routine_exercises  ejercicios de cada rutina: series, rango de repeticiones, descanso
--   kairo_workouts           cada entrenamiento hecho (inicio, fin, rutina)
--   kairo_sets               cada serie hecha: kilos y repeticiones
--   kairo_ai                 análisis de la IA guardados (revisión de rutinas, plan del próximo entreno)

create table if not exists kairo_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle text not null,
  equipment text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists kairo_routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days int[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists kairo_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references kairo_routines(id) on delete cascade,
  exercise_id uuid not null references kairo_exercises(id) on delete cascade,
  sort_order int not null default 0,
  sets int not null default 3,
  rep_min int not null default 8,
  rep_max int not null default 12,
  rest_sec int not null default 90,
  notes text
);

create table if not exists kairo_workouts (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references kairo_routines(id) on delete set null,
  routine_name text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

create table if not exists kairo_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references kairo_workouts(id) on delete cascade,
  exercise_id uuid not null references kairo_exercises(id) on delete cascade,
  set_index int not null,
  weight_kg numeric not null default 0,
  reps int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kairo_sets_exercise_idx on kairo_sets (exercise_id, created_at desc);

create table if not exists kairo_ai (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                 -- review | plan
  routine_id uuid references kairo_routines(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['kairo_exercises','kairo_routines','kairo_routine_exercises','kairo_workouts','kairo_sets','kairo_ai'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format($p$create policy %I on %I for all
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
      with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))$p$, t || '_admin', t);
  end loop;
end $$;

insert into kairo_exercises (name, muscle, equipment) values
  ('Press banca plano con barra', 'Pecho', 'Barra'),
  ('Press banca inclinado con barra', 'Pecho', 'Barra'),
  ('Press inclinado con mancuernas', 'Pecho', 'Mancuernas'),
  ('Press plano con mancuernas', 'Pecho', 'Mancuernas'),
  ('Aperturas con mancuernas', 'Pecho', 'Mancuernas'),
  ('Cruce de poleas', 'Pecho', 'Polea'),
  ('Press de pecho en máquina', 'Pecho', 'Máquina'),
  ('Fondos en paralelas', 'Pecho', 'Peso corporal'),
  ('Flexiones', 'Pecho', 'Peso corporal'),
  ('Dominadas', 'Espalda', 'Peso corporal'),
  ('Jalón al pecho', 'Espalda', 'Polea'),
  ('Remo con barra', 'Espalda', 'Barra'),
  ('Remo con mancuerna a una mano', 'Espalda', 'Mancuernas'),
  ('Remo en polea baja', 'Espalda', 'Polea'),
  ('Remo en máquina', 'Espalda', 'Máquina'),
  ('Peso muerto', 'Espalda', 'Barra'),
  ('Pullover en polea', 'Espalda', 'Polea'),
  ('Press militar con barra', 'Hombros', 'Barra'),
  ('Press de hombros con mancuernas', 'Hombros', 'Mancuernas'),
  ('Elevaciones laterales', 'Hombros', 'Mancuernas'),
  ('Elevaciones laterales en polea', 'Hombros', 'Polea'),
  ('Pájaros (deltoides posterior)', 'Hombros', 'Mancuernas'),
  ('Face pull', 'Hombros', 'Polea'),
  ('Curl con barra', 'Bíceps', 'Barra'),
  ('Curl con mancuernas', 'Bíceps', 'Mancuernas'),
  ('Curl martillo', 'Bíceps', 'Mancuernas'),
  ('Curl en polea', 'Bíceps', 'Polea'),
  ('Curl predicador', 'Bíceps', 'Máquina'),
  ('Extensión de tríceps en polea con soga', 'Tríceps', 'Polea'),
  ('Press francés', 'Tríceps', 'Barra'),
  ('Extensión de tríceps sobre la cabeza', 'Tríceps', 'Mancuernas'),
  ('Press banca agarre cerrado', 'Tríceps', 'Barra'),
  ('Sentadilla con barra', 'Piernas', 'Barra'),
  ('Prensa de piernas', 'Piernas', 'Máquina'),
  ('Sentadilla búlgara', 'Piernas', 'Mancuernas'),
  ('Zancadas', 'Piernas', 'Mancuernas'),
  ('Sentadilla hack', 'Piernas', 'Máquina'),
  ('Extensión de cuádriceps', 'Piernas', 'Máquina'),
  ('Curl femoral acostado', 'Piernas', 'Máquina'),
  ('Curl femoral sentado', 'Piernas', 'Máquina'),
  ('Peso muerto rumano', 'Piernas', 'Barra'),
  ('Hip thrust', 'Glúteos', 'Barra'),
  ('Abducción de cadera en máquina', 'Glúteos', 'Máquina'),
  ('Gemelos de pie', 'Gemelos', 'Máquina'),
  ('Gemelos sentado', 'Gemelos', 'Máquina'),
  ('Plancha', 'Abdomen', 'Peso corporal'),
  ('Crunch en polea', 'Abdomen', 'Polea'),
  ('Elevación de piernas colgado', 'Abdomen', 'Peso corporal'),
  ('Rueda abdominal', 'Abdomen', 'Peso corporal')
on conflict (name) do nothing;
