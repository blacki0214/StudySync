-- migration_room_channels.sql
-- ---------------------------------------------------------------------------
-- Per-room text/voice channels (Discord-style). Channels are shared across
-- everyone in a room. Run after schema.sql (and migration_rooms_community_write).

create table if not exists public.room_channels (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.study_rooms (id) on delete cascade,
  name       text not null,
  kind       text not null default 'text',   -- 'text' | 'voice'
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.room_channels enable row level security;

drop policy if exists "public read room_channels" on public.room_channels;
create policy "public read room_channels" on public.room_channels
  for select using (true);

drop policy if exists "auth insert room_channels" on public.room_channels;
create policy "auth insert room_channels" on public.room_channels
  for insert to authenticated with check (true);

drop policy if exists "auth delete room_channels" on public.room_channels;
create policy "auth delete room_channels" on public.room_channels
  for delete to authenticated using (true);