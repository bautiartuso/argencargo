-- Seguridad (28/10/2026) — ya aplicado en producción con el MCP.
-- 1) Nadie puede cambiarse el rol (ni campos de socio) salvo admin / service role.
create or replace function public.profiles_bloquear_rol()
returns trigger language plpgsql security definer set search_path = public as $$
declare es_admin boolean; es_servicio boolean;
begin
  es_servicio := coalesce(auth.role(), '') = 'service_role' or auth.uid() is null;
  if es_servicio then return new; end if;
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin') into es_admin;
  if es_admin then return new; end if;
  if new.role is distinct from old.role or new.id is distinct from old.id then
    raise exception 'No autorizado a cambiar el rol' using errcode = '42501';
  end if;
  if (new.is_gi_partner is distinct from old.is_gi_partner or new.gi_partner_pct is distinct from old.gi_partner_pct or new.argenmaq_role is distinct from old.argenmaq_role)
     and not (old.id <> auth.uid() and coalesce((select es_socio_gi()), false)) then
    raise exception 'No autorizado a cambiar permisos' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_bloquear_rol on public.profiles;
create trigger profiles_bloquear_rol before update on public.profiles for each row execute function public.profiles_bloquear_rol();

-- 2) El cliente no edita su operación directo (el portal usa /api/portal/*).
drop policy if exists ops_update_client_consolidation on public.operations;

-- 3) El cliente no cambia condición fiscal, código, socio GI ni seguimiento de su ficha.
create or replace function public.clients_bloquear_campos()
returns trigger language plpgsql security definer set search_path = public as $$
declare rol text;
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then return new; end if;
  select role::text into rol from profiles where id = auth.uid();
  if rol in ('admin','empleado','agente') or coalesce((select es_socio_gi()), false) then return new; end if;
  if new.tax_condition is distinct from old.tax_condition or new.client_code is distinct from old.client_code
     or new.auth_user_id is distinct from old.auth_user_id or new.gi_partner_id is distinct from old.gi_partner_id
     or new.followup_status is distinct from old.followup_status or new.followup_next_at is distinct from old.followup_next_at
     or new.last_followup_at is distinct from old.last_followup_at then
    raise exception 'No autorizado a cambiar ese dato' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists clients_bloquear_campos on public.clients;
create trigger clients_bloquear_campos before update on public.clients for each row execute function public.clients_bloquear_campos();
