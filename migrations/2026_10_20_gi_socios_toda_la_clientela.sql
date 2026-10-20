-- Socios de Gestión Integral: acceso a toda la clientela (20/10/2026)
-- Pedido de Bautista: cuando Maxi (socio GI) arma una cotización tiene que poder elegir a cualquier
-- cliente de la base, no solo a los que tiene asignados. La comisión sigue yendo al socio que arma
-- la cotización (assigned_partner_id); si el cliente no tenía socio, queda asignado a él.

-- ¿El usuario actual es socio GI? (STABLE + SECURITY DEFINER: no anida RLS, ver nota del 14/09/2026)
create or replace function public.es_socio_gi()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce((select is_gi_partner from public.profiles where id = auth.uid()), false); $$;

-- Ver todos los clientes
drop policy if exists clients_select_socio_gi on public.clients;
create policy clients_select_socio_gi on public.clients for select to authenticated
  using ((select public.es_socio_gi()));

-- Tomar un cliente sin socio: queda asignado al socio que lo cotiza. Si ya tiene socio, no se pisa
-- (la comisión de esa cotización va igual por assigned_partner_id).
create or replace function public.gi_tomar_cliente(p_client uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.es_socio_gi() then raise exception 'Solo socios GI'; end if;
  update public.clients set gi_partner_id = auth.uid() where id = p_client and gi_partner_id is null;
  return found;
end $$;
grant execute on function public.gi_tomar_cliente(uuid) to authenticated;
