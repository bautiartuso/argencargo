-- 03/11/2026: el gasto de Meta Ads llega en pesos (cuenta ARGENCARGO 2 en ARS) y el tablero de Campañas
-- muestra todo en dólares. spend queda en USD (convertido con el blue venta del día); el original se guarda.
alter table public.crm_ad_spend
  add column if not exists spend_local numeric(12,2),
  add column if not exists local_currency text,
  add column if not exists fx_rate numeric(12,2);
comment on column public.crm_ad_spend.spend is 'Gasto en USD (convertido con fx_rate si la cuenta factura en otra moneda)';
comment on column public.crm_ad_spend.spend_local is 'Gasto en la moneda de la cuenta publicitaria, tal como lo informa Meta';
comment on column public.crm_ad_spend.fx_rate is 'Blue venta del día usado para pasar spend_local a USD';
