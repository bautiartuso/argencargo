-- Buscador de clientes por teléfono (27/10/2026) — YA APLICADO con el MCP.
-- El WhatsApp se guarda con espacios y guiones ("+54 9 11 2386-3156"): se busca contra esta versión solo dígitos.
-- Columna generada: ningún PATCH puede mandarla (el admin la saca de la ficha antes de guardar).
alter table public.clients add column if not exists whatsapp_digitos text
  generated always as (regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g')) stored;
-- CESMIN tenía el número mal cargado (+541191123863156).
update public.clients set whatsapp = '+54 9 11 2386-3156' where client_code = 'CESMIN' and whatsapp = '+541191123863156';
