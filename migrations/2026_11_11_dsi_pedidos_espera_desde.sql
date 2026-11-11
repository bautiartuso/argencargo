-- Responder el mail del courier desde el vuelo (11/11/2026): al contestar, el pedido vuelve a "esperando
-- respuesta" y solo cuentan como respuesta los mails del courier posteriores a ese momento.
alter table public.dsi_pedidos add column if not exists espera_desde timestamptz;
