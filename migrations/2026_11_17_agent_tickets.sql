-- Tickets con el agente (17/11/2026, pedido de Bautista): cada tema que hay que resolver con el agente
-- (un reclamo, algo que pidió un cliente, algo que tiene que hacer) es un ticket con su propio chat,
-- fotos, y se cierra cuando queda resuelto. Antes iba todo por WhatsApp y se le pasaban cosas.
-- Todo pasa por /api/agente/tickets con la service_role (traduce, avisa y marca leído), por eso las
-- tablas tienen RLS prendida y ninguna policy. Las fotos van al bucket público "tickets" (no a
-- package-photos, que tiene un cron que borra lo que no está referenciado).
create sequence if not exists public.agent_ticket_seq;

create table if not exists public.agent_tickets (
  id uuid primary key default gen_random_uuid(),
  numero int not null default nextval('public.agent_ticket_seq'),   -- se muestra como #12
  agent_id uuid not null,                 -- auth uid del agente
  titulo text not null,
  titulo_tr text,                         -- traducción para el otro lado (castellano ↔ chino)
  status text not null default 'abierto' check (status in ('abierto','cerrado')),
  creado_por uuid,
  creado_rol text not null check (creado_rol in ('admin','agente')),
  created_at timestamptz not null default now(),
  cerrado_at timestamptz,
  cerrado_por uuid,
  ultimo_at timestamptz not null default now(),   -- último mensaje (ordena la lista)
  ultimo_rol text,                                -- quién escribió último: a quién le toca responder
  ultimo_texto text,
  ultimo_texto_tr text,                           -- el mismo recorte, traducido para el otro lado
  visto_admin_at timestamptz,
  visto_agente_at timestamptz
);
create unique index if not exists agent_tickets_numero on public.agent_tickets (numero);
create index if not exists agent_tickets_agente on public.agent_tickets (agent_id, status, ultimo_at desc);

create table if not exists public.agent_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.agent_tickets(id) on delete cascade,
  autor_id uuid,
  autor_rol text not null check (autor_rol in ('admin','agente','sistema')),
  texto text,
  texto_tr text,
  fotos text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists agent_ticket_messages_ticket on public.agent_ticket_messages (ticket_id, created_at);

alter table public.agent_tickets enable row level security;
alter table public.agent_ticket_messages enable row level security;

insert into storage.buckets (id, name, public) values ('tickets', 'tickets', true) on conflict (id) do nothing;

-- Mismo día: prioridad del ticket. 'alta' se ve en rojo, 'media' en amarillo (no hay verde: si hay un
-- ticket abierto, algo falta resolver). La pone y la cambia solo Argencargo.
alter table public.agent_tickets add column if not exists prioridad text not null default 'media' check (prioridad in ('alta','media'));
