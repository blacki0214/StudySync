-- migration_profile_bio.sql
-- ---------------------------------------------------------------------------
-- Adds a short "about me" bio to profiles for personalisation. The banner
-- colour, avatar, handle, program, school and location columns already exist.
-- Safe to re-run.

alter table public.profiles
  add column if not exists bio text;
