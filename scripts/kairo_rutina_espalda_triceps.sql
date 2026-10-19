-- Kairo · carga única: rutina "Espalda y tríceps" (martes y viernes) de admin@argencargo.com con el
-- último entreno de Hevy como historial (fechado el martes 13/10/2026). Correr UNA vez en Supabase → SQL Editor.

do $$
declare
  uid uuid; rid uuid; wid uuid; ex record; i int := 0;
begin
  select id into uid from auth.users where lower(email) = 'admin@argencargo.com';
  if uid is null then raise exception 'No encontré admin@argencargo.com'; end if;
  if exists (select 1 from kairo_routines where user_id = uid and name = 'Espalda y tríceps') then raise exception 'La rutina "Espalda y tríceps" ya existe'; end if;

  insert into kairo_routines (user_id, name, days, sort_order)
  values (uid, 'Espalda y tríceps', array[1, 4], 2)
  returning id into rid;

  insert into kairo_workouts (user_id, routine_id, routine_name, started_at, finished_at)
  values (uid, rid, 'Espalda y tríceps', '2026-10-13 19:30:00-03', '2026-10-13 20:40:00-03')
  returning id into wid;

  -- ejercicio, reps piso, reps tope, descanso, lo que hizo (kg, reps) serie por serie
  for ex in
    select * from (values
      ('Jalón al pecho',                                 8, 12, 105, array[[70, 10], [80, 10], [90, 10], [90, 10]]),
      ('Remo en T',                                      6, 10, 105, array[[25, 8], [25, 8], [25, 8], [25, 7]]),
      ('Remo en polea baja',                             8, 12, 105, array[[45, 8], [45, 8], [45, 8]]),
      ('Jalón a una mano',                               8, 12,  90, array[[35, 10], [35, 10], [35, 7]]),
      ('Extensión de tríceps en polea con barra',        8, 12, 105, array[[40, 10], [45, 10], [45, 10], [45, 10]]),
      ('Extensión de tríceps sobre la cabeza en polea',  8, 12, 105, array[[30, 10], [30, 10], [30, 10]])
    ) as t(nombre, rmin, rmax, descanso, hecho)
  loop
    declare eid uuid; k int;
    begin
      select id into eid from kairo_exercises where name = ex.nombre and created_by is null limit 1;
      if eid is null then raise exception 'Falta el ejercicio "%"', ex.nombre; end if;
      insert into kairo_routine_exercises (user_id, routine_id, exercise_id, sort_order, sets, rep_min, rep_max, rest_sec)
      values (uid, rid, eid, i, array_length(ex.hecho, 1), ex.rmin, ex.rmax, ex.descanso);
      for k in 1 .. array_length(ex.hecho, 1) loop
        insert into kairo_sets (user_id, workout_id, exercise_id, set_index, weight_kg, reps, created_at)
        values (uid, wid, eid, k - 1, ex.hecho[k][1], ex.hecho[k][2], '2026-10-13 19:30:00-03'::timestamptz + (i * 10 + k) * interval '1 minute');
      end loop;
      i := i + 1;
    end;
  end loop;
end $$;

select r.name, r.days, count(re.*) as ejercicios
from kairo_routines r join kairo_routine_exercises re on re.routine_id = r.id
join auth.users u on u.id = r.user_id
where lower(u.email) = 'admin@argencargo.com'
group by r.name, r.days
order by r.name;
