-- ============================================================================
-- Migration — inline comments anchored to note text
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent / safe to re-run.
-- The highlighted span lives in the document (a CommentMark, synced via Yjs);
-- the comment body/author/quote live here so they sync live to everyone.
-- ============================================================================

create table if not exists public.note_comments (
  id          uuid primary key default gen_random_uuid(),
  comment_id  text not null,                 -- id of the mark in the document
  note_id     uuid references public.notes(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  quote       text,
  body        text not null,
  resolved    boolean default false,
  created_at  timestamptz not null default now()
);

do $$
begin
  alter publication supabase_realtime add table public.note_comments;
exception when duplicate_object then null;
end $$;

alter table public.note_comments enable row level security;
drop policy if exists "comments read"   on public.note_comments;
drop policy if exists "comments insert" on public.note_comments;
drop policy if exists "comments update" on public.note_comments;
drop policy if exists "comments delete" on public.note_comments;
create policy "comments read"   on public.note_comments for select using (true);
create policy "comments insert" on public.note_comments for insert to authenticated with check (true);
create policy "comments update" on public.note_comments for update to authenticated using (true);
create policy "comments delete" on public.note_comments for delete to authenticated using (true);
