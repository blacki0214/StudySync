-- ============================================================================
-- Migration — Phase 3: class-scoped content + assignments + gradebook
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor (after migration_classes.sql).
-- Idempotent and safe to re-run. A fresh schema.sql already includes all of this.
-- ============================================================================

-- 1. Link notes to a class (documents.class_id already exists) ---------------
alter table public.notes add column if not exists class_id uuid references public.classes(id) on delete set null;

-- 2. Assignments + submissions + quiz attempts ------------------------------
create table if not exists public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid references public.classes(id) on delete cascade,
  author_id          uuid references public.profiles(id) on delete set null,
  title              text not null,
  instructions       text,
  type               text default 'text',     -- text | quiz
  source_document_id uuid references public.documents(id) on delete set null,
  due_at             timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  content       text,
  answers       jsonb default '[]',
  score         int,
  total         int,
  graded        boolean default false,
  created_at    timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create table if not exists public.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  class_id    uuid references public.classes(id) on delete set null,
  score       int,
  total       int,
  created_at  timestamptz not null default now()
);

-- 3. Helper: is the current user the owner of an assignment's class? ---------
create or replace function public.is_assignment_owner(aid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.assignments a
    join public.classes c on c.id = a.class_id
    where a.id = aid and c.owner_id = auth.uid()
  );
$$;

-- 4. Broaden document reads to class members --------------------------------
drop policy if exists "doc owner read" on public.documents;
create policy "doc owner read" on public.documents for select
  using (owner_id = auth.uid() or visibility = 'public' or public.is_class_member(class_id));

-- 5. RLS for the new tables -------------------------------------------------
alter table public.assignments   enable row level security;
alter table public.submissions   enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "assign read"   on public.assignments;
drop policy if exists "assign write"  on public.assignments;
drop policy if exists "assign update" on public.assignments;
drop policy if exists "assign delete" on public.assignments;
create policy "assign read"   on public.assignments for select using (public.is_class_member(class_id));
create policy "assign write"  on public.assignments for insert to authenticated with check (public.is_class_owner(class_id));
create policy "assign update" on public.assignments for update to authenticated using (public.is_class_owner(class_id));
create policy "assign delete" on public.assignments for delete to authenticated using (public.is_class_owner(class_id));

drop policy if exists "sub read"   on public.submissions;
drop policy if exists "sub insert" on public.submissions;
drop policy if exists "sub update" on public.submissions;
drop policy if exists "sub delete" on public.submissions;
create policy "sub read"   on public.submissions for select using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));
create policy "sub insert" on public.submissions for insert to authenticated with check (user_id = auth.uid());
create policy "sub update" on public.submissions for update to authenticated using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));
create policy "sub delete" on public.submissions for delete to authenticated using (user_id = auth.uid() or public.is_assignment_owner(assignment_id));

drop policy if exists "attempt read"   on public.quiz_attempts;
drop policy if exists "attempt insert" on public.quiz_attempts;
create policy "attempt read"   on public.quiz_attempts for select using (user_id = auth.uid() or public.is_class_owner(class_id));
create policy "attempt insert" on public.quiz_attempts for insert to authenticated with check (user_id = auth.uid());
