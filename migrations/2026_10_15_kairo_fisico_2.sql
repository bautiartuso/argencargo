-- Kairo · Físico 2 (14/10/2026)
--
-- 1) Tu perfil para la IA (objetivo, experiencia, medidas): sin esto no puede decidir si subir,
--    mantener o bajar. Una sola fila (id = 1).
-- 2) Avisos de fin de descanso: el servidor espera el tiempo y manda la notificación al celular
--    (si cancelás o sumás tiempo, se marca cancelled y no suena).
-- 3) Foto y músculos de cada ejercicio, de free-exercise-db (dominio público):
--    media_id = carpeta del ejercicio (…/exercises/<media_id>/0.jpg y 1.jpg).

create table if not exists kairo_profile (
  id int primary key default 1 check (id = 1),
  objetivo text,            -- volumen | definicion | recomposicion | mantenimiento | fuerza
  experiencia text,         -- principiante | intermedio | avanzado
  sexo text,
  edad int,
  peso_kg numeric,
  altura_cm numeric,
  dias_semana int,
  lesiones text,
  notas text,
  updated_at timestamptz not null default now()
);

create table if not exists kairo_rest_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  fire_at timestamptz not null,
  title text,
  body text,
  cancelled boolean not null default false,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table kairo_exercises add column if not exists media_id text;
alter table kairo_exercises add column if not exists muscles_primary text[] not null default '{}';
alter table kairo_exercises add column if not exists muscles_secondary text[] not null default '{}';

do $$
declare t text;
begin
  foreach t in array array['kairo_profile','kairo_rest_timers'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format($p$create policy %I on %I for all
      using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
      with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))$p$, t || '_admin', t);
  end loop;
end $$;

