-- migration_feedback.sql
-- ---------------------------------------------------------------------------
-- Inbox for the "Send feedback" form in the Help centre (the "?" button).
-- Anyone signed in can file a report; only the author can read their own back.
-- Staff triage happens with the service role / SQL editor, which bypasses RLS.
--
-- Safe to re-run. Run in: Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  kind       text not null default 'other',  -- bug | idea | question | other
  message    text not null,
  email      text,                           -- optional reply-to
  page       text,                           -- route the form was opened from
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback insert" on public.feedback;
drop policy if exists "feedback read own" on public.feedback;

-- File feedback as yourself (user_id must match, or be left null for anonymous).
create policy "feedback insert" on public.feedback
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Read back only your own submissions.
create policy "feedback read own" on public.feedback
  for select using (user_id = auth.uid());
