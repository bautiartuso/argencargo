-- CRM con WhatsApp (30/10/2026). Aplicado en producción vía MCP; queda acá como registro.
-- El número comercial (+54 9 11 2508-8580, WhatsApp Business) se conecta a la Cloud API en
-- "coexistencia": sigue andando en el celu y los chats se espejan acá (lib/crm-wa.js).
--   crm_numbers  → números conectados (el token lo usa solo el servidor: sin policies de usuario)
--   crm_agenda   → la agenda del celu (nombre por teléfono), para ponerle nombre a las fichas
--   crm_contacts → una ficha por teléfono (lead o cliente), con la etapa y la atribución del anuncio
--   crm_messages → cada mensaje, entrante (API) o saliente (eco de lo que se manda desde el celu)

create table if not exists public.crm_numbers (
  phone_number_id text primary key,
  waba_id text,
  business_id text,
  display_phone text,
  token text,
  status text not null default 'conectado',   -- conectado | desconectado | reconectando
  disconnect_reason text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  sync_contacts_at timestamptz,
  sync_history_at timestamptz,
  history_progress int,
  is_on_biz_app boolean,
  updated_at timestamptz not null default now()
);
alter table public.crm_numbers enable row level security;

create table if not exists public.crm_agenda (
  phone text primary key,
  name text,
  updated_at timestamptz not null default now()
);
alter table public.crm_agenda enable row level security;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,                  -- 549… solo dígitos
  name text,                                   -- como está agendado en el celu
  wa_name text,                                -- el nombre que el cliente puso en su WhatsApp
  client_id uuid references public.clients(id) on delete set null,
  stage text not null default 'nuevo',         -- nuevo | hablando | cotizo | importo | perdido
  stage_manual boolean not null default false,
  stage_at timestamptz,
  lost_reason text,
  source text,                                 -- ad | organico | historial
  ad_source_id text, ad_source_url text, ad_headline text, ad_body text, ad_media_type text, ad_ctwa_clid text, ad_at timestamptz,
  campaign_id text, campaign_name text, adset_id text, adset_name text, ad_name text,
  first_in_at timestamptz, last_in_at timestamptz, last_out_at timestamptz, last_msg_at timestamptz,
  last_preview text, last_direction text,
  unread int not null default 0,
  seen_at timestamptz,
  summary text, summary_at timestamptz, pending text,
  next_contact_at date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_contacts_last_msg_idx on public.crm_contacts (last_msg_at desc nulls last);
create index if not exists crm_contacts_client_idx on public.crm_contacts (client_id);
alter table public.crm_contacts enable row level security;
drop policy if exists crm_contacts_staff_select on public.crm_contacts;
create policy crm_contacts_staff_select on public.crm_contacts for select to authenticated
  using ((select public.current_user_role()) in ('admin','empleado'));
drop policy if exists crm_contacts_staff_update on public.crm_contacts;
create policy crm_contacts_staff_update on public.crm_contacts for update to authenticated
  using ((select public.current_user_role()) in ('admin','empleado'))
  with check ((select public.current_user_role()) in ('admin','empleado'));

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.crm_contacts(id) on delete cascade,
  phone text not null,
  wamid text unique,
  direction text not null,                     -- in | out
  via text,                                    -- api | app | history
  type text,
  text text,
  media_id text, media_mime text, media_filename text, media_url text,
  reply_to text,
  referral jsonb,
  status text,                                 -- sent | delivered | read | failed
  deleted boolean not null default false,
  ts timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists crm_messages_contact_ts_idx on public.crm_messages (contact_id, ts);
alter table public.crm_messages enable row level security;
drop policy if exists crm_messages_staff_select on public.crm_messages;
create policy crm_messages_staff_select on public.crm_messages for select to authenticated
  using ((select public.current_user_role()) in ('admin','empleado'));

