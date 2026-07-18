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
