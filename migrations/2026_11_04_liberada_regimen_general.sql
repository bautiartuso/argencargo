-- 04/11/2026: una op retenida por Aduana termina de dos formas: liberada vía régimen general (el courier
-- la despachó por régimen general y la entregó: no hay DSI, factura del courier ni legajo; el tracking
-- sigue) o perdida en aduana. Antes "Quitar retención" borraba retenida_at y el legajo volvía a ser
-- obligatorio (AC-0284).
alter table public.operations add column if not exists liberada_rg_at timestamptz;
alter table public.flights add column if not exists liberado_rg_at timestamptz;
comment on column public.operations.liberada_rg_at is 'Retenida por Aduana y liberada vía régimen general (04/11/2026): el courier la despachó por régimen general y la entregó; no hay DSI, factura del courier ni legajo. Sigue por tracking.';
comment on column public.flights.liberado_rg_at is 'Vuelo retenido por Aduana y liberado vía régimen general (04/11/2026).';
