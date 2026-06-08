-- ============================================================================
-- StudySync Vietnam — Supabase schema
-- Run this in the Supabase SQL editor to create the backend used by the app.
-- The frontend works WITHOUT this (demo mode); apply it to enable the live
-- database, auth profiles and realtime collaboration.
-- ============================================================================

-- 1. profiles ----------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  avatar_url text,
  reputation int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. subjects ----------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  category text,
  created_at timestamptz not null default now()
);

-- 3. notes -------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  content text not null default '',
  visibility text not null default 'public',
  likes_count int not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 4. note_versions (one row per saved snapshot) ------------------------------
create table if not exists public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notes (id) on delete cascade,
  content text not null,
  version_number int not null,
  edited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. flashcards --------------------------------------------------------------
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notes (id) on delete cascade,
  question text not null,
  answer text not null,
  difficulty text,
  created_at timestamptz not null default now()
);

-- 6. quizzes -----------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references public.notes (id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_answer int not null,
  created_at timestamptz not null default now()
);

-- 7. study_rooms -------------------------------------------------------------
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects (id) on delete set null,
  name text not null,
  description text,
  active_users int not null default 0,
  created_at timestamptz not null default now()
);

-- 8. activities --------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Realtime: add the tables we subscribe to in the app to the realtime publication.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.note_versions;

-- ----------------------------------------------------------------------------
-- Row Level Security (basic policies — tighten for production).
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.subjects      enable row level security;
alter table public.notes         enable row level security;
alter table public.note_versions enable row level security;
alter table public.flashcards    enable row level security;
alter table public.quizzes       enable row level security;
alter table public.study_rooms   enable row level security;
alter table public.activities    enable row level security;

-- Public read for shared content.
create policy "read subjects"  on public.subjects      for select using (true);
create policy "read notes"     on public.notes         for select using (true);
create policy "read versions"  on public.note_versions for select using (true);
create policy "read rooms"     on public.study_rooms   for select using (true);
create policy "read profiles"  on public.profiles      for select using (true);

-- Authenticated users can write their own data.
create policy "insert notes"   on public.notes         for insert with check (auth.uid() = author_id);
create policy "update notes"   on public.notes         for update using (true);
create policy "insert versions" on public.note_versions for insert with check (true);
create policy "own profile"    on public.profiles      for update using (auth.uid() = id);
