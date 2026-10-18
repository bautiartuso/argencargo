-- Cotizaciones del portal (18/10/2026): el cliente tiene que poder ACTUALIZAR su propia cotización.
-- Al recalcular, el portal hace PATCH sobre la misma fila; si no hay policy de update, PostgREST
-- devuelve [] sin error y la base se queda con la primera cuenta (GABMIR, AGC-01979: el WhatsApp
-- decía USD 2.500 de mercadería y la base USD 2.900). Idempotente: si la policy ya existe no hace nada.
-- Según migrations/2026_09_14_rls_performance_portal.sql: solo (select current_client_id()).

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes' and policyname = 'quotes_client_update'
  ) then
    create policy quotes_client_update on public.quotes for update
      using (client_id = (select current_client_id()))
      with check (client_id = (select current_client_id()));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes' and policyname = 'quotes_client_insert'
  ) then
    create policy quotes_client_insert on public.quotes for insert
      with check (client_id = (select current_client_id()));
  end if;
end $$;

-- Para ver cómo quedó:
select policyname, cmd from pg_policies where tablename = 'quotes' order by policyname;
