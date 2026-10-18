-- Kairo · reacciones a historias y fotos de progreso (18/10/2026)

-- Reacción (un emoji) de cada persona a cada historia. Solo el dueño de la historia las ve, vía /api/kairo/social.
create table if not exists kairo_story_reactions (
  story_id uuid not null references kairo_stories(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table kairo_story_reactions enable row level security;

-- Fotos de progreso (antes/después). Imagen achicada en la fila, como las historias. Privadas: cada uno las suyas.
create table if not exists kairo_progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  taken_on date not null,
  image text not null,
  thumb text,
  note text,
  peso_kg numeric,
  created_at timestamptz not null default now()
);
create index if not exists kairo_progress_photos_user_idx on kairo_progress_photos (user_id, taken_on desc);
alter table kairo_progress_photos enable row level security;
drop policy if exists kairo_progress_photos_own on kairo_progress_photos;
create policy kairo_progress_photos_own on kairo_progress_photos for all using (user_id = auth.uid() and is_kairo_user()) with check (user_id = auth.uid() and is_kairo_user());
