-- Reparto (13/11/2026): app de los fletes locales, compartida entre Argencargo y MyBox.
-- Los repartidores entran con un link propio (token); todo pasa por /api/reparto con la service_role,
-- por eso las tablas tienen RLS prendida y ninguna policy: ni clientes ni agentes las leen.

create table if not exists public.repartidores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  token text not null unique,
  tarifa_km_ars numeric not null default 0,
  cuenta_vuelta boolean not null default false,   -- suma los km de vuelta a la oficina
  activo boolean not null default true,
  prueba boolean not null default false,          -- ve entregas ya hechas y no toca las operaciones
  created_at timestamptz not null default now()
);

create table if not exists public.reparto_viajes (
  id uuid primary key default gen_random_uuid(),
  repartidor_id uuid not null references public.repartidores(id) on delete cascade,
  fecha date not null,
  estado text not null default 'abierto' check (estado in ('abierto','terminado')),
  ruta jsonb,                 -- tramos y dibujo del recorrido planeado
  km numeric,                 -- recorrido real, calculado al terminar
  km_manual numeric,          -- corrección del admin
  tarifa_km_ars numeric,      -- tarifa vigente al terminar
  pago_ars numeric,
  pagado_at timestamptz,
  terminado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reparto_viajes_repartidor on public.reparto_viajes (repartidor_id, fecha desc);

create table if not exists public.reparto_paradas (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.reparto_viajes(id) on delete cascade,
  base text not null check (base in ('argencargo','mybox')),
  operation_id uuid not null,
  operation_code text,
  orden int not null default 0,
  datos jsonb not null default '{}'::jsonb,   -- foto del envío (cliente, dirección, franja, saldo…)
  lat double precision,
  lng double precision,
  estado text not null default 'cargado' check (estado in ('cargado','entregado','no_entregado')),
  cobros jsonb,               -- [{monto, moneda, metodo}] que declaró el repartidor
  motivo text,
  nota text,
  cargado_at timestamptz not null default now(),
  resuelto_at timestamptz,
  rendido_at timestamptz
);
create index if not exists reparto_paradas_viaje on public.reparto_paradas (viaje_id);
-- Un envío no puede estar cargado en dos autos a la vez.
create unique index if not exists reparto_paradas_una_carga on public.reparto_paradas (base, operation_id) where estado = 'cargado';

-- Direcciones ya ubicadas en el mapa, para no volver a consultarlas.
create table if not exists public.reparto_geo (
  clave text primary key,
  lat double precision,
  lng double precision,
  fuente text,
  created_at timestamptz not null default now()
);

alter table public.repartidores enable row level security;
alter table public.reparto_viajes enable row level security;
alter table public.reparto_paradas enable row level security;
alter table public.reparto_geo enable row level security;

-- Mismo día: foto de la entrega como comprobante (bucket privado reparto-fotos) y la vuelta a la
-- oficina cuenta en los kilómetros por defecto (oficina → paradas → oficina).
alter table public.reparto_paradas add column if not exists foto_path text;
alter table public.repartidores alter column cuenta_vuelta set default true;
insert into storage.buckets (id, name, public) values ('reparto-fotos', 'reparto-fotos', false) on conflict (id) do nothing;

-- Mismo día: lo que cobra el repartidor se anota como cobro de la operación (anotado = qué se anotó o
-- por qué no) y lo que se le paga por el viaje se reparte como flete local entre sus operaciones (costo).
alter table public.reparto_paradas add column if not exists anotado jsonb;
alter table public.reparto_paradas add column if not exists costo jsonb;
alter table public.reparto_viajes add column if not exists pago_metodo text;

-- Mismo día: notificaciones a los repartidores. reparto_push = teléfonos suscriptos;
-- reparto_avisos = qué ya se avisó (resumen del día y cada envío nuevo), para no repetir.
create table if not exists public.reparto_push (
  id uuid primary key default gen_random_uuid(),
  repartidor_id uuid not null references public.repartidores(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.reparto_avisos (
  clave text primary key,
  created_at timestamptz not null default now()
);
alter table public.reparto_push enable row level security;
alter table public.reparto_avisos enable row level security;
