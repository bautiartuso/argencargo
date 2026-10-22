alter table public.operation_items add column if not exists unit_cost_usd numeric;
update public.operation_items oi set unit_cost_usd = p.unit_cost_usd from public.gi_quotes q join public.gi_quote_products p on p.quote_id = q.id where q.operation_id = oi.operation_id and p.description = oi.description and oi.unit_cost_usd is null;
