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
