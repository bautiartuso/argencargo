-- Reclamos de bultos solo a los agentes que siguen recibiendo carga (11/11/2026).
-- VV Xiao queda afuera: todos los reclamos (portal y admin) van a 飞殷.
alter table public.agent_signups add column if not exists recibe_reclamos boolean not null default true;
update public.agent_signups set recibe_reclamos = false where auth_user_id = '37acaafb-4315-47b9-9ed0-5ff9662e544e';
