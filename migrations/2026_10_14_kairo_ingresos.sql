-- Kairo · Ingresos (14/10/2026)
--
-- El presupuesto del mes sale de lo que entra: ingresos cargados a mano (sueldo, efectivo, otro
-- banco) y cobros de Mercado Pago (source='mp'). Los que no son ingreso de verdad quedan con
-- source='ignorado' para que la sincronización no los vuelva a traer.

create table if not exists kairo_incomes (
  id uuid primary key default gen_random_uuid(),
  amount_ars numeric not null,
  income_date date not null,
  description text,
  source text not null default 'manual',   -- manual | mp | ignorado
  mp_payment_id text unique,
  created_at timestamptz not null default now()
);

alter table kairo_incomes enable row level security;
drop policy if exists kairo_incomes_admin on kairo_incomes;
create policy kairo_incomes_admin on kairo_incomes for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
