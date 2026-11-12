-- Posiciones arancelarias más favorables para la factura del vuelo (12/11/2026).
-- Al preparar un vuelo, el admin puede buscar, para cada ítem de la factura, posiciones donde esa
-- mercadería también encaja y que pagan menos derechos (/api/aereo/ncm-alternativas).
--   flight_invoice_items.hs_original: la posición que tenía el ítem antes de aplicar una alternativa.
--     Con este campo cargado, la posición del vuelo NO se copia a la operación (el presupuesto del
--     cliente sigue con su posición de siempre).
--   ncm_alternativas: memoria por (descripción, posición): lo que encontró la IA y qué se decidió
--     ("usar:<ncm>" o "descartar"), para no volver a consultar ni volver a mostrar lo descartado.
--     RLS sin policies: solo el servidor.
alter table public.flight_invoice_items add column if not exists hs_original text;

create table if not exists public.ncm_alternativas (
  id uuid primary key default gen_random_uuid(),
  desc_norm text not null,
  hs_code text not null,
  resultado jsonb not null default '[]'::jsonb,
  decision text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (desc_norm, hs_code)
);
alter table public.ncm_alternativas enable row level security;
