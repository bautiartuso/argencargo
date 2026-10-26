-- Vuelos retenidos por Aduana (26/10/2026). FedEx lo informa en el tracking como "Documentación
-- disponible para agente externo a FedEx": la carga queda excluida del régimen courier. El sync lo
-- detecta, marca la op y el vuelo, avisa al cliente por mail y deja de seguir el tracking. Un vuelo
-- retenido no exige DSI ni factura del courier para marcarlo recibido ni para cerrar la op.
alter table public.flights add column if not exists retenido_at timestamptz;
alter table public.operations add column if not exists retenida_at timestamptz;

-- Lo que ya estaba retenido antes de este cambio (FL-0143 / AC-0284): se marca con la fecha del evento.
update public.operations o
set retenida_at = e.occurred_at
from (
  select operation_id, min(occurred_at) as occurred_at
  from public.tracking_events
  where description ilike '%agente externo a FedEx%'
  group by operation_id
) e
where e.operation_id = o.id
  and o.retenida_at is null
  and o.status in ('en_transito', 'arribo_argentina', 'en_aduana');

update public.flights f
set retenido_at = o.retenida_at
from public.flight_operations fo
join public.operations o on o.id = fo.operation_id
where fo.flight_id = f.id
  and f.retenido_at is null
  and f.status <> 'recibido'
  and o.retenida_at is not null;
