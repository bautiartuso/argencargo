-- 06/11/2026: una cotización GI a alguien que todavía no es cliente no crea la ficha en clients.
-- El pedido guarda solo nombre, apellido y WhatsApp; la ficha se crea cuando la persona crea su cuenta
-- desde el link de la cotización o cuando la cotización pasa a operación. Ya aplicado en producción.
alter table public.gi_quote_requests
  add column if not exists prospect_first_name text,
  add column if not exists prospect_last_name text,
  add column if not exists prospect_whatsapp text;
comment on column public.gi_quote_requests.prospect_first_name is 'Nombre del interesado mientras no tiene ficha en clients (client_id null)';
