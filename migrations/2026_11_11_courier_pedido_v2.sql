-- Courier pedido al agente, v2 (11/11/2026): origen (China Mainland / Hong Kong) + servicio nuevo
-- (FedEx International Economy / Priority, UPS Expedited / Saver, ÷5000 y ÷6000). Formato "CN:UPS_SAV_5000".
-- Los códigos viejos (DHL, FEDEX, UPS, FEDEX_5000…) siguen valiendo para los vuelos ya cargados.
alter table public.flights drop constraint if exists flights_requested_carrier_check;
alter table public.flights add constraint flights_requested_carrier_check check (
  requested_carrier is null
  or requested_carrier ~ '^(DHL|FEDEX|UPS|FEDEX_(5000|6000)|UPS_(5000|6000))$'
  or requested_carrier ~ '^(CN|HK):(DHL|FEDEX_(IE|IP)_(5000|6000)|UPS_(EXP|SAV)_(5000|6000))$'
);
