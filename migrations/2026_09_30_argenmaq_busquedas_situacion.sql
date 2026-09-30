-- ARGENMAQ · A pedido: en qué punto está el cliente antes de escribirle.
-- Situación (si ya habló con proveedores o está en cero), con quién habló y qué precio le pasaron,
-- urgencia y por dónde llegó. Correr en el SQL Editor del proyecto de Argencargo.
alter table public.cat_busquedas
  add column if not exists situacion         text not null default 'sin_contacto'
    check (situacion in ('sin_contacto','averiguando','con_cotizacion','por_cerrar')),
  add column if not exists proveedores       text,    -- con quién ya habló (marca, proveedor, país, link)
  add column if not exists precio_referencia text,    -- qué precio le pasaron, si lo dijo
  add column if not exists urgencia          text not null default 'sin_definir'
    check (urgencia in ('ya','un_mes','tres_meses','sin_apuro','sin_definir')),
  add column if not exists origen            text;    -- por dónde llegó: whatsapp, instagram, referido, web, otro
