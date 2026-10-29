-- Vuelos directos (28/10/2026): los que despachamos nosotros con el courier (sin agente).
-- El admin los crea solo al guardar courier + tracking en una op aérea que no está en ningún vuelo.
alter table public.flights alter column agent_id drop not null;
-- Primero: AC-0352 (Papadopoulos, DHL 7499781553) → FL-0162.

-- Costo de los vuelos directos: se carga en la op (cost_flete) y el vuelo lo toma solo como suma
-- de sus ops (migración vuelo_directo_costo_desde_op, aplicada con el MCP):
--   trigger vuelo_directo_costo_desde_op  AFTER UPDATE OF cost_flete ON operations
--   trigger vuelo_directo_costo_al_sumar  AFTER INSERT ON flight_operations
-- Solo actúan sobre vuelos con agent_id null.
