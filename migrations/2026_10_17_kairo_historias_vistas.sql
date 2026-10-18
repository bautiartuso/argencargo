-- Kairo · quién vio cada historia (17/10/2026)
--
-- Cada vez que alguien abre una historia de otro se guarda (una vez por persona). Solo el dueño de la
-- historia ve la lista, a través de /api/kairo/social (service role): por eso la tabla no tiene
-- políticas para usuarios. Se borra sola junto con la historia.

create table if not exists kairo_story_views (
  story_id uuid not null references kairo_stories(id) on delete cascade,
  viewer_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table kairo_story_views enable row level security;
