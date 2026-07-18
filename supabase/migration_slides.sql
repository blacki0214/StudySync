-- migration_slides.sql
-- ---------------------------------------------------------------------------
-- Phase 3 of the teacher/school extension: native slide decks per class. A deck
-- stores its ordered slides (and their blocks) as a jsonb array to keep the
-- model simple. Safe to run more than once. Run after migration_class_workspace.

create table if not exists public.slide_decks (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  owner_id   uuid references auth.users (id) on delete set null,
  title      text not null default 'Untitled deck',
  slides     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_slide_decks_class on public.slide_decks (class_id);

alter table public.slide_decks enable row level security;

-- Signed-in read; any signed-in user can create/update/delete (tighten to class
-- membership later if needed).
drop policy if exists "read slide decks" on public.slide_decks;
create policy "read slide decks" on public.slide_decks
  for select to authenticated using (true);

drop policy if exists "write slide decks" on public.slide_decks;
create policy "write slide decks" on public.slide_decks
  for all to authenticated using (true) with check (true);
