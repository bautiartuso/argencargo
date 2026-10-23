-- Legajo de la operación (22/10/2026) — solo aéreo courier comercial.
-- Documentos que se suben desde el vuelo (o desde la op): DSI y factura del courier por los impuestos.
-- La factura de Argencargo sale de invoices y el recibo de los cobros: no se guardan acá.
-- Una misma DSI/factura puede servir a varias ops del vuelo: una fila por op, mismo archivo.
create table if not exists public.legajo_docs (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  flight_id uuid references public.flights(id) on delete set null,
  tipo text not null check (tipo in ('dsi', 'factura_courier')),
  storage_path text,              -- bucket privado "legajos"; null cuando se borró (180 días después del cierre)
  file_name text,
  datos jsonb,                    -- DSI leída: guía, destinatario, ítems, total
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  borrado_at timestamptz
);
create index if not exists legajo_docs_op_idx on public.legajo_docs (operation_id);
create index if not exists legajo_docs_flight_idx on public.legajo_docs (flight_id);

-- Mostrar el legajo al cliente: null = automático (RI con entrega directa sí, el resto no), true/false = a mano.
alter table public.operations add column if not exists legajo_visible boolean;

alter table public.legajo_docs enable row level security;
drop policy if exists legajo_docs_staff on public.legajo_docs;
create policy legajo_docs_staff on public.legajo_docs for all to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
-- El cliente lo ve por /api/portal/legajo (service role + chequeo de dueño y visibilidad), no por RLS.

-- Los PDF van al bucket privado "legajos" (ya creado). Admin y empleado suben y leen directo.
drop policy if exists legajos_staff_all on storage.objects;
create policy legajos_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'legajos' and (select public.es_staff()))
  with check (bucket_id = 'legajos' and (select public.es_staff()));
