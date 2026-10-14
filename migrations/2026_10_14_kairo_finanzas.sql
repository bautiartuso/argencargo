-- Kairo · Finanzas (14/10/2026)
--
-- Reusa las tablas de gastos de Cinabrio (mp_expenses / mp_expense_categories) y les suma:
-- 1) Presupuesto mensual: un total por mes (kairo_budgets) y un tope por categoría
--    (mp_expense_categories.monthly_limit, vale para todos los meses).
-- 2) Gastos que entran solos desde Mercado Pago: source = 'mp', mp_payment_id único (no se
--    duplican al re-sincronizar) y merchant (el comercio tal cual lo manda MP).
-- 3) Reglas comercio → categoría (kairo_merchant_rules): cuando categorizás a mano un gasto de
--    MP, se guarda la regla y los próximos de ese comercio entran ya categorizados.

alter table mp_expense_categories add column if not exists monthly_limit numeric;

alter table mp_expenses add column if not exists source text not null default 'manual';
alter table mp_expenses add column if not exists mp_payment_id text;
alter table mp_expenses add column if not exists merchant text;
create unique index if not exists mp_expenses_mp_payment_id_key on mp_expenses (mp_payment_id) where mp_payment_id is not null;

create table if not exists kairo_budgets (
  month text primary key,               -- 'YYYY-MM'
  amount_ars numeric not null,
  updated_at timestamptz not null default now()
);

create table if not exists kairo_merchant_rules (
  merchant_key text primary key,        -- comercio normalizado (minúsculas, sin espacios dobles)
  category_id uuid references mp_expense_categories(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- Solo el admin (misma regla que el resto de Cinabrio).
alter table kairo_budgets enable row level security;
alter table kairo_merchant_rules enable row level security;
drop policy if exists kairo_budgets_admin on kairo_budgets;
create policy kairo_budgets_admin on kairo_budgets for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists kairo_merchant_rules_admin on kairo_merchant_rules;
create policy kairo_merchant_rules_admin on kairo_merchant_rules for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
