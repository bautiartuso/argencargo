-- Marítimo (30/10/2026): nombre del proveedor del pedido, para los que esperan que el proveedor despache.
alter table maritime_shipments add column if not exists supplier_name text;
