-- Seguimiento tal cual el courier (28-29/10/2026): courier_text = texto exacto del courier (admin);
-- title = el mismo texto sin la marca (cliente). DHL se pide en castellano (language=es).
alter table public.tracking_events add column if not exists courier_text text;

-- auto_update_op_statuses (29/10/2026, migración auto_update_op_statuses_entrega_estricta): la entrega
-- ya no se detecta por texto suelto ('%deliver%' / '%entregad%'), que marcó AC-0274 como lista por un
-- "…schedule your delivery" pegado de UPS y habría matcheado "aún no ha sido entregado al courier".
-- Ahora: dhl status_code 'delivered', fedex 'DL', ups 'KB'/'FS'/'D', o un evento UPS que diga
-- exactamente "Delivered"/"Entregado". El aviso de DHL de "despacho actualizado" en castellano no
-- cuenta como arribo a Argentina.
