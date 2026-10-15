-- Kairo · historias (15/10/2026)
--
-- Fotos tipo historia de Instagram que duran 24 horas (al terminar un entreno o cuando quieras).
-- La imagen va achicada en la misma fila (image = jpg ~1080px, thumb = miniatura) para no depender
-- de un bucket. Las ven todos los usuarios de Kairo; cada uno borra las suyas.
-- Las de más de 24 h no se muestran; /api/kairo/social borra las de más de 2 días.

create table if not exists kairo_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  image text not null,
  thumb text,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists kairo_stories_created_idx on kairo_stories (created_at desc);

alter table kairo_stories enable row level security;
drop policy if exists kairo_stories_read on kairo_stories;
create policy kairo_stories_read on kairo_stories for select using (is_kairo_user() and created_at > now() - interval '24 hours');
drop policy if exists kairo_stories_insert on kairo_stories;
create policy kairo_stories_insert on kairo_stories for insert with check (is_kairo_user() and user_id = auth.uid());
drop policy if exists kairo_stories_delete on kairo_stories;
create policy kairo_stories_delete on kairo_stories for delete using (user_id = auth.uid());
