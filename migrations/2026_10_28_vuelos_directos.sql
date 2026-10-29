-- Vuelos directos (28/10/2026): los que despachamos nosotros con el courier (sin agente).
-- El admin los crea solo al guardar courier + tracking en una op aérea que no está en ningún vuelo.
alter table public.flights alter column agent_id drop not null;
-- Primero: AC-0352 (Papadopoulos, DHL 7499781553) → FL-0162.
