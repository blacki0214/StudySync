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
