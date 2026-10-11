-- Pagos a cuenta corriente (11/10/2026): el cliente paga sin una operación abierta (ej. DIEMAG con
-- ops cerradas a cuenta). El pago queda como movimiento 'payment' de client_account_movements con
-- todo su detalle: método, moneda, monto original, tipo de cambio, comprobante y fecha.

alter table public.client_account_movements
  add column if not exists payment_method text,     -- transferencia | efectivo | cripto
  add column if not exists currency text,           -- ARS | USD
  add column if not exists amount_original numeric, -- monto tal cual lo pagó (ARS o USD)
  add column if not exists exchange_rate numeric,   -- TC usado si pagó en pesos
  add column if not exists receipt_url text,        -- comprobante
  add column if not exists movement_date date;      -- fecha del pago (created_at es cuándo se cargó)

-- El tipo 'payment' no estaba permitido: se rehace el check con todos los tipos.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.client_account_movements'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.client_account_movements drop constraint %I', c);
  end loop;
end $$;

alter table public.client_account_movements
  add constraint client_account_movements_type_check
  check (type in ('debt', 'overpayment', 'applied', 'adjustment', 'refund', 'payment'));
