-- 04/11/2026: operation_items tenía dos triggers que completan las alícuotas al cargar el NCM.
-- El viejo (operation_items_auto_rates_trg, 2026-05) corría primero por orden alfabético y ponía
-- iva_rate = 21 siempre que venía vacío, ignorando la columna iva de ncm_database; el nuevo
-- (trg_fill_ncm_rates, 08/09/2026) ya hace todo eso bien, con prefijos y el IVA real (10,5 % en 374
-- posiciones). Se elimina el viejo.
drop trigger if exists operation_items_auto_rates_trg on public.operation_items;
drop function if exists public.operation_items_auto_rates();
