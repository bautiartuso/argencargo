-- Factura comercial del vuelo (26/10/2026): la sube el agente al despachar, junto con el desglose
-- de bultos (/api/agente/factura-vuelo). Queda en el legajo de cada op del vuelo y el vuelo guarda
-- el archivo para que el agente sepa que ya la subió.
alter table public.legajo_docs drop constraint if exists legajo_docs_tipo_check;
alter table public.legajo_docs add constraint legajo_docs_tipo_check check (tipo in ('dsi', 'factura_courier', 'guia_aerea', 'factura_comercial'));
alter table public.flights add column if not exists commercial_invoice_path text;
alter table public.flights add column if not exists commercial_invoice_name text;
