-- Kairo · suplementos con cantidad por toma (17/10/2026)
-- amount + unit = lo que tomás en cada toma (ej. 2,5 g). Total del día = amount × cantidad de horarios.
-- dose (texto) queda por compatibilidad.
alter table kairo_supplements add column if not exists amount numeric;
alter table kairo_supplements add column if not exists unit text;
