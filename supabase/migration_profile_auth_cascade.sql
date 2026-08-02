-- migration_profile_auth_cascade.sql
-- ---------------------------------------------------------------------------
-- Deleting a user in Authentication → Users used to leave their public.profiles
-- row behind, because profiles.auth_id was a plain uuid column with no foreign
-- key. The orphan then tripped the duplicate-email pre-check in
-- services/authService.js signUp(), so the same address could never sign up
-- again ("An account with this email already exists") even though the auth user
-- was gone.
--
-- This adds the missing FK with ON DELETE CASCADE, so removing an auth user now
-- removes their profile too. Seeded sample profiles have auth_id NULL and are
-- unaffected (a NULL FK is always valid).
--
-- Safe to re-run.

-- 1. Clear existing orphans first, or the constraint can't be validated.
--    Only touches rows that POINT AT a deleted auth user; auth_id IS NULL
--    (seed/sample data) is left alone.
delete from public.profiles p
where p.auth_id is not null
  and not exists (select 1 from auth.users u where u.id = p.auth_id);

-- 2. Add the foreign key.
alter table public.profiles
  drop constraint if exists profiles_auth_id_fkey;

alter table public.profiles
  add constraint profiles_auth_id_fkey
  foreign key (auth_id) references auth.users (id) on delete cascade;

-- 3. The duplicate-email pre-check does `ilike email`, which can't use a plain
--    btree index. This makes it an index lookup instead of a scan.
create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));
