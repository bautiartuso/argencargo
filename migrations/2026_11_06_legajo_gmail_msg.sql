-- 06/11/2026: de qué mail de Gmail (pedido de DSI) se tomó el adjunto. Antes el panel comparaba por
-- nombre de archivo y la factura de DHL subida a mano (5536420923.pdf) tapó la DSI que DHL mandó al
-- día siguiente con el mismo nombre (FL-0157). Ya aplicado en producción.
alter table public.legajo_docs add column if not exists gmail_msg text;
comment on column public.legajo_docs.gmail_msg is 'Id del mensaje de Gmail del que se tomó el adjunto (null si se subió a mano)';
