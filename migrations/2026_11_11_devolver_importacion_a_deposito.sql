-- Eliminar una importación desde Aéreos → Depósito (11/11/2026).
-- Los bultos vuelven al depósito del cliente (operation_id null, con su client_id) y la operación se borra
-- con sus productos. Todo en una sola transacción: si la op tiene gastos o facturas (eliminar_operacion lo
-- frena) o está en un vuelo, no se toca nada.
create or replace function public.devolver_importacion_a_deposito(p_op uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_code text; v_client uuid; v_agent uuid; v_origin text; v_status text; v_pk int; r jsonb;
begin
  if coalesce(current_user_role(),'') not in ('admin','empleado') then
    raise exception 'Solo el equipo puede eliminar importaciones';
  end if;
  select operation_code, client_id, created_by_agent_id, origin, status::text
    into v_code, v_client, v_agent, v_origin, v_status
    from operations where id = p_op;
  if v_code is null then raise exception 'La importación no existe o ya fue eliminada'; end if;
  if v_status not in ('pendiente','en_deposito_origen','en_preparacion') then
    raise exception 'No se puede eliminar %: ya salió del depósito.', v_code;
  end if;
  if exists (select 1 from flight_operations where operation_id = p_op) then
    raise exception 'No se puede eliminar %: está en un vuelo. Sacala del vuelo primero.', v_code;
  end if;
  update operation_packages
     set operation_id = null,
         client_id = coalesce(client_id, v_client),
         registered_by_agent_id = coalesce(registered_by_agent_id, v_agent),
         origin = coalesce(origin, v_origin)
   where operation_id = p_op;
  get diagnostics v_pk = row_count;
  r := eliminar_operacion(p_op);
  return r || jsonb_build_object('bultos_devueltos', v_pk);
end $$;

revoke all on function public.devolver_importacion_a_deposito(uuid) from public, anon;
grant execute on function public.devolver_importacion_a_deposito(uuid) to authenticated;