-- El historial llega en pedazos desordenados: después de cada pedazo se recalculan los
-- "último mensaje" de los contactos tocados a partir de crm_messages.
create or replace function public.crm_recalcular_contactos(p_phones text[])
returns void language sql security definer set search_path = public as $$
  update public.crm_contacts c set
    first_in_at = s.first_in, last_in_at = s.last_in, last_out_at = s.last_out, last_msg_at = s.last_msg,
    last_preview = s.preview, last_direction = s.dir, updated_at = now()
  from (
    select m.phone,
      min(m.ts) filter (where m.direction = 'in') as first_in,
      max(m.ts) filter (where m.direction = 'in') as last_in,
      max(m.ts) filter (where m.direction = 'out') as last_out,
      max(m.ts) as last_msg,
      (array_agg(coalesce(m.text, '') order by m.ts desc))[1] as preview,
      (array_agg(m.direction order by m.ts desc))[1] as dir
    from public.crm_messages m where m.phone = any(p_phones) and not m.deleted group by m.phone
  ) s where s.phone = c.phone;
$$;
revoke all on function public.crm_recalcular_contactos(text[]) from public;

-- Envío desde el sistema (apagado por defecto; tope mensual para no pasar las 1.000 respuestas gratis)
alter table public.crm_numbers add column if not exists send_enabled boolean not null default false;
alter table public.crm_numbers add column if not exists send_month text;
alter table public.crm_numbers add column if not exists send_count int not null default 0;
alter table public.crm_numbers add column if not exists send_cap int not null default 950;

-- Gasto de Meta Ads por anuncio y día (cron /api/cron/crm-ads). Plata: solo admin.
create table if not exists public.crm_ad_spend (
  date date not null,
  ad_id text not null,
  ad_name text, adset_id text, adset_name text, campaign_id text, campaign_name text,
  spend numeric(12,2) not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  conversaciones int not null default 0,     -- conversaciones de WhatsApp iniciadas (según Meta)
  currency text,
  updated_at timestamptz not null default now(),
  primary key (date, ad_id)
);
alter table public.crm_ad_spend enable row level security;
drop policy if exists crm_ad_spend_admin_select on public.crm_ad_spend;
create policy crm_ad_spend_admin_select on public.crm_ad_spend for select to authenticated
  using ((select public.current_user_role()) = 'admin');

-- ── Lecturas y mantenimiento del CRM (panel app/crm) ──
-- El equipo (admin/empleado) puede crear fichas a mano (Contactos: cliente sin chat todavía).
drop policy if exists crm_contacts_staff_insert on public.crm_contacts;
create policy crm_contacts_staff_insert on public.crm_contacts for insert to authenticated
  with check ((select public.current_user_role()) in ('admin','empleado'));

-- Teléfono normalizado como lo manda Meta (549 + 10 dígitos), igual que waNumber() de lib/wa.js.
create or replace function public.crm_norm_tel(p text) returns text language sql immutable as $$
  select case
    when d like '549%' and length(d) >= 12 then d
    when d like '54%' and length(d) >= 11 then d
    when length(d) = 10 then '549' || d
    when length(d) >= 11 then d else null end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s;
$$;

