-- ============================================================================
-- Migration — Phase 2: classes + enrollment (join code) + announcements
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor (after migration_workspaces.sql).
-- Idempotent and safe to re-run. A fresh schema.sql already includes all of this.
-- ============================================================================

-- 1. Tables -----------------------------------------------------------------
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  code        text unique not null,        -- short join code (e.g. ABC123)
  color       text default 'grad-blue',
  archived    boolean default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.class_members (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid references public.classes(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      text default 'member',          -- member | ta
  joined_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create table if not exists public.class_announcements (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid references public.classes(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- 2. Security-definer helpers (run as owner → bypass RLS → no recursion) -----
create or replace function public.is_class_owner(cid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and owner_id = auth.uid());
$$;

create or replace function public.is_class_member(cid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = cid and user_id = auth.uid())
      or exists (select 1 from public.classes where id = cid and owner_id = auth.uid());
$$;

-- 3. Realtime ----------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.class_announcements;
exception when duplicate_object then null;
end $$;

-- 4. RLS --------------------------------------------------------------------
alter table public.classes            enable row level security;
alter table public.class_members      enable row level security;
alter table public.class_announcements enable row level security;

-- classes: readable by anyone (so join-by-code works); only the owner writes.
drop policy if exists "classes read"   on public.classes;
drop policy if exists "classes insert" on public.classes;
drop policy if exists "classes update" on public.classes;
drop policy if exists "classes delete" on public.classes;
create policy "classes read"   on public.classes for select using (true);
create policy "classes insert" on public.classes for insert to authenticated with check (owner_id = auth.uid());
create policy "classes update" on public.classes for update to authenticated using (owner_id = auth.uid());
create policy "classes delete" on public.classes for delete to authenticated using (owner_id = auth.uid());

-- class_members: members + owner can read the roster; students self-enrol;
-- the owner can add/remove; students can remove themselves.
drop policy if exists "members read"   on public.class_members;
drop policy if exists "members insert" on public.class_members;
drop policy if exists "members update" on public.class_members;
drop policy if exists "members delete" on public.class_members;
create policy "members read"   on public.class_members for select using (public.is_class_member(class_id));
create policy "members insert" on public.class_members for insert to authenticated
  with check (user_id = auth.uid() or public.is_class_owner(class_id));
create policy "members update" on public.class_members for update to authenticated using (public.is_class_owner(class_id));
create policy "members delete" on public.class_members for delete to authenticated
  using (public.is_class_owner(class_id) or user_id = auth.uid());

-- announcements: any class member reads; only the owner posts/deletes.
drop policy if exists "ann read"   on public.class_announcements;
drop policy if exists "ann insert" on public.class_announcements;
drop policy if exists "ann delete" on public.class_announcements;
create policy "ann read"   on public.class_announcements for select using (public.is_class_member(class_id));
create policy "ann insert" on public.class_announcements for insert to authenticated with check (public.is_class_owner(class_id));
create policy "ann delete" on public.class_announcements for delete to authenticated using (public.is_class_owner(class_id));
