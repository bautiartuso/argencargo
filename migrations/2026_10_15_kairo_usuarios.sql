-- Kairo · varios usuarios (15/10/2026)
--
-- 1) Rol propio "kairo" en profiles: esas cuentas solo entran a /kairo (el portal, agentes, GI y el
--    admin las rechazan). Se crean desde Kairo → Perfil → Usuarios (solo el admin).
-- 2) Cada dato de Kairo pasa a ser de su usuario (user_id) y cada uno ve solo lo suyo. Lo que ya
--    existe queda del dueño actual (admin@argencargo.com).
-- 3) La biblioteca de ejercicios es compartida; los ejercicios propios llevan created_by.
-- 4) Perfil: una fila por usuario (antes era una sola con id = 1), con fecha de nacimiento y la
--    organización de los días (días fijos o rotación).
-- Ojo: correr ENTERO, de una vez.

-- 1) Rol "kairo" (si role es un enum, se le agrega el valor)
do $$
declare t text;
begin
  select udt_name into t from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';
  if t is not null and exists (select 1 from pg_type where typname = t and typtype = 'e') then
    execute format('alter type %I add value if not exists %L', t, 'kairo');
  end if;
end $$;

-- 2) user_id en todo lo de Kairo + dueño actual
do $$
declare owner uuid; t text;
begin
  select id into owner from auth.users where lower(email) = 'admin@argencargo.com' limit 1;
  foreach t in array array['kairo_routines','kairo_routine_exercises','kairo_workouts','kairo_sets','kairo_ai','kairo_body_logs',
                           'kairo_incomes','kairo_budgets','kairo_merchant_rules','mp_expenses','mp_expense_categories','mp_salary_withdrawals'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I add column if not exists user_id uuid', t);
    execute format('alter table %I alter column user_id set default auth.uid()', t);
    execute format('update %I set user_id = %L where user_id is null', t, owner);
    execute format('create index if not exists %I on %I (user_id)', t || '_user_idx', t);
  end loop;
  update kairo_profile set user_id = owner where user_id is null;
end $$;

-- Claves que pasan a ser por usuario
alter table kairo_budgets drop constraint if exists kairo_budgets_pkey;
alter table kairo_budgets add primary key (user_id, month);
alter table kairo_merchant_rules drop constraint if exists kairo_merchant_rules_pkey;
alter table kairo_merchant_rules add primary key (user_id, merchant_key);

-- 4) Perfil por usuario
alter table kairo_profile drop constraint if exists kairo_profile_id_check;
alter table kairo_profile drop constraint if exists kairo_profile_pkey;
alter table kairo_profile alter column id drop default;
alter table kairo_profile alter column id drop not null;
alter table kairo_profile alter column user_id set not null;
alter table kairo_profile add primary key (user_id);
alter table kairo_profile add column if not exists fecha_nacimiento date;
alter table kairo_profile add column if not exists dias jsonb;   -- { modo: 'fijos' | 'rotacion', orden: [routine_id | 'descanso'], inicio: 'YYYY-MM-DD' }

-- 3) Ejercicios: compartidos, los propios con autor
alter table kairo_exercises add column if not exists created_by uuid default auth.uid();
alter table kairo_exercises drop constraint if exists kairo_exercises_name_key;
create unique index if not exists kairo_exercises_name_owner_key on kairo_exercises (name, coalesce(created_by, '00000000-0000-0000-0000-000000000000'::uuid));
update kairo_exercises set created_by = null where not is_custom;

-- Acceso: quién es usuario de Kairo
create or replace function public.is_kairo_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'kairo'));
$$;

-- RLS: cada uno lo suyo (se reemplazan las políticas viejas de solo-admin)
do $$
declare t text; pol record;
begin
  foreach t in array array['kairo_routines','kairo_routine_exercises','kairo_workouts','kairo_sets','kairo_ai','kairo_body_logs','kairo_profile',
                           'kairo_rest_timers','kairo_incomes','kairo_budgets','kairo_merchant_rules','mp_expenses','mp_expense_categories','mp_salary_withdrawals'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
    execute format('create policy %I on %I for all using (user_id = auth.uid() and is_kairo_user()) with check (user_id = auth.uid() and is_kairo_user())', t || '_own', t);
  end loop;

  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'kairo_exercises' loop
    execute format('drop policy %I on kairo_exercises', pol.policyname);
  end loop;
  create policy kairo_exercises_read on kairo_exercises for select using (is_kairo_user() and (created_by is null or created_by = auth.uid()));
  create policy kairo_exercises_write on kairo_exercises for insert with check (is_kairo_user() and created_by = auth.uid() and is_custom);
  create policy kairo_exercises_edit on kairo_exercises for update using (created_by = auth.uid()) with check (created_by = auth.uid());
  create policy kairo_exercises_del on kairo_exercises for delete using (created_by = auth.uid());
end $$;
