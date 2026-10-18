-- Kairo · tipo de alimentación (17/10/2026)
-- Keto, vegana, sin gluten, etc. La IA lo respeta al calcular calorías y macros y al analizar la semana.
alter table kairo_profile add column if not exists dieta text;
