-- Factura del vuelo: renglón con la descripción vacía (25/11/2026).
-- El admin convierte los textos vacíos en null antes de guardar (para que no fallen fechas y números),
-- y flight_invoice_items.description es NOT NULL: "+ Agregar ítem manual" crea el renglón en blanco y
-- la base lo rechazaba sin avisar (lo mismo al borrar la descripción de un renglón). La base ahora
-- guarda '' cuando llega null.
alter table public.flight_invoice_items alter column description set default '';
create or replace function public.fii_descripcion_vacia() returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.description := coalesce(new.description, '');
  return new;
end $$;
drop trigger if exists trg_fii_descripcion_vacia on public.flight_invoice_items;
create trigger trg_fii_descripcion_vacia before insert or update on public.flight_invoice_items
  for each row execute function public.fii_descripcion_vacia();
