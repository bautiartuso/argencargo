-- Legajo: la guía aérea del courier (23/10/2026). Llega en el mismo mail que la DSI; no es obligatoria.
alter table public.legajo_docs drop constraint if exists legajo_docs_tipo_check;
alter table public.legajo_docs add constraint legajo_docs_tipo_check check (tipo in ('dsi', 'factura_courier', 'guia_aerea'));
