-- Cotización de una importación armada desde el depósito (15/09/2026).
--
-- El estimado que ve el cliente al cargar la mercadería de sus bultos es una cotización y se
-- guarda en `quotes` como las de la calculadora: una fila por operación (operation_id), que
-- se actualiza con cada guardado de la mercadería. Hasta hoy ese flujo no escribía nada en
-- quotes: solo se guardaban las cotizaciones de la calculadora.
--
-- ON DELETE SET NULL: si se borra la op, la cotización queda como registro de lo que el
-- cliente vio. El índice único parcial garantiza una sola cotización por op (el endpoint
-- hace PATCH si ya existe, POST si no).
alter table public.quotes add column if not exists operation_id uuid references public.operations(id) on delete set null;
create unique index if not exists quotes_operation_id_uniq on public.quotes(operation_id) where operation_id is not null;
