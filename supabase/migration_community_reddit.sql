-- migration_community_reddit.sql
-- ---------------------------------------------------------------------------
-- Reddit-style community: threaded (nested) replies + per-user up/down votes on
-- posts. Ideally run AFTER migration_community_interactions.sql, but this file
-- is self-contained (it creates community_comments if that migration hasn't run
-- yet). Safe to re-run.
--
-- NOTE: the Save feature also needs `community_saves` from
-- migration_community_interactions.sql — run that one too.

-- Ensure the comments table exists (in case this runs before the other file).
create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post on public.community_comments (post_id);

alter table public.community_comments enable row level security;
drop policy if exists "cc read"   on public.community_comments;
drop policy if exists "cc insert" on public.community_comments;
drop policy if exists "cc delete" on public.community_comments;
create policy "cc read"   on public.community_comments for select using (true);
create policy "cc insert" on public.community_comments for insert to authenticated with check (author_id = auth.uid());
create policy "cc delete" on public.community_comments for delete to authenticated using (author_id = auth.uid());

-- Nested replies: a comment may reply to another comment.
alter table public.community_comments
  add column if not exists parent_id uuid references public.community_comments (id) on delete cascade;
create index if not exists community_comments_parent on public.community_comments (parent_id);

-- Per-user post votes (+1 up / -1 down). The post's `votes` column stays the
-- denormalised net score for cheap sorting/display.
create table if not exists public.community_votes (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles (id) on delete cascade,
  post_id  uuid not null references public.community_posts (id) on delete cascade,
  value    smallint not null check (value in (-1, 1)),
  unique (user_id, post_id)
);
create index if not exists community_votes_user on public.community_votes (user_id);

alter table public.community_votes enable row level security;
drop policy if exists "cv read"   on public.community_votes;
drop policy if exists "cv insert" on public.community_votes;
drop policy if exists "cv update" on public.community_votes;
drop policy if exists "cv delete" on public.community_votes;
create policy "cv read"   on public.community_votes for select using (user_id = auth.uid());
create policy "cv insert" on public.community_votes for insert to authenticated with check (user_id = auth.uid());
create policy "cv update" on public.community_votes for update to authenticated using (user_id = auth.uid());
create policy "cv delete" on public.community_votes for delete to authenticated using (user_id = auth.uid());
