-- Un comprobante que paga varias gestiones (19/11/2026).
--
-- Lo normal: cada pago por transferencia de una gestión tiene su propio ingreso en la CC de SolFin
-- (cc_solfin_movements.pm_cobro_id). Excepción: el cliente transfiere todo junto y el comprobante
-- cubre dos o más gestiones. En la financiera eso es UN movimiento (el del comprobante); en las
-- gestiones, un pago por cada una. Esos pagos apuntan al ingreso compartido con cc_movement_id y
-- la dolarización de cada uno sale de ese ingreso, en proporción a su parte.
alter table public.payment_management_cobros
  add column if not exists cc_movement_id uuid references public.cc_solfin_movements(id) on delete set null;
create index if not exists pm_cobros_cc_mov_idx on public.payment_management_cobros(cc_movement_id) where cc_movement_id is not null;
