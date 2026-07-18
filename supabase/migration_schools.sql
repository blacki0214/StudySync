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
