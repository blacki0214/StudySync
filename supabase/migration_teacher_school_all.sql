-- migration_teacher_school_all.sql
-- ============================================================================
-- ALL teacher/school-extension migrations in run order (Phases 1-5).
-- Paste this whole file into the Supabase SQL editor and Run. Idempotent.
-- NOTE: for slide uploads also create a PUBLIC Storage bucket named 'slides'.
-- ============================================================================


-- >>> migration_schools.sql >>>

-- migration_schools.sql
-- ---------------------------------------------------------------------------
-- Phase 1 of the teacher/school extension: the institution layer above
-- teachers. Adds:
--   • schools               — an institution with a join code, owned by an admin
--   • school_members        — admin / teacher / student membership
--   • classes.school_id     — links a class to a school (nullable = independent)
--
-- Safe to run more than once. Run in the Supabase SQL editor after schema.sql.
-- RLS mirrors the app's permissive "authenticated read + write" pattern; tighten
-- later if you need stricter isolation.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  code       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'student' check (role in ('admin', 'teacher', 'student')),
  joined_at  timestamptz not null default now(),
  unique (school_id, user_id)
);

-- Link a class to a school (nullable → independent teacher class).
alter table public.classes
  add column if not exists school_id uuid references public.schools (id) on delete set null;

create index if not exists idx_school_members_school on public.school_members (school_id);
create index if not exists idx_school_members_user on public.school_members (user_id);
create index if not exists idx_classes_school on public.classes (school_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_members enable row level security;

-- Schools: anyone signed-in can read (needed to resolve a join code); the admin
-- who created it can update/delete.
drop policy if exists "read schools" on public.schools;
create policy "read schools" on public.schools
  for select to authenticated using (true);

drop policy if exists "insert schools" on public.schools;
create policy "insert schools" on public.schools
  for insert to authenticated with check (admin_id = auth.uid());

drop policy if exists "admin update schools" on public.schools;
create policy "admin update schools" on public.schools
  for update to authenticated using (admin_id = auth.uid());

drop policy if exists "admin delete schools" on public.schools;
create policy "admin delete schools" on public.schools
  for delete to authenticated using (admin_id = auth.uid());

-- School members: signed-in read; a user can add themselves (join by code) or
-- be added; the school admin can remove members.
drop policy if exists "read school members" on public.school_members;
create policy "read school members" on public.school_members
  for select to authenticated using (true);

drop policy if exists "insert school members" on public.school_members;
create policy "insert school members" on public.school_members
  for insert to authenticated with check (true);

drop policy if exists "delete school members" on public.school_members;
create policy "delete school members" on public.school_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.schools s
      where s.id = school_members.school_id and s.admin_id = auth.uid()
    )
  );

-- >>> migration_class_workspace.sql >>>

-- migration_class_workspace.sql
-- ---------------------------------------------------------------------------
-- Phase 2 of the teacher/school extension: a class becomes a workspace. Adds a
-- nullable class_id to subjects and study_rooms so they can be scoped to a
-- class (null = personal, as before). Personal lists filter class_id IS NULL,
-- so existing behaviour is unchanged.
--
-- Safe to run more than once. Run in the Supabase SQL editor after schema.sql.

alter table public.subjects
  add column if not exists class_id uuid references public.classes (id) on delete cascade;

alter table public.study_rooms
  add column if not exists class_id uuid references public.classes (id) on delete cascade;

create index if not exists idx_subjects_class on public.subjects (class_id);
create index if not exists idx_study_rooms_class on public.study_rooms (class_id);

-- >>> migration_slides.sql >>>

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

-- >>> migration_class_quizzes.sql >>>

-- migration_class_quizzes.sql
-- ---------------------------------------------------------------------------
-- Phase 4 of the teacher/school extension: teacher-authored class quizzes and
-- student results (feeds the gradebook). Questions are stored as jsonb. Safe to
-- run more than once. Run after migration_class_workspace.

create table if not exists public.class_quizzes (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  owner_id   uuid references auth.users (id) on delete set null,
  title      text not null,
  questions  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references public.class_quizzes (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  score    int not null default 0,
  total    int not null default 0,
  taken_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

create index if not exists idx_class_quizzes_class on public.class_quizzes (class_id);
create index if not exists idx_quiz_results_quiz on public.quiz_results (quiz_id);

alter table public.class_quizzes enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists "read quizzes" on public.class_quizzes;
create policy "read quizzes" on public.class_quizzes for select to authenticated using (true);
drop policy if exists "write quizzes" on public.class_quizzes;
create policy "write quizzes" on public.class_quizzes for all to authenticated using (true) with check (true);

drop policy if exists "read results" on public.quiz_results;
create policy "read results" on public.quiz_results for select to authenticated using (true);
drop policy if exists "write own results" on public.quiz_results;
create policy "write own results" on public.quiz_results
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- >>> migration_class_activity.sql >>>

-- migration_class_activity.sql
-- ---------------------------------------------------------------------------
-- Phase 5 of the teacher/school extension: class-private discussions (Q&A) and
-- attendance. Safe to run more than once. Run after migration_class_workspace.

create table if not exists public.class_discussions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  title      text not null,
  body       text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.class_discussion_replies (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.class_discussions (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.class_attendance (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid not null references public.classes (id) on delete cascade,
  date      date not null,
  user_id   uuid not null references auth.users (id) on delete cascade,
  present   boolean not null default false,
  unique (class_id, date, user_id)
);

create index if not exists idx_discussions_class on public.class_discussions (class_id);
create index if not exists idx_discussion_replies_thread on public.class_discussion_replies (thread_id);
create index if not exists idx_attendance_class_date on public.class_attendance (class_id, date);

alter table public.class_discussions enable row level security;
alter table public.class_discussion_replies enable row level security;
alter table public.class_attendance enable row level security;

drop policy if exists "rw discussions" on public.class_discussions;
create policy "rw discussions" on public.class_discussions for all to authenticated using (true) with check (true);
drop policy if exists "rw discussion replies" on public.class_discussion_replies;
create policy "rw discussion replies" on public.class_discussion_replies for all to authenticated using (true) with check (true);
drop policy if exists "rw attendance" on public.class_attendance;
create policy "rw attendance" on public.class_attendance for all to authenticated using (true) with check (true);
