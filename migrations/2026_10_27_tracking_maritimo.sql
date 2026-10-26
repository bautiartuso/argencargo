-- Seguimiento de contenedores por naviera (27/10/2026): COSCO (público) y Maersk (API oficial).
-- Lo escribe /api/cron/maritimo-tracking cada hora y el botón ↻ del contenedor.
alter table public.maritime_containers add column if not exists tracking_events jsonb;
alter table public.maritime_containers add column if not exists tracking_last text;
alter table public.maritime_containers add column if not exists tracking_vessel text;
alter table public.maritime_containers add column if not exists tracking_updated_at timestamptz;
alter table public.maritime_containers add column if not exists tracking_error text;
alter table public.maritime_containers add column if not exists eta_naviera date;
