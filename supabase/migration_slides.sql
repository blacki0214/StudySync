-- migration_slides.sql
-- ---------------------------------------------------------------------------
-- Phase 3 (upload model): class slide decks are UPLOADED files (PDF / PPTX)
-- that can be presented in-app. A deck row just points at the uploaded file.
-- Safe to run more than once. Run after migration_class_workspace.
--
-- For live uploads, also create a PUBLIC Storage bucket named "slides"
-- (Supabase → Storage → New bucket → name "slides", Public). Without it the app
-- falls back to storing the file inline as a data URL (fine for small PDFs).

create table if not exists public.slide_decks (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  owner_id   uuid references auth.users (id) on delete set null,
  title      text not null default 'Untitled deck',
  file_url   text,
  file_type  text,
  created_at timestamptz not null default now()
);

-- If an older version of this table exists (with a `slides` jsonb column), add
-- the new columns so upgrades are seamless.
alter table public.slide_decks add column if not exists file_url text;
alter table public.slide_decks add column if not exists file_type text;

create index if not exists idx_slide_decks_class on public.slide_decks (class_id);

alter table public.slide_decks enable row level security;

drop policy if exists "read slide decks" on public.slide_decks;
create policy "read slide decks" on public.slide_decks
  for select to authenticated using (true);

drop policy if exists "write slide decks" on public.slide_decks;
create policy "write slide decks" on public.slide_decks
  for all to authenticated using (true) with check (true);
