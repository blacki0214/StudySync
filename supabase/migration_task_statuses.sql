-- migration_task_statuses.sql
-- ---------------------------------------------------------------------------
-- Customizable task statuses (ClickUp-style). Each board (personal or subject)
-- can keep its own ordered set of statuses; users can also save reusable
-- templates. Statuses are stored as JSON: [{ id, name, color, group }].
--
-- Run after migration_tasks.sql. Safe to re-run.

-- Active status set per board -------------------------------------------------
create table if not exists public.task_status_sets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade,
  subject_id   uuid references public.subjects (id) on delete cascade,  -- null = personal board
  template_key text,                                                    -- built-in key or null when custom
  statuses     jsonb not null,
  updated_at   timestamptz not null default now()
);
-- One set per personal board and one per subject board.
create unique index if not exists tss_personal on public.task_status_sets (owner_id) where subject_id is null;
create unique index if not exists tss_subject  on public.task_status_sets (subject_id) where subject_id is not null;

alter table public.task_status_sets enable row level security;
drop policy if exists "tss read"   on public.task_status_sets;
drop policy if exists "tss write"  on public.task_status_sets;
drop policy if exists "tss update" on public.task_status_sets;
-- Personal sets are private to the owner; subject sets are shared with everyone.
create policy "tss read"   on public.task_status_sets for select using (auth.uid() = owner_id or subject_id is not null);
create policy "tss write"  on public.task_status_sets for insert to authenticated with check (auth.uid() = owner_id or subject_id is not null);
create policy "tss update" on public.task_status_sets for update to authenticated using (auth.uid() = owner_id or subject_id is not null);

-- User-saved status templates -------------------------------------------------
create table if not exists public.task_status_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  statuses   jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists tst_owner on public.task_status_templates (owner_id);

alter table public.task_status_templates enable row level security;
drop policy if exists "tst read"   on public.task_status_templates;
drop policy if exists "tst insert" on public.task_status_templates;
drop policy if exists "tst delete" on public.task_status_templates;
create policy "tst read"   on public.task_status_templates for select using (owner_id = auth.uid());
create policy "tst insert" on public.task_status_templates for insert to authenticated with check (owner_id = auth.uid());
create policy "tst delete" on public.task_status_templates for delete to authenticated using (owner_id = auth.uid());
