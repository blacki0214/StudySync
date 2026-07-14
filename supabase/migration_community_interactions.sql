-- migration_community_interactions.sql
-- ---------------------------------------------------------------------------
-- Community replies (comments) + saved posts (bookmarks). Comments are public
-- like the posts; saves are private to each user. Run after schema.sql.
-- Safe to re-run.

-- Replies -------------------------------------------------------------------
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

-- Saved posts (per-user bookmarks) ------------------------------------------
create table if not exists public.community_saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
create index if not exists community_saves_user on public.community_saves (user_id);

alter table public.community_saves enable row level security;
drop policy if exists "cs read"   on public.community_saves;
drop policy if exists "cs insert" on public.community_saves;
drop policy if exists "cs delete" on public.community_saves;
create policy "cs read"   on public.community_saves for select using (user_id = auth.uid());
create policy "cs insert" on public.community_saves for insert to authenticated with check (user_id = auth.uid());
create policy "cs delete" on public.community_saves for delete to authenticated using (user_id = auth.uid());

-- Let authenticated users update a post's reply count when they comment.
drop policy if exists "auth update posts" on public.community_posts;
create policy "auth update posts" on public.community_posts for update to authenticated using (true);