update kairo_exercises set media_id = 'Barbell_Bench_Press_-_Medium_Grip', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Press banca plano con barra';
update kairo_exercises set media_id = 'Barbell_Incline_Bench_Press_-_Medium_Grip', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Press banca inclinado con barra';
update kairo_exercises set media_id = 'Incline_Dumbbell_Press', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Press inclinado con mancuernas';
update kairo_exercises set media_id = 'Dumbbell_Bench_Press', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Press plano con mancuernas';
update kairo_exercises set media_id = 'Dumbbell_Flyes', muscles_primary = array['chest']::text[], muscles_secondary = '{}'::text[] where name = 'Aperturas con mancuernas';
update kairo_exercises set media_id = 'Cable_Crossover', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders']::text[] where name = 'Cruce de poleas';
update kairo_exercises set media_id = 'Machine_Bench_Press', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Press de pecho en máquina';
update kairo_exercises set media_id = 'Dips_-_Chest_Version', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Fondos en paralelas';
update kairo_exercises set media_id = 'Pushups', muscles_primary = array['chest']::text[], muscles_secondary = array['shoulders','triceps']::text[] where name = 'Flexiones';
update kairo_exercises set media_id = 'Pullups', muscles_primary = array['lats']::text[], muscles_secondary = array['biceps','middle back']::text[] where name = 'Dominadas';
update kairo_exercises set media_id = 'Wide-Grip_Lat_Pulldown', muscles_primary = array['lats']::text[], muscles_secondary = array['biceps','middle back','shoulders']::text[] where name = 'Jalón al pecho';
update kairo_exercises set media_id = 'Bent_Over_Barbell_Row', muscles_primary = array['middle back']::text[], muscles_secondary = array['biceps','lats','shoulders']::text[] where name = 'Remo con barra';
update kairo_exercises set media_id = 'One-Arm_Dumbbell_Row', muscles_primary = array['middle back']::text[], muscles_secondary = array['biceps','lats','shoulders']::text[] where name = 'Remo con mancuerna a una mano';
update kairo_exercises set media_id = 'Seated_Cable_Rows', muscles_primary = array['middle back']::text[], muscles_secondary = array['biceps','lats','shoulders']::text[] where name = 'Remo en polea baja';
update kairo_exercises set media_id = 'Leverage_High_Row', muscles_primary = array['middle back']::text[], muscles_secondary = array['lats']::text[] where name = 'Remo en máquina';
update kairo_exercises set media_id = 'Barbell_Deadlift', muscles_primary = array['lower back']::text[], muscles_secondary = array['calves','forearms','glutes','hamstrings','lats','middle back','quadriceps','traps']::text[] where name = 'Peso muerto';
update kairo_exercises set media_id = 'Straight-Arm_Pulldown', muscles_primary = array['lats']::text[], muscles_secondary = '{}'::text[] where name = 'Pullover en polea';
update kairo_exercises set media_id = 'Standing_Military_Press', muscles_primary = array['shoulders']::text[], muscles_secondary = array['triceps']::text[] where name = 'Press militar con barra';
update kairo_exercises set media_id = 'Dumbbell_Shoulder_Press', muscles_primary = array['shoulders']::text[], muscles_secondary = array['triceps']::text[] where name = 'Press de hombros con mancuernas';
update kairo_exercises set media_id = 'Side_Lateral_Raise', muscles_primary = array['shoulders']::text[], muscles_secondary = '{}'::text[] where name = 'Elevaciones laterales';
update kairo_exercises set media_id = 'Cable_Seated_Lateral_Raise', muscles_primary = array['shoulders']::text[], muscles_secondary = array['middle back','traps']::text[] where name = 'Elevaciones laterales en polea';
update kairo_exercises set media_id = 'Seated_Bent-Over_Rear_Delt_Raise', muscles_primary = array['shoulders']::text[], muscles_secondary = '{}'::text[] where name = 'Pájaros (deltoides posterior)';
update kairo_exercises set media_id = 'Face_Pull', muscles_primary = array['shoulders']::text[], muscles_secondary = array['middle back']::text[] where name = 'Face pull';
update kairo_exercises set media_id = 'Barbell_Curl', muscles_primary = array['biceps']::text[], muscles_secondary = array['forearms']::text[] where name = 'Curl con barra';
update kairo_exercises set media_id = 'Dumbbell_Bicep_Curl', muscles_primary = array['biceps']::text[], muscles_secondary = array['forearms']::text[] where name = 'Curl con mancuernas';
update kairo_exercises set media_id = 'Hammer_Curls', muscles_primary = array['biceps']::text[], muscles_secondary = '{}'::text[] where name = 'Curl martillo';
update kairo_exercises set media_id = 'Standing_Biceps_Cable_Curl', muscles_primary = array['biceps']::text[], muscles_secondary = '{}'::text[] where name = 'Curl en polea';
update kairo_exercises set media_id = 'Preacher_Curl', muscles_primary = array['biceps']::text[], muscles_secondary = '{}'::text[] where name = 'Curl predicador';
update kairo_exercises set media_id = 'Triceps_Pushdown_-_Rope_Attachment', muscles_primary = array['triceps']::text[], muscles_secondary = '{}'::text[] where name = 'Extensión de tríceps en polea con soga';
update kairo_exercises set media_id = 'EZ-Bar_Skullcrusher', muscles_primary = array['triceps']::text[], muscles_secondary = array['forearms']::text[] where name = 'Press francés';
update kairo_exercises set media_id = 'Standing_Dumbbell_Triceps_Extension', muscles_primary = array['triceps']::text[], muscles_secondary = '{}'::text[] where name = 'Extensión de tríceps sobre la cabeza';
update kairo_exercises set media_id = 'Close-Grip_Barbell_Bench_Press', muscles_primary = array['triceps']::text[], muscles_secondary = array['chest','shoulders']::text[] where name = 'Press banca agarre cerrado';
update kairo_exercises set media_id = 'Barbell_Squat', muscles_primary = array['quadriceps']::text[], muscles_secondary = array['calves','glutes','hamstrings','lower back']::text[] where name = 'Sentadilla con barra';
update kairo_exercises set media_id = 'Leg_Press', muscles_primary = array['quadriceps']::text[], muscles_secondary = array['calves','glutes','hamstrings']::text[] where name = 'Prensa de piernas';
update kairo_exercises set media_id = 'Split_Squat_with_Dumbbells', muscles_primary = array['quadriceps']::text[], muscles_secondary = array['glutes','hamstrings']::text[] where name = 'Sentadilla búlgara';
update kairo_exercises set media_id = 'Dumbbell_Lunges', muscles_primary = array['quadriceps']::text[], muscles_secondary = array['calves','glutes','hamstrings']::text[] where name = 'Zancadas';
update kairo_exercises set media_id = 'Hack_Squat', muscles_primary = array['quadriceps']::text[], muscles_secondary = array['calves','glutes','hamstrings']::text[] where name = 'Sentadilla hack';
update kairo_exercises set media_id = 'Leg_Extensions', muscles_primary = array['quadriceps']::text[], muscles_secondary = '{}'::text[] where name = 'Extensión de cuádriceps';
update kairo_exercises set media_id = 'Lying_Leg_Curls', muscles_primary = array['hamstrings']::text[], muscles_secondary = '{}'::text[] where name = 'Curl femoral acostado';
update kairo_exercises set media_id = 'Seated_Leg_Curl', muscles_primary = array['hamstrings']::text[], muscles_secondary = '{}'::text[] where name = 'Curl femoral sentado';
update kairo_exercises set media_id = 'Romanian_Deadlift', muscles_primary = array['hamstrings']::text[], muscles_secondary = array['calves','glutes','lower back']::text[] where name = 'Peso muerto rumano';
update kairo_exercises set media_id = 'Barbell_Hip_Thrust', muscles_primary = array['glutes']::text[], muscles_secondary = array['calves','hamstrings']::text[] where name = 'Hip thrust';
update kairo_exercises set media_id = 'Thigh_Abductor', muscles_primary = array['abductors']::text[], muscles_secondary = array['glutes']::text[] where name = 'Abducción de cadera en máquina';
update kairo_exercises set media_id = 'Standing_Calf_Raises', muscles_primary = array['calves']::text[], muscles_secondary = '{}'::text[] where name = 'Gemelos de pie';
update kairo_exercises set media_id = 'Seated_Calf_Raise', muscles_primary = array['calves']::text[], muscles_secondary = '{}'::text[] where name = 'Gemelos sentado';
update kairo_exercises set media_id = 'Plank', muscles_primary = array['abdominals']::text[], muscles_secondary = '{}'::text[] where name = 'Plancha';
update kairo_exercises set media_id = 'Cable_Crunch', muscles_primary = array['abdominals']::text[], muscles_secondary = '{}'::text[] where name = 'Crunch en polea';
update kairo_exercises set media_id = 'Hanging_Leg_Raise', muscles_primary = array['abdominals']::text[], muscles_secondary = '{}'::text[] where name = 'Elevación de piernas colgado';
update kairo_exercises set media_id = 'Ab_Roller', muscles_primary = array['abdominals']::text[], muscles_secondary = array['shoulders']::text[] where name = 'Rueda abdominal';
