-- Gastos fijos del negocio (12/11/2026).
-- Lista de conceptos que se pagan todos los meses (monotributo, obra social, sueldo, software…). Cada
-- mes aparecen como pendientes en Finanzas → Gastos fijos; al pagarlos se anotan en finance_entries
-- (el libro diario de siempre) con gasto_fijo_id + periodo, así no se cargan dos veces.
-- No hay monto habitual: cada mes se anota lo que se pagó (pesos al tipo de cambio, o dólares).
--   estado:   sugerido (propuesto, todavía sin aceptar) | activo | pausado
--   avisar:   false = opcional, nunca prende alerta
--   dia_vence: día del mes (null = fin de mes); la alerta arranca avisar_dias antes
--   salteados: meses ('YYYY-MM') en que no corresponde pagarlo
-- Solo gastos FIJOS: los variables (publicidad, IA por uso, WhatsApp API) van al libro diario común.
create table if not exists public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  emoji text,
  categoria text not null default 'otros',
  dia_vence int check (dia_vence between 1 and 31),
  avisar boolean not null default true,
  avisar_dias int not null default 3 check (avisar_dias between 0 and 30),
  estado text not null default 'activo' check (estado in ('sugerido','activo','pausado')),
  salteados text[] not null default '{}',
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.gastos_fijos enable row level security;
drop policy if exists gastos_fijos_admin on public.gastos_fijos;
create policy gastos_fijos_admin on public.gastos_fijos for all
  using ((select current_user_role()) = 'admin') with check ((select current_user_role()) = 'admin');

alter table public.finance_entries add column if not exists gasto_fijo_id uuid references public.gastos_fijos(id) on delete set null;
alter table public.finance_entries add column if not exists periodo text;
create index if not exists finance_entries_gasto_fijo_idx on public.finance_entries (gasto_fijo_id) where gasto_fijo_id is not null;

-- Los conceptos (cuáles, con qué emoji y vencimiento) se cargan desde el panel; no van en el repositorio.