-- Ficha comercial: cliente, operaciones, cotizaciones y facturado (facturado solo para el admin).
create or replace function public.crm_ficha(p_contact_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'cliente', (select json_build_object('id', cl.id, 'client_code', cl.client_code, 'nombre', nullif(trim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), ''), 'company_name', cl.company_name, 'email', cl.email, 'created_at', cl.created_at)
                from public.clients cl where cl.id = c.client_id),
    'ops', coalesce((select json_agg(json_build_object('id', o.id, 'code', o.operation_code, 'status', o.status, 'created_at', o.created_at, 'delivered_at', coalesce(o.delivery_completed_at, o.closed_at), 'total', o.budget_total, 'entregada', (o.status = 'operacion_cerrada' or o.delivery_completed_at is not null)) order by o.created_at desc)
                     from public.operations o where o.client_id = c.client_id and o.status <> 'cancelada'), '[]'::json),
    'cots', coalesce((select json_agg(json_build_object('id', q.id, 'code', case when q.quote_number is null then null else 'AGC-' || lpad(q.quote_number::text, 5, '0') end, 'status', q.status, 'created_at', q.created_at, 'total', q.total_cost) order by q.created_at desc)
                      from public.quotes q where q.client_id = c.client_id), '[]'::json),
    'facturado', case when (select public.current_user_role()) = 'admin'
                 then coalesce((select sum(o.budget_total) from public.operations o where o.client_id = c.client_id and o.status = 'operacion_cerrada'), 0) else null end
  )
  from public.crm_contacts c
  where c.id = p_contact_id and (select public.current_user_role()) in ('admin', 'empleado');
$$;
grant execute on function public.crm_ficha(uuid) to authenticated;
revoke execute on function public.crm_ficha(uuid) from public, anon;

-- Etapas automáticas + vinculación por teléfono. La corre el panel al abrir y el cron crm-resumen.
--   importó > cotizó > hablando (le contestamos) > nuevo. "perdido" solo lo pone una persona.
create or replace function public.crm_sync_etapas() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  perform public.exigir_equipo();
  update public.crm_contacts c
     set client_id = cl.id,
         name = coalesce(c.name, nullif(trim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), ''), cl.company_name),
         updated_at = now()
    from public.clients cl
   where c.client_id is null and length(cl.whatsapp_digitos) >= 10 and right(cl.whatsapp_digitos, 10) = right(c.phone, 10);
  with calc as (
    select c.id,
      case
        when c.client_id is not null and exists (select 1 from public.operations o where o.client_id = c.client_id and o.status <> 'cancelada' and (o.status = 'operacion_cerrada' or o.delivery_completed_at is not null)) then 'importo'
        when c.client_id is not null and exists (select 1 from public.maritime_shipments ms join public.maritime_containers mc on mc.id = ms.container_id where ms.client_id = c.client_id and mc.status = 'arribado') then 'importo'
        when c.client_id is not null and exists (select 1 from public.quotes q where q.client_id = c.client_id) then 'cotizo'
        when c.last_out_at is not null then 'hablando'
        else 'nuevo' end as nueva
    from public.crm_contacts c where not c.stage_manual
  )
  update public.crm_contacts c set stage = calc.nueva, stage_at = now(), updated_at = now()
    from calc where calc.id = c.id and c.stage is distinct from calc.nueva;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.crm_sync_etapas() to authenticated;
revoke execute on function public.crm_sync_etapas() from public, anon;

