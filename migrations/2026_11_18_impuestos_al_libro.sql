-- Impuestos pagados de contado/transferencia SIEMPRE al libro diario (18/11/2026).
--
-- El "Cash disponible" y el libro diario restan los impuestos solo a traves de finance_entries
-- (auto_generated, descripcion "Impuestos AC-xxxx"). El editor de la operacion crea esa fila, pero
-- el reparto de "Impuestos del vuelo" escribia el costo en la operacion y nunca la fila: desde
-- fines de julio de 2026 ningun impuesto cargado por vuelo se restaba de la caja.
--
-- Esta regla lo garantiza en la base, venga de donde venga el cambio: si una operacion tiene
-- impuesto real pagado de contado o por transferencia, tiene su fila en el libro con el mismo
-- monto y la fecha de pago. Si el editor ya creo la fila, se actualiza esa (no se duplica).
-- Tarjeta de credito queda afuera: ese circuito (pendiente hasta el debito) lo maneja el editor.

create or replace function public.impuestos_op_al_libro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_usd numeric := round(coalesce(new.cost_impuestos_reales, 0)::numeric, 2);
  v_ars numeric := coalesce(new.cost_impuestos_ars, 0);
  v_tc numeric := coalesce(new.cost_impuestos_exchange_rate, 0);
  v_desc text;
begin
  if coalesce(new.cost_impuestos_method, '') not in ('efectivo', 'transferencia') then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and new.cost_impuestos_reales is not distinct from old.cost_impuestos_reales
     and new.cost_impuestos_paid_at is not distinct from old.cost_impuestos_paid_at
     and new.cost_impuestos_method is not distinct from old.cost_impuestos_method
     and new.cost_impuestos_ars is not distinct from old.cost_impuestos_ars
     and new.cost_impuestos_exchange_rate is not distinct from old.cost_impuestos_exchange_rate then
    return null;
  end if;

  select id into v_id
    from finance_entries
   where operation_id = new.id and auto_generated and description like 'Impuestos%'
   order by created_at
   limit 1;

  if v_usd <= 0.005 then
    -- Se saco el impuesto de la operacion: la fila del libro ya no corresponde.
    if v_id is not null and tg_op = 'UPDATE' and coalesce(old.cost_impuestos_reales, 0) > 0.005 then
      delete from finance_entries where id = v_id;
    end if;
    return null;
  end if;

  v_desc := 'Impuestos ' || new.operation_code ||
    case when v_ars > 0 and v_tc > 0
      then ' (ARS ' || translate(to_char(v_ars, 'FM999,999,999,990.00'), ',.', '.,') || ' @ ' || trim(to_char(v_tc, 'FM999990.##'), '.') || ')'
      else ' (USD)' end;

  if v_id is null then
    insert into finance_entries (date, type, description, amount, amount_ars, exchange_rate, currency, payment_method, is_paid, auto_generated, operation_id)
    values (
      coalesce(new.cost_impuestos_paid_at, (now() at time zone 'America/Argentina/Buenos_Aires')::date),
      'gasto', v_desc, v_usd,
      case when v_ars > 0 then v_ars end,
      case when v_tc > 0 then v_tc end,
      'USD', new.cost_impuestos_method, true, true, new.id
    );
  else
    update finance_entries
       set amount = v_usd,
           amount_ars = case when v_ars > 0 then v_ars else amount_ars end,
           exchange_rate = case when v_tc > 0 then v_tc else exchange_rate end,
           date = coalesce(new.cost_impuestos_paid_at, date),
           currency = 'USD',
           payment_method = new.cost_impuestos_method,
           is_paid = true,
           description = v_desc
     where id = v_id
       and (amount is distinct from v_usd
            or date is distinct from coalesce(new.cost_impuestos_paid_at, date)
            or currency is distinct from 'USD'
            or is_paid is distinct from true);
  end if;
  return null;
end;
$$;

revoke all on function public.impuestos_op_al_libro() from public, anon, authenticated;

drop trigger if exists trg_impuestos_op_al_libro on public.operations;
create trigger trg_impuestos_op_al_libro
  after insert or update of cost_impuestos_reales, cost_impuestos_paid_at, cost_impuestos_method, cost_impuestos_ars, cost_impuestos_exchange_rate
  on public.operations
  for each row execute function public.impuestos_op_al_libro();
