-- migration_class_quizzes.sql
-- ---------------------------------------------------------------------------
-- Phase 4 of the teacher/school extension: teacher-authored class quizzes and
-- student results (feeds the gradebook). Questions are stored as jsonb. Safe to
-- run more than once. Run after migration_class_workspace.

create table if not exists public.class_quizzes (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  owner_id   uuid references auth.users (id) on delete set null,
  title      text not null,
  questions  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references public.class_quizzes (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  score    int not null default 0,
  total    int not null default 0,
  taken_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

create index if not exists idx_class_quizzes_class on public.class_quizzes (class_id);
create index if not exists idx_quiz_results_quiz on public.quiz_results (quiz_id);

alter table public.class_quizzes enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists "read quizzes" on public.class_quizzes;
create policy "read quizzes" on public.class_quizzes for select to authenticated using (true);
drop policy if exists "write quizzes" on public.class_quizzes;
create policy "write quizzes" on public.class_quizzes for all to authenticated using (true) with check (true);

drop policy if exists "read results" on public.quiz_results;
create policy "read results" on public.quiz_results for select to authenticated using (true);
drop policy if exists "write own results" on public.quiz_results;
create policy "write own results" on public.quiz_results
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
