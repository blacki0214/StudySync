-- ============================================================================
-- Migration — Notion-style task tracker
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent / safe to re-run.
-- A task is either PERSONAL (subject_id is null, private to its owner) or
-- SUBJECT-scoped (subject_id set, visible to everyone studying that subject).
-- ============================================================================

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references public.profiles(id) on delete cascade,
  subject_id    uuid references public.subjects(id) on delete cascade,   -- null = personal
  title         text not null default 'Untitled task',
  status        text not null default 'not_started',  -- not_started | in_progress | done
  priority      text not null default 'medium',       -- low | medium | high
  type          text not null default 'general',      -- general | feature | bugfix | polish | research
  due_date      date,
  description   text default '',
  assignee_id   uuid references public.profiles(id) on delete set null,
  assignee_name text,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_owner_idx   on public.tasks (owner_id);
create index if not exists tasks_subject_idx on public.tasks (subject_id);

-- Keep updated_at fresh on every write.
create or replace function public.touch_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_tasks_updated_at();

-- Live updates so boards stay in sync across collaborators.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

alter table public.tasks enable row level security;
drop policy if exists "tasks read"   on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks update" on public.tasks;
drop policy if exists "tasks delete" on public.tasks;
-- Personal tasks are private to the owner; subject tasks are shared.
create policy "tasks read"   on public.tasks for select using (auth.uid() = owner_id or subject_id is not null);
create policy "tasks insert" on public.tasks for insert to authenticated with check (auth.uid() = owner_id);
create policy "tasks update" on public.tasks for update to authenticated using (auth.uid() = owner_id or subject_id is not null);
create policy "tasks delete" on public.tasks for delete to authenticated using (auth.uid() = owner_id);
