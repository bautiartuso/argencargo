-- 06/11/2026: el cliente no ve el seguimiento del courier de esta operación en el portal
-- (pedido de Bautista para las ops de FL-0165, guía FedEx compartida). Ya aplicado en producción.
alter table public.operations add column if not exists portal_hide_tracking boolean not null default false;
comment on column public.operations.portal_hide_tracking is 'true = el portal no muestra el seguimiento del courier (guía ni movimientos) de esta operación';
-- La columna la lee el portal (OPSEL) y operations tiene SELECT por columna desde el 28/10: sin este
-- grant PostgREST rechaza la consulta entera y el cliente ve 0 operaciones (pasó el 06/11 a la tarde).
grant select (portal_hide_tracking) on public.operations to authenticated, anon;
