-- Kairo · arreglo del dueño (15/10/2026)
--
-- El SQL de usuarios asignó todo lo que ya existía (rutinas, entrenos, peso, finanzas…) a
-- bautiartuso21@gmail.com, pero la cuenta con la que se usa Kairo es admin@argencargo.com.
-- 1) Pasa todo a admin@argencargo.com (si una fila choca con algo que el admin ya cargó, gana la del admin).
-- 2) Borra la cuenta bautiartuso21@gmail.com SOLO si no tiene nada en Argencargo (ficha de cliente).
--    Si tiene, no la toca y lo avisa en el resultado.

do $$
declare
  old uuid; adm uuid; t text;
begin
  select id into old from auth.users where lower(email) = 'bautiartuso21@gmail.com';
  select id into adm from auth.users where lower(email) = 'admin@argencargo.com';
  if adm is null then raise exception 'No encontré admin@argencargo.com'; end if;
  if old is null then raise notice 'bautiartuso21@gmail.com no existe: nada que mover'; return; end if;

  -- Claves por usuario que podrían chocar: se descarta la copia vieja si el admin ya tiene la suya.
  delete from kairo_budgets o where o.user_id = old and exists (select 1 from kairo_budgets a where a.user_id = adm and a.month = o.month);
  delete from kairo_merchant_rules o where o.user_id = old and exists (select 1 from kairo_merchant_rules a where a.user_id = adm and a.merchant_key = o.merchant_key);
  delete from kairo_profile where user_id = old and exists (select 1 from kairo_profile where user_id = adm);

  foreach t in array array['kairo_routines','kairo_routine_exercises','kairo_workouts','kairo_sets','kairo_ai','kairo_body_logs','kairo_rest_timers','kairo_stories',
                           'kairo_incomes','kairo_budgets','kairo_merchant_rules','mp_expenses','mp_expense_categories','mp_salary_withdrawals','kairo_profile'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('update %I set user_id = %L where user_id = %L', t, adm, old);
  end loop;
  update kairo_exercises set created_by = adm where created_by = old;
  update push_subscriptions set user_id = adm where user_id = old and portal = 'kairo';
end $$;

-- 2) Borrar la cuenta vieja si no tiene ficha de cliente en Argencargo
do $$
declare old uuid; n int;
begin
  select id into old from auth.users where lower(email) = 'bautiartuso21@gmail.com';
  if old is null then return; end if;
  select count(*) into n from clients where auth_user_id = old;
  if n > 0 then
    raise notice 'NO se borró bautiartuso21@gmail.com: tiene % ficha(s) de cliente en Argencargo', n;
  else
    delete from push_subscriptions where user_id = old;
    delete from profiles where id = old;
    delete from auth.users where id = old;
    raise notice 'Cuenta bautiartuso21@gmail.com borrada';
  end if;
end $$;

-- Resultado: lo que ahora es del admin
select
  (select count(*) from kairo_routines r join auth.users u on u.id = r.user_id where lower(u.email) = 'admin@argencargo.com') as rutinas,
  (select count(*) from kairo_workouts w join auth.users u on u.id = w.user_id where lower(u.email) = 'admin@argencargo.com') as entrenos,
  (select count(*) from mp_expenses e join auth.users u on u.id = e.user_id where lower(u.email) = 'admin@argencargo.com') as gastos,
  (select count(*) from auth.users where lower(email) = 'bautiartuso21@gmail.com') as cuenta_vieja_sigue,
  (select count(*) from clients c join auth.users u on u.id = c.auth_user_id where lower(u.email) = 'bautiartuso21@gmail.com') as tiene_ficha_cliente;
