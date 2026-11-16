-- Gestión Integral (16/11/2026): cada servicio de una cotización se puede ocultar al cliente.
-- hidden_channels guarda las claves ocultas (aereo_blanco / maritimo_blanco / maritimo_negro).
-- El precio se sigue guardando: ocultar no lo borra, solo deja de mostrarse en el link y en el PDF.
alter table public.gi_quotes add column if not exists hidden_channels text[] not null default '{}';
