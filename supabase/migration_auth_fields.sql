-- ============================================================================
-- Migration — richer signup profile fields
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor if you already created the database
-- with an older schema.sql and DON'T want to wipe your data. It only adds the
-- new columns the multi-step signup collects. (A fresh schema.sql already
-- includes these, so you only need this for an existing database.)
-- ============================================================================

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name  text;
alter table public.profiles add column if not exists dob        date;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists role       text;   -- 'student' | 'teacher'
alter table public.profiles add column if not exists purpose    text;   -- 'personal' | 'education' | 'teaching'