-- Contactos: las fichas del CRM + los clientes que todavía no tienen ficha (misma base, una lista).
create or replace function public.crm_contactos() returns table (
  contact_id uuid, client_id uuid, phone text, nombre text, wa_name text, client_code text, company_name text, email text,
  stage text, stage_manual boolean, source text, campaign_name text, ad_headline text,
  last_msg_at timestamptz, last_preview text, last_direction text, unread int, next_contact_at date, summary text, pending text, notes text,
  cotizaciones int, importaciones int, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  with cl as (
    select c.id, c.client_code, c.company_name, c.email, c.whatsapp, c.created_at,
      nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as nombre,
      (select count(*) from public.quotes q where q.client_id = c.id)::int as cotizaciones,
      (select count(*) from public.operations o where o.client_id = c.id and o.status <> 'cancelada' and (o.status = 'operacion_cerrada' or o.delivery_completed_at is not null))::int as importaciones
    from public.clients c
  )
  select * from (
    select x.id, x.client_id, x.phone, coalesce(x.name, cl.nombre, cl.company_name, x.wa_name), x.wa_name, cl.client_code, cl.company_name, cl.email,
      x.stage, x.stage_manual, x.source, x.campaign_name, x.ad_headline, x.last_msg_at, x.last_preview, x.last_direction, x.unread, x.next_contact_at, x.summary, x.pending, x.notes,
      coalesce(cl.cotizaciones, 0), coalesce(cl.importaciones, 0), x.created_at
    from public.crm_contacts x left join cl on cl.id = x.client_id
    union all
    select null::uuid, cl.id, public.crm_norm_tel(cl.whatsapp), coalesce(cl.nombre, cl.company_name), null, cl.client_code, cl.company_name, cl.email,
      case when cl.importaciones > 0 then 'importo' when cl.cotizaciones > 0 then 'cotizo' else 'nuevo' end, false, 'cliente', null, null,
      null, null, null, 0, null, null, null, null, cl.cotizaciones, cl.importaciones, cl.created_at
    from cl where not exists (select 1 from public.crm_contacts x where x.client_id = cl.id)
  ) t
  where (select public.current_user_role()) in ('admin', 'empleado');
$$;
grant execute on function public.crm_contactos() to authenticated;
revoke execute on function public.crm_contactos() from public, anon;

-- Campañas: por anuncio, gasto (crm_ad_spend) y embudo (leads que llegaron con ese anuncio). Plata solo admin.
create or replace function public.crm_campanas(p_desde date, p_hasta date) returns table (
  campaign_id text, campaign_name text, adset_id text, adset_name text, ad_id text, ad_name text,
  spend numeric, impressions bigint, clicks bigint, conversaciones bigint,
  leads bigint, hablaron bigint, cotizaron bigint, importaron bigint, facturado numeric
) language sql stable security definer set search_path = public as $$
  with gasto as (
    select s.ad_id, max(s.ad_name) ad_name, max(s.adset_id) adset_id, max(s.adset_name) adset_name, max(s.campaign_id) campaign_id, max(s.campaign_name) campaign_name,
      sum(s.spend) spend, sum(s.impressions)::bigint impressions, sum(s.clicks)::bigint clicks, sum(s.conversaciones)::bigint conversaciones
    from public.crm_ad_spend s where s.date between p_desde and p_hasta group by s.ad_id
  ), leads as (
    select c.ad_source_id ad_id, max(c.ad_name) ad_name, max(c.adset_id) adset_id, max(c.adset_name) adset_name, max(c.campaign_id) campaign_id, max(c.campaign_name) campaign_name,
      count(*) leads,
      count(*) filter (where c.stage in ('hablando', 'cotizo', 'importo')) hablaron,
      count(*) filter (where c.stage in ('cotizo', 'importo')) cotizaron,
      count(*) filter (where c.stage = 'importo') importaron,
      sum((select sum(o.budget_total) from public.operations o where o.client_id = c.client_id and o.status = 'operacion_cerrada' and o.created_at >= c.ad_at)) facturado
    from public.crm_contacts c where c.ad_source_id is not null and c.ad_at::date between p_desde and p_hasta group by c.ad_source_id
  )
  select coalesce(g.campaign_id, l.campaign_id), coalesce(g.campaign_name, l.campaign_name), coalesce(g.adset_id, l.adset_id), coalesce(g.adset_name, l.adset_name),
    coalesce(g.ad_id, l.ad_id), coalesce(g.ad_name, l.ad_name),
    case when (select public.current_user_role()) = 'admin' then g.spend end, g.impressions, g.clicks, g.conversaciones,
    coalesce(l.leads, 0), coalesce(l.hablaron, 0), coalesce(l.cotizaron, 0), coalesce(l.importaron, 0),
    case when (select public.current_user_role()) = 'admin' then l.facturado end
  from gasto g full join leads l on l.ad_id = g.ad_id
  where (select public.current_user_role()) in ('admin', 'empleado');
$$;
grant execute on function public.crm_campanas(date, date) to authenticated;
revoke execute on function public.crm_campanas(date, date) from public, anon;
