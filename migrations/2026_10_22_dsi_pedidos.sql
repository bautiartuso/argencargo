-- Pedido de DSI por mail (22/10/2026). Un pedido por vuelo (una guía): se manda desde el vuelo con
-- el Gmail conectado, la respuesta del courier se detecta sola por el asunto "Solicitud DSI <guía>"
-- y prende la campanita de Aéreos hasta que alguien la revisa y adjunta la DSI.
create table if not exists public.dsi_pedidos (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights(id) on delete cascade,
  guia text not null,
  carrier text,
  para text,
  cc text,
  asunto text,
  gmail_id text,
  gmail_hilo text,
  enviado_por uuid,
  enviado_at timestamptz not null default now(),
  respuesta_at timestamptz,
  respuesta_de text,
  revisado_at timestamptz,
  revisado_por uuid
);
create index if not exists dsi_pedidos_flight on public.dsi_pedidos (flight_id);
alter table public.dsi_pedidos enable row level security;
drop policy if exists dsi_pedidos_staff on public.dsi_pedidos;
create policy dsi_pedidos_staff on public.dsi_pedidos for all to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
