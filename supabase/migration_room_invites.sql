-- migration_room_invites.sql
-- ---------------------------------------------------------------------------
-- Study-room invites. Rooms are per-user (scoped to owner_id), so a room only
-- appears in its owner's list. This table lets someone JOIN another user's room
-- via a share link: opening the room URL inserts a membership row, after which
-- the room shows up in that user's own room list too.
--
-- Run after migration_owner_scoping.sql. Safe to re-run.

create table if not exists public.room_members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.study_rooms (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists room_members_user on public.room_members (user_id);
create index if not exists room_members_room on public.room_members (room_id);

alter table public.room_members enable row level security;

-- A user manages only their OWN memberships (join/leave themselves).
drop policy if exists "rm read"   on public.room_members;
drop policy if exists "rm insert" on public.room_members;
drop policy if exists "rm delete" on public.room_members;

create policy "rm read"   on public.room_members for select using (user_id = auth.uid());
create policy "rm insert" on public.room_members for insert to authenticated with check (user_id = auth.uid());
create policy "rm delete" on public.room_members for delete to authenticated using (user_id = auth.uid());
