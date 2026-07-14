-- migration_owner_scoping.sql
-- ---------------------------------------------------------------------------
-- Per-user isolation for decks and study rooms. Neither table had an owner
-- column, so every account saw every account's decks/rooms (the tables are
-- public-read at the RLS level). This adds `owner_id` so the app can scope the
-- lists to the signed-in user (client-side filter, mirroring notes).
--
-- Existing rows get owner_id = NULL (no creator was ever recorded), so they
-- become unowned and drop out of every user's scoped list — a clean slate.
--
-- Safe to re-run. Run in: Supabase -> SQL Editor -> New query -> paste -> Run.

alter table public.decks
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
create index if not exists decks_owner on public.decks (owner_id);

alter table public.study_rooms
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;
create index if not exists study_rooms_owner on public.study_rooms (owner_id);
