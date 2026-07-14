-- migration_community_reddit.sql
-- ---------------------------------------------------------------------------
-- Reddit-style community: threaded (nested) replies + per-user up/down votes on
-- posts. Run after migration_community_interactions.sql. Safe to re-run.

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
