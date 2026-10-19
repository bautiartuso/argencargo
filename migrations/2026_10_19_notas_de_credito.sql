-- Notas de crédito (19/10/2026): la nota se guarda en invoices con tipo_cbte = 13 y anula_id = la
-- factura que anula. El código funciona sin esta columna (deja la referencia en el detalle), pero con
-- ella el panel marca la factura como anulada de forma segura.
alter table public.invoices add column if not exists anula_id uuid references public.invoices(id) on delete set null;
create index if not exists invoices_anula_id_idx on public.invoices (anula_id);
