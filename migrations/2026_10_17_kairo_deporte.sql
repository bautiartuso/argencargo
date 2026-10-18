-- Kairo · deporte / cardio (17/10/2026)
--
-- Boxeo, natación, running… aparte de las pesas. Lo que planeás por día de la semana va en
-- kairo_profile.cardio_plan (json: [{kind, days, minutes, time, intensity}]) y cada sesión hecha
-- en kairo_cardio con las calorías estimadas (MET × peso × horas). Esas calorías se suman al
-- objetivo del día y el deporte vale un 15 % del éxito del día.

create table if not exists kairo_cardio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  log_date date not null,
  kind text not null,
  minutes int not null,
  intensity text not null default 'media',
  kcal int not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists kairo_cardio_user_date_idx on kairo_cardio (user_id, log_date desc);
alter table kairo_cardio enable row level security;
drop policy if exists kairo_cardio_own on kairo_cardio;
create policy kairo_cardio_own on kairo_cardio for all using (user_id = auth.uid() and is_kairo_user()) with check (user_id = auth.uid() and is_kairo_user());

alter table kairo_profile add column if not exists cardio_plan jsonb;
