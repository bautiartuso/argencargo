-- 17/09/2026 · Registro de correos enviados.
--
-- No había ninguno. Los avisos de bulto en depósito se podían contar de casualidad, porque
-- marcan clients.deposit_email_last_at para agrupar de a una hora; los de arribo, retiro y
-- cierre no dejaban rastro. pg_net guarda la respuesta del trigger unas pocas horas y después
-- la borra, así que si se vencía la API key de Resend o un cliente tenía el mail mal escrito,
-- el error quedaba en los logs de Vercel y nadie se enteraba.
--
-- Ahora los 8 puntos de envío pasan por lib/email.js (enviarEmail), que manda y registra —
-- éxito o error. Se ve en Admin › Comunicaciones › Correos enviados.
--
-- Aplicado en producción vía MCP; queda acá como registro.
create table if not exists public.email_log (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  trigger    text,
  to_email   text,
  subject    text,
  ok         boolean not null,
  resend_id  text,
  error      text,
  client_id  uuid,
  op_id      uuid
);
create index if not exists email_log_ts_idx     on public.email_log (ts desc);
create index if not exists email_log_fallos_idx on public.email_log (ts desc) where ok = false;
alter table public.email_log enable row level security;
create policy email_log_admin_select on public.email_log
  for select using ((select current_user_role()) = 'admin');
