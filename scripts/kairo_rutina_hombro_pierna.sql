-- Kairo · carga única: rutina "Hombro y pierna" (miércoles y sábado) de admin@argencargo.com con el
-- entreno de Hevy del miércoles 14/10/2026 como historial. Correr UNA vez en Supabase → SQL Editor.

do $$
declare
  uid uuid; rid uuid; wid uuid; ex record; i int := 0;
begin
  select id into uid from auth.users where lower(email) = 'admin@argencargo.com';
  if uid is null then raise exception 'No encontré admin@argencargo.com'; end if;
  if exists (select 1 from kairo_routines where user_id = uid and name = 'Hombro y pierna') then raise exception 'La rutina "Hombro y pierna" ya existe'; end if;

  insert into kairo_routines (user_id, name, days, sort_order)
  values (uid, 'Hombro y pierna', array[2, 5], 1)
  returning id into rid;

  insert into kairo_workouts (user_id, routine_id, routine_name, started_at, finished_at)
  values (uid, rid, 'Hombro y pierna', '2026-10-14 19:30:00-03', '2026-10-14 20:45:00-03')
  returning id into wid;

  -- ejercicio, reps piso, reps tope, lo que hizo (kg, reps) serie por serie
  for ex in
    select * from (values
      ('Press de hombros en máquina',              6,  10, array[[45, 8], [50, 8], [50, 8], [55, 6]]),
      ('Elevaciones laterales',                    10, 15, array[[7, 12], [7, 12], [7, 12], [7, 11]]),
      ('Pec deck invertido (deltoides posterior)', 8,  12, array[[40, 10], [45, 8], [40, 6], [40, 5]]),
      ('Curl femoral acostado',                    8,  12, array[[45, 10], [50, 10], [45, 8]]),
      ('Extensión de cuádriceps',                  8,  12, array[[55, 10], [60, 10], [60, 10]]),
      ('Abducción de cadera en máquina',           10, 15, array[[55, 10], [60, 10], [65, 10]]),
      ('Aducción de cadera en máquina',            10, 15, array[[60, 10], [60, 10], [60, 10]])
    ) as t(nombre, rmin, rmax, hecho)
  loop
    declare eid uuid; k int;
    begin
      select id into eid from kairo_exercises where name = ex.nombre and created_by is null limit 1;
      if eid is null then raise exception 'Falta el ejercicio "%"', ex.nombre; end if;
      insert into kairo_routine_exercises (user_id, routine_id, exercise_id, sort_order, sets, rep_min, rep_max, rest_sec)
      values (uid, rid, eid, i, array_length(ex.hecho, 1), ex.rmin, ex.rmax, 105);
      for k in 1 .. array_length(ex.hecho, 1) loop
        insert into kairo_sets (user_id, workout_id, exercise_id, set_index, weight_kg, reps, created_at)
        values (uid, wid, eid, k - 1, ex.hecho[k][1], ex.hecho[k][2], '2026-10-14 19:30:00-03'::timestamptz + (i * 10 + k) * interval '1 minute');
      end loop;
      i := i + 1;
    end;
  end loop;
end $$;

select r.name, count(re.*) as ejercicios
from kairo_routines r join kairo_routine_exercises re on re.routine_id = r.id
join auth.users u on u.id = r.user_id
where lower(u.email) = 'admin@argencargo.com'
group by r.name;
