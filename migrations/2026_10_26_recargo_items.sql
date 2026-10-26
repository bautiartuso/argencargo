-- Recargo por ítems de factura (26/10/2026): al presentar la factura del vuelo, cada op guarda
-- cuántos renglones le quedaron en la declaración. lib/calc.js lo usa en vez de la cantidad de
-- productos de la op: si la compresión la dejó en 8 o menos, no hay recargo.
alter table operations add column if not exists invoice_items_count integer;
