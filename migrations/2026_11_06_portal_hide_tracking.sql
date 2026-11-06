-- 06/11/2026: el cliente no ve el seguimiento del courier de esta operación en el portal
-- (pedido de Bautista para las ops de FL-0165, guía FedEx compartida). Ya aplicado en producción.
alter table public.operations add column if not exists portal_hide_tracking boolean not null default false;
comment on column public.operations.portal_hide_tracking is 'true = el portal no muestra el seguimiento del courier (guía ni movimientos) de esta operación';
